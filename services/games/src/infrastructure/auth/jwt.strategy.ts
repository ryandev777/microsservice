import { Injectable } from "@nestjs/common";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import { passportJwtSecret } from "jwks-rsa";

export interface JwtPayload {
  sub: string;
  preferred_username?: string;
  [key: string]: unknown;
}

export interface AuthenticatedUser {
  playerId: string;
  username?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      algorithms: ["RS256"],
      issuer: process.env.KEYCLOAK_ISSUER,
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksUri: process.env.KEYCLOAK_JWKS_URI as string,
      }),
    });
  }

  validate(payload: JwtPayload): AuthenticatedUser {
    return { playerId: payload.sub, username: payload.preferred_username };
  }
}
