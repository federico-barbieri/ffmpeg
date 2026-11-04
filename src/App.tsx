import { useState } from 'react'
import { version } from './ffmpeg/engine'

export default function App() {
  const [out, setOut] = useState('')
  return (
    <main>
      <button onClick={() => version().then(setOut).catch((e) => setOut(String(e)))}>Test FFmpeg</button>
      <pre id="out">{out}</pre>
    </main>
  )
}
