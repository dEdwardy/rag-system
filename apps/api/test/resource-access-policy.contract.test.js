const assert = require("node:assert/strict");
const { test } = require("node:test");

const {
  buildResourceAccessDeniedHint,
  evaluateOwnerResourceAccess,
  resolveResourceVisibilityOnCreate
} = require("../src/modules/auth/resource-access-policy.contract.ts");

function buildInput(overrides = {}) {
  return {
    identity: {
      userId: "user-1",
      tenantId: "tenant-1"
    },
    action: "read",
    resource: {
      kind: "document",
      resourceId: "doc-1",
      tenantId: "tenant-1",
      ownerId: "user-1"
    },
    ...overrides
  };
}

test("evaluateOwnerResourceAccess allows access for same-tenant resource owner", () => {
  const decision = evaluateOwnerResourceAccess(buildInput());

  assert.deepEqual(decision, {
    allowed: true,
    reason: "owner_match",
    policy: "owner_only_v1"
  });
});

test("evaluateOwnerResourceAccess denies access when tenant does not match", () => {
  const decision = evaluateOwnerResourceAccess(
    buildInput({
      resource: {
        kind: "document",
        resourceId: "doc-1",
        tenantId: "tenant-2",
        ownerId: "user-1"
      }
    })
  );

  assert.deepEqual(decision, {
    allowed: false,
    reason: "tenant_mismatch",
    policy: "owner_only_v1"
  });
});

test("evaluateOwnerResourceAccess denies access when owner does not match", () => {
  const decision = evaluateOwnerResourceAccess(
    buildInput({
      resource: {
        kind: "document",
        resourceId: "doc-1",
        tenantId: "tenant-1",
        ownerId: "user-2"
      }
    })
  );

  assert.deepEqual(decision, {
    allowed: false,
    reason: "owner_mismatch",
    policy: "owner_only_v1"
  });

  assert.equal(
    buildResourceAccessDeniedHint(decision),
    "Access blocked by owner_only_v1 policy (owner_mismatch: resource owner does not match current user)."
  );
});

test("evaluateOwnerResourceAccess denies access when owner is missing", () => {
  const decision = evaluateOwnerResourceAccess(
    buildInput({
      resource: {
        kind: "document",
        resourceId: "doc-1",
        tenantId: "tenant-1",
        ownerId: null
      }
    })
  );

  assert.deepEqual(decision, {
    allowed: false,
    reason: "owner_unassigned",
    policy: "owner_only_v1"
  });
});

test("evaluateOwnerResourceAccess denies access for unsupported action using conservative fallback", () => {
  const decision = evaluateOwnerResourceAccess(
    buildInput({
      action: "delete"
    })
  );

  assert.deepEqual(decision, {
    allowed: false,
    reason: "unsupported_action",
    policy: "owner_only_v1"
  });
});

test("evaluateOwnerResourceAccess denies access for unsupported resource kind using conservative fallback", () => {
  const decision = evaluateOwnerResourceAccess(
    buildInput({
      resource: {
        kind: "artifact",
        resourceId: "doc-1",
        tenantId: "tenant-1",
        ownerId: "user-1"
      }
    })
  );

  assert.deepEqual(decision, {
    allowed: false,
    reason: "unsupported_resource_kind",
    policy: "owner_only_v1"
  });
});

test("resolveResourceVisibilityOnCreate defaults new resources to private", () => {
  const kinds = ["knowledge_base", "document", "assistant", "conversation", "trace"];
  for (const kind of kinds) {
    assert.equal(resolveResourceVisibilityOnCreate({ kind }), "private");
  }
});

test("resolveResourceVisibilityOnCreate inherits public visibility for KB/conversation child resources", () => {
  assert.equal(resolveResourceVisibilityOnCreate({ kind: "document", parentVisibility: "public" }), "public");
  assert.equal(resolveResourceVisibilityOnCreate({ kind: "assistant", parentVisibility: "public" }), "public");
  assert.equal(resolveResourceVisibilityOnCreate({ kind: "trace", parentVisibility: "public" }), "public");
});

test("resolveResourceVisibilityOnCreate keeps explicit-private resources private even with public parent", () => {
  assert.equal(resolveResourceVisibilityOnCreate({ kind: "knowledge_base", parentVisibility: "public" }), "private");
  assert.equal(resolveResourceVisibilityOnCreate({ kind: "conversation", parentVisibility: "public" }), "private");
});
