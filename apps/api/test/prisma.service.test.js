const assert = require("node:assert/strict");
const { resolvePrismaDatasourceUrl } = require("../src/infra/database/prisma.service.ts");

test("resolvePrismaDatasourceUrl prefers DIRECT_URL when present", () => {
  const resolved = resolvePrismaDatasourceUrl({
    DATABASE_URL: "postgresql://pooler.example:6543/postgres?pgbouncer=true",
    DIRECT_URL: "postgresql://direct.example:5432/postgres"
  });

  assert.equal(resolved, "postgresql://direct.example:5432/postgres");
});

test("resolvePrismaDatasourceUrl falls back to DATABASE_URL when DIRECT_URL is absent", () => {
  const resolved = resolvePrismaDatasourceUrl({
    DATABASE_URL: "postgresql://pooler.example:6543/postgres?pgbouncer=true"
  });

  assert.equal(resolved, "postgresql://pooler.example:6543/postgres?pgbouncer=true");
});

test("resolvePrismaDatasourceUrl returns undefined when no datasource env vars exist", () => {
  const resolved = resolvePrismaDatasourceUrl({});

  assert.equal(resolved, undefined);
});
