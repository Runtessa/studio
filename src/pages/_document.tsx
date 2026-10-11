import Document, { Html, Head, Main, NextScript } from "next/document";

const themeScript = `
(function () {
  try {
    var theme = localStorage.getItem("ashna-cloudway.theme");
    if (theme !== "light" && theme !== "dark") theme = "dark";
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.colorScheme = theme;
  } catch (_) {
    document.documentElement.dataset.theme = "dark";
  }
})();
`;

class MyDocument extends Document {
  render() {
    return (
      <Html dir="ltr" lang="en">
        <Head>
          <link rel="preconnect" href="https://fonts.googleapis.com" />
          <link
            rel="preconnect"
            href="https://fonts.gstatic.com"
            crossOrigin="anonymous"
          />
          <link rel="icon" href="/brand/runtessa-signal.png" />
          <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        </Head>
        <body className="bg-bgApp text-textPrimary">
          <Main />
          <NextScript />
          <script src="babel/bable.js"></script>
        </body>
      </Html>
    );
  }
}

export default MyDocument;
