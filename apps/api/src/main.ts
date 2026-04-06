import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { GlobalHttpExceptionFilter } from "./common/http-exception.filter";
import { RequestTimingInterceptor } from "./common/request-timing.interceptor";
import { resolveApiRuntimeConfig } from "./infra/env/api-runtime-config";
import { validateCriticalRuntimeEnv } from "./infra/env/critical-env";

const REQUEST_TIMING_LOG_ENV = "API_ENABLE_REQUEST_TIMING_LOGS";

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
  if ((process.env[REQUEST_TIMING_LOG_ENV] ?? "").trim() === "true") {
    app.useGlobalInterceptors(new RequestTimingInterceptor());
  }
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
