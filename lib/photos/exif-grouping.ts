// Minimal EXIF DateTimeOriginal reader + time-window grouper.
//
// Reads only what we need to group rapid-succession iPhone shots from
// the Lucy binder import. No external dependencies. Reads the APP1
// segment, parses the TIFF/EXIF IFD chain, and pulls tag 0x9003
// (DateTimeOriginal). Falls back to tag 0x0132 (DateTime) if needed.

import fs from 'node:fs';

// JPEG markers we care about.
const SOI  = 0xffd8;
const APP1 = 0xffe1;

// EXIF tag IDs.
const TAG_EXIF_IFD_POINTER   = 0x8769;
const TAG_DATETIME_ORIGINAL  = 0x9003;
const TAG_DATETIME           = 0x0132;
const TAG_SUBSEC_ORIGINAL    = 0x9291;

export type PhotoMeta = {
  path: string;
  /** ms since epoch derived from DateTimeOriginal (+ SubSecTimeOriginal). */
  capturedAtMs: number;
  /** Original DateTimeOriginal string, for logging. */
  capturedAtRaw: string;
};

export type PhotoGroup = {
  /** Sequential group index (1-based). */
  index: number;
  /** Capture timestamp of the first photo in the group, in ms. */
  startMs: number;
  /** Capture timestamp of the last photo in the group, in ms. */
  endMs: number;
  photos: PhotoMeta[];
};

function readAscii(buf: Buffer, off: number, len: number): string {
  let end = off + len;
  for (let i = off; i < off + len; i++) {
    if (buf[i] === 0) { end = i; break; }
  }
  return buf.slice(off, end).toString('ascii');
}

// Parse one IFD; returns the values keyed by tag id (raw bytes/strings only
// for the tags we care about) plus the offset of the next IFD.
function readIfd(
  tiff: Buffer,
  ifdOffset: number,
  littleEndian: boolean,
): { values: Map<number, { type: number; count: number; valueBytes: Buffer; valueU32: number }>; nextIfdOffset: number } {
  const u16 = (o: number) => (littleEndian ? tiff.readUInt16LE(o) : tiff.readUInt16BE(o));
  const u32 = (o: number) => (littleEndian ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));

  const numEntries = u16(ifdOffset);
  const values = new Map<number, { type: number; count: number; valueBytes: Buffer; valueU32: number }>();
  for (let i = 0; i < numEntries; i++) {
    const entryOff = ifdOffset + 2 + i * 12;
    const tag      = u16(entryOff);
    const type     = u16(entryOff + 2);
    const count    = u32(entryOff + 4);
    // For ASCII (type 2), valueBytes is len = count. Per-component byte sizes:
    //   1=BYTE 2=ASCII 3=SHORT 4=LONG 5=RATIONAL 7=UNDEFINED 9=SLONG 10=SRATIONAL
    const compSizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
    const byteLen = (compSizes[type] ?? 1) * count;
    let valueBytes: Buffer;
    let valueU32 = 0;
    if (byteLen <= 4) {
      valueBytes = tiff.slice(entryOff + 8, entryOff + 8 + byteLen);
      valueU32   = u32(entryOff + 8);
    } else {
      const offset = u32(entryOff + 8);
      valueBytes   = tiff.slice(offset, offset + byteLen);
      valueU32     = offset;
    }
    values.set(tag, { type, count, valueBytes, valueU32 });
  }
  const nextIfdOffset = u32(ifdOffset + 2 + numEntries * 12);
  return { values, nextIfdOffset };
}

/** Parse DateTimeOriginal from a JPEG. Returns ms since epoch, or null. */
export function readCaptureTimeMs(buf: Buffer): { ms: number; raw: string } | null {
  // Validate SOI.
  if (buf.readUInt16BE(0) !== SOI) return null;

  // Walk segments looking for APP1 with EXIF identifier.
  let pos = 2;
  while (pos < buf.length - 2) {
    const marker = buf.readUInt16BE(pos);
    pos += 2;
    if (marker === 0xffd8 || marker === 0xffd9 || marker === 0xffda) {
      // SOI/EOI/SOS — stop or skip.
      if (marker === 0xffda) return null;
      continue;
    }
    const segLen = buf.readUInt16BE(pos);
    const segEnd = pos + segLen;
    if (marker === APP1 && segLen >= 8) {
      const id = buf.slice(pos + 2, pos + 8).toString('ascii');
      if (id === 'Exif\0\0') {
        const tiffStart = pos + 8;
        const byteOrder = buf.readUInt16BE(tiffStart);
        const littleEndian = byteOrder === 0x4949; // 'II'
        if (!littleEndian && byteOrder !== 0x4d4d) return null;
        const tiff = buf.slice(tiffStart, segEnd);
        const u32  = (o: number) => (littleEndian ? tiff.readUInt32LE(o) : tiff.readUInt32BE(o));
        const ifd0Offset = u32(4);

        const ifd0 = readIfd(tiff, ifd0Offset, littleEndian);
        const exifSubOff = ifd0.values.get(TAG_EXIF_IFD_POINTER)?.valueU32;

        // Look for DateTimeOriginal in the EXIF SubIFD.
        let raw: string | null = null;
        let subSec = '';
        if (exifSubOff) {
          const sub = readIfd(tiff, exifSubOff, littleEndian);
          const dto = sub.values.get(TAG_DATETIME_ORIGINAL);
          if (dto && dto.type === 2) raw = readAscii(dto.valueBytes, 0, dto.valueBytes.length);
          const sst = sub.values.get(TAG_SUBSEC_ORIGINAL);
          if (sst && sst.type === 2) subSec = readAscii(sst.valueBytes, 0, sst.valueBytes.length);
        }
        // Fall back to DateTime (IFD0) if DateTimeOriginal is missing.
        if (!raw) {
          const dt = ifd0.values.get(TAG_DATETIME);
          if (dt && dt.type === 2) raw = readAscii(dt.valueBytes, 0, dt.valueBytes.length);
        }
        if (!raw) return null;

        // Parse "YYYY:MM:DD HH:MM:SS" as local time (iPhone EXIF doesn't
        // record a timezone offset in the basic field — but for grouping
        // by 15s windows the absolute zone doesn't matter as long as
        // every photo uses the same one).
        const m = raw.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
        if (!m) return null;
        const ms = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
        const subSecMs = subSec ? Math.round((parseInt(subSec, 10) / 10 ** subSec.length) * 1000) : 0;
        return { ms: ms + subSecMs, raw: subSec ? `${raw}.${subSec}` : raw };
      }
    }
    pos = segEnd;
  }
  return null;
}

export async function readPhotoMeta(filePath: string): Promise<PhotoMeta | null> {
  const buf = await fs.promises.readFile(filePath);
  const t = readCaptureTimeMs(buf);
  if (!t) return null;
  return { path: filePath, capturedAtMs: t.ms, capturedAtRaw: t.raw };
}

/**
 * Group photos by capture time. Two adjacent photos within `windowMs` ms of
 * each other join the same group.
 */
export function groupByTimeWindow(photos: PhotoMeta[], windowMs: number): PhotoGroup[] {
  const sorted = [...photos].sort((a, b) => a.capturedAtMs - b.capturedAtMs);
  const groups: PhotoGroup[] = [];
  for (const p of sorted) {
    const last = groups[groups.length - 1];
    if (last && p.capturedAtMs - last.endMs <= windowMs) {
      last.photos.push(p);
      last.endMs = p.capturedAtMs;
    } else {
      groups.push({
        index: groups.length + 1,
        startMs: p.capturedAtMs,
        endMs: p.capturedAtMs,
        photos: [p],
      });
    }
  }
  return groups;
}
