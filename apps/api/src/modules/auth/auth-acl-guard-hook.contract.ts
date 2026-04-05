import type { ApiRequestWithAuthContext } from "./auth-identity.contract";
import type { AuthAclRouteHook } from "./auth-route-policy";

export const AUTH_ACL_GUARD_HOOK = Symbol("AUTH_ACL_GUARD_HOOK");

export type AuthAclGuardHookInput = {
  request: ApiRequestWithAuthContext;
  aclHook: AuthAclRouteHook;
};

export type AuthAclGuardHook = (input: AuthAclGuardHookInput) => void;

export const NOOP_AUTH_ACL_GUARD_HOOK: AuthAclGuardHook = () => {};
