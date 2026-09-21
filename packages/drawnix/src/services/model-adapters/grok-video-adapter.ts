import type {
  AdapterContext,
  VideoGenerationRequest,
  VideoGenerationResult,
  VideoModelAdapter,
} from './types';
import { registerModelAdapter } from './registry';
import {
  buildProviderContextFromAdapterContext,
  sendAdapterRequest,
} from './context';
import { downloadVideoContentToLocalUrl } from '../video-binding-utils';

const DEFAULT_MODEL = 'grok-imagine-video-1.5';
const DEFAULT_POLL_INTERVAL_MS = 5000;
const DEFAULT_MAX_ATTEMPTS = 180;

type GrokVideoPayload = {
  request_id?: string;
  id?: string;
  task_id?: string;
  status?: string;
  model?: string;
  video?: { url?: string; duration?: number };
  error?: string | { message?: string; code?: string };
  message?: string;
};

function isGrokVideoModel(model?: string | null): boolean {
  const normalized = model?.toLowerCase() || '';
  return normalized.includes('grok') && normalized.includes('video');
}

function parseSize(size?: string): { aspectRatio: string; resolution: string } {
  const normalized = size?.trim().toLowerCase() || '';
  const combined = normalized.match(/^(480p|720p|1080p)@(\d+:\d+)$/);
  if (combined) {
    return { resolution: combined[1], aspectRatio: combined[2] };
  }

  if (/^(480p|720p|1080p)$/.test(normalized)) {
    return { resolution: normalized, aspectRatio: '16:9' };
  }

  const dimensions = normalized.match(/^(\d+)x(\d+)$/);
  if (dimensions) {
    const width = Number(dimensions[1]);
    const height = Number(dimensions[2]);
    const aspectRatio = width === height ? '1:1' : width > height ? '16:9' : '9:16';
    const shortEdge = Math.min(width, height);
    const resolution = shortEdge >= 1080 ? '1080p' : shortEdge >= 720 ? '720p' : '480p';
    return { aspectRatio, resolution };
  }

  return { aspectRatio: '16:9', resolution: '720p' };
}

async function readPayload(response: Response): Promise<GrokVideoPayload> {
  const text = await response.text();
  let payload: GrokVideoPayload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { message: text };
  }

  if (!response.ok) {
    const message =
      typeof payload.error === 'string'
        ? payload.error
        : payload.error?.message || payload.message || `HTTP ${response.status}`;
    const error = new Error(`Grok 视频请求失败: ${message}`);
    (error as any).httpStatus = response.status;
    (error as any).apiErrorBody = text;
    throw error;
  }
  return payload;
}

function failureMessage(payload: GrokVideoPayload): string {
  if (typeof payload.error === 'string') return payload.error;
  return payload.error?.message || payload.message || 'Grok 视频生成失败';
}

async function generateGrokVideo(
  context: AdapterContext,
  request: VideoGenerationRequest
): Promise<VideoGenerationResult> {
  const model = request.model || DEFAULT_MODEL;
  const { aspectRatio, resolution } = parseSize(request.size);
  const onProgress = request.params?.onProgress as
    | ((progress: number, status?: string) => void)
    | undefined;
  const onSubmitted = request.params?.onSubmitted as
    | ((videoId: string) => void)
    | undefined;

  const body: Record<string, unknown> = {
    model,
    prompt: request.prompt,
    duration: request.duration || 8,
    aspect_ratio:
      (request.params?.aspect_ratio as string | undefined) || aspectRatio,
    resolution:
      (request.params?.resolution as string | undefined) || resolution,
  };
  if (request.referenceImages?.[0]) {
    body.image = { url: request.referenceImages[0] };
  }
  if (typeof request.params?.generate_audio === 'boolean') {
    body.generate_audio = request.params.generate_audio;
  }

  onProgress?.(5, 'submitting');
  const submitResponse = await sendAdapterRequest(context, {
    path: context.binding?.submitPath || '/videos/generations',
    baseUrlStrategy: context.binding?.baseUrlStrategy,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const submitted = await readPayload(submitResponse);
  const taskId = submitted.request_id || submitted.id || submitted.task_id;
  if (!taskId) {
    throw new Error('Grok 视频接口未返回 request_id');
  }
  onSubmitted?.(taskId);
  onProgress?.(10, submitted.status || 'pending');

  for (let attempt = 0; attempt < DEFAULT_MAX_ATTEMPTS; attempt += 1) {
    const statusResponse = await sendAdapterRequest(context, {
      path: (context.binding?.pollPathTemplate || '/videos/{taskId}').replace(
        '{taskId}',
        encodeURIComponent(taskId)
      ),
      baseUrlStrategy: context.binding?.baseUrlStrategy,
      method: 'GET',
    });
    const statusPayload = await readPayload(statusResponse);
    const status = (statusPayload.status || '').toLowerCase();

    if (status === 'done' || status === 'completed' || status === 'succeeded') {
      onProgress?.(100, status);
      const remoteUrl = statusPayload.video?.url;
      const url = remoteUrl?.startsWith('http')
        ? remoteUrl
        : await downloadVideoContentToLocalUrl({
            videoId: taskId,
            provider: buildProviderContextFromAdapterContext(context),
            binding: context.binding,
            modelId: statusPayload.model || model,
            cacheKey: taskId,
          });
      return {
        url,
        format: 'mp4',
        duration: statusPayload.video?.duration || request.duration,
        raw: statusPayload,
      };
    }

    if (status === 'failed' || status === 'expired' || status === 'error') {
      throw new Error(failureMessage(statusPayload));
    }

    onProgress?.(Math.min(10 + (attempt + 1) * 2, 90), status || 'pending');
    await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLL_INTERVAL_MS));
  }

  throw new Error('Grok 视频生成等待超时，请稍后重试');
}

export const grokVideoAdapter: VideoModelAdapter = {
  id: 'grok-video-adapter',
  label: 'Grok Video',
  kind: 'video',
  docsUrl: 'https://docs.x.ai/developers/model-capabilities/video/generation',
  matchProtocols: ['xai.video'],
  matchRequestSchemas: ['xai.video.generation-json'],
  matchPredicate: (model) =>
    model.type === 'video' && isGrokVideoModel(model.id),
  defaultModel: DEFAULT_MODEL,
  generateVideo: generateGrokVideo,
};

export function registerGrokVideoAdapter(): void {
  registerModelAdapter(grokVideoAdapter);
}
