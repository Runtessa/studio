import type { AppProps } from "next/app";
import "../styles/globals.css";
import "@/lib/monaco";
import AppShell from "@/layouts/AppShell";
import { AuthGuard } from "@/components/AuthGuard";
import { ToastProvider } from "@/components/ui/Toast";
import { useRouter } from "next/router";
import Head from "next/head";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const isLogin = router.pathname === "/login";
  const isEditor = router.pathname === "/editor";
  const hideShell = isLogin || isEditor;

  return (
    <ToastProvider>
      <Head>
        <title>Ashna CloudWay</title>
        <meta name="application-name" content="Ashna CloudWay" />
        <meta name="description" content="The familiar path from code to cloud." />
        <meta name="theme-color" content="#000000" />
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
