import { Injectable, Logger } from "@nestjs/common";
import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
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

interface DecodedPlayer {
  playerId: string;
  username: string;
}

async function bestEffortDecodePlayer(token: string): Promise<DecodedPlayer | null> {
  try {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === "string" || !decoded.header.kid) {
      return null;
    }
    const publicKey = await getSigningKey(decoded.header.kid);
    const verified = jwt.verify(token, publicKey, {
      algorithms: ["RS256"],
      issuer: process.env.KEYCLOAK_ISSUER,
    }) as { sub?: string; preferred_username?: string };
    if (!verified.sub) {
      return null;
    }
    return { playerId: verified.sub, username: verified.preferred_username ?? verified.sub };
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
export class GameGateway implements RoundBroadcaster, OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(GameGateway.name);

  // playerId -> { username, socketCount }. socketCount handles a player with
  // multiple tabs open — they only leave the "online" list once every tab
  // has disconnected, not on the first one.
  private readonly onlinePlayers = new Map<string, { username: string; socketCount: number }>();

  @WebSocketServer()
  server!: Server;

  constructor(private readonly getCurrentRound: GetCurrentRoundUseCase) {}

  // RoundLifecycleScheduler drives exactly one round for the whole service —
  // there's no per-room isolation to provide, so this broadcasts to every
  // connected client. A `round:${roundId}` room was tried instead, but
  // sockets only ever joined it once at connection time (see
  // handleConnection below) and were never moved into the *next* round's
  // room when one started, so every client silently stopped receiving
  // events the moment the round it connected during ended.
  broadcastToRound(_roundId: string, event: string, payload: Record<string, unknown>): void {
    this.server.emit(event, payload);
  }

  emitToPlayer(playerId: string, event: string, payload: Record<string, unknown>): void {
    this.server.to(`player:${playerId}`).emit(event, payload);
  }

  async handleConnection(socket: Socket): Promise<void> {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (token) {
        const decoded = await bestEffortDecodePlayer(token);
        if (decoded) {
          socket.data.playerId = decoded.playerId;
          await socket.join(`player:${decoded.playerId}`);
          this.markOnline(decoded.playerId, decoded.username);
        }
      }

      socket.emit("players:online", this.onlinePlayersSnapshot());

      const current = await this.getCurrentRound.execute();
      if (current) {
        socket.emit("round:snapshot", { round: current });
      }
    } catch (error) {
      this.logger.warn(`handleConnection error: ${(error as Error).message}`);
    }
  }

  handleDisconnect(socket: Socket): void {
    const playerId = socket.data.playerId as string | undefined;
    if (playerId) {
      this.markOffline(playerId);
    }
  }

  private markOnline(playerId: string, username: string): void {
    const existing = this.onlinePlayers.get(playerId);
    if (existing) {
      existing.socketCount += 1;
    } else {
      this.onlinePlayers.set(playerId, { username, socketCount: 1 });
    }
    this.server.emit("players:online", this.onlinePlayersSnapshot());
  }

  private markOffline(playerId: string): void {
    const existing = this.onlinePlayers.get(playerId);
    if (!existing) {
      return;
    }
    existing.socketCount -= 1;
    if (existing.socketCount <= 0) {
      this.onlinePlayers.delete(playerId);
    }
    this.server.emit("players:online", this.onlinePlayersSnapshot());
  }

  private onlinePlayersSnapshot(): { count: number; players: Array<{ playerId: string; username: string }> } {
    const players = Array.from(this.onlinePlayers.entries()).map(([playerId, { username }]) => ({
      playerId,
      username,
    }));
    return { count: players.length, players };
  }
}
