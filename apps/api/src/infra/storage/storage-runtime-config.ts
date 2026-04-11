

export type SupabaseStorageRuntimeConfig = {
  provider: "supabase";
  supabaseUrl: string;
  serviceRoleKey: string;
  buckets: {
    uploads: string;
    generated: string;
  };
};

export type OssStorageRuntimeConfig = {
  provider: "oss";
  endpoint: string;
  accessKeyId: string;
  accessKeySecret: string;
  securityToken?: string;
  buckets: {
    uploads: string;
    generated: string;
  };
};

export type LocalStorageRuntimeConfig = {
  provider: "local";
  storageRoot: string;
};

export type StorageRuntimeConfig = SupabaseStorageRuntimeConfig | OssStorageRuntimeConfig | LocalStorageRuntimeConfig;

export class StorageRuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageRuntimeConfigError";
  }
}

export function resolveStorageRuntimeConfig(env: NodeJS.ProcessEnv = process.env): StorageRuntimeConfig {
  const explicitStorageProvider = readTrimmedEnv(env, "STORAGE_PROVIDER");
  const storageProvider = explicitStorageProvider || "supabase";
  const storageRoot = readTrimmedEnv(env, "STORAGE_ROOT");

  // 优先检查 Supabase 配置
  const supabaseUrl = readTrimmedEnv(env, "SUPABASE_URL");
  const serviceRoleKey = readTrimmedEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const uploadsBucket = readTrimmedEnv(env, "SUPABASE_STORAGE_BUCKET_UPLOADS");
  const generatedBucket = readTrimmedEnv(env, "SUPABASE_STORAGE_BUCKET_GENERATED");
  const ossEndpoint = readTrimmedEnv(env, "OSS_ENDPOINT");
  const ossAccessKeyId = readTrimmedEnv(env, "OSS_ACCESS_KEY_ID");
  const ossAccessKeySecret = readTrimmedEnv(env, "OSS_ACCESS_KEY_SECRET");
  const ossSecurityToken = readTrimmedEnv(env, "OSS_SECURITY_TOKEN") ?? undefined;
  const ossUploadsBucket = readTrimmedEnv(env, "OSS_BUCKET_UPLOADS");
  const ossGeneratedBucket = readTrimmedEnv(env, "OSS_BUCKET_GENERATED");

  if (storageProvider === "local" || (!explicitStorageProvider && storageRoot)) {
    return {
      provider: "local",
      storageRoot: storageRoot || "storage"
    };
  }

  if (storageProvider === "oss") {
    if (!ossEndpoint || !ossAccessKeyId || !ossAccessKeySecret || !ossUploadsBucket || !ossGeneratedBucket) {
      throw new StorageRuntimeConfigError("OSS storage requires OSS_ENDPOINT, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, OSS_BUCKET_UPLOADS, and OSS_BUCKET_GENERATED.");
    }

    return {
      provider: "oss",
      endpoint: normalizeUrl(ossEndpoint, "OSS_ENDPOINT"),
      accessKeyId: ossAccessKeyId,
      accessKeySecret: ossAccessKeySecret,
      securityToken: ossSecurityToken,
      buckets: {
        uploads: ossUploadsBucket,
        generated: ossGeneratedBucket
      }
    };
  }

  if (storageProvider !== "supabase") {
    throw new StorageRuntimeConfigError(`Unsupported STORAGE_PROVIDER: ${storageProvider}`);
  }

  if (!supabaseUrl || !serviceRoleKey || !uploadsBucket || !generatedBucket) {
    throw new StorageRuntimeConfigError("Storage runtime requires complete Supabase storage config or an explicit supported STORAGE_PROVIDER.");
  }

  return {
    provider: "supabase",
    supabaseUrl: normalizeUrl(supabaseUrl, "SUPABASE_URL"),
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

function normalizeUrl(value: string, envName: string) {
  try {
    const normalized = new URL(value);
    normalized.pathname = normalized.pathname.replace(/\/$/, "");
    return normalized.toString().replace(/\/$/, "");
  } catch {
    throw new StorageRuntimeConfigError(`${envName} must be a valid URL. Received: ${value}`);
  }
}
