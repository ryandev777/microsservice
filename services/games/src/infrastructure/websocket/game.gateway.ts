import { Injectable, Logger } from "@nestjs/common";
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";
import type { RoundBroadcaster } from "../../application/ports/round-broadcaster.port";
import { GetCurrentRoundUseCase } from "../../application/use-cases/get-current-round.use-case";

const jwks = jwksClient({
  jwksUri: process.env.KEYCLOAK_JWKS_URI ?? "http://localhost:8080/realms/crash-game/protocol/openid-connect/certs",
  cache: true,
  rateLimit: true,
});

function getSigningKey(kid: string): Promise<string> {
  return new Promise((resolve, reject) => {
    jwks.getSigningKey(kid, (err, key) => {
      if (err || !key) {
        reject(err ?? new Error("Signing key not found"));
        return;
      }
      resolve(key.getPublicKey());
    });
  });
}

async function bestEffortDecodePlayerId(token: string): Promise<string | null> {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === "string" || !decoded.header.kid) {
      return null;
    }
    const publicKey = await getSigningKey(decoded.header.kid);
    const verified = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      issuer: process.env.KEYCLOAK_ISSUER,
    }) as { sub?: string };
    return verified.sub ?? null;
  } catch {
    return null;
  }
}

@Injectable()
@WebSocketGateway({
  // Kong forwards the "/games" prefix unchanged (strip_path: false, see
  // docker/kong/kong.yml), so the engine.io endpoint must live at
  // "/games/socket.io" to match what the browser requests through Kong
  // (http://localhost:8000/games, path: "/games/socket.io" on the client).
  // Default namespace ("/") — the path segment already disambiguates this
  // service, a custom namespace on top of it is unnecessary.
  path: "/games/socket.io",
  cors: { origin: "*" },
})
export class GameGateway implements RoundBroadcaster, OnGatewayConnection {
  private readonly logger = new Logger(GameGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly getCurrentRound: GetCurrentRoundUseCase) {}

  broadcastToRound(roundId: string, event: string, payload: Record<string, unknown>): void {
    this.server.to(`round:${roundId}`).emit(event, payload);
  }

  emitToPlayer(playerId: string, event: string, payload: Record<string, unknown>): void {
    this.server.to(`player:${playerId}`).emit(event, payload);
  }

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (token) {
        const playerId = await bestEffortDecodePlayerId(token);
        if (playerId) {
          await socket.join(`player:${playerId}`);
        }
      }

      const current = await this.getCurrentRound.execute();
      if (current) {
        await socket.join(`round:${current.roundId}`);
        socket.emit("round:snapshot", { round: current });
      }
    } catch (error) {
      this.logger.warn(`handleConnection error: ${(error as Error).message}`);
    }
  }
}
