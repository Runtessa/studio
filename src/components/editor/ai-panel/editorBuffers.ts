import type { ActiveFile } from '../types';
import type { EditorBuffer } from '@/lib/assistant/respond-runtime/editor-context';

export const editorBuffer = (
  file: ActiveFile,
  content?: string,
): EditorBuffer => {
  const meta = file.meta;
  return {
    id: file.id,
    name: file.name,
    meta: meta
      ? {
          kind: meta.kind,
          backendId: 'backendId' in meta ? meta.backendId : undefined,
          fileId: 'fileId' in meta ? meta.fileId : undefined,
          file: 'file' in meta ? meta.file : undefined,
        }
      : undefined,
    ...(content !== undefined ? { content } : {}),
  };
};
