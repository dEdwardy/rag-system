import { Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import type { IncomingHttpHeaders } from "node:http";
import { resolveCurrentAuthIdentity, type ApiRequestWithAuthContext } from "./auth-identity.contract";
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
    const identity = await this.authIdentityProvider.resolveIdentity({
      request: {
        headers: request.headers
      }
    });
    const currentIdentity = resolveCurrentAuthIdentity({ identity });

    request.authContext = {
      identity,
      currentIdentity
    };

    next();
  }
}
