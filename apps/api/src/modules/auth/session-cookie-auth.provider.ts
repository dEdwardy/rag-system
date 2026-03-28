import { Injectable } from "@nestjs/common";
import type { AuthIdentity } from "./auth-identity.contract";
import type { AuthIdentityProvider, AuthProviderRequest } from "./auth-provider.contract";

const DEFAULT_SESSION_COOKIE_NAME = "rag_session";

@Injectable()
export class SessionCookieAuthProvider implements AuthIdentityProvider {
  resolveIdentity(input: { request: AuthProviderRequest }): AuthIdentity | null {
    const sessionId = this.readSessionId(input.request.headers);
    if (sessionId == null) {
      return null;
    }

    const userId = this.readHeaderString(input.request.headers, "x-rag-user-id");
    const tenantId = this.readHeaderString(input.request.headers, "x-rag-tenant-id");
    if (userId == null || tenantId == null) {
      return null;
    }

    return {
      userId,
      tenantId,
      sessionId,
      authSource: "session"
    };
  }

  private readSessionId(headers?: AuthProviderRequest["headers"]): string | null {
    const rawCookieHeader = this.readHeaderString(headers, "cookie");
    if (rawCookieHeader == null) {
      return null;
    }

    const cookieName = (process.env.AUTH_SESSION_COOKIE_NAME ?? DEFAULT_SESSION_COOKIE_NAME).trim();
    if (!cookieName) {
      return null;
    }

    const pairs = rawCookieHeader.split(";");
    for (const pair of pairs) {
      const separatorIndex = pair.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = pair.slice(0, separatorIndex).trim();
      if (key !== cookieName) {
        continue;
      }

      const value = pair.slice(separatorIndex + 1).trim();
      if (!value) {
        return null;
      }

      return value;
    }

    return null;
  }

  private readHeaderString(headers: AuthProviderRequest["headers"], name: string): string | null {
    const rawValue = headers?.[name];
    if (typeof rawValue === "string") {
      const trimmed = rawValue.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (Array.isArray(rawValue)) {
      const joined = rawValue.join(",").trim();
      return joined.length > 0 ? joined : null;
    }

    return null;
  }
}
