import { Body, Controller, Get, Param, Post, Query, Req, Res } from "@nestjs/common";
import {
  DEFAULT_AUTH_LOGIN_PROVENANCE_COOKIE_NAME,
  DEFAULT_AUTH_OAUTH_STATE_COOKIE_NAME,
  DEFAULT_AUTH_SESSION_COOKIE_NAME
} from "./auth.constants";
import { AuthRateLimit } from "./auth-rate-limit.decorator";
import type { ApiRequestWithAuthContext } from "./auth-identity.contract";
import { AuthenticatedRoute, PublicRoute } from "./auth-route-policy";
import { AuthRuntimeConfigService } from "./auth-runtime-config";
import {
  loginSchema,
  oauthCallbackQuerySchema,
  oauthProviderParamSchema,
  permissionCheckSchema
} from "./auth.schemas";
import { AuthService } from "./auth.service";

const LOCAL_LOGIN_PROVENANCE_COOKIE_VALUE = "local";

export const AUTH_OAUTH_PROVIDER_ROUTE_SHAPES = {
  start: "/auth/oauth/:provider/start",
  callback: "/auth/oauth/:provider/callback"
} as const;

@PublicRoute()
@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authRuntimeConfig: AuthRuntimeConfigService = new AuthRuntimeConfigService()
  ) {}

  @Post("login")
  @AuthRateLimit("login")
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: { setHeader: (name: string, value: string | string[]) => void }
  ) {
    const input = loginSchema.parse(body);
    const result = await this.authService.login({
      email: input.email,
      password: input.password
    });

    response.setHeader("Set-Cookie", [
      this.buildSessionCookieValue(result.identity.sessionId, result.expiresAt),
      this.buildLoginProvenanceCookieValue(LOCAL_LOGIN_PROVENANCE_COOKIE_VALUE, result.expiresAt)
    ]);

    return result;
  }

  @Post("logout")
  async logout(
    @Req() request?: ApiRequestWithAuthContext,
    @Res({ passthrough: true }) response?: { setHeader: (name: string, value: string | string[]) => void }
  ) {
    await this.authService.logout({
      sessionId: request?.authContext?.identity?.sessionId
    });

    if (response != null) {
      response.setHeader("Set-Cookie", [
        this.buildClearSessionCookieValue(),
        this.buildClearLoginProvenanceCookieValue()
      ]);
    }

    return {
      ok: true
    };
  }

  @Get("providers")
  providers() {
    return this.authService.getAuthProviders();
  }

  @Get("oauth/:provider/start")
  @AuthRateLimit("oauth_start")
  async oauthProviderStart(
    @Param() params: unknown,
    @Res() response: {
      setHeader: (name: string, value: string | string[]) => void;
      redirect: (statusCode: number, url: string) => void;
    }
  ) {
    const input = oauthProviderParamSchema.parse(params);
    const start = await this.authService.startOauthProvider({
      provider: input.provider
    });

    const safeState = encodeURIComponent(start.state);
    response.setHeader(
      "Set-Cookie",
      `${start.stateCookieName}=${safeState}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${start.stateTtlSeconds}`
    );
    response.redirect(302, start.redirectUrl);
  }

  @Get("oauth/:provider/callback")
  @AuthRateLimit("oauth_callback")
  async oauthProviderCallback(
    @Param() params: unknown,
    @Query() query: unknown,
    @Req()
    request: {
      headers?: {
        cookie?: string | string[];
      };
    },
    @Res() response: {
      setHeader: (name: string, value: string | string[]) => void;
      redirect: (statusCode: number, url: string) => void;
    }
  ) {
    return this.completeOauthProviderCallback(params, query, request, response);
  }

  @Get("github/callback")
  @AuthRateLimit("oauth_callback")
  async githubOauthCallback(
    @Query() query: unknown,
    @Req()
    request: {
      headers?: {
        cookie?: string | string[];
      };
    },
    @Res() response: {
      setHeader: (name: string, value: string | string[]) => void;
      redirect: (statusCode: number, url: string) => void;
    }
  ) {
    return this.completeOauthProviderCallback({ provider: "github" }, query, request, response);
  }

  private async completeOauthProviderCallback(
    params: unknown,
    query: unknown,
    request: {
      headers?: {
        cookie?: string | string[];
      };
    },
    response: {
      setHeader: (name: string, value: string | string[]) => void;
      redirect: (statusCode: number, url: string) => void;
    }
  ) {
    const providerInput = oauthProviderParamSchema.parse(params);
    const callbackInput = oauthCallbackQuerySchema.parse(query);

    const expectedState = this.readNamedCookie(request.headers, this.resolveOauthStateCookieName());
    const result = await this.authService.completeOauthProviderCallback({
      provider: providerInput.provider,
      code: callbackInput.code,
      state: callbackInput.state,
      expectedState
    });

    response.setHeader("Set-Cookie", [
      this.buildClearOauthStateCookieValue(),
      this.buildSessionCookieValue(result.identity.sessionId, result.expiresAt),
      this.buildLoginProvenanceCookieValue(providerInput.provider, result.expiresAt)
    ]);
    response.redirect(302, this.resolveOauthSuccessRedirectUrl());
  }

  private resolveOauthSuccessRedirectUrl(): string {
    return this.authRuntimeConfig.getConfig().oauthSuccessRedirectUrl;
  }

  @Get("me")
  @AuthenticatedRoute()
  me(
    @Req()
    request?:
      | (ApiRequestWithAuthContext & {
          headers?: {
            cookie?: string | string[];
          };
        })
      | undefined
  ) {
    return this.authService.getMe({
      authContext: request?.authContext,
      loginProvenanceHint: this.readNamedCookie(request?.headers, this.resolveLoginProvenanceCookieName())
    });
  }

  @Post("permissions/check")
  @AuthenticatedRoute()
  checkPermission(@Body() body: unknown, @Req() request?: ApiRequestWithAuthContext) {
    const input = permissionCheckSchema.parse(body);

    return this.authService.checkPermission({
      authContext: request?.authContext,
      action: input.action,
      resource: input.resource
    });
  }

  private readNamedCookie(
    headers: {
      cookie?: string | string[];
    } | undefined,
    cookieName: string
  ): string | null {
    const rawCookieHeader = this.readCookieHeader(headers);
    if (rawCookieHeader == null) {
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

      try {
        const decoded = decodeURIComponent(value);
        return decoded.length > 0 ? decoded : null;
      } catch {
        return null;
      }
    }

    return null;
  }

  private readCookieHeader(
    headers: {
      cookie?: string | string[];
    } | undefined
  ): string | null {
    const rawCookie = headers?.cookie;
    if (typeof rawCookie === "string") {
      const trimmed = rawCookie.trim();
      return trimmed.length > 0 ? trimmed : null;
    }

    if (Array.isArray(rawCookie)) {
      const joined = rawCookie.join(";").trim();
      return joined.length > 0 ? joined : null;
    }

    return null;
  }

  private resolveCookieName() {
    const cookieName = this.authRuntimeConfig.getConfig().sessionCookieName;
    return cookieName.length > 0 ? cookieName : DEFAULT_AUTH_SESSION_COOKIE_NAME;
  }

  private resolveOauthStateCookieName() {
    const cookieName = this.authRuntimeConfig.getConfig().oauthStateCookieName;
    return cookieName.length > 0 ? cookieName : DEFAULT_AUTH_OAUTH_STATE_COOKIE_NAME;
  }

  private resolveLoginProvenanceCookieName() {
    const cookieName = this.authRuntimeConfig.getConfig().loginProvenanceCookieName;
    return cookieName.length > 0 ? cookieName : DEFAULT_AUTH_LOGIN_PROVENANCE_COOKIE_NAME;
  }

  private buildSessionCookieValue(sessionId: string | null, expiresAtIso: string): string {
    const cookieName = this.resolveCookieName();
    const safeSessionId = encodeURIComponent(sessionId ?? "");
    const expiresAt = new Date(expiresAtIso).toUTCString();
    return `${cookieName}=${safeSessionId}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt}`;
  }

  private buildClearSessionCookieValue(): string {
    const cookieName = this.resolveCookieName();
    return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }

  private buildLoginProvenanceCookieValue(value: string, expiresAtIso: string): string {
    const cookieName = this.resolveLoginProvenanceCookieName();
    const safeValue = encodeURIComponent(value);
    const expiresAt = new Date(expiresAtIso).toUTCString();
    return `${cookieName}=${safeValue}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt}`;
  }

  private buildClearLoginProvenanceCookieValue(): string {
    const cookieName = this.resolveLoginProvenanceCookieName();
    return `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }

  private buildClearOauthStateCookieValue(): string {
    const stateCookieName = this.resolveOauthStateCookieName();
    return `${stateCookieName}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`;
  }
}
