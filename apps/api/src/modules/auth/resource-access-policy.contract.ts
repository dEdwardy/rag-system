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

const RESOURCE_ACCESS_DENIED_REASON_HINTS: Record<Exclude<ResourceAccessDecisionReason, "owner_match">, string> = {
  tenant_mismatch: "request tenant does not match resource tenant",
  owner_mismatch: "resource owner does not match current user",
  owner_unassigned: "resource has no assigned owner",
  unsupported_action: "requested action is not supported by the current policy baseline",
  unsupported_resource_kind: "resource kind is not supported by the current policy baseline"
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

export function buildResourceAccessDeniedHint(decision: ResourceAccessDecision): string {
  if (decision.allowed) {
    return `Access allowed by ${decision.policy} policy.`;
  }

  if (decision.reason === "owner_match") {
    return `Access blocked by ${decision.policy} policy.`;
  }

  const reasonHint = RESOURCE_ACCESS_DENIED_REASON_HINTS[decision.reason];
  return `Access blocked by ${decision.policy} policy (${decision.reason}: ${reasonHint}).`;
}
