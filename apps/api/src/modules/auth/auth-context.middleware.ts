import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import type { IncomingHttpHeaders } from "node:http";
import { resolveCurrentAuthIdentity, type ApiRequestWithAuthContext } from "./auth-identity.contract";
import { isAuthDevDefaultUserModeEnabled } from "./auth.constants";
import { AUTH_IDENTITY_PROVIDER, type AuthIdentityProvider } from "./auth-provider.contract";

@Injectable()
export class AuthContextMiddleware implements NestMiddleware {
  constructor(
    @Inject(AUTH_IDENTITY_PROVIDER)
    private readonly authIdentityProvider: AuthIdentityProvider
  ) {}

  async use(
    request: ApiRequestWithAuthContext & { headers?: IncomingHttpHeaders },
    _response: unknown,
    next: () => void
  ) {
    const resolvedIdentity = await this.authIdentityProvider.resolveIdentity({
      request: {
        headers: request.headers
      }
    });
    const identity = resolvedIdentity ?? (isAuthDevDefaultUserModeEnabled() ? resolveCurrentAuthIdentity({}) : null);
    const currentIdentity = resolveCurrentAuthIdentity({ identity });

    request.authContext = {
      identity,
      currentIdentity
    };

    next();
  }
}
