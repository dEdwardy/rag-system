export const RESOURCE_ACCESS_POLICY_VERSION_VALUES = ["owner_only_v1"] as const;

export type ResourceAccessPolicyVersion = (typeof RESOURCE_ACCESS_POLICY_VERSION_VALUES)[number];

export const RESOURCE_ACCESS_DEFAULT_STANCE_VALUES = ["deny_by_default"] as const;

export type ResourceAccessDefaultStance = (typeof RESOURCE_ACCESS_DEFAULT_STANCE_VALUES)[number];

export const RESOURCE_ACCESS_ACTION_VALUES = ["read", "write"] as const;

export type ResourceAccessAction = (typeof RESOURCE_ACCESS_ACTION_VALUES)[number];

export const RESOURCE_KIND_VALUES = ["knowledge_base", "document", "assistant", "conversation", "trace"] as const;

export type ResourceKind = (typeof RESOURCE_KIND_VALUES)[number];

export type ResourceAccessIdentity = {
  tenantId: string;
  userId: string;
};

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

export const RESOURCE_ACCESS_DENY_REASON_VALUES = [
  "tenant_mismatch",
  "owner_mismatch",
  "owner_unassigned",
  "unsupported_action",
  "unsupported_resource_kind"
] as const;

export type ResourceAccessDenyReason = (typeof RESOURCE_ACCESS_DENY_REASON_VALUES)[number];

export type ResourceAccessDecisionReason = "owner_match" | ResourceAccessDenyReason;

export type ResourceAccessAllowedDecision = {
  allowed: true;
  reason: "owner_match";
  policy: ResourceAccessPolicyVersion;
};

export type ResourceAccessDeniedDecision = {
  allowed: false;
  reason: ResourceAccessDenyReason;
  policy: ResourceAccessPolicyVersion;
};

export type ResourceAccessDecision = ResourceAccessAllowedDecision | ResourceAccessDeniedDecision;
