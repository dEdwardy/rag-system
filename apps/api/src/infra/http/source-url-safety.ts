import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

export class SourceUrlSafetyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SourceUrlSafetyError';
  }
}

type LookupResult = {
  address: string;
  family: number;
};

type SourceUrlSafetyOptions = {
  allowPrivateNetwork?: boolean;
  lookup?: (hostname: string) => Promise<LookupResult[]>;
};

const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'metadata',
  'metadata.google.internal',
  'instance-data',
  'instance-data.ec2.internal'
]);

const RESERVED_HOSTNAME_SUFFIXES = ['.localhost', '.local', '.internal'];

export function isBlockedSourceAddress(address: string): boolean {
  if (isIP(address) === 4) {
    return isBlockedIpv4(address);
  }

  if (isIP(address) === 6) {
    return isBlockedIpv6(address);
  }

  return true;
}

export async function assertSafeSourceUrl(
  rawUrl: string,
  options: SourceUrlSafetyOptions = {}
): Promise<void> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SourceUrlSafetyError(`Invalid source URL: ${rawUrl}.`);
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new SourceUrlSafetyError(
      `Source URL must use http or https: ${url.protocol}.`
    );
  }

  if (options.allowPrivateNetwork === true) {
    return;
  }

  const hostname = normalizeHostname(url.hostname);
  if (hostname.length === 0) {
    throw new SourceUrlSafetyError('Source URL must include a hostname.');
  }

  const allowedHosts = readAllowedSourceHosts();
  if (
    allowedHosts.length > 0 &&
    !allowedHosts.some((allowedHost) => hostnameMatches(hostname, allowedHost))
  ) {
    throw new SourceUrlSafetyError(
      `Source URL host is outside SOURCE_FETCH_ALLOWED_HOSTS: ${hostname}.`
    );
  }

  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    RESERVED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new SourceUrlSafetyError(
      `Source URL host is not allowed: ${hostname}.`
    );
  }

  const literalFamily = isIP(hostname);
  if (literalFamily !== 0) {
    if (isBlockedSourceAddress(hostname)) {
      throw new SourceUrlSafetyError(
        `Source URL resolves to a blocked address: ${hostname}.`
      );
    }
    return;
  }

  if (process.env.NODE_ENV === 'test' && options.lookup == null) {
    return;
  }

  const resolver =
    options.lookup ??
    (async (value: string) =>
      (await lookup(value, { all: true, verbatim: true })).map((entry) => ({
        address: entry.address,
        family: entry.family
      })));

  let addresses: LookupResult[];
  try {
    addresses = await resolver(hostname);
  } catch {
    throw new SourceUrlSafetyError(
      `Source URL hostname could not be resolved: ${hostname}.`
    );
  }

  if (addresses.length === 0) {
    throw new SourceUrlSafetyError(
      `Source URL hostname resolved to no addresses: ${hostname}.`
    );
  }

  for (const entry of addresses) {
    if (isBlockedSourceAddress(entry.address)) {
      throw new SourceUrlSafetyError(
        `Source URL resolves to a blocked address: ${entry.address}.`
      );
    }
  }
}

function normalizeHostname(hostname: string) {
  return hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, '')
    .replace(/\.$/, '');
}

function readAllowedSourceHosts() {
  return (process.env.SOURCE_FETCH_ALLOWED_HOSTS ?? '')
    .split(',')
    .map((value) => normalizeHostname(value.trim()))
    .filter((value) => value.length > 0);
}

function hostnameMatches(hostname: string, allowedHost: string) {
  return hostname === allowedHost || hostname.endsWith(`.${allowedHost}`);
}

function isBlockedIpv4(address: string) {
  const parts = address.split('.').map((part) => Number.parseInt(part, 10));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) {
    return true;
  }

  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 0) return true;
  if (a === 192 && b === 168) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51) return true;
  if (a === 203 && b === 0) return true;
  if (a >= 224) return true;

  return false;
}

function isBlockedIpv6(address: string) {
  const normalized = address.toLowerCase();
  if (normalized === '::' || normalized === '::1') {
    return true;
  }

  if (normalized.startsWith('::ffff:')) {
    const mapped = normalized.slice('::ffff:'.length);
    if (mapped.includes('.')) {
      return isBlockedIpv4(mapped);
    }
  }

  const firstGroup = normalized.split(':')[0] ?? '';
  const firstValue = Number.parseInt(firstGroup, 16);
  if (!Number.isFinite(firstValue)) {
    return true;
  }

  if ((firstValue & 0xfe00) === 0xfc00) return true;
  if ((firstValue & 0xffc0) === 0xfe80) return true;
  if ((firstValue & 0xff00) === 0xff00) return true;

  return false;
}
