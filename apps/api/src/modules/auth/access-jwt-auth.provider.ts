import { Injectable } from "@nestjs/common";
import type { AuthIdentity } from "./auth-identity.contract";
import type { AuthIdentityProvider, AuthProviderRequest } from "./auth-provider.contract";
import { AuthRuntimeConfigService } from "./auth-runtime-config";
import { readNamedCookie } from "./auth-cookie.utils";
import { verifyAccessJwt } from "./access-jwt";

@Injectable()
export class AccessJwtAuthProvider implements AuthIdentityProvider {
  constructor(
    private readonly authRuntimeConfig: AuthRuntimeConfigService = new AuthRuntimeConfigService()
  ) {}

  async resolveIdentity(input: { request: AuthProviderRequest }): Promise<AuthIdentity | null> {
    const config = this.authRuntimeConfig.getConfig();
    if (config.accessJwtSecret.length === 0) {
      return null;
    }

    const token = readNamedCookie(input.request.headers, config.accessTokenCookieName);
    if (token == null) {
      return null;
    }

    const payload = verifyAccessJwt({
      token,
      secret: config.accessJwtSecret
    });
    if (payload == null) {
      return null;
    }

    return {
      userId: payload.sub,
      tenantId: payload.tenantId,
      role: payload.role,
      sessionId: payload.sid,
      authSource: "session"
    };
  }
}
