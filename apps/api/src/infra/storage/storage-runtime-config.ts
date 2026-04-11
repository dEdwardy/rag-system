

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
  region: string;
  endpoint: string;
  accessKeyId: string;
  accessKeySecret: string;
  securityToken?: string;
  bucket: string;
  objectPrefix: string;
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
  const ossRegion = readTrimmedEnv(env, "OSS_REGION");
  const ossAccessKeyId = readTrimmedEnv(env, "OSS_ACCESS_KEY_ID");
  const ossAccessKeySecret = readTrimmedEnv(env, "OSS_ACCESS_KEY_SECRET");
  const ossSecurityToken = readTrimmedEnv(env, "OSS_SECURITY_TOKEN") ?? undefined;
  const ossBucket = readTrimmedEnv(env, "OSS_BUCKET");
  const ossPrefix = readTrimmedEnv(env, "OSS_PREFIX");
  const ossUploadsBucket = readTrimmedEnv(env, "OSS_BUCKET_UPLOADS");
  const ossGeneratedBucket = readTrimmedEnv(env, "OSS_BUCKET_GENERATED");

  if (storageProvider === "local" || (!explicitStorageProvider && storageRoot)) {
    return {
      provider: "local",
      storageRoot: storageRoot || "storage"
    };
  }

  if (storageProvider === "oss") {
    const resolvedBucket = ossBucket || ossUploadsBucket || ossGeneratedBucket;
    const resolvedRegion = ossRegion || readRegionFromOssEndpoint(ossEndpoint);
    if ((!ossEndpoint && !resolvedRegion) || !ossAccessKeyId || !ossAccessKeySecret || !resolvedBucket) {
      throw new StorageRuntimeConfigError("OSS storage requires OSS_REGION or OSS_ENDPOINT, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET, and OSS_BUCKET (or compatible OSS_BUCKET_UPLOADS / OSS_BUCKET_GENERATED fallback values).");
    }

    const region = resolvedRegion ?? "oss-cn-hangzhou";

    return {
      provider: "oss",
      region,
      endpoint: normalizeUrl(ossEndpoint || `https://${region}.aliyuncs.com`, "OSS endpoint"),
      accessKeyId: ossAccessKeyId,
      accessKeySecret: ossAccessKeySecret,
      securityToken: ossSecurityToken,
      bucket: resolvedBucket,
      objectPrefix: normalizeObjectPrefix(ossPrefix || "rag-system")
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

function readRegionFromOssEndpoint(value: string | null) {
  if (!value) {
    return null;
  }

  try {
    const host = new URL(value).hostname;
    const match = host.match(/^(oss-[^.]+)\./);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
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

function normalizeObjectPrefix(value: string) {
  return value.replaceAll("\\", "/").replace(/^\/+|\/+$/g, "");
}
