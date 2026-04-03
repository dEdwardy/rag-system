import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { GlobalHttpExceptionFilter } from "./common/http-exception.filter";
import { validateCriticalRuntimeEnv } from "./infra/env/critical-env";

async function bootstrap() {
  validateCriticalRuntimeEnv(process.env);
  const app = await NestFactory.create(AppModule);
  const corsOptions = buildCorsOptions();
  if (corsOptions !== null) {
    app.enableCors(corsOptions);
  }
  app.useGlobalFilters(new GlobalHttpExceptionFilter());
  await app.listen(process.env.API_PORT ?? 3000);
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
