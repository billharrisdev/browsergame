import Head from 'next/head'
import GameContainer from '../components/GameContainer'

export default function Home() {
  return <>
    <Head>
      <title>Frequency Frontier — Hit the beat</title>
      <meta name="description" content="Click and tap the beat. Hit approach-circle targets to rock, jazz, punk, and metal, with instant timing feedback." />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
    </Head>
    <GameContainer />
  </>
}
