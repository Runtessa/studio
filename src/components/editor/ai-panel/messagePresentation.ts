import type { AiMessage } from './shared';

// Exclude transport and host summaries from the answer, preserving exact code.
export function filterMessageLines(text: string, exclude: (line: string) => boolean) {
  let fence: { marker: string; length: number } | null = null;
  return text
    .split('\n')
    .filter((line) => {
      const match = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
      if (match) {
        if (!fence) fence = { marker: match[1][0], length: match[1].length };
        else if (match[1][0] === fence.marker && match[1].length >= fence.length && !match[2].trim())
          fence = null;
        return true;
      }
      return fence !== null || !exclude(line);
    })
    .join('\n');
}

export const assistantAnswer = (content: string) =>
  filterMessageLines(
    content,
    (line) =>
      /^\[(codex|gateway|stderr|pipeline)\]/i.test(line.trim()) ||
      /^\s*-\s+(?:Applied|Failed)\s+(?:create|update|delete|write|get)_[a-z_]+\b.*$/.test(line),
  ).trim();

export const activityLabel = (msg: AiMessage, pending: boolean) => {
  if (pending) return 'Working';
  if (msg.status === 'running') return 'Recovering result';
  if (msg.status === 'failed')
    return /stopped by you|request stopped/i.test(msg.content) ? 'Stopped' : 'Run failed';
  const timestamps = (msg.events || []).map((event) => Date.parse(event.timestamp)).filter(Number.isFinite);
  if (timestamps.length < 2) return 'Activity';
  const seconds = Math.max(1, Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / 1000));
  return seconds < 60 ? `Worked for ${seconds}s` : `Worked for ${Math.floor(seconds / 60)}m ${seconds % 60}s`;
};
