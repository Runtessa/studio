import type { AssistantChange } from '@/lib/assistant/types';

export type HistoryResponse<T> = {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
};

export type AssistantDiffPreview = {
  id: string;
  path: string;
  before: string;
  after: string;
  language: string;
};

export type PreviewExceptionPayload = {
  id?: string;
  kind?: string;
  level?: 'error' | 'warn' | 'info' | string;
  message?: string;
  stack?: string;
  componentStack?: string;
  sourceUrl?: string;
  line?: number | null;
  column?: number | null;
  requestUrl?: string;
  method?: string;
  status?: number | null;
  responseSnippet?: string;
  previewName?: string;
  previewVersion?: string;
  previewSession?: string;
  previewStage?: string;
  tenantHost?: string;
  href?: string;
  kernelBuild?: string;
  createdAt?: string;
};

export type AssistantChangeWithPreview = AssistantChange & {
  preview?: AssistantDiffPreview;
};
