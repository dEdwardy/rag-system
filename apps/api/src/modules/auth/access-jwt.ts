import { createHmac, timingSafeEqual } from "node:crypto";

type AccessJwtPayload = {
  sub: string;
  tenantId: string;
  role: string;
  authSource: string;
  typ: "access" | "refresh";
  iat: number;
  exp: number;
};

const JWT_HEADER = {
  alg: "HS256",
  typ: "JWT"
} as const;

export function signAccessJwt(input: {
  secret: string;
  userId: string;
  tenantId: string;
  role: string;
  authSource: string;
  issuedAtSeconds: number;
  expiresAtSeconds: number;
  tokenType?: "access" | "refresh";
}): string {
  const encodedHeader = encodeBase64Url(JSON.stringify(JWT_HEADER));
  const encodedPayload = encodeBase64Url(JSON.stringify({
      sub: input.userId,
      tenantId: input.tenantId,
      role: input.role,
      authSource: input.authSource,
      typ: input.tokenType ?? "access",
      iat: input.issuedAtSeconds,
      exp: input.expiresAtSeconds
  } satisfies AccessJwtPayload));
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = createHmac("sha256", input.secret).update(signingInput).digest("base64url");
  return `${signingInput}.${signature}`;
}

export function verifyAccessJwt(input: {
  token: string;
  secret: string;
  nowMs?: number;
  allowExpired?: boolean;
  expectedType?: "access" | "refresh";
}): AccessJwtPayload | null {
  const parts = input.token.split(".");
  if (parts.length !== 3) {
    return null;
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createHmac("sha256", input.secret).update(signingInput).digest();
  const providedSignature = decodeBase64UrlToBuffer(encodedSignature);

  if (providedSignature == null || providedSignature.length !== expectedSignature.length) {
    return null;
  }

  if (!timingSafeEqual(providedSignature, expectedSignature)) {
    return null;
  }

  const header = parseJson<Partial<typeof JWT_HEADER>>(encodedHeader);
  if (header?.alg !== "HS256" || header?.typ !== "JWT") {
    return null;
  }

  const payload = parseJson<Partial<AccessJwtPayload>>(encodedPayload);
  if (
    typeof payload?.sub !== "string" ||
    typeof payload.tenantId !== "string" ||
    typeof payload.role !== "string" ||
    typeof payload.authSource !== "string" ||
    (payload.typ !== "access" && payload.typ !== "refresh") ||
    typeof payload.iat !== "number" ||
    typeof payload.exp !== "number"
  ) {
    return null;
  }

  if (input.expectedType && payload.typ !== input.expectedType) {
    return null;
  }

  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);
  if (!input.allowExpired && payload.exp <= nowSeconds) {
    return null;
  }

  return {
    sub: payload.sub,
    tenantId: payload.tenantId,
    role: payload.role,
    authSource: payload.authSource,
    typ: payload.typ,
    iat: payload.iat,
    exp: payload.exp
  };
}

function encodeBase64Url(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function decodeBase64UrlToBuffer(value: string): Buffer | null {
  try {
    return Buffer.from(value, "base64url");
  } catch {
    return null;
  }
}

function parseJson<T>(encoded: string): T | null {
  const buffer = decodeBase64UrlToBuffer(encoded);
  if (buffer == null) {
    return null;
  }

  try {
    return JSON.parse(buffer.toString("utf8")) as T;
  } catch {
    return null;
  }
}
