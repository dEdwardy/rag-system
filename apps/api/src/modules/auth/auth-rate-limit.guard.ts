import { CanActivate, HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AUTH_RATE_LIMIT_KEY } from "./auth-rate-limit.decorator";
import { AuthRuntimeConfigService, type AuthRateLimitProfile } from "./auth-runtime-config";

type RateLimitBucket = {
  count: number;
  resetAt: number;
};

@Injectable()
export class AuthRateLimitGuard implements CanActivate {
  private readonly buckets = new Map<string, RateLimitBucket>();

  constructor(
    private readonly reflector: Reflector,
    private readonly authRuntimeConfig: AuthRuntimeConfigService = new AuthRuntimeConfigService()
  ) {}

  canActivate(context: Parameters<CanActivate["canActivate"]>[0]): boolean {
    const profile = this.reflector.getAllAndOverride<AuthRateLimitProfile | undefined>(AUTH_RATE_LIMIT_KEY, [
      context.getHandler(),
      context.getClass()
    ]);

    if (profile == null) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
      socket?: { remoteAddress?: string };
    }>();
    const clientId = this.resolveClientId(request);
    const now = Date.now();
    const policy = this.authRuntimeConfig.getConfig().rateLimits[profile];
    const bucketKey = `${profile}:${clientId}`;
    const existingBucket = this.buckets.get(bucketKey);

    if (existingBucket == null || existingBucket.resetAt <= now) {
      this.buckets.set(bucketKey, {
        count: 1,
        resetAt: now + policy.windowMs
      });
      this.pruneExpiredBuckets(now);
      return true;
    }

    if (existingBucket.count >= policy.maxAttempts) {
      throw new HttpException("Too many authentication attempts. Please try again later.", HttpStatus.TOO_MANY_REQUESTS);
    }

    existingBucket.count += 1;
    this.pruneExpiredBuckets(now);
    return true;
  }

  private resolveClientId(request: {
    ip?: string;
    headers?: Record<string, string | string[] | undefined>;
    socket?: { remoteAddress?: string };
  } | undefined): string {
    const forwardedFor = request?.headers?.["x-forwarded-for"];
    const forwardedHeader = Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor;
    const forwardedIp = forwardedHeader?.split(",")[0]?.trim();

    return forwardedIp || request?.ip?.trim() || request?.socket?.remoteAddress?.trim() || "unknown";
  }

  private pruneExpiredBuckets(now: number) {
    if (this.buckets.size <= 256) {
      return;
    }

    for (const [key, bucket] of this.buckets.entries()) {
      if (bucket.resetAt <= now) {
        this.buckets.delete(key);
      }
    }
  }
}
