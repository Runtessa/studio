import type { AppProps } from "next/app";
import "../styles/globals.css";
import "@/lib/monaco";
import AppShell from "@/layouts/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { ToastProvider } from "@/components/ui/Toast";
import { useRouter } from "next/router";
import Head from "next/head";
import branding from "@/branding.json";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isLogin = router.pathname === "/login";
  const isEditor = router.pathname === "/editor";
  const hideShell = isLogin || isEditor;

  return (
    <ToastProvider>
      <Head>
        <title>{branding.app_title}</title>
        <meta name="application-name" content="Runtessa" />
        <meta name="description" content={branding.description} />
        <meta name="theme-color" content="#121212" />
      </Head>
      {isLogin ? (
        <Component {...pageProps} />
      ) : (
        <AuthGuard>
          {hideShell ? (
            <Component {...pageProps} />
          ) : (
            <AppShell>
              <Component {...pageProps} />
            </AppShell>
          )}
        </AuthGuard>
      )}
    </ToastProvider>
  );
}
