import { ExecutionContext, createParamDecorator } from "@nestjs/common";
import type { AuthenticatedUser } from "../../infrastructure/auth/jwt.strategy";

export const CurrentPlayer = createParamDecorator((_data: unknown, ctx: ExecutionContext): string => {
  const request = ctx.switchToHttp().getRequest<{ user: AuthenticatedUser }>();
  return request.user.playerId;
});
