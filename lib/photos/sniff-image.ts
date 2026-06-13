// Byte-level image validation for the upload routes. The client's MIME type
// is an unverified claim — any request can label arbitrary bytes
// "image/jpeg" and land them in a bucket that serves them back to the
// family. Both upload routes sniff the actual bytes instead and store the
// sniffed type, not the claimed one.
//
// Two layers:
//   1. Magic-byte detection of the four accepted formats.
//   2. A sharp decode probe for jpeg/png/webp — catches files that merely
//      start with the right signature. HEIC stops at layer 1: sharp's
//      prebuilt binaries can't decode HEVC (see generateThumb in
//      lib/storage/photos.ts), and rejecting every iPhone photo would be
//      worse than trusting the container header.
//
// sharp stays lazy-imported (deploy gotcha: its native binary must never
// enter a page's module graph). If the binary fails to LOAD, we fall back
// to the magic-byte verdict rather than blocking all uploads; if it loads
// and the bytes fail to PARSE, the file is rejected.

export type SniffedMime = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/heic';

export type ImageSniff =
  | { ok: true; mime: SniffedMime }
  | { ok: false; reason: 'unrecognized' | 'undecodable' };

// ISO-BMFF major brands that mean "HEIF family image". Apple uses heic/heix;
// mif1/msf1 are the structural brands some encoders write.
const HEIF_BRANDS = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'mif1', 'msf1']);

export function sniffMagicBytes(buf: Buffer): SniffedMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 8 &&
    buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 &&
    buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (buf.length >= 12 && buf.toString('ascii', 4, 8) === 'ftyp') {
    const brand = buf.toString('ascii', 8, 12).toLowerCase();
    if (HEIF_BRANDS.has(brand)) return 'image/heic';
  }
  return null;
}

const SHARP_FORMAT_TO_MIME: Record<string, SniffedMime> = {
  jpeg: 'image/jpeg',
  png:  'image/png',
  webp: 'image/webp',
};

export async function sniffImage(buf: Buffer): Promise<ImageSniff> {
  const magic = sniffMagicBytes(buf);
  if (!magic) return { ok: false, reason: 'unrecognized' };
  if (magic === 'image/heic') return { ok: true, mime: magic };

  // Structural type sidesteps sharp's CJS/ESM interop typing; only the
  // probe surface matters here.
  type SharpProbe = (input: Buffer) => { metadata(): Promise<{ format?: string }> };
  let sharpProbe: SharpProbe;
  try {
    sharpProbe = (await import('sharp')).default as SharpProbe;
  } catch (err) {
    // The codec failing to load must not block family uploads — same
    // philosophy as thumbnail generation. The magic-byte check stands.
    console.error('sniffImage: sharp unavailable, magic bytes only:', (err as Error).message);
    return { ok: true, mime: magic };
  }

  try {
    const meta = await sharpProbe(buf).metadata();
    const mime = meta.format ? SHARP_FORMAT_TO_MIME[meta.format] : undefined;
    if (!mime) return { ok: false, reason: 'undecodable' };
    return { ok: true, mime };
  } catch {
    return { ok: false, reason: 'undecodable' };
  }
}
