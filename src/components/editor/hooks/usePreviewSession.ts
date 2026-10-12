import { useEffect, type RefObject } from "react";
import type { PreviewSession } from "@/lib/preview-session";

type Params = {
  enabled: boolean;
  previewSrc: string;
  previewSession: string;
  frameRef: RefObject<HTMLIFrameElement | null>;
  apiFetch: (
    url: string,
    options: { method: string },
  ) => Promise<PreviewSession>;
};

export function usePreviewSession({
  enabled,
  previewSrc,
  previewSession,
  frameRef,
  apiFetch,
}: Params) {
  useEffect(() => {
    if (!enabled || !previewSrc) return;
    const origin = new URL(previewSrc).origin;
    let disposed = false;
    let pending = false;
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const send = async () => {
      if (disposed || pending || !frameRef.current?.contentWindow) return;
      pending = true;
      try {
        const session = await apiFetch("/api/preview/session", {
          method: "POST",
        });
        if (disposed) return;
        frameRef.current?.contentWindow?.postMessage(
          {
            source: "idp-preview-auth",
            previewSession,
            ...session,
          },
          origin,
        );
        clearTimeout(refreshTimer);
        refreshTimer = setTimeout(
          () => void send(),
          Math.max(1000, session.expiresAt - Date.now() - 60000),
        );
      } catch (error) {
        if (!disposed)
          frameRef.current?.contentWindow?.postMessage(
            {
              source: "idp-preview-auth",
              previewSession,
              error:
                error instanceof Error
                  ? error.message
                  : "Preview sign-in failed",
            },
            origin,
          );
      } finally {
        pending = false;
      }
    };
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== origin ||
        event.source !== frameRef.current?.contentWindow ||
        event.data?.source !== "idp-preview-ready" ||
        event.data?.previewSession !== previewSession
      )
        return;
      void send();
    };
    window.addEventListener("message", receive);
    void send();
    return () => {
      disposed = true;
      clearTimeout(refreshTimer);
      window.removeEventListener("message", receive);
    };
  }, [enabled, previewSrc, previewSession, frameRef, apiFetch]);
}
