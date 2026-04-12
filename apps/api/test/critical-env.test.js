import assert from "node:assert/strict";
import { test } from "vitest";
import { validateCriticalRuntimeEnv } from "../src/infra/env/critical-env.ts";

test("validateCriticalRuntimeEnv accepts current Supabase pgvector pgmq shape", () => {
  const env = validateCriticalRuntimeEnv({
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "secret",
    SUPABASE_STORAGE_BUCKET_UPLOADS: "uploads",
    SUPABASE_STORAGE_BUCKET_GENERATED: "generated",
    QUEUE_PROVIDER: "pgmq",
    VECTOR_STORE_PROVIDER: "pgvector",
    OLLAMA_BASE_URL: "http://127.0.0.1:11434",
    OLLAMA_EMBEDDING_MODEL: "nomic-embed-text"
  });

  assert.equal(env.QUEUE_PROVIDER, "pgmq");
  assert.equal(env.VECTOR_STORE_PROVIDER, "pgvector");
});

test("validateCriticalRuntimeEnv accepts redis queue when REDIS_URL is configured", () => {
  const env = validateCriticalRuntimeEnv({
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    STORAGE_PROVIDER: "local",
    QUEUE_PROVIDER: "redis",
    REDIS_URL: "redis://127.0.0.1:6379"
  });

  assert.equal(env.QUEUE_PROVIDER, "redis");
  assert.equal(env.REDIS_URL, "redis://127.0.0.1:6379");
});

test("validateCriticalRuntimeEnv accepts explicit local storage fallback for test-debug use", () => {
  const env = validateCriticalRuntimeEnv({
    DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
    STORAGE_PROVIDER: "local"
  });

  assert.equal(env.STORAGE_PROVIDER, "local");
});

test("validateCriticalRuntimeEnv rejects missing database url", () => {
  assert.throws(() => validateCriticalRuntimeEnv({}), /DATABASE_URL is required/);
});

test("validateCriticalRuntimeEnv rejects missing storage runtime selection", () => {
  assert.throws(
    () =>
      validateCriticalRuntimeEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db"
      }),
    /SUPABASE_URL is required for Supabase Storage/
  );
});

test("validateCriticalRuntimeEnv rejects partial Supabase storage config", () => {
  assert.throws(
    () =>
      validateCriticalRuntimeEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        SUPABASE_URL: "https://example.supabase.co",
        SUPABASE_STORAGE_BUCKET_UPLOADS: "uploads"
      }),
    /SUPABASE_SERVICE_ROLE_KEY is required for Supabase Storage/
  );
});

test("validateCriticalRuntimeEnv rejects Ollama model config without base url", () => {
  assert.throws(
    () =>
      validateCriticalRuntimeEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        OLLAMA_EMBEDDING_MODEL: "nomic-embed-text"
      }),
    /OLLAMA_BASE_URL is required when Ollama model settings are configured/
  );
});

test("validateCriticalRuntimeEnv rejects OpenAI embedding model without key", () => {
  assert.throws(
    () =>
      validateCriticalRuntimeEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        OPENAI_EMBEDDING_MODEL: "text-embedding-3-small"
      }),
    /OPENAI_API_KEY is required when OPENAI_EMBEDDING_MODEL is configured/
  );
});

test("validateCriticalRuntimeEnv rejects redis queue without REDIS_URL", () => {
  assert.throws(
    () =>
      validateCriticalRuntimeEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        STORAGE_PROVIDER: "local",
        QUEUE_PROVIDER: "redis"
      }),
    /REDIS_URL is required when QUEUE_PROVIDER=redis/
  );
});

test("validateCriticalRuntimeEnv rejects redis auth session store without REDIS_URL", () => {
  assert.throws(
    () =>
      validateCriticalRuntimeEnv({
        DATABASE_URL: "postgresql://user:pass@localhost:5432/db",
        STORAGE_PROVIDER: "local",
        AUTH_SESSION_STORE_PROVIDER: "redis"
      }),
    /REDIS_URL is required when AUTH_SESSION_STORE_PROVIDER=redis/
  );
});
