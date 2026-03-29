import { Body, Controller, Get, Param, Post, Req, Res } from "@nestjs/common";
import { DEFAULT_AUTH_SESSION_COOKIE_NAME } from "./auth.constants";
import type { ApiRequestWithAuthContext } from "./auth-identity.contract";
import { AuthenticatedRoute, PublicRoute } from "./auth-route-policy";
import { loginSchema, oauthProviderParamSchema, permissionCheckSchema } from "./auth.schemas";
import { AuthService } from "./auth.service";

export const AUTH_OAUTH_PROVIDER_ROUTE_SHAPES = {
  start: "/auth/oauth/:provider/start",
  callback: "/auth/oauth/:provider/callback"
} as const;

@PublicRoute()
@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("login")
  async login(
    @Body() body: unknown,
    @Res({ passthrough: true }) response: { setHeader: (name: string, value: string | string[]) => void }
  ) {
    const input = loginSchema.parse(body);
    const result = await this.authService.login({
      email: input.email,
      password: input.password
    });

    this.setSessionCookie(response, result.identity.sessionId, result.expiresAt);

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
      this.clearSessionCookie(response);
    }

    return {
      ok: true
    };
  }

  @Get("oauth/:provider/start")
  oauthProviderStart(
    @Param() params: unknown,
    @Res() response: {
      setHeader: (name: string, value: string | string[]) => void;
      redirect: (statusCode: number, url: string) => void;
    }
  ) {
    const input = oauthProviderParamSchema.parse(params);
    const start = this.authService.startOauthProvider({
      provider: input.provider
    });

    const safeState = encodeURIComponent(start.state);
    response.setHeader(
      "Set-Cookie",
      `${start.stateCookieName}=${safeState}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${start.stateTtlSeconds}`
    );
    response.redirect(302, start.redirectUrl);
  }

  @Get("me")
  @AuthenticatedRoute()
  me(@Req() request?: ApiRequestWithAuthContext) {
    return this.authService.getMe({
      authContext: request?.authContext
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

  private setSessionCookie(
    response: { setHeader: (name: string, value: string | string[]) => void },
    sessionId: string | null,
    expiresAtIso: string
  ) {
    const cookieName = this.resolveCookieName();
    const safeSessionId = encodeURIComponent(sessionId ?? "");
    const expiresAt = new Date(expiresAtIso).toUTCString();

    response.setHeader("Set-Cookie", `${cookieName}=${safeSessionId}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt}`);
  }

  private clearSessionCookie(response: { setHeader: (name: string, value: string | string[]) => void }) {
    const cookieName = this.resolveCookieName();
    response.setHeader(
      "Set-Cookie",
      `${cookieName}=; Path=/; HttpOnly; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`
    );
  }

  private resolveCookieName() {
    const cookieName = (process.env.AUTH_SESSION_COOKIE_NAME ?? DEFAULT_AUTH_SESSION_COOKIE_NAME).trim();
    return cookieName.length > 0 ? cookieName : DEFAULT_AUTH_SESSION_COOKIE_NAME;
  }
}
