import '../styles/globals.css'
import type { AppProps } from 'next/app'
import { useEffect } from 'react'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Force dark mode on load
    document.documentElement.classList.add('dark')
  }, [])

  return <Component {...pageProps} />
}
