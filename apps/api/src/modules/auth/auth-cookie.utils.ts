type CookieHeaderInput = {
  cookie?: string | string[];
} | undefined;

export function readNamedCookie(headers: CookieHeaderInput, cookieName: string): string | null {
  const rawCookieHeader = readCookieHeader(headers);
  if (rawCookieHeader == null) {
    return null;
  }

  const pairs = rawCookieHeader.split(";");
  for (const pair of pairs) {
    const separatorIndex = pair.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = pair.slice(0, separatorIndex).trim();
    if (key !== cookieName) {
      continue;
    }

    const value = pair.slice(separatorIndex + 1).trim();
    if (!value) {
      return null;
    }

    try {
      const decoded = decodeURIComponent(value);
      return decoded.length > 0 ? decoded : null;
    } catch {
      return null;
    }
  }

  return null;
}

export function buildCookie(input: {
  name: string;
  value: string;
  expires?: Date;
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
}): string {
  const parts = [`${input.name}=${encodeURIComponent(input.value)}`, `Path=${input.path ?? "/"}`];

  if (input.httpOnly !== false) {
    parts.push("HttpOnly");
  }

  parts.push(`SameSite=${input.sameSite ?? "Lax"}`);

  if (input.secure) {
    parts.push("Secure");
  }

  if (input.expires != null) {
    parts.push(`Expires=${input.expires.toUTCString()}`);
  }

  return parts.join("; ");
}

export function buildExpiredCookie(input: {
  name: string;
  secure?: boolean;
  sameSite?: "Lax" | "Strict" | "None";
  path?: string;
}): string {
  return buildCookie({
    name: input.name,
    value: "",
    expires: new Date(0),
    secure: input.secure,
    sameSite: input.sameSite,
    path: input.path
  });
}

function readCookieHeader(headers: CookieHeaderInput): string | null {
  const rawCookie = headers?.cookie;
  if (typeof rawCookie === "string") {
    const trimmed = rawCookie.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  if (Array.isArray(rawCookie)) {
    const joined = rawCookie.join(";").trim();
    return joined.length > 0 ? joined : null;
  }

  return null;
}
