# Bastidores de um Crash Game: arquitetura, filas e por que Bun

> Material de apoio para post no LinkedIn. Escrito a partir da implementação real deste repositório (um desafio técnico de iGaming: backend em microsserviços + frontend em tempo real para um jogo estilo "crash").

---

## O que é iGaming, em uma frase

iGaming é a indústria de jogos de apostas online — cassinos, apostas esportivas, pôquer, e um gênero mais recente chamado **crash games**: um multiplicador sobe a partir de `1.00x` em tempo real e pode "crashar" a qualquer instante; quem sacou (cash out) antes do crash embolsa `aposta × multiplicador`, quem não sacou perde a aposta. É um domínio pequeno em regras, mas brutal em exigências não-funcionais: **dinheiro real, tempo real, e um adversário (o próprio jogador) tentando explorar qualquer brecha.**

Isso muda completamente o cálculo de risco de engenharia. Um bug de concorrência num app de lista de tarefas gera um card duplicado. O mesmo bug aqui gera um jogador sacando duas vezes o mesmo prêmio, ou um saldo que fica negativo. Não existe "corrige no próximo deploy" quando a falha é financeira.

## O problema, em uma frase

Construir o motor de um crash game: fase de apostas cronometrada, multiplicador subindo em tempo real, cash out a qualquer momento, resultado matematicamente comprovável (provably fair), e uma carteira que nunca pode ficar inconsistente — mesmo com dois serviços separados, filas de mensagens e picos de concorrência.

## Regras de negócio do jogo

1. Janela de apostas configurável (10s) — uma aposta por jogador por rodada.
2. O multiplicador começa em `1.00x` e sobe segundo `growthRate ^ (segundos decorridos)`.
3. Cash out a qualquer momento durante a rodada; pagamento = aposta × multiplicador **no instante em que o servidor recebe a requisição** — o multiplicador nunca é aceito do cliente, sempre recalculado no backend.
4. O crash point é sorteado matematicamente **antes** da rodada começar, mas só revelado depois que ela termina.
5. Aposta mínima/máxima, saldo insuficiente rejeita a aposta, saldo nunca fica negativo, sempre em centavos inteiros — zero ponto flutuante em dinheiro.

## Arquitetura: dois microsserviços que nunca se falam diretamente

```
Frontend (React) → Kong (API Gateway) → Game Service  ⇄ RabbitMQ ⇄  Wallet Service
                                              │                          │
                                          Postgres                  Postgres
                                          (games)                   (wallets)
```

**Game Service** cuida do ciclo de vida da rodada, do multiplicador e do algoritmo provably fair. **Wallet Service** cuida só de saldo — crédito, débito, nunca ponto flutuante. Eles **não trocam chamadas HTTP entre si**. Toda comunicação é assíncrona, via RabbitMQ, com dois exchanges dedicados (`games.events`, `wallets.events`).

Por que separar assim? Porque cada serviço tem um perfil de risco diferente. O Game Service pode reiniciar, escalar horizontalmente, ter bugs de UI de rodada — nada disso ameaça o dinheiro do jogador. O Wallet Service é o único lugar autorizado a mexer em saldo, e por isso é deliberadamente burro: ele não sabe o que é um "crash", só sabe debitar e creditar mediante eventos.

## A complexidade escondida: consistência entre serviços via fila

Isso é o cerne da avaliação técnica — e o cerne de qualquer sistema de pagamentos distribuído de verdade. Sem transação distribuída (não dá pra fazer um `COMMIT` que atravesse dois bancos Postgres diferentes), a única saída é **consistência eventual com garantias explícitas**:

- **Outbox transacional**: quando o Game Service cria uma aposta, ele grava a aposta *e* o evento a ser publicado (`bet.placed`) na **mesma transação** de banco. Se a rodada de apostas foi salva, o evento existe — e vice-versa. Nunca existe estado "apostei mas o evento se perdeu".
- **Relay assíncrono**: um worker separado faz polling na tabela de outbox a cada 200ms e publica no RabbitMQ, só marcando como publicado depois da confirmação do broker. Se o RabbitMQ cair, a mensagem fica pendente e é reenviada — **at-least-once delivery**.
- **Inbox no consumidor**: o lado que recebe (por exemplo, o Wallet Service processando `bet.placed`) registra o `messageId` já visto. Se a mesma mensagem chegar duas vezes (porque o relay reenviou), ela é ignorada na segunda vez — **exactly-once processing** do ponto de vista de efeito colateral.
- **Compensação (saga)**: se o débito falhar por saldo insuficiente, o Wallet Service publica `wallet.debit.failed`; o Game Service reage marcando a aposta como rejeitada e avisa **só o jogador afetado** via WebSocket privado — os demais jogadores nunca veem a tentativa fracassada.
- **Dead-letter queue**: mensagens que falham no processamento (não no saldo — num erro de fato) vão para uma fila morta em vez de travar o consumidor ou serem descartadas silenciosamente. Isso é auditável: dá pra saber exatamente o que não foi processado e por quê.

Esse é o tipo de problema que separa "sei desenhar um CRUD" de "sei desenhar um sistema que mexe em dinheiro de verdade". Cada aposta passa por no mínimo dois saltos de fila (Game → Wallet → Game) antes de ser confirmada visualmente — e o jogador vê isso como uma resposta instantânea, porque o pipeline inteiro roda em dezenas de milissegundos.

## Segurança em microsserviços de iGaming: superfícies que um monólito não tem

Cada fronteira entre serviços é uma superfície de ataque:

- **Autenticação descentralizada**: os dois serviços validam o JWT independentemente contra o JWKS do Keycloak (nunca confiam em claims sem assinatura verificada) — não existe um "gateway confia, serviço não checa".
- **Multiplicador nunca confiado do cliente**: o cash out recalcula o multiplicador no servidor no instante exato da requisição. Sem isso, qualquer um com DevTools aberto poderia forjar um multiplicador maior.
- **Resultado oculto até o momento certo**: o crash point já existe no banco desde o início da rodada (é assim que o algoritmo funciona), mas a API nunca o expõe antes do crash — a garantia de que "o resultado não foi manipulado depois que você apostou" depende inteiramente dessa disciplina de não vazar o dado antes da hora.
- **Idempotência como requisito de segurança, não só de correção**: numa fila de mensagens, reentrega é normal. Sem proteção de idempotência (inbox), um reenvio de `wallet.credit.succeeded` creditaria o jogador duas vezes — um exploit trivial de duplicar saldo, não um bug cosmético.
- **CORS e gateway como perímetro único**: todo tráfego do browser passa pelo Kong, que é o único lugar que precisa saber quem tem permissão de chamar o quê — os serviços internos não ficam expostos diretamente.

## Provably fair: prova matemática, não "confia em mim"

O crash point de cada rodada é gerado assim:

1. O servidor sorteia um `serverSeed` secreto e publica só o hash SHA-256 dele **antes** da fase de apostas abrir — um compromisso público que não revela nada.
2. No fim da rodada, o `serverSeed` é revelado, e o crash point é recalculado via `HMAC-SHA256(serverSeed, clientSeed:nonce)`.
3. Qualquer jogador pode pegar o `serverSeed` revelado, recalcular o HMAC, e confirmar independentemente que o crash point bateu — e que `SHA256(serverSeed)` bate com o hash publicado antes da rodada começar.

É o mesmo princípio usado por casas de apostas sérias no mercado: o jogador não precisa confiar na palavra da casa, ele **verifica matematicamente**.

## Por que Bun

Bun não foi escolhido por modismo — ele resolve três atritos concretos de um monorepo de microsserviços em TypeScript:

- **Workspaces nativos e instalação única**: um `bun install` na raiz resolve as dependências dos dois serviços NestJS e do frontend, sem a complexidade extra de ferramentas como Lerna/Nx só para isso.
- **Test runner embutido, rápido, sem transpile step separado**: `bun test` roda os testes unitários e de domínio direto em TypeScript, sem configurar Jest/ts-jest. Isso importa quando o suite de testes cobre invariantes financeiras (saldo nunca negativo, transições de estado da rodada) que você quer rodar o tempo todo, não só no CI.
- **Runtime mais rápido para I/O-bound workloads**: um crash game em tempo real é dominado por I/O — sockets abertos, mensagens de fila, polling de outbox a cada 200ms. O ecossistema Bun tem crescido rápido justamente nesse nicho (runtimes de borda, backends orientados a eventos), com compatibilidade cada vez maior com o ecossistema Node — o que permite usar NestJS, Prisma e amqplib normalmente, sem reescrever nada, e ainda ganhar o runtime mais enxuto por baixo.

O ganho real não é "mais rápido" em abstrato — é menos ferramentas de build/teste diferentes para manter sincronizadas entre dois serviços e um frontend que vivem no mesmo repositório.

## Por que essas outras ferramentas

- **NestJS + DDD** (domain/application/infrastructure/presentation): força a separar "regra de negócio da aposta" de "como isso chega via HTTP ou fila". Isso é o que permite testar `Round.transitionToRunning()` sem subir Postgres, RabbitMQ ou HTTP nenhum.
- **RabbitMQ com exchanges topic**: dá roteamento por `routingKey` (ex.: `wallet.debit.succeeded` vs `wallet.debit.failed`) sem o consumidor precisar inspecionar o corpo da mensagem para saber o que fazer — o roteamento já é a decisão.
- **Prisma + Postgres com `BIGINT`/`NUMERIC`**: dinheiro como inteiro de centavos, nunca `float`, é o requisito não-negociável número um de qualquer sistema financeiro — um erro de arredondamento de ponto flutuante em produção é dinheiro sendo criado ou destruído silenciosamente.
- **Kong declarativo**: um único arquivo versionado define todo o roteamento e CORS — sem mais um banco de dados de configuração de gateway para manter no ar.
- **Keycloak (OIDC)**: terceiriza autenticação para um IdP padrão de mercado em vez de reinventar login/token — os dois serviços só precisam saber validar um JWT contra um JWKS.
- **socket.io**: canal servidor→cliente para o multiplicador em tempo real, com fallback de transporte e rooms nativas para isolar broadcast por rodada e por jogador — essencial para o evento privado de aposta rejeitada não vazar para os outros participantes.

---

*Este material descreve a implementação técnica de um desafio de engenharia iGaming — não constitui, promove ou está associado a nenhuma operação real de apostas.*
