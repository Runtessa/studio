import { filterMessageLines } from './messagePresentation';

export const isMetaLogLine = (line: string) =>
  /^\[(codex|gateway|stderr|pipeline)\]/i.test(String(line || '').trim());

export const stripMetaLogLines = (text: string) => filterMessageLines(String(text || ''), isMetaLogLine);

export const normalizeAssistantMessage = (text: string) => stripMetaLogLines(String(text || '')).trim();
