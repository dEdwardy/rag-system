import { NestFactory } from "@nestjs/core";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { AppModule } from "./app.module";
import { GlobalHttpExceptionFilter } from "./common/http-exception.filter";

loadEnvFiles();

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: buildCorsOrigins(),
    credentials: true
  });
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  await app.listen(process.env.API_PORT ?? 3000);
}

void bootstrap();

function loadEnvFiles() {
  const envPaths = [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "apps/api/.env")
  ];

  for (const envPath of envPaths) {
    if (!existsSync(envPath)) {
      continue;
    }

    const content = readFileSync(envPath, "utf8");
    for (const line of content.split(/\r?\n/g)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex <= 0) {
        continue;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    }
  }
}

function buildCorsOrigins() {
  const configuredOrigins = (process.env.CORS_ORIGIN ?? "")
    .split(",")
    .map(origin => origin.trim())
    .filter(Boolean);

  if (configuredOrigins.length > 0) {
    return configuredOrigins;
  }

  return [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3001",
    "http://127.0.0.1:3001"
  ];
}
