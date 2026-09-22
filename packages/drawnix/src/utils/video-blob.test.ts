import { describe, expect, it } from 'vitest';
import { ensurePlayableVideoBlob } from './video-blob';

describe('ensurePlayableVideoBlob', () => {
  it('keeps an existing video MIME type', () => {
    const blob = new Blob(['video'], { type: 'video/webm' });
    expect(ensurePlayableVideoBlob(blob, 'clip.mp4')).toBe(blob);
  });

  it('restores MP4 MIME type from a cache URL', () => {
    const blob = new Blob(['video'], { type: 'application/octet-stream' });
    const normalized = ensurePlayableVideoBlob(
      blob,
      '/__aitu_cache__/video/task.mp4?cache=1#video'
    );

    expect(normalized.type).toBe('video/mp4');
    expect(normalized.size).toBe(blob.size);
  });

  it('leaves an unknown container untouched', () => {
    const blob = new Blob(['video'], { type: 'application/octet-stream' });
    expect(ensurePlayableVideoBlob(blob, 'clip.bin')).toBe(blob);
  });
});
