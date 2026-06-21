import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';

const assets = {
  js: { file: 'ffmpeg-core.js', contentType: 'text/javascript; charset=utf-8' },
  wasm: { file: 'ffmpeg-core.wasm', contentType: 'application/wasm' }
} as const;

export async function GET(request: NextRequest) {
  const assetName = new URL(request.url).searchParams.get('asset') as keyof typeof assets | null;
  const asset = assetName ? assets[assetName] : null;
  if (!asset) return NextResponse.json({ success: false, message: 'Unknown FFmpeg asset' }, { status: 404 });

  try {
    const assetPath = path.join(process.cwd(), 'node_modules', '@ffmpeg', 'core', 'dist', 'esm', asset.file);
    const contents = await readFile(assetPath);
    return new NextResponse(contents, {
      headers: {
        'Content-Type': asset.contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Cross-Origin-Resource-Policy': 'same-origin'
      }
    });
  } catch {
    return NextResponse.json({ success: false, message: 'FFmpeg compression runtime is unavailable' }, { status: 500 });
  }
}
