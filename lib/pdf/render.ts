import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

export type RenderedPage = {
  pageNumber: number;     // 1-based
  mediaType:  'image/png';
  base64:     string;
};

// Render each page of `pdfPath` to a PNG at the given DPI (default 150 — a
// good balance between OCR quality and image-token cost for Claude vision).
// Returns one entry per page in order.
export async function renderPdfPagesToPng(
  pdfPath: string,
  opts: { dpi?: number } = {},
): Promise<RenderedPage[]> {
  const dpi = opts.dpi ?? 150;
  const dir = await mkdtemp(path.join(tmpdir(), 'bfk-pdf-'));
  const outPrefix = path.join(dir, 'page');
  try {
    await runPdftoppm(['-png', '-r', String(dpi), pdfPath, outPrefix]);
    const files = (await readdir(dir))
      .filter((f) => f.startsWith('page') && f.endsWith('.png'))
      .sort();
    const pages: RenderedPage[] = [];
    for (let i = 0; i < files.length; i++) {
      const buf = await readFile(path.join(dir, files[i]));
      pages.push({
        pageNumber: i + 1,
        mediaType:  'image/png',
        base64:     buf.toString('base64'),
      });
    }
    return pages;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function runPdftoppm(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn('pdftoppm', args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    child.stderr.on('data', (d) => { stderr += d.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`pdftoppm exited ${code}: ${stderr.trim()}`));
    });
  });
}
