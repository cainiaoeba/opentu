import { describe, expect, it, vi } from 'vitest';
import { grokVideoAdapter } from '../model-adapters/grok-video-adapter';

describe('grok video adapter', () => {
  it('uses the xAI JSON submit and request_id polling contract', async () => {
    const fetcher = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === 'https://hanbao.party/v1/videos/generations') {
        expect(init?.method).toBe('POST');
        expect(init?.body).toBeTypeOf('string');
        expect(JSON.parse(String(init?.body))).toEqual({
          model: 'grok-imagine-video-1.5',
          prompt: '汉堡在太空中旋转',
          duration: 10,
          aspect_ratio: '9:16',
          resolution: '720p',
        });
        return new Response(JSON.stringify({ request_id: 'video-request-1' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      expect(url).toBe('https://hanbao.party/v1/videos/video-request-1');
      expect(init?.method).toBe('GET');
      return new Response(
        JSON.stringify({
          status: 'done',
          model: 'grok-imagine-video-1.5',
          video: {
            url: 'https://video.example.com/result.mp4',
            duration: 10,
          },
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    });
    const onSubmitted = vi.fn();

    const result = await grokVideoAdapter.generateVideo(
      {
        baseUrl: 'https://hanbao.party/v1',
        operation: 'video',
        apiKey: 'secret',
        authType: 'bearer',
        fetcher,
        binding: {
          id: 'grok-video',
          profileId: 'hanbao',
          modelId: 'grok-imagine-video-1.5',
          operation: 'video',
          protocol: 'xai.video',
          requestSchema: 'xai.video.generation-json',
          responseSchema: 'xai.video.task',
          submitPath: '/videos/generations',
          pollPathTemplate: '/videos/{taskId}',
          priority: 700,
          confidence: 'high',
          source: 'template',
        },
      },
      {
        model: 'grok-imagine-video-1.5',
        prompt: '汉堡在太空中旋转',
        duration: 10,
        size: '720x1280',
        params: { onSubmitted },
      }
    );

    expect(onSubmitted).toHaveBeenCalledWith('video-request-1');
    expect(result).toMatchObject({
      url: 'https://video.example.com/result.mp4',
      duration: 10,
      format: 'mp4',
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
