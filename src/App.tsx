import { useEffect, useState } from 'react'
import { DropZone, formatSize } from './components/DropZone'
import { ProgressBar } from './components/ProgressBar'
import { ButtonGrid } from './components/ButtonGrid'
import { OptionsPanel } from './components/OptionsPanel'
import { features } from './features/registry'
import { defaultValues } from './features/options'
import { CancelledError, EngineError, cancel, probe, run, type RunResult } from './ffmpeg/engine'
import { parseInfo, summarize, toRows, type MediaInfo } from './ffmpeg/probe'
import type { Feature, OptionValues } from './features/types'

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'running'; progress: number | null }
  | { phase: 'done'; result: RunResult; url: string }
  | { phase: 'info'; info: MediaInfo | null; log: string[] }
  | { phase: 'error'; message: string; log: string[] }

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [state, setState] = useState<State>({ phase: 'idle' })
  const [selected, setSelected] = useState<Feature | null>(null)
  const [values, setValues] = useState<OptionValues>({})
  const [summary, setSummary] = useState('')
  const [probing, setProbing] = useState(false)
  const working = probing || state.phase === 'loading' || state.phase === 'running'

  /** Read duration/resolution of a newly chosen file (best effort: failures are silent). */
  async function choose(f: File) {
    setFile(f)
    setSummary('')
    setState({ phase: 'idle' })
    setProbing(true)
    try {
      const info = parseInfo(await probe(f, () => setState({ phase: 'loading' })))
      setSummary(info ? summarize(info) : '')
    } catch { /* the buttons still work; the summary is a nice-to-have */ }
    setState((s) => (s.phase === 'loading' ? { phase: 'idle' } : s))
    setProbing(false)
  }

  useEffect(() => () => { if (state.phase === 'done') URL.revokeObjectURL(state.url) }, [state])

  async function start(feature: Feature, opts: OptionValues) {
    if (!file) return
    setState({ phase: 'loading' })
    try {
      const result = await run(
        feature, file, opts,
        (p) => setState({ phase: 'running', progress: p }),
        () => setState({ phase: 'loading' }),
      )
      if (!result.blob) return setState({ phase: 'info', info: parseInfo(result.log), log: result.log })
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
      <DropZone file={file} onFile={choose} disabled={working} summary={summary} />

      <ButtonGrid
        features={features}
        file={file}
        selectedId={selected?.id ?? null}
        disabled={working}
        onSelect={(f) => {
          const v = defaultValues(f.options)
          setSelected(f)
          setValues(v)
          setState({ phase: 'idle' })
          if (f.options.length === 0) start(f, v) // nothing to ask: run right away
        }}
      />

      {selected && selected.options.length > 0 && (
        <OptionsPanel feature={selected} values={values} disabled={working} onChange={setValues} onRun={() => start(selected, values)} />
      )}

      {state.phase === 'loading' && <ProgressBar value={null} label="Loading FFmpeg… (~30 MB, once)" onCancel={cancel} />}
      {state.phase === 'running' && <ProgressBar value={state.progress} onCancel={cancel} />}
      {state.phase === 'error' && (
        <div className="error">
          <p>Something went wrong: {state.message}</p>
          <details><summary>Technical details</summary><pre>{state.log.join('\n')}</pre></details>
        </div>
      )}
      {state.phase === 'info' && (
        <div className="result">
          {state.info ? (
            <table className="info">
              <tbody>{toRows(state.info).map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody>
            </table>
          ) : (
            <p>This file seems damaged or isn't a video, audio or image file.</p>
          )}
          <details><summary>Technical details</summary><pre>{state.log.join('\n')}</pre></details>
        </div>
      )}
      {state.phase === 'done' && state.result.blob && (
        <div className="result">
          <strong>{state.result.outputName}</strong> · {formatSize(state.result.blob.size)}
          {state.result.blob.type.startsWith('audio/') && <audio controls src={state.url} />}
          {state.result.blob.type.startsWith('video/') && <video controls src={state.url} />}
          {state.result.blob.type.startsWith('image/') && <img src={state.url} alt="Result preview" />}
          <a className="download" href={state.url} download={state.result.outputName}>Download</a>
        </div>
      )}
    </main>
  )
}
