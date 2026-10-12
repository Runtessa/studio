import { commitCodexGatewayWorkspace, resetCodexGatewayWorkspace } from './gateway-workspace';

export async function syncAssistantWorkspace(
  input: { userId: string | number; userName?: string; chatId: string; tenantId: string },
  action: 'commit' | 'reset',
) {
  try {
    if (action === 'commit') await commitCodexGatewayWorkspace(input);
    else await resetCodexGatewayWorkspace(input);
  } catch {
    // Stored changes remain authoritative. Activation rehydrates the gateway
    // from current source if its transient filesystem cannot be synchronized.
  }
}
