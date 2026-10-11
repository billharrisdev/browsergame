import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en" className="dark">
      <Head>
        <meta name="description" content="Frequency Frontier - A musical exploration game" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
      </Head>
      <body className="bg-gray-900 text-white">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
