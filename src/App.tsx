import { useEffect, useRef, useState } from 'react'
import { ButtonGrid } from './components/ButtonGrid'
import { DropZone } from './components/DropZone'
import { InfoCard } from './components/InfoCard'
import { OptionsPanel } from './components/OptionsPanel'
import { ProgressBar } from './components/ProgressBar'
import { ResultCard } from './components/ResultCard'
import { defaultValues, firstError } from './features/options'
import { features } from './features/registry'
import { willReencode, type Feature, type OptionValues } from './features/types'
import { commandString } from './ffmpeg/command'
import { CancelledError, EngineError, cancel, probe, run, type RunResult } from './ffmpeg/engine'
import { friendlyError } from './ffmpeg/errors'
import { estimateSeconds, formatEstimate } from './ffmpeg/estimate'
import { parseInfo, summarize, type MediaInfo } from './ffmpeg/probe'
import { checkSize } from './limits'

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'running'; progress: number | null }
  | { phase: 'done'; result: RunResult & { blob: Blob }; url: string; command: string; inputSize: number }
  | { phase: 'info'; info: MediaInfo | null; log: string[] }
  | { phase: 'error'; message: string; log: string[] }

interface Job { startedAt: number; estimate?: string }

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [fileInfo, setFileInfo] = useState<MediaInfo | null>(null)
  const [state, setState] = useState<State>({ phase: 'idle' })
  const [selected, setSelected] = useState<Feature | null>(null)
  const [values, setValues] = useState<OptionValues>({})
  const [probing, setProbing] = useState(false)
  const [notice, setNotice] = useState<{ level: 'warn' | 'refuse'; message: string } | null>(null)
  const [showCommand, setShowCommand] = useState(false)
  const [job, setJob] = useState<Job | null>(null)
  const top = useRef<HTMLHeadingElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const working = probing || state.phase === 'loading' || state.phase === 'running'

  // Free the previous result's blob URL whenever the state moves on.
  useEffect(() => () => { if (state.phase === 'done') URL.revokeObjectURL(state.url) }, [state])

  // On small screens the options panel / results are below the fold: bring them into view.
  useEffect(() => {
    if (selected && selected.options.length > 0) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selected])
  useEffect(() => {
    if (state.phase !== 'idle') statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [state.phase])

  /** Accept a file (size-checked), then read its duration/resolution. Probe failures are silent. */
  async function choose(f: File) {
    const size = checkSize(f.size)
    if (size.level === 'refuse') return setNotice(size) // keep the previous file, if any
    setNotice(size.level === 'warn' ? size : null)
    setFile(f)
    setFileInfo(null)
    setState({ phase: 'idle' })
    setProbing(true)
    try {
      const info = parseInfo(await probe(f, {
        onLoading: () => setState({ phase: 'loading' }),
        onLoaded: () => setState({ phase: 'idle' }),
      }))
      setFileInfo(info)
    } catch { /* the buttons still work; the summary is a nice-to-have */ }
    setState((s) => (s.phase === 'loading' ? { phase: 'idle' } : s))
    setProbing(false)
  }

  async function start(feature: Feature, opts: OptionValues) {
    if (!file) return
    const seconds = willReencode(feature, opts) ? estimateSeconds(fileInfo) : null
    setJob({ startedAt: Date.now(), estimate: seconds === null ? undefined : formatEstimate(seconds) })
    setState({ phase: 'running', progress: null }) // indeterminate until real progress arrives
    const command = commandString(feature, file.name, opts)
    try {
      const result = await run(feature, file, opts, {
        onProgress: (p) => setState({ phase: 'running', progress: p }),
        onLoading: () => setState({ phase: 'loading' }),
        onLoaded: () => setState({ phase: 'running', progress: null }),
      })
      if (!result.blob) return setState({ phase: 'info', info: parseInfo(result.log), log: result.log })
      setState({ phase: 'done', result: { ...result, blob: result.blob }, url: URL.createObjectURL(result.blob), command, inputSize: file.size })
    } catch (e) {
      if (e instanceof CancelledError) return setState({ phase: 'idle' })
      const log = e instanceof EngineError ? e.log : []
      setState({ phase: 'error', message: friendlyError(e instanceof Error ? e.message : String(e), log), log })
    }
  }

  function reuse() {
    if (state.phase !== 'done') return
    const { blob, outputName } = state.result
    setSelected(null)
    choose(new File([blob], outputName, { type: blob.type }))
    top.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const optionError = selected ? firstError(selected.options, values) : null
  const previewEstimate = selected && willReencode(selected, values) ? estimateSeconds(fileInfo) : null

  return (
    <main>
      <h1 ref={top}>FFmpeg Buttons</h1>
      <DropZone file={file} onFile={choose} disabled={working} summary={fileInfo ? summarize(fileInfo) : ''} />
      {notice && <div className={`notice ${notice.level}`} role="alert">{notice.message}</div>}

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

      <div ref={panelRef} className="slot">
      {selected && file && selected.options.length > 0 && (
        <OptionsPanel
          feature={selected}
          values={values}
          disabled={working}
          onChange={setValues}
          onRun={() => start(selected, values)}
          command={optionError ? '' : commandString(selected, file.name, values)}
          showCommand={showCommand}
          onToggleCommand={() => setShowCommand((v) => !v)}
          estimate={previewEstimate === null ? undefined : formatEstimate(previewEstimate)}
        />
      )}
      </div>

      <div ref={statusRef} className="status">

      {state.phase === 'loading' && <ProgressBar value={null} label="Loading FFmpeg… (~30 MB, once)" onCancel={cancel} />}
      {state.phase === 'running' && (
        <ProgressBar value={state.progress} estimate={job?.estimate} startedAt={job?.startedAt} onCancel={cancel} />
      )}
      {state.phase === 'error' && (
        <div className="error" role="alert">
          <p>{state.message}</p>
          <details><summary>Technical details</summary><pre>{state.log.join('\n') || 'No log available.'}</pre></details>
        </div>
      )}
      {state.phase === 'info' && <InfoCard info={state.info} log={state.log} />}
      {state.phase === 'done' && (
        <ResultCard
          result={state.result}
          url={state.url}
          inputSize={state.inputSize}
          command={state.command}
          showCommand={showCommand}
          onToggleCommand={() => setShowCommand((v) => !v)}
          onReuse={reuse}
        />
      )}
      </div>
    </main>
  )
}
