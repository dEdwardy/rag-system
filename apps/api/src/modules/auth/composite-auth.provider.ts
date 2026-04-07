import { Injectable } from "@nestjs/common";
import type { AuthIdentity } from "./auth-identity.contract";
import type { AuthIdentityProvider, AuthProviderRequest } from "./auth-provider.contract";
import { AccessJwtAuthProvider } from "./access-jwt-auth.provider";
import { SessionCookieAuthProvider } from "./session-cookie-auth.provider";

@Injectable()
export class CompositeAuthProvider implements AuthIdentityProvider {
  constructor(
    private readonly accessJwtAuthProvider: AccessJwtAuthProvider,
    private readonly sessionCookieAuthProvider: SessionCookieAuthProvider
  ) {}

  async resolveIdentity(input: { request: AuthProviderRequest }): Promise<AuthIdentity | null> {
    const identityFromJwt = await this.accessJwtAuthProvider.resolveIdentity(input);
    if (identityFromJwt != null) {
      return identityFromJwt;
    }

    return this.sessionCookieAuthProvider.resolveIdentity(input);
  }
}
