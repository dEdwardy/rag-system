import type { IncomingHttpHeaders } from "node:http";
import type { AuthIdentity } from "./auth-identity.contract";

export type AuthProviderRequest = {
  headers?: IncomingHttpHeaders;
};

export interface AuthIdentityProvider {
  resolveIdentity(input: { request: AuthProviderRequest }): Promise<AuthIdentity | null> | AuthIdentity | null;
}

export const AUTH_IDENTITY_PROVIDER = Symbol("AUTH_IDENTITY_PROVIDER");
