import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { GlobalHttpExceptionFilter } from "./common/http-exception.filter";
import { resolveApiRuntimeConfig } from "./infra/env/api-runtime-config";
import { validateCriticalRuntimeEnv } from "./infra/env/critical-env";

async function bootstrap() {
  validateCriticalRuntimeEnv(process.env);
  const runtimeConfig = resolveApiRuntimeConfig();
  console.log("[bootstrap] critical env validated");
  const app = await NestFactory.create(AppModule);
  console.log("[bootstrap] nest app created");
  const corsOptions = buildCorsOptions(runtimeConfig);
  if (corsOptions !== null) {
    app.enableCors(corsOptions);
  }
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  console.log("[bootstrap] about to listen", runtimeConfig.port);
  await app.listen(runtimeConfig.port);
  console.log("[bootstrap] app.listen resolved");
}

void bootstrap();

function buildCorsOptions(runtimeConfig: ReturnType<typeof resolveApiRuntimeConfig>) {
  if (!runtimeConfig.isProduction) {
    return {
      origin: true,
      credentials: true
    };
  }

  return null;
}
