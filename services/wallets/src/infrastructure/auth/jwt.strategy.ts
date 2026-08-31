import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PassportStrategy } from "@nestjs/passport";
import { ExtractJwt, Strategy } from "passport-jwt";
import * as jwksRsa from "jwks-rsa";

export interface AuthenticatedPlayer {
  playerId: string;
  username?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ["RS256"],
      issuer: config.get<string>("KEYCLOAK_ISSUER"),
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: config.get<string>("KEYCLOAK_JWKS_URI") as string,
      }),
    });
  }

  validate(payload: { sub: string; preferred_username?: string }): AuthenticatedPlayer {
    return { playerId: payload.sub, username: payload.preferred_username };
  }
}
