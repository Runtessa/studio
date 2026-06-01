import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import { useSessionToken } from '@/lib/client/session';

const isAllowedCallbackUrl = (value: string) => {
  try {
    const url = new URL(value);
    return ['127.0.0.1', 'localhost'].includes(url.hostname) && /^http:$/.test(url.protocol);
  } catch {
    return false;
  }
};

const buildCallbackRedirectUrl = (callbackUrl: string, sessionToken: string, state: string) => {
  const url = new URL(callbackUrl);
  url.searchParams.set('sessionToken', sessionToken);
  url.searchParams.set('state', state);
  return url.toString();
};

export default function ExtensionAuthPage() {
  const router = useRouter();
  const { token, clear, ready } = useSessionToken();
  const [status, setStatus] = useState<'loading' | 'authenticating' | 'redirecting' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('Preparing browser sign-in...');
  const [manualReturnUrl, setManualReturnUrl] = useState('');

  const callbackUrl = useMemo(() => String(router.query.callbackUrl || '').trim(), [router.query.callbackUrl]);
  const state = useMemo(() => String(router.query.state || '').trim(), [router.query.state]);
  const tenantHost = useMemo(() => String(router.query.tenantHost || '').trim(), [router.query.tenantHost]);

  useEffect(() => {
    if (!router.isReady || !ready) return;
    if (!callbackUrl || !state || !isAllowedCallbackUrl(callbackUrl)) {
      setStatus('error');
      setMessage('Invalid extension callback URL.');
      return;
    }

    const run = async () => {
      if (!token) {
        setStatus('authenticating');
        setMessage('Redirecting to login...');
        const next = `/extension-auth?callbackUrl=${encodeURIComponent(callbackUrl)}&state=${encodeURIComponent(state)}${tenantHost ? `&tenantHost=${encodeURIComponent(tenantHost)}` : ''}`;
        await router.replace(`/login?next=${encodeURIComponent(next)}`);
        return;
      }

      setStatus('redirecting');
      setMessage('Redirecting back to VS Code...');
      try {
        const me = await fetch('/api/me', {
          headers: {
            Authorization: `Session ${token}`,
          },
        });
        if (!me.ok) {
          clear();
          throw new Error('Your current browser session is expired. Please sign in again.');
        }

        const nextUrl = buildCallbackRedirectUrl(callbackUrl, token, state);
        setManualReturnUrl(nextUrl);
        setStatus('success');
        setMessage('Sign-in completed. If your browser does not navigate automatically, use the return link below.');
        window.location.replace(nextUrl);
      } catch (error) {
        setStatus('error');
        setMessage((error as Error)?.message || 'Sign-in failed.');
      }
    };

    void run();
  }, [callbackUrl, clear, ready, router, state, tenantHost, token]);

  return (
    <div
      className="min-h-screen bg-bgApp text-textPrimary px-6 py-12"
      style={{
        backgroundImage:
          'radial-gradient(circle at 20% 20%, rgba(77, 107, 255, 0.08), transparent 25%), radial-gradient(circle at 80% 80%, rgba(29, 53, 87, 0.16), transparent 30%)',
      }}
    >
      <div className="mx-auto max-w-2xl rounded-3xl border border-borderSubtle bg-bgSurface/90 p-8 shadow-soft backdrop-blur">
        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-textMuted">VS Code sign-in</p>
          <h1 className="text-3xl font-semibold">Connect IDPCore Tenant Studio</h1>
          <p className="text-sm text-textMuted">This page transfers your current `ideNew` session back to the VS Code extension.</p>
        </div>

        <div className="mt-8 rounded-2xl border border-borderSubtle bg-bgApp/60 p-5">
          <p className="text-sm font-medium capitalize text-textPrimary">{status}</p>
          <p className="mt-2 text-sm text-textMuted">{message}</p>
          {manualReturnUrl ? (
            <p className="mt-4 text-sm">
              <a className="text-accent underline" href={manualReturnUrl}>
                Return to VS Code
              </a>
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
