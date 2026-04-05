export type ApiRuntimeConfig = {
  port: number;
  isProduction: boolean;
};

export class ApiRuntimeConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApiRuntimeConfigError";
  }
}

export function resolveApiRuntimeConfig(env: NodeJS.ProcessEnv = process.env): ApiRuntimeConfig {
  const rawPort = (env.API_PORT ?? "3000").trim();
  const parsedPort = Number.parseInt(rawPort, 10);

  if (!Number.isFinite(parsedPort) || parsedPort <= 0) {
    throw new ApiRuntimeConfigError("API_PORT must be a positive integer when set.");
  }

  return {
    port: parsedPort,
    isProduction: (env.NODE_ENV ?? "").trim() === "production"
  };
}
