export type ErrorFrame = {
  file?: string;
  line?: number;
  column?: number;
  method?: string;
};

export type LogDetail = {
  id: number;
  level: string;
  source: string;
  action?: string | null;
  message?: string | null;
  meta?: any;
  createdAt?: string;
};

export const levelTone = (level: string) => {
  const normalizedLevel = (level || '').toLowerCase();
  if (normalizedLevel === 'error') return 'bg-danger/20 text-danger border border-danger/30';
  if (normalizedLevel === 'warning' || normalizedLevel === 'warn') {
    return 'bg-warning/20 text-warning border border-warning/30';
  }
  return 'bg-primary/10 text-accent border border-primary/30';
};

export const levelLabel = (level: string) => {
  const normalizedLevel = (level || '').toLowerCase();
  if (normalizedLevel === 'error') return 'Error';
  if (normalizedLevel === 'warning' || normalizedLevel === 'warn') return 'Warning';
  return 'Info';
};

export const formatDate = (value?: string) => {
  if (!value) return '-';
  return new Date(value).toLocaleString();
};

export const formatMeta = (meta: any) => {
  if (!meta) return '';
  try {
    return JSON.stringify(meta, null, 2);
  } catch {
    return String(meta);
  }
};
