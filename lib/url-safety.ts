import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

// SSRF guard for server-side fetches of user-supplied URLs (the /add/url
// recipe-import path). We resolve the hostname and reject any URL that
// points at a private, loopback, link-local, or otherwise non-public
// address — so a family member can't make the server probe internal
// infrastructure or a cloud metadata endpoint.
//
// Residual risk: DNS rebinding (the name resolves differently between this
// check and the actual fetch). Fully closing that needs IP-pinned fetching;
// for an invite-only family cookbook, resolve-and-check is proportionate.

export type UrlSafetyResult =
  | { ok: true }
  | { ok: false; reason: 'bad_url' | 'bad_protocol' | 'private_address' | 'dns_failed' };

function ipv4IsBlocked(ip: string): boolean {
  const p = ip.split('.').map(Number);
  if (p.length !== 4 || p.some((n) => Number.isNaN(n) || n < 0 || n > 255)) return true;
  const [a, b] = p;
  if (a === 0)   return true;                       // 0.0.0.0/8
  if (a === 10)  return true;                       // 10.0.0.0/8 private
  if (a === 127) return true;                       // loopback
  if (a === 169 && b === 254) return true;          // link-local incl. 169.254.169.254 metadata
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 private
  if (a === 192 && b === 168) return true;          // 192.168.0.0/16 private
  if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 CGNAT
  if (a >= 224) return true;                        // multicast + reserved
  return false;
}

function ipv6IsBlocked(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;          // loopback / unspecified
  if (lower.startsWith('fe80')) return true;                   // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local fc00::/7
  // IPv4-mapped (::ffff:a.b.c.d) — extract and re-check as v4.
  const mapped = lower.match(/::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4IsBlocked(mapped[1]);
  return false;
}

function addressIsBlocked(ip: string): boolean {
  const kind = isIP(ip);
  if (kind === 4) return ipv4IsBlocked(ip);
  if (kind === 6) return ipv6IsBlocked(ip);
  return true; // not a recognizable IP — reject
}

export async function checkFetchTarget(rawUrl: string): Promise<UrlSafetyResult> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return { ok: false, reason: 'bad_url' };
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    return { ok: false, reason: 'bad_protocol' };
  }

  // URL.hostname returns IPv6 literals wrapped in brackets ("[::1]"); strip
  // them so isIP() recognizes the address.
  const host = url.hostname.replace(/^\[|\]$/g, '');

  // Obvious-name blocklist before we even resolve.
  const lowerHost = host.toLowerCase();
  if (
    lowerHost === 'localhost' ||
    lowerHost.endsWith('.localhost') ||
    lowerHost.endsWith('.local') ||
    lowerHost.endsWith('.internal')
  ) {
    return { ok: false, reason: 'private_address' };
  }

  // If the host is already an IP literal, check it directly.
  if (isIP(host)) {
    return addressIsBlocked(host)
      ? { ok: false, reason: 'private_address' }
      : { ok: true };
  }

  // Otherwise resolve and check every returned address.
  try {
    const records = await lookup(host, { all: true });
    if (records.length === 0) return { ok: false, reason: 'dns_failed' };
    for (const r of records) {
      if (addressIsBlocked(r.address)) {
        return { ok: false, reason: 'private_address' };
      }
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: 'dns_failed' };
  }
}
