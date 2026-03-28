import { Inject, Optional, CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import {
  AUTH_ACL_GUARD_HOOK,
  NOOP_AUTH_ACL_GUARD_HOOK,
  type AuthAclGuardHook
} from "./auth-acl-guard-hook.contract";
import type { ApiRequestWithAuthContext } from "./auth-identity.contract";
import {
  AUTH_ACL_ROUTE_HOOK_KEY,
  AUTH_ROUTE_POLICY_KEY,
  type AuthAclRouteHook,
  type AuthRoutePolicy
} from "./auth-route-policy";

@Injectable()
export class AuthRoutePolicyGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Optional()
    @Inject(AUTH_ACL_GUARD_HOOK)
    private readonly aclGuardHook: AuthAclGuardHook = NOOP_AUTH_ACL_GUARD_HOOK
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const routePolicy = this.reflector.getAllAndOverride<AuthRoutePolicy | undefined>(AUTH_ROUTE_POLICY_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (routePolicy !== "authenticated") {
      return true;
    }

    const request = context.switchToHttp().getRequest<ApiRequestWithAuthContext>();
    if (request?.authContext?.identity == null) {
      throw new UnauthorizedException("Authentication required.");
    }

    const aclHook = this.reflector.getAllAndOverride<AuthAclRouteHook | undefined>(AUTH_ACL_ROUTE_HOOK_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (aclHook != null) {
      this.aclGuardHook({
        request,
        aclHook
      });
    }

    return true;
  }
}
