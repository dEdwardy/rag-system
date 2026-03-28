import type { AuthIdentity } from "./auth-identity.contract";

export type ResourceAccessPolicyVersion = "owner_only_v1";

export type ResourceAccessDefaultStance = "deny_by_default";

export type ResourceAccessAction = "read" | "write";

export type ResourceKind = "knowledge_base" | "document" | "assistant" | "conversation" | "trace";

export type ResourceAccessIdentity = Pick<AuthIdentity, "tenantId" | "userId">;

export type ResourceAccessTarget = {
  kind: ResourceKind;
  resourceId: string;
  tenantId: string;
  ownerId: string | null;
};

export type ResourceAccessPolicyInput = {
  identity: ResourceAccessIdentity;
  action: ResourceAccessAction;
  resource: ResourceAccessTarget;
};

export type ResourceAccessDecisionReason =
  | "owner_match"
  | "tenant_mismatch"
  | "owner_mismatch"
  | "owner_unassigned"
  | "unsupported_action"
  | "unsupported_resource_kind";

export type ResourceAccessDecision = {
  allowed: boolean;
  reason: ResourceAccessDecisionReason;
  policy: ResourceAccessPolicyVersion;
};

const OWNER_ONLY_POLICY: ResourceAccessPolicyVersion = "owner_only_v1";
export const RESOURCE_ACCESS_DEFAULT_STANCE: ResourceAccessDefaultStance = "deny_by_default";

const SUPPORTED_RESOURCE_ACCESS_ACTIONS = new Set<ResourceAccessAction>(["read", "write"]);
const SUPPORTED_RESOURCE_KINDS = new Set<ResourceKind>([
  "knowledge_base",
  "document",
  "assistant",
  "conversation",
  "trace"
]);

export function evaluateOwnerResourceAccess(input: ResourceAccessPolicyInput): ResourceAccessDecision {
  if (!SUPPORTED_RESOURCE_ACCESS_ACTIONS.has(input.action)) {
    return {
      allowed: false,
      reason: "unsupported_action",
      policy: OWNER_ONLY_POLICY
    };
  }

  if (!SUPPORTED_RESOURCE_KINDS.has(input.resource.kind)) {
    return {
      allowed: false,
      reason: "unsupported_resource_kind",
      policy: OWNER_ONLY_POLICY
    };
  }

  if (input.resource.tenantId !== input.identity.tenantId) {
    return {
      allowed: false,
      reason: "tenant_mismatch",
      policy: OWNER_ONLY_POLICY
    };
  }

  if (input.resource.ownerId == null) {
    return {
      allowed: false,
      reason: "owner_unassigned",
      policy: OWNER_ONLY_POLICY
    };
  }

  if (input.resource.ownerId !== input.identity.userId) {
    return {
      allowed: false,
      reason: "owner_mismatch",
      policy: OWNER_ONLY_POLICY
    };
  }

  return {
    allowed: true,
    reason: "owner_match",
    policy: OWNER_ONLY_POLICY
  };
}
