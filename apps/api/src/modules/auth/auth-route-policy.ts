import { SetMetadata } from "@nestjs/common";

export const AUTH_ROUTE_POLICY_KEY = "auth:route-policy";
export const AUTH_ACL_ROUTE_HOOK_KEY = "auth:acl-route-hook";

export type AuthRoutePolicy = "public" | "authenticated";
export type AuthAclRouteHookAction = "read" | "write";
export type AuthAclRouteHookTarget = "document" | "resource";

export type AuthAclRouteHook = {
  action: AuthAclRouteHookAction;
  target: AuthAclRouteHookTarget;
};

export const PublicRoute = () => SetMetadata(AUTH_ROUTE_POLICY_KEY, "public" satisfies AuthRoutePolicy);

export const AuthenticatedRoute = () =>
  SetMetadata(AUTH_ROUTE_POLICY_KEY, "authenticated" satisfies AuthRoutePolicy);

export const DocumentPermissionHook = (action: AuthAclRouteHookAction) =>
  SetMetadata(
    AUTH_ACL_ROUTE_HOOK_KEY,
    {
      action,
      target: "document"
    } satisfies AuthAclRouteHook
  );

export const ResourcePermissionHook = (action: AuthAclRouteHookAction) =>
  SetMetadata(
    AUTH_ACL_ROUTE_HOOK_KEY,
    {
      action,
      target: "resource"
    } satisfies AuthAclRouteHook
  );
