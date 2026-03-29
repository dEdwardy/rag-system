export const RESOURCE_ACCESS_POLICY_VERSION_VALUES = ["owner_only_v1"] as const;

export type ResourceAccessPolicyVersion = (typeof RESOURCE_ACCESS_POLICY_VERSION_VALUES)[number];

export const RESOURCE_ACCESS_DEFAULT_STANCE_VALUES = ["deny_by_default"] as const;

export type ResourceAccessDefaultStance = (typeof RESOURCE_ACCESS_DEFAULT_STANCE_VALUES)[number];

export const RESOURCE_ACCESS_ACTION_VALUES = ["read", "write"] as const;

export type ResourceAccessAction = (typeof RESOURCE_ACCESS_ACTION_VALUES)[number];

export const RESOURCE_KIND_VALUES = ["knowledge_base", "document", "assistant", "conversation", "trace"] as const;

export type ResourceKind = (typeof RESOURCE_KIND_VALUES)[number];

export const RESOURCE_VISIBILITY_VALUES = ["private", "public"] as const;

export type ResourceVisibility = (typeof RESOURCE_VISIBILITY_VALUES)[number];

export const RESOURCE_VISIBILITY_INHERITANCE_RULE_VALUES = [
  "explicit_private",
  "inherit_from_knowledge_base",
  "inherit_from_conversation"
] as const;

export type ResourceVisibilityInheritanceRule = (typeof RESOURCE_VISIBILITY_INHERITANCE_RULE_VALUES)[number];

export const RESOURCE_DEFAULT_VISIBILITY_BY_KIND: Record<ResourceKind, ResourceVisibility> = {
  knowledge_base: "private",
  document: "private",
  assistant: "private",
  conversation: "private",
  trace: "private"
};

export const RESOURCE_VISIBILITY_INHERITANCE_BY_KIND: Record<ResourceKind, ResourceVisibilityInheritanceRule> = {
  knowledge_base: "explicit_private",
  document: "inherit_from_knowledge_base",
  assistant: "inherit_from_knowledge_base",
  conversation: "explicit_private",
  trace: "inherit_from_conversation"
};

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
