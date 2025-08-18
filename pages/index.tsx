import { useEffect, useState } from 'react'
import Head from 'next/head'
import GameContainer from '../components/GameContainer'

export default function Home() {
  const [isClient, setIsClient] = useState(false)
  const [scriptsLoaded, setScriptsLoaded] = useState(false)

  useEffect(() => {
    setIsClient(true)
    
    // Load external libraries
    const loadScript = (src: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        if (document.querySelector(`script[src="${src}"]`)) {
          resolve()
          return
        }
        
        const script = document.createElement('script')
        script.src = src
        script.onload = () => resolve()
        script.onerror = reject
        document.head.appendChild(script)
      })
    }

    const loadLibraries = async () => {
      try {
        await Promise.all([
          loadScript('https://cdnjs.cloudflare.com/ajax/libs/pixi.js/7.3.2/pixi.min.js'),
          loadScript('https://cdnjs.cloudflare.com/ajax/libs/tone/14.8.49/Tone.js'),
          loadScript('https://cdnjs.cloudflare.com/ajax/libs/gsap/3.12.2/gsap.min.js')
        ])
        
        // Wait a bit for libraries to be available
        setTimeout(() => {
          setScriptsLoaded(true)
        }, 100)
        
      } catch (error) {
        console.error('Failed to load libraries:', error)
      }
    }

    loadLibraries()
  }, [])

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900">
        <div className="text-white text-xl">Loading...</div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Frequency Frontier - Musical Game Experience</title>
        <meta name="description" content="A musical exploration game where you play as a sound wave navigating through a spectrum analyzer landscape" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      {scriptsLoaded ? (
        <GameContainer />
      ) : (
        <div className="flex items-center justify-center min-h-screen bg-gray-900">
          <div className="text-center">
            <div className="text-white text-xl mb-4">Loading Frequency Frontier...</div>
            <div className="text-gray-400">
              Loading audio processing and graphics libraries...
            </div>
            <div className="mt-8">
              <div className="animate-pulse-glow text-neon-cyan text-lg">
                🎵 Preparing your musical journey 🎵
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
