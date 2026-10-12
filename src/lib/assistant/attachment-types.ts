export const MAX_ATTACHMENTS = 5;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_TEXT_BYTES = 256 * 1024;
export const MAX_TURN_BYTES = 10 * 1024 * 1024;
export const ATTACHMENT_TTL_SECONDS = 7 * 24 * 60 * 60;
export const FILE_ACCEPT = 'image/png,image/jpeg,image/webp,.txt,.md,.csv,.json,.js,.jsx,.ts,.tsx,.css,.html,.xml,.yaml,.yml,.toml,.ini,.sql,.py,.go,.cs,.rs,.c,.h,.sh,.log,.svg,.env,.gitignore';
export type PreviewMark = { x: number; y: number; width: number; height: number; note: string };
export type PreviewAnnotation = {
  route: string;
  stage: 'draft' | 'published';
  width: number;
  height: number;
  marks: PreviewMark[];
};
export type AssistantAttachment = {
  id: string;
  name: string;
  kind: 'image' | 'text';
  mime: string;
  size: number;
  preview?: PreviewAnnotation;
};
export type AttachmentContent = AssistantAttachment & { base64: string };
