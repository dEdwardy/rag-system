import { resolveStorageRoot } from "./storage-root";

export type LocalStorageRuntimeConfig = {
  provider: "local";
  storageRoot: string;
};

export type SupabaseStorageRuntimeConfig = {
  provider: "supabase";
  supabaseUrl: string;
  serviceRoleKey: string;
  buckets: {
    uploads: string;
    generated: string;
  };
};

export type StorageRuntimeConfig = LocalStorageRuntimeConfig | SupabaseStorageRuntimeConfig;

export class StorageRuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageRuntimeConfigError";
  }
}

export function resolveStorageRuntimeConfig(env: NodeJS.ProcessEnv = process.env): StorageRuntimeConfig {
  const supabaseUrl = readTrimmedEnv(env, "SUPABASE_URL");
  const serviceRoleKey = readTrimmedEnv(env, "SUPABASE_SERVICE_ROLE_KEY");
  const uploadsBucket = readTrimmedEnv(env, "SUPABASE_STORAGE_BUCKET_UPLOADS");
  const generatedBucket = readTrimmedEnv(env, "SUPABASE_STORAGE_BUCKET_GENERATED");

  const hasSupabaseConfig = [supabaseUrl, serviceRoleKey, uploadsBucket, generatedBucket].some(value => value !== null);

  if (!hasSupabaseConfig) {
    return {
      provider: "local",
      storageRoot: resolveStorageRoot({ env })
    };
  }

  if (!supabaseUrl || !serviceRoleKey || !uploadsBucket || !generatedBucket) {
    throw new StorageRuntimeConfigError(
      "Supabase storage requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_STORAGE_BUCKET_UPLOADS, and SUPABASE_STORAGE_BUCKET_GENERATED."
    );
  }

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
