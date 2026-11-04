import { useEffect, useState } from 'react'
import { DropZone, formatSize } from './components/DropZone'
import { ProgressBar } from './components/ProgressBar'
import { features } from './features/registry'
import { CancelledError, EngineError, cancel, run, type RunResult } from './ffmpeg/engine'
import type { Feature } from './features/types'

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'running'; progress: number | null }
  | { phase: 'done'; result: RunResult; url: string }
  | { phase: 'error'; message: string; log: string[] }

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<State>({ phase: 'idle' })
  const working = state.phase === 'loading' || state.phase === 'running'

  useEffect(() => () => { if (state.phase === 'done') URL.revokeObjectURL(state.url) }, [state])

  async function start(feature: Feature) {
    if (!file) return
    setState({ phase: 'loading' })
    try {
      const result = await run(
        feature, file, {},
        (p) => setState({ phase: 'running', progress: p }),
        () => setState({ phase: 'loading' }),
      )
      setState({ phase: 'done', result, url: URL.createObjectURL(result.blob) })
    } catch (e) {
      if (e instanceof CancelledError) return setState({ phase: 'idle' })
      const log = e instanceof EngineError ? e.log : []
      setState({ phase: 'error', message: e instanceof Error ? e.message : String(e), log })
    }
  }

  return (
    <main>
      <h1>FFmpeg Buttons</h1>
      <DropZone file={file} onFile={(f) => { setFile(f); setState({ phase: 'idle' }) }} disabled={working} />

      <div className="grid">
        {features.map((f) => (
          <button key={f.id} className="tile" disabled={!file || working} title={f.description} onClick={() => start(f)}>
            <span className="icon">{f.icon}</span>
            {f.label}
          </button>
        ))}
      </div>

      {state.phase === 'loading' && <ProgressBar value={null} label="Loading FFmpeg… (~30 MB, once)" onCancel={cancel} />}
      {state.phase === 'running' && <ProgressBar value={state.progress} onCancel={cancel} />}
      {state.phase === 'error' && (
        <div className="error">
          <p>Something went wrong: {state.message}</p>
          <details><summary>Technical details</summary><pre>{state.log.join('\n')}</pre></details>
        </div>
      )}
      {state.phase === 'done' && (
        <div className="result">
          <strong>{state.result.outputName}</strong> · {formatSize(state.result.blob.size)}
          {state.result.blob.type.startsWith('audio/') && <audio controls src={state.url} />}
          <a className="download" href={state.url} download={state.result.outputName}>Download</a>
        </div>
      )}
    </main>
  )
}
