import Head from 'next/head'
import GameContainer from '../components/GameContainer'

export default function Home() {
  return <>
    <Head>
      <title>Frequency Frontier — Find your frequency</title>
      <meta name="description" content="Explore a neon world built from music. Shift frequency, follow the beat, and build your resonance." />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </Head>
    <GameContainer />
  </>
}
