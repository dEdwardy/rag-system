import { SetMetadata } from "@nestjs/common";

export const AUTH_ROUTE_POLICY_KEY = "auth:route-policy";

export type AuthRoutePolicy = "public" | "authenticated";

export const PublicRoute = () => SetMetadata(AUTH_ROUTE_POLICY_KEY, "public" satisfies AuthRoutePolicy);

export const AuthenticatedRoute = () =>
  SetMetadata(AUTH_ROUTE_POLICY_KEY, "authenticated" satisfies AuthRoutePolicy);
