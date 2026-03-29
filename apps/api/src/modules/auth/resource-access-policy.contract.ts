import type { AuthIdentity } from "./auth-identity.contract";
import {
  RESOURCE_ACCESS_ACTION_VALUES,
  RESOURCE_ACCESS_DEFAULT_STANCE_VALUES,
  RESOURCE_ACCESS_POLICY_VERSION_VALUES,
  RESOURCE_KIND_VALUES,
  type ResourceAccessDecision,
  type ResourceAccessDecisionReason,
  type ResourceAccessDenyReason,
  type ResourceAccessPolicyInput as SharedResourceAccessPolicyInput,
  type ResourceAccessPolicyVersion
} from "@rag-system/shared";

export type { ResourceAccessDecision, ResourceAccessDecisionReason, ResourceAccessPolicyVersion };

export type ResourceAccessDefaultStance = (typeof RESOURCE_ACCESS_DEFAULT_STANCE_VALUES)[number];

export type ResourceAccessIdentity = Pick<AuthIdentity, "tenantId" | "userId">;
export type ResourceAccessPolicyInput = Omit<SharedResourceAccessPolicyInput, "identity"> & {
  identity: ResourceAccessIdentity;
};

const RESOURCE_ACCESS_DENIED_REASON_HINTS: Record<ResourceAccessDenyReason, string> = {
  tenant_mismatch: "request tenant does not match resource tenant",
  owner_mismatch: "resource owner does not match current user",
  owner_unassigned: "resource has no assigned owner",
  unsupported_action: "requested action is not supported by the current policy baseline",
  unsupported_resource_kind: "resource kind is not supported by the current policy baseline"
};

const OWNER_ONLY_POLICY: ResourceAccessPolicyVersion = RESOURCE_ACCESS_POLICY_VERSION_VALUES[0];
export const RESOURCE_ACCESS_DEFAULT_STANCE: ResourceAccessDefaultStance = "deny_by_default";

const SUPPORTED_RESOURCE_ACCESS_ACTIONS = new Set<ResourceAccessPolicyInput["action"]>(RESOURCE_ACCESS_ACTION_VALUES);
const SUPPORTED_RESOURCE_KINDS = new Set<ResourceAccessPolicyInput["resource"]["kind"]>(RESOURCE_KIND_VALUES);

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

  const reasonHint = RESOURCE_ACCESS_DENIED_REASON_HINTS[decision.reason];
  return `Access blocked by ${decision.policy} policy (${decision.reason}: ${reasonHint}).`;
}
