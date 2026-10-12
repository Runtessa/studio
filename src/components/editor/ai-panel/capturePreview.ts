import type { PreviewAnnotation } from '@/lib/assistant/attachment-types';

export type PreviewSnapshot = Omit<PreviewAnnotation, 'marks'> & { image: string };
export type PreviewSource = { frame: HTMLIFrameElement | null; src: string; session: string };
export function capturePreview({ frame, src, session }: PreviewSource): Promise<PreviewSnapshot> {
  if (!frame?.contentWindow || !src || !session) return Promise.reject(new Error('Open an app in Preview first.'));
  const source = frame.contentWindow;
  const origin = new URL(src, window.location.href).origin;
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const cleanup = () => { clearTimeout(timer); window.removeEventListener('message', receive); };
    const receive = (event: MessageEvent) => {
      const data = event.data;
      if (event.source !== source || event.origin !== origin || data?.source !== 'runtessa-preview-snapshot' ||
          data.previewSession !== session || data.requestId !== requestId) return;
      cleanup();
      if (frame.contentWindow !== source || frame.src !== new URL(src, window.location.href).href) { reject(new Error('Preview changed. Capture it again.')); return; }
      if (data.error) { reject(new Error(String(data.error))); return; }
      if (typeof data.image !== 'string' || !data.image.startsWith('data:image/png;base64,') ||
          data.image.length > 7 * 1024 * 1024 || !Number.isInteger(data.width) || !Number.isInteger(data.height) ||
          data.width < 1 || data.height < 1 || data.width > 8192 || data.height > 8192 ||
          typeof data.route !== 'string' || !data.route.startsWith('/') || data.route.length > 1000 ||
          !['draft', 'published'].includes(data.stage)) { reject(new Error('Invalid preview snapshot.')); return; }
      resolve({ image: data.image, width: data.width, height: data.height, route: data.route, stage: data.stage });
    };
    const timer = setTimeout(() => { cleanup(); reject(new Error('Preview capture timed out. Reload Preview and try again.')); }, 20000);
    window.addEventListener('message', receive);
    source.postMessage({ source: 'runtessa-preview-capture', previewSession: session, requestId }, origin);
  });
}
