const VIDEO_MIME_BY_EXTENSION: Record<string, string> = {
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  webm: 'video/webm',
  ogv: 'video/ogg',
  ogg: 'video/ogg',
};

function getVideoExtension(source: string): string {
  const normalized = source.split('#')[0].split('?')[0].toLowerCase();
  const extensionMatch = normalized.match(/\.([a-z0-9]+)$/);
  return extensionMatch?.[1] || normalized.replace(/^\./, '');
}

/**
 * Some upstream video endpoints return a valid media body as
 * application/octet-stream. Safari relies on the Blob MIME type when playing a
 * blob: URL, so restore the type from the stable cache URL/known extension.
 */
export function ensurePlayableVideoBlob(blob: Blob, source: string): Blob {
  if (blob.type.toLowerCase().startsWith('video/')) {
    return blob;
  }

  const mimeType = VIDEO_MIME_BY_EXTENSION[getVideoExtension(source)];
  if (!mimeType) {
    return blob;
  }

  return blob.slice(0, blob.size, mimeType);
}
