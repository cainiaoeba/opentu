// @vitest-environment jsdom
import React from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ImageProps } from '@plait/common';
import { Image } from './image';

vi.mock('tdesign-react', () => ({
  Loading: () => null,
  MessagePlugin: { error: vi.fn() },
}));

vi.mock('./video', () => ({
  Video: () => null,
}));

vi.mock('../../mcp/tools/image-generation', () => ({
  generateImage: vi.fn(),
}));

vi.mock('../../services/ppt', () => ({
  getImageRegion: vi.fn(),
}));

vi.mock('../../utils/frame-insertion-utils', () => ({
  insertMediaIntoFrame: vi.fn(),
  removePPTImagePlaceholder: vi.fn(),
  setFramePPTImageStatus: vi.fn(),
  setPPTImagePlaceholderStatus: vi.fn(),
}));

vi.mock('../../utils/asset-cleanup', () => ({
  clearVirtualUrlImageError: vi.fn(),
  handleVirtualUrlImageError: vi.fn(() => undefined),
}));

vi.mock('../../utils/image-3d-transform', () => ({
  getImage3DSourceRectangle: vi.fn(),
  getImage3DSvgOverlayGeometry: vi.fn(),
  isOrdinary3DTransformImage: vi.fn(() => false),
  sanitizeImage3DTransform: vi.fn(),
}));

const imageProps = {
  board: { children: [] },
  element: { id: 'image-1' },
  imageItem: {
    url: 'https://cdn.example.com/generated.png?signature=abc',
    width: 512,
    height: 512,
  },
  getRectangle: vi.fn(),
} as unknown as ImageProps;

describe('Image canvas renderer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('retries remote image loads and shows a visible fallback after retries fail', async () => {
    render(<Image {...imageProps} />);
    const image = document.querySelector('img.image-origin') as HTMLImageElement;

    fireEvent.error(image);
    expect(image.style.visibility).toBe('hidden');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(500);
    });
    expect(image.getAttribute('src')).toBe(imageProps.imageItem.url);

    fireEvent.error(image);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    fireEvent.error(image);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2000);
    });
    fireEvent.error(image);

    expect(screen.getByRole('status').textContent).toContain('图片暂时无法加载');
    expect(screen.getByRole('button', { name: '重试加载图片' })).toBeTruthy();
  });

  it('clears the fallback when manual retry succeeds', async () => {
    render(<Image {...imageProps} />);
    const image = document.querySelector('img.image-origin') as HTMLImageElement;

    for (const delay of [500, 1000, 2000]) {
      fireEvent.error(image);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(delay);
      });
    }
    fireEvent.error(image);

    fireEvent.click(screen.getByRole('button', { name: '重试加载图片' }));
    expect(screen.queryByRole('status')).toBeNull();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    fireEvent.load(image);

    expect(image.style.visibility).toBe('');
    expect(screen.queryByRole('status')).toBeNull();
  });
});
