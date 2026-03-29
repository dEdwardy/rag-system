import { Body, Controller, Get, Post, Req, Res } from "@nestjs/common";
import { DEFAULT_AUTH_SESSION_COOKIE_NAME } from "./auth.constants";
import type { ApiRequestWithAuthContext } from "./auth-identity.contract";
import { AuthenticatedRoute, PublicRoute } from "./auth-route-policy";
import { loginSchema, permissionCheckSchema } from "./auth.schemas";
import { AuthService } from "./auth.service";

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
