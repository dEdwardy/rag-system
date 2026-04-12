import { Injectable } from "@nestjs/common";
import type { AuthIdentity } from "./auth-identity.contract";
import type { AuthIdentityProvider, AuthProviderRequest } from "./auth-provider.contract";
import { AccessJwtAuthProvider } from "./access-jwt-auth.provider";

@Injectable()
export class CompositeAuthProvider implements AuthIdentityProvider {
  constructor(
    private readonly accessJwtAuthProvider: AccessJwtAuthProvider
  ) {}

  async resolveIdentity(input: { request: AuthProviderRequest }): Promise<AuthIdentity | null> {
    return this.accessJwtAuthProvider.resolveIdentity(input);
  }
}
