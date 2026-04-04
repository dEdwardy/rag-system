import { SetMetadata } from "@nestjs/common";
import type { AuthRateLimitProfile } from "./auth-runtime-config";

export const AUTH_RATE_LIMIT_KEY = "auth_rate_limit";

export function AuthRateLimit(profile: AuthRateLimitProfile) {
  return SetMetadata(AUTH_RATE_LIMIT_KEY, profile);
}
