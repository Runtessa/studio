import type { AssistantRunSummary } from './state-store';

export const assertAssistantRunAccess = (
  user: { id: number; isAdmin: boolean },
  run: Pick<AssistantRunSummary, 'userId'> | null,
) => {
  if (!run || (!user.isAdmin && run.userId !== String(user.id))) {
    throw Object.assign(new Error('Run not found'), { statusCode: 404 });
  }
};
