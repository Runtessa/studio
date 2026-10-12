type PreviewIdentity = { id: number; email: string; isAdmin: boolean };
type PreviewTenant = { id: string; hostname: string };
export type PreviewSession = {
  token: string;
  tenantHost: string;
  expiresAt: number;
};

export async function issuePreviewSession(
  user: PreviewIdentity,
  tenant: PreviewTenant,
): Promise<PreviewSession> {
  const base = process.env.CORE_PREVIEW_INTERNAL_URL?.trim();
  const serviceToken = process.env.CORE_STUDIO_PREVIEW_TOKEN?.trim();
  if (!base || !serviceToken) {
    const error = new Error("Studio preview connection is not configured");
    Object.assign(error, { statusCode: 503, userMessage: error.message });
    throw error;
  }
  const url = new URL("/auth/studio-preview", base);
  if (!["http:", "https:"].includes(url.protocol))
    throw new Error("Invalid preview connection URL");
  const response = await fetch(url, {
    method: "POST",
    redirect: "error",
    signal: AbortSignal.timeout(10000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceToken}`,
    },
    body: JSON.stringify({
      tenantId: tenant.id,
      actor: {
        id: `studio:${user.id}`,
        email: user.email,
        role: user.isAdmin ? "ADMIN" : "USER",
      },
    }),
  });
  if (!response.ok) throw new Error("Runtime could not authorize this preview");
  const result = (await response.json()) as PreviewSession;
  if (
    !result.token ||
    result.tenantHost !== tenant.hostname ||
    !Number.isFinite(result.expiresAt)
  ) {
    throw new Error("Invalid runtime preview session");
  }
  return result;
}
