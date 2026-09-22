// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getCachedBlob } = vi.hoisted(() => ({
  getCachedBlob: vi.fn(),
}));

vi.mock('../../services/unified-cache-service', () => ({
  unifiedCacheService: {
    getCachedBlob,
  },
}));

import { Video } from './video';

describe('Video', () => {
  beforeEach(() => {
    getCachedBlob.mockReset();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:http://localhost/cached-video'),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('使用 Blob URL 播放画布中已缓存的生成视频', async () => {
    getCachedBlob.mockResolvedValue(
      new Blob(['video-content'], { type: 'video/mp4' })
    );

    render(
      <Video
        videoItem={{
          url: '/__aitu_cache__/video/task-123.mp4#video',
        }}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    const video = document.querySelector('video');
    expect(getCachedBlob).toHaveBeenCalledWith(
      '/__aitu_cache__/video/task-123.mp4'
    );
    expect(video?.getAttribute('src')).toBe(
      'blob:http://localhost/cached-video'
    );
    expect(video?.getAttribute('preload')).toBe('auto');
  });

  it('播放前修正上游通用二进制视频的 MIME 类型', async () => {
    getCachedBlob.mockResolvedValue(
      new Blob(['video-content'], { type: 'application/octet-stream' })
    );

    render(
      <Video
        videoItem={{
          url: '/__aitu_cache__/video/task-octet.mp4#video',
        }}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    const createObjectURL = vi.mocked(URL.createObjectURL);
    const playableBlob = createObjectURL.mock.calls[0][0] as Blob;
    expect(playableBlob.type).toBe('video/mp4');
  });

  it('缓存未命中时降级使用原始虚拟地址', async () => {
    getCachedBlob.mockResolvedValue(null);

    render(
      <Video
        videoItem={{
          url: '/__aitu_cache__/video/task-456.mp4#video',
        }}
      />
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(document.querySelector('video')?.getAttribute('src')).toBe(
      '/__aitu_cache__/video/task-456.mp4'
    );
  });

  it('非虚拟地址不读取本地缓存', () => {
    render(
      <Video
        videoItem={{
          url: 'https://cdn.example.com/video.mp4#video',
        }}
      />
    );

    expect(screen.queryByText('Video failed to load')).toBeNull();
    expect(getCachedBlob).not.toHaveBeenCalled();
    expect(document.querySelector('video')?.getAttribute('src')).toBe(
      'https://cdn.example.com/video.mp4'
    );
  });
});
