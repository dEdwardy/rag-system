import { Body, Controller, Get, Param, Post, Query, Req, Res } from "@nestjs/common";
import {
  DEFAULT_AUTH_ACCESS_TOKEN_COOKIE_NAME,
  DEFAULT_AUTH_LOGIN_PROVENANCE_COOKIE_NAME,
  DEFAULT_AUTH_OAUTH_STATE_COOKIE_NAME,
  DEFAULT_AUTH_REFRESH_TOKEN_COOKIE_NAME
} from "./auth.constants";
import { buildCookie, buildExpiredCookie, readNamedCookie as readCookieValue } from "./auth-cookie.utils";
import { AuthRateLimit } from "./auth-rate-limit.decorator";
import type { ApiRequestWithAuthContext } from "./auth-identity.contract";
import { AuthenticatedRoute, PublicRoute } from "./auth-route-policy";
import { AuthRuntimeConfigService } from "./auth-runtime-config";
import { ZodValidationPipe } from "../../common/zod-validation.pipe";
import {
  LoginInput,
  OauthCallbackQueryInput,
  OauthProviderParamInput,
  loginSchema,
  oauthCallbackQuerySchema,
  oauthProviderParamSchema,
  PermissionCheckInput,
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
    @Body(new ZodValidationPipe(loginSchema)) input: LoginInput,
    @Res({ passthrough: true }) response: { setHeader: (name: string, value: string | string[]) => void }
  ) {
    const result = await this.authService.login({
      email: input.email,
      password: input.password
    });

    response.setHeader("Set-Cookie", [
      this.buildAccessTokenCookieValue(result.accessToken, result.accessTokenExpiresAt),
      this.buildRefreshTokenCookieValue(result.refreshToken, result.expiresAt),
      this.buildLoginProvenanceCookieValue(LOCAL_LOGIN_PROVENANCE_COOKIE_VALUE, result.expiresAt)
    ]);

    return {
      identity: result.identity,
      user: result.user,
      expiresAt: result.expiresAt,
      accessTokenExpiresAt: result.accessTokenExpiresAt
    };
  }

  @Post("refresh")
  @AuthRateLimit("refresh")
  async refresh(
    @Req()
    request: {
      headers?: {
        cookie?: string | string[];
      };
    },
    @Res({ passthrough: true }) response: { setHeader: (name: string, value: string | string[]) => void }
  ) {
    const result = await this.authService.refreshAccessToken({
      refreshToken: this.readNamedCookie(request.headers, this.resolveRefreshTokenCookieName())
    });

    response.setHeader("Set-Cookie", [
      this.buildAccessTokenCookieValue(result.accessToken, result.accessTokenExpiresAt),
      this.buildRefreshTokenCookieValue(result.refreshToken, result.expiresAt)
    ]);

    return {
      ok: true,
      identity: result.identity,
      user: result.user,
      expiresAt: result.accessTokenExpiresAt
    };
  }

  @Post("logout")
  async logout(
    @Req() request?: ApiRequestWithAuthContext,
    @Res({ passthrough: true }) response?: { setHeader: (name: string, value: string | string[]) => void }
  ) {
    await this.authService.logout();

    if (response != null) {
      response.setHeader("Set-Cookie", [
        this.buildClearAccessTokenCookieValue(),
        this.buildClearRefreshTokenCookieValue(),
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
    @Param(new ZodValidationPipe(oauthProviderParamSchema)) input: OauthProviderParamInput,
    @Res() response: {
      setHeader: (name: string, value: string | string[]) => void;
      redirect: (statusCode: number, url: string) => void;
    }
  ) {
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
    @Param(new ZodValidationPipe(oauthProviderParamSchema)) params: OauthProviderParamInput,
    @Query(new ZodValidationPipe(oauthCallbackQuerySchema)) query: OauthCallbackQueryInput,
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
    @Query(new ZodValidationPipe(oauthCallbackQuerySchema)) query: OauthCallbackQueryInput,
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
    params: OauthProviderParamInput,
    query: OauthCallbackQueryInput,
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
    const expectedState = this.readNamedCookie(request.headers, this.resolveOauthStateCookieName());
    const result = await this.authService.completeOauthProviderCallback({
      provider: params.provider,
      code: query.code,
      state: query.state,
      expectedState
    });

    response.setHeader("Set-Cookie", [
      this.buildClearOauthStateCookieValue(),
      this.buildAccessTokenCookieValue(result.accessToken, result.accessTokenExpiresAt),
      this.buildRefreshTokenCookieValue(result.refreshToken, result.expiresAt),
      this.buildLoginProvenanceCookieValue(params.provider, result.expiresAt)
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
  checkPermission(
    @Body(new ZodValidationPipe(permissionCheckSchema)) input: PermissionCheckInput,
    @Req() request?: ApiRequestWithAuthContext
  ) {
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
    return readCookieValue(headers, cookieName);
  }

  private resolveAccessTokenCookieName() {
    const cookieName = this.authRuntimeConfig.getConfig().accessTokenCookieName;
    return cookieName.length > 0 ? cookieName : DEFAULT_AUTH_ACCESS_TOKEN_COOKIE_NAME;
  }

  private resolveRefreshTokenCookieName() {
    const cookieName = this.authRuntimeConfig.getConfig().refreshTokenCookieName;
    return cookieName.length > 0 ? cookieName : DEFAULT_AUTH_REFRESH_TOKEN_COOKIE_NAME;
  }

  private resolveOauthStateCookieName() {
    const cookieName = this.authRuntimeConfig.getConfig().oauthStateCookieName;
    return cookieName.length > 0 ? cookieName : DEFAULT_AUTH_OAUTH_STATE_COOKIE_NAME;
  }

  private resolveLoginProvenanceCookieName() {
    const cookieName = this.authRuntimeConfig.getConfig().loginProvenanceCookieName;
    return cookieName.length > 0 ? cookieName : DEFAULT_AUTH_LOGIN_PROVENANCE_COOKIE_NAME;
  }

  private buildRefreshTokenCookieValue(token: string, expiresAtIso: string): string {
    return buildCookie({
      name: this.resolveRefreshTokenCookieName(),
      value: token,
      expires: new Date(expiresAtIso),
      httpOnly: true,
      sameSite: this.authRuntimeConfig.getConfig().cookieSameSite,
      secure: this.authRuntimeConfig.getConfig().cookieSecure
    });
  }

  private buildAccessTokenCookieValue(token: string, expiresAtIso: string): string {
    return buildCookie({
      name: this.resolveAccessTokenCookieName(),
      value: token,
      expires: new Date(expiresAtIso),
      httpOnly: true,
      sameSite: this.authRuntimeConfig.getConfig().cookieSameSite,
      secure: this.authRuntimeConfig.getConfig().cookieSecure
    });
  }

  private buildClearRefreshTokenCookieValue(): string {
    return buildExpiredCookie({
      name: this.resolveRefreshTokenCookieName(),
      sameSite: this.authRuntimeConfig.getConfig().cookieSameSite,
      secure: this.authRuntimeConfig.getConfig().cookieSecure
    });
  }

  private buildClearAccessTokenCookieValue(): string {
    return buildExpiredCookie({
      name: this.resolveAccessTokenCookieName(),
      sameSite: this.authRuntimeConfig.getConfig().cookieSameSite,
      secure: this.authRuntimeConfig.getConfig().cookieSecure
    });
  }

  private buildLoginProvenanceCookieValue(value: string, expiresAtIso: string): string {
    return buildCookie({
      name: this.resolveLoginProvenanceCookieName(),
      value,
      expires: new Date(expiresAtIso),
      httpOnly: true,
      sameSite: this.authRuntimeConfig.getConfig().cookieSameSite,
      secure: this.authRuntimeConfig.getConfig().cookieSecure
    });
  }

  private buildClearLoginProvenanceCookieValue(): string {
    return buildExpiredCookie({
      name: this.resolveLoginProvenanceCookieName(),
      sameSite: this.authRuntimeConfig.getConfig().cookieSameSite,
      secure: this.authRuntimeConfig.getConfig().cookieSecure
    });
  }

  private buildClearOauthStateCookieValue(): string {
    return buildExpiredCookie({
      name: this.resolveOauthStateCookieName(),
      sameSite: this.authRuntimeConfig.getConfig().cookieSameSite,
      secure: this.authRuntimeConfig.getConfig().cookieSecure
    });
  }
}
