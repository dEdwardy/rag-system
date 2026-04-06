import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from "@nestjs/common";
import { type Observable, tap } from "rxjs";

const SLOW_REQUEST_THRESHOLD_MS = 200;

@Injectable()
export class RequestTimingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestTimingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method?: string;
      originalUrl?: string;
      url?: string;
      authContext?: {
        currentIdentity?: {
          userId?: string;
          authSource?: string;
        };
      };
    }>();
    const response = context.switchToHttp().getResponse<{ statusCode?: number }>();
    const startedAt = process.hrtime.bigint();

    return next.handle().pipe(
      tap({
        next: () => this.logRequest(request, response, startedAt),
        error: () => this.logRequest(request, response, startedAt)
      })
    );
  }

  private logRequest(
    request: {
      method?: string;
      originalUrl?: string;
      url?: string;
      authContext?: {
        currentIdentity?: {
          userId?: string;
          authSource?: string;
        };
      };
    },
    response: {
      statusCode?: number;
    },
    startedAt: bigint
  ) {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    const method = request.method ?? "GET";
    const path = request.originalUrl ?? request.url ?? "unknown";
    const statusCode = response.statusCode ?? 200;
    const identity = request.authContext?.currentIdentity;
    const identityLabel = identity?.userId != null ? `${identity.userId}${identity.authSource ? `@${identity.authSource}` : ""}` : "anonymous";
    const message = `HTTP ${statusCode} ${method} ${path} ${durationMs.toFixed(1)}ms (${identityLabel})`;

    if (statusCode >= 500 || durationMs >= SLOW_REQUEST_THRESHOLD_MS) {
      this.logger.warn(message);
      return;
    }

    if (statusCode >= 400) {
      this.logger.log(message);
    }
  }
}
