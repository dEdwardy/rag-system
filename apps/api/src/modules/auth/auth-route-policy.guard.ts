import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import type { ApiRequestWithAuthContext } from "./auth-identity.contract";
import { AUTH_ROUTE_POLICY_KEY, type AuthRoutePolicy } from "./auth-route-policy";

@Injectable()
export class AuthRoutePolicyGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const routePolicy = this.reflector.getAllAndOverride<AuthRoutePolicy | undefined>(AUTH_ROUTE_POLICY_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (routePolicy !== "authenticated") {
      return true;
    }

    const request = context.switchToHttp().getRequest<ApiRequestWithAuthContext>();
    if (request?.authContext?.identity != null) {
      return true;
    }

    throw new UnauthorizedException("Authentication required.");
  }
}
