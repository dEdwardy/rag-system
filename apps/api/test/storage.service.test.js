const assert = require("node:assert/strict");
const test = require("node:test");

const { StorageRuntimeConfigError, resolveStorageRuntimeConfig } = require("../src/infra/storage/storage-runtime-config.ts");
const {
  LocalStorageProviderService,
  SupabaseStorageProviderService,
  OssStorageProviderService
} = require("../src/infra/storage/storage-provider.service.ts");
const { StorageService } = require("../src/infra/storage/storage.service.ts");
const { withEnv } = require("./support/llm-test-helpers.js");

test("resolveStorageRuntimeConfig uses local storage when STORAGE_ROOT is provided", () => {
  const config = resolveStorageRuntimeConfig({ STORAGE_ROOT: "/tmp/rag-storage-test" });

  assert.equal(config.provider, "local");
  assert.equal(typeof config.storageRoot, "string");
});

test("resolveStorageRuntimeConfig rejects missing explicit storage runtime selection", () => {
  assert.throws(
    () => resolveStorageRuntimeConfig({}),
    /Storage runtime requires complete Supabase storage config or an explicit supported STORAGE_PROVIDER/
  );
});

test("resolveStorageRuntimeConfig allows explicit local fallback without a custom root", () => {
  const config = resolveStorageRuntimeConfig({ STORAGE_PROVIDER: "local" });

  assert.equal(config.provider, "local");
  assert.equal(typeof config.storageRoot, "string");
});

test("resolveStorageRuntimeConfig resolves OSS storage when explicit OSS config is present", () => {
  const config = resolveStorageRuntimeConfig({
    STORAGE_PROVIDER: "oss",
    OSS_REGION: "oss-cn-chengdu",
    OSS_ACCESS_KEY_ID: "test-key-id",
    OSS_ACCESS_KEY_SECRET: "test-key-secret",
    OSS_BUCKET: "rag-system"
  });

  assert.equal(config.provider, "oss");
  assert.equal(config.region, "oss-cn-chengdu");
  assert.equal(config.endpoint, "https://oss-cn-chengdu.aliyuncs.com");
  assert.equal(config.bucket, "rag-system");
});

test("resolveStorageRuntimeConfig rejects partial Supabase storage config", () => {
  assert.throws(
    () =>
      resolveStorageRuntimeConfig({
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "secret"
      }),
    StorageRuntimeConfigError
  );
});

test("StorageService stores uploads in Supabase buckets while preserving storageKey shape", async () => {
  const originalFetch = global.fetch;
  const requests = [];

  try {
    global.fetch = async (url, options = {}) => {
      requests.push({ url, options });

      return new Response(JSON.stringify({ Key: "uploads/test.txt" }), {
        status: 200,
        headers: {
          "Content-Type": "application/json"
        }
      });
    };

    await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        SUPABASE_STORAGE_BUCKET_UPLOADS: "uploads",
        SUPABASE_STORAGE_BUCKET_GENERATED: "generated",
        STORAGE_PROVIDER: "supabase"
      },
      async () => {
        const service = new StorageService(
          new SupabaseStorageProviderService({
            provider: "supabase",
            supabaseUrl: "https://example.supabase.co",
            serviceRoleKey: "service-role-key",
            buckets: { uploads: "uploads", generated: "generated" }
          })
        );
        const stored = await service.saveUploadedFile({
          buffer: Buffer.from("hello", "utf8"),
          originalName: "notes.md",
          mimeType: "text/markdown"
        });

        assert.match(stored.storageKey, /^uploads\/.+\.md$/);
        assert.equal(stored.absolutePath, null);
      }
    );
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /^https:\/\/example\.supabase\.co\/storage\/v1\/object\/uploads\/.+\.md$/);
  assert.equal(requests[0].options.method, "POST");
  assert.equal(requests[0].options.headers["Content-Type"], "text/markdown");
  assert.equal(requests[0].options.headers.apikey, "service-role-key");
});

test("StorageService reads generated files back from Supabase authenticated object endpoint", async () => {
  const originalFetch = global.fetch;
  const requests = [];

  try {
    global.fetch = async (url, options = {}) => {
      requests.push({ url, options });

      return new Response("retrieved text", {
        status: 200,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    };

    await withEnv(
      {
        SUPABASE_URL: "https://example.supabase.co/",
        SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
        SUPABASE_STORAGE_BUCKET_UPLOADS: "uploads",
        SUPABASE_STORAGE_BUCKET_GENERATED: "generated",
        STORAGE_PROVIDER: "supabase"
      },
      async () => {
        const service = new StorageService(
          new SupabaseStorageProviderService({
            provider: "supabase",
            supabaseUrl: "https://example.supabase.co",
            serviceRoleKey: "service-role-key",
            buckets: { uploads: "uploads", generated: "generated" }
          })
        );
        const content = await service.readFileByStorageKey("generated/sample.txt");

        assert.equal(content.toString("utf8"), "retrieved text");
        assert.equal(service.getStorageRoot(), null);
      }
    );
  } finally {
    global.fetch = originalFetch;
  }

  assert.equal(requests.length, 1);
  assert.equal(
    requests[0].url,
    "https://example.supabase.co/storage/v1/object/authenticated/generated/sample.txt"
  );
  assert.equal(requests[0].options.method, "GET");
  assert.equal(requests[0].options.headers.apikey, "service-role-key");
});

test("StorageService delegates local storage behavior through the selected provider", async () => {
  const service = new StorageService(new LocalStorageProviderService());

  assert.equal(typeof service.getStorageRoot(), "string");
});

test("StorageService stores uploads in OSS buckets while preserving storageKey shape", async () => {
  const putCalls = [];
  const service = new StorageService(
    new OssStorageProviderService({
      provider: "oss",
      region: "oss-cn-chengdu",
      endpoint: "https://oss-cn-chengdu.aliyuncs.com",
      accessKeyId: "test-key-id",
      accessKeySecret: "test-key-secret",
      bucket: "rag-system"
    }, async bucket => ({
      put: async (name, data, options = {}) => {
        putCalls.push({ bucket, name, data, options });
      },
      get: async () => ({ content: Buffer.from("", "utf8") })
    }))
  );
  const stored = await service.saveUploadedFile({
    buffer: Buffer.from("hello", "utf8"),
    originalName: "notes.md",
    mimeType: "text/markdown"
  });

  assert.match(stored.storageKey, /^uploads\/.+\.md$/);
  assert.equal(stored.absolutePath, null);
  assert.equal(putCalls.length, 1);
  assert.equal(putCalls[0].bucket, "rag-system");
  assert.match(putCalls[0].name, /^.+\.md$/);
  assert.equal(putCalls[0].options.headers["Content-Type"], "text/markdown");
  assert.equal(putCalls[0].data.toString("utf8"), "hello");
});

test("StorageService reads generated files back from OSS", async () => {
  const getCalls = [];
  const service = new StorageService(
    new OssStorageProviderService({
      provider: "oss",
      region: "oss-cn-chengdu",
      endpoint: "https://oss-cn-chengdu.aliyuncs.com",
      accessKeyId: "test-key-id",
      accessKeySecret: "test-key-secret",
      bucket: "rag-system"
    }, async bucket => ({
      put: async () => ({}),
      get: async name => {
        getCalls.push({ bucket, name });
        return { content: Buffer.from("retrieved text", "utf8") };
      }
    }))
  );

  const content = await service.readFileByStorageKey("generated/sample.txt");

  assert.equal(content.toString("utf8"), "retrieved text");
  assert.deepEqual(getCalls, [{ bucket: "rag-system", name: "sample.txt" }]);
});
