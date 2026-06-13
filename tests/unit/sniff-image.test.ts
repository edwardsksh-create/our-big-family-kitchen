import { describe, expect, it } from 'vitest';
import sharp from 'sharp';
import { sniffImage, sniffMagicBytes } from '@/lib/photos/sniff-image';

// Real encoders make these tests honest: the decode probe runs against
// bytes sharp itself produced.
async function realImage(format: 'jpeg' | 'png' | 'webp'): Promise<Buffer> {
  const base = sharp({
    create: { width: 4, height: 4, channels: 3, background: { r: 200, g: 30, b: 60 } },
  });
  if (format === 'jpeg') return base.jpeg().toBuffer();
  if (format === 'png') return base.png().toBuffer();
  return base.webp().toBuffer();
}

// A structurally plausible HEIC header: [size]ftypheic + brand list. Only
// the container is checked for HEIC (sharp can't decode HEVC), so this is
// exactly what the production path sees of a real iPhone photo.
function heicHeader(): Buffer {
  const buf = Buffer.alloc(24);
  buf.writeUInt32BE(24, 0);
  buf.write('ftyp', 4, 'ascii');
  buf.write('heic', 8, 'ascii');
  buf.write('mif1heic', 12, 'ascii');
  return buf;
}

describe('sniffImage', () => {
  it('accepts real JPEG/PNG/WebP bytes and reports the actual format', async () => {
    for (const format of ['jpeg', 'png', 'webp'] as const) {
      const result = await sniffImage(await realImage(format));
      expect(result).toEqual({ ok: true, mime: `image/${format === 'jpeg' ? 'jpeg' : format}` });
    }
  });

  it('accepts a HEIC container by brand', async () => {
    expect(await sniffImage(heicHeader())).toEqual({ ok: true, mime: 'image/heic' });
  });

  it('reports the byte format, not the claimed one (PNG renamed to .jpg)', async () => {
    const png = await realImage('png');
    // The route passes only bytes — a client claiming image/jpeg changes nothing.
    expect(await sniffImage(png)).toEqual({ ok: true, mime: 'image/png' });
  });

  it('rejects non-image bytes', async () => {
    expect(await sniffImage(Buffer.from('<script>alert(1)</script>'))).toEqual({
      ok: false,
      reason: 'unrecognized',
    });
    expect(await sniffImage(Buffer.alloc(0))).toEqual({ ok: false, reason: 'unrecognized' });
  });

  it('rejects bytes that start like an image but do not decode', async () => {
    // Valid PNG signature followed by garbage — passes magic bytes, fails
    // the sharp probe.
    const forged = Buffer.concat([
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      Buffer.from('definitely not a PNG chunk stream'),
    ]);
    expect(await sniffImage(forged)).toEqual({ ok: false, reason: 'undecodable' });
  });

  it('rejects an ftyp box with a non-image brand (e.g. an MP4 video)', async () => {
    const mp4 = Buffer.alloc(24);
    mp4.writeUInt32BE(24, 0);
    mp4.write('ftyp', 4, 'ascii');
    mp4.write('isom', 8, 'ascii');
    expect(sniffMagicBytes(mp4)).toBeNull();
    expect(await sniffImage(mp4)).toEqual({ ok: false, reason: 'unrecognized' });
  });
});
