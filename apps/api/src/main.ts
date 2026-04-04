import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { GlobalHttpExceptionFilter } from "./common/http-exception.filter";
import { validateCriticalRuntimeEnv } from "./infra/env/critical-env";

async function bootstrap() {
  validateCriticalRuntimeEnv(process.env);
  console.log("[bootstrap] critical env validated");
  const app = await NestFactory.create(AppModule);
  console.log("[bootstrap] nest app created");
  const corsOptions = buildCorsOptions();
  if (corsOptions !== null) {
    app.enableCors(corsOptions);
  }
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  console.log("[bootstrap] about to listen", process.env.API_PORT ?? 3000);
  await app.listen(process.env.API_PORT ?? 3000);
  console.log("[bootstrap] app.listen resolved");
}

void bootstrap();

function buildCorsOptions() {
  if ((process.env.NODE_ENV ?? "").trim() !== "production") {
    return {
      origin: true,
      credentials: true
    };
  }

  return null;
}
