

export type SupabaseStorageRuntimeConfig = {
  provider: "supabase";
  supabaseUrl: string;
  serviceRoleKey: string;
  buckets: {
    uploads: string;
    generated: string;
  };
};

export type LocalStorageRuntimeConfig = {
  provider: "local";
  storageRoot: string;
};

export type StorageRuntimeConfig = SupabaseStorageRuntimeConfig | LocalStorageRuntimeConfig;

export class StorageRuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageRuntimeConfigError";
  }
}

export function resolveStorageRuntimeConfig(env: NodeJS.ProcessEnv = process.env): StorageRuntimeConfig {
  const storageProvider = readTrimmedEnv(env, "STORAGE_PROVIDER") || "supabase";
  const storageRoot = readTrimmedEnv(env, "STORAGE_ROOT");

  // 优先检查 Supabase 配置
  const supabaseUrl = readTrimmedEnv(env, "SUPABASE_URL");
  const serviceRoleKey = readTrimmedEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const uploadsBucket = readTrimmedEnv(env, "SUPABASE_STORAGE_BUCKET_UPLOADS");
  const generatedBucket = readTrimmedEnv(env, "SUPABASE_STORAGE_BUCKET_GENERATED");

  // 如果明确指定使用本地存储，或者 Supabase 配置不完整，才使用本地存储
  if (storageProvider === "local" || (!supabaseUrl || !serviceRoleKey || !uploadsBucket || !generatedBucket)) {
    return {
      provider: "local",
      storageRoot: storageRoot || "storage"
    };
  }

  // 否则使用 Supabase 存储
  return {
    provider: "supabase",
    supabaseUrl: normalizeSupabaseUrl(supabaseUrl),
    serviceRoleKey,
    buckets: {
      uploads: uploadsBucket,
      generated: generatedBucket
    }
  };
}

function readTrimmedEnv(env: NodeJS.ProcessEnv, key: string) {
  const value = env[key]?.trim();
  return value ? value : null;
}

function normalizeSupabaseUrl(value: string) {
  try {
    const normalized = new URL(value);
    normalized.pathname = normalized.pathname.replace(/\/$/, "");
    return normalized.toString().replace(/\/$/, "");
  } catch {
    throw new StorageRuntimeConfigError(`SUPABASE_URL must be a valid URL. Received: ${value}`);
  }
}
