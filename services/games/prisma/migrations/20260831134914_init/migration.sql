-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'BETTING',
    "server_seed" TEXT NOT NULL,
    "server_seed_hash" TEXT NOT NULL,
    "client_seed" TEXT NOT NULL,
    "nonce" INTEGER NOT NULL,
    "crash_point" DECIMAL(10,2) NOT NULL,
    "algorithm_version" TEXT NOT NULL DEFAULT 'HMAC_SHA256_V1',
    "betting_ends_at" TIMESTAMP(3) NOT NULL,
    "started_at" TIMESTAMP(3),
    "crashed_at" TIMESTAMP(3),
    "settled_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bets" (
    "id" TEXT NOT NULL,
    "round_id" TEXT NOT NULL,
    "player_id" TEXT NOT NULL,
    "amount_cents" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLACED_PENDING',
    "cashout_multiplier" DECIMAL(10,2),
    "payout_cents" BIGINT,
    "cashout_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbox_messages" (
    "id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "outbox_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbox_messages" (
    "message_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "consumed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_messages_pkey" PRIMARY KEY ("message_id")
);

-- CreateIndex
CREATE INDEX "rounds_status_idx" ON "rounds"("status");

-- CreateIndex
CREATE INDEX "rounds_created_at_idx" ON "rounds"("created_at");

-- CreateIndex
CREATE INDEX "bets_player_id_idx" ON "bets"("player_id");

-- CreateIndex
CREATE UNIQUE INDEX "bets_round_id_player_id_key" ON "bets"("round_id", "player_id");

-- CreateIndex
CREATE INDEX "outbox_messages_published_at_idx" ON "outbox_messages"("published_at");

-- AddForeignKey
ALTER TABLE "bets" ADD CONSTRAINT "bets_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
