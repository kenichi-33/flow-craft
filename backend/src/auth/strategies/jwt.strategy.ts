import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import * as jwksRsa from 'jwks-rsa';
import { JwtPayload, AuthUser } from '../types/user.interface';
import { TeamsService } from '../../modules/teams/teams.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private teamsService: TeamsService,
  ) {
    const keycloakUrl =
      configService.get<string>('KEYCLOAK_URL') || 'http://localhost:8081';
    const realm = configService.get<string>('KEYCLOAK_REALM') || 'workflow';

    const issuerUrl =
      configService.get<string>('KEYCLOAK_ISSUER_URL') || keycloakUrl;

    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      algorithms: ['RS256'],
      secretOrKeyProvider: jwksRsa.passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 5,
        jwksUri: `${keycloakUrl}/realms/${realm}/protocol/openid-connect/certs`,
      }),
      issuer: `${issuerUrl}/realms/${realm}`,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload.sub) {
      throw new UnauthorizedException('Invalid token');
    }

    return {
      id: payload.sub,
      username: payload.preferred_username,
      email: payload.email,
      name: payload.name,
      firstName: payload.given_name,
      lastName: payload.family_name,
      roles: payload.roles || [],
      groups: payload.groups || [],
      groupCodes: [
        ...(payload.groupCodes || payload.group_code || []),
        ...(await this.teamsService.getMyTeams(payload.preferred_username)).map(
          (t) => t.id,
        ),
      ],
      employeeId: payload.employeeId,
      displayName: payload.displayName,
    };
  }
}
