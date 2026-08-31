import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedPlayer } from "../../infrastructure/auth/jwt.strategy";

export const CurrentPlayer = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedPlayer }>();
  return request.user.playerId;
});
