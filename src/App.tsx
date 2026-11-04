import { useEffect, useRef, useState } from 'react'
import { ButtonGrid } from './components/ButtonGrid'
import { CropPicker, type CropRect } from './components/CropPicker'
import { DropZone } from './components/DropZone'
import { ExtraFile } from './components/ExtraFile'
import { FileList } from './components/FileList'
import { InfoCard } from './components/InfoCard'
import { OptionsPanel } from './components/OptionsPanel'
import { ProgressBar } from './components/ProgressBar'
import { ResultCard } from './components/ResultCard'
import { screenshot } from './features/images'
import { defaultValues, firstError } from './features/options'
import { features } from './features/registry'
import { willReencode, type Feature, type OptionValues } from './features/types'
import { UserError } from './features/util'
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

/** Buttons with options or extra inputs show a panel first; the rest run on click. */
const needsPanel = (f: Feature) => f.options.length > 0 || !!f.multiFile || !!f.extraInput || !!f.picker

export default function App() {
  const [file, setFile] = useState<File | null>(null)
  const [extras, setExtras] = useState<File[]>([]) // more files for multi-file buttons
  const [logo, setLogo] = useState<File | null>(null) // the separate extra input (watermark)
  const [fileInfo, setFileInfo] = useState<MediaInfo | null>(null)
  const [state, setState] = useState<State>({ phase: 'idle' })
  const [selected, setSelected] = useState<Feature | null>(null)
  const [values, setValues] = useState<OptionValues>({})
  const [probing, setProbing] = useState(false)
  const [framing, setFraming] = useState(false)
  const [frameUrl, setFrameUrl] = useState<string | null>(null) // a frame of the video, for Crop
  const [notice, setNotice] = useState<{ level: 'warn' | 'refuse'; message: string } | null>(null)
  const [showCommand, setShowCommand] = useState(false)
  const [job, setJob] = useState<Job | null>(null)
  const top = useRef<HTMLHeadingElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const statusRef = useRef<HTMLDivElement>(null)
  const working = probing || framing || state.phase === 'loading' || state.phase === 'running'

  // Free the previous result's blob URL whenever the state moves on.
  useEffect(() => () => { if (state.phase === 'done') URL.revokeObjectURL(state.url) }, [state])
  useEffect(() => () => { if (frameUrl) URL.revokeObjectURL(frameUrl) }, [frameUrl])

  // On small screens the options panel / results are below the fold: bring them into view.
  useEffect(() => {
    if (selected && needsPanel(selected)) panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [selected])
  useEffect(() => {
    if (state.phase !== 'idle') statusRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [state.phase])

  /** Accept a file (size-checked), then read its duration/resolution. Probe failures are silent. */
  async function choose(f: File, keepExtras = false) {
    const size = checkSize(f.size)
    if (size.level === 'refuse') return setNotice(size) // keep the previous file, if any
    setNotice(size.level === 'warn' ? size : null)
    setFile(f)
    if (!keepExtras) setExtras([])
    setFileInfo(null)
    setState({ phase: 'idle' })
    setProbing(true)
    try {
      setFileInfo(parseInfo(await probe(f, {
        onLoading: () => setState({ phase: 'loading' }),
        onLoaded: () => setState({ phase: 'idle' }),
      })))
    } catch { /* the buttons still work; the summary is a nice-to-have */ }
    setState((s) => (s.phase === 'loading' ? { phase: 'idle' } : s))
    setProbing(false)
  }

  /** The list shown for multi-file buttons was reordered / trimmed: the first file is the main one. */
  function applyList(list: File[]) {
    setExtras(list.slice(1))
    if (list[0] !== file) choose(list[0], true)
  }

  function addFiles(more: File[]) {
    const ok = more.filter((f) => checkSize(f.size).level !== 'refuse')
    if (ok.length < more.length) setNotice({ level: 'refuse', message: 'Some files are over 2 GB and were skipped.' })
    setExtras((e) => [...e, ...ok])
  }

  // Crop: grab one frame of the video to draw on, and start with a centred rectangle.
  const cropWanted = selected?.picker === 'crop' && file && !probing
  useEffect(() => {
    if (!cropWanted || !file) return
    let stale = false
    ;(async () => {
      setFraming(true)
      setFrameUrl(null)
      try {
        const at = fileInfo?.durationSec ? Math.min(1, fileInfo.durationSec / 2) : 0
        const r = await run(screenshot, { files: [file] }, { time: String(at) }, {
          onLoading: () => setState({ phase: 'loading' }),
          onLoaded: () => setState({ phase: 'idle' }),
        })
        if (stale || !r.blob) return
        const url = URL.createObjectURL(r.blob)
        const img = new Image()
        img.onload = () => {
          if (stale) return
          const w = Math.round(img.naturalWidth * 0.8), h = Math.round(img.naturalHeight * 0.8)
          setValues((v) => ({ ...v, x: Math.round((img.naturalWidth - w) / 2), y: Math.round((img.naturalHeight - h) / 2), w, h }))
        }
        img.src = url
        setFrameUrl(url)
      } catch {
        if (!stale) setNotice({ level: 'warn', message: "Couldn't load a preview frame. You can still type the crop numbers by hand." })
      } finally {
        setState((s) => (s.phase === 'loading' ? { phase: 'idle' } : s))
        setFraming(false)
      }
    })()
    return () => { stale = true }
    // fileInfo is read only to choose the frame time; re-running when it changes would just repeat the work
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropWanted, file])

  const inputFiles = (feature: Feature) => (file ? (feature.multiFile ? [file, ...extras] : [file]) : [])

  function commandFor(feature: Feature, opts: OptionValues): string {
    try {
      return commandString(feature, inputFiles(feature).map((f) => f.name), opts, logo?.name)
    } catch {
      return '' // e.g. a required extra file isn't chosen yet
    }
  }

  async function start(feature: Feature, opts: OptionValues) {
    if (!file) return
    const seconds = willReencode(feature, opts) ? estimateSeconds(fileInfo) : null
    setJob({ startedAt: Date.now(), estimate: seconds === null ? undefined : formatEstimate(seconds) })
    setState({ phase: 'running', progress: null }) // indeterminate until real progress arrives
    const files = inputFiles(feature)
    const command = commandFor(feature, opts)
    try {
      const result = await run(feature, { files, extra: feature.extraInput ? logo ?? undefined : undefined }, opts, {
        onProgress: (p) => setState({ phase: 'running', progress: p }),
        onLoading: () => setState({ phase: 'loading' }),
        onLoaded: () => setState({ phase: 'running', progress: null }),
      })
      if (!result.blob) return setState({ phase: 'info', info: parseInfo(result.log), log: result.log })
      setState({ phase: 'done', result: { ...result, blob: result.blob }, url: URL.createObjectURL(result.blob), command, inputSize: files.reduce((n, f) => n + f.size, 0) })
    } catch (e) {
      if (e instanceof CancelledError) return setState({ phase: 'idle' })
      if (e instanceof UserError) return setState({ phase: 'error', message: e.message, log: [] })
      const log = e instanceof EngineError ? e.log : []
      setState({ phase: 'error', message: friendlyError(e instanceof Error ? e.message : String(e), log), log })
    }
  }

  function reuse() {
    if (state.phase !== 'done') return
    const { blob, outputName } = state.result
    setSelected(null)
    if (blob.type === 'application/zip') return // nothing to feed back in
    choose(new File([blob], outputName, { type: blob.type }))
    top.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const optionError = selected ? firstError(selected.options, values) : null
  const previewEstimate = selected && willReencode(selected, values) ? estimateSeconds(fileInfo) : null
  const blocker = (() => {
    if (!selected) return null
    if (selected.multiFile && inputFiles(selected).length < (selected.minFiles ?? 1)) return 'Add more files to continue.'
    if (selected.extraInput && !logo) return `${selected.extraInput.label}: choose a file first.`
    if (selected.picker && !frameUrl) return framing ? 'Loading a preview frame…' : null
    return null
  })()

  return (
    <main>
      <h1 ref={top}>FFmpeg Buttons</h1>
      <DropZone file={file} onFile={(f) => choose(f)} disabled={working} summary={fileInfo ? summarize(fileInfo) : ''} />
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
          if (!needsPanel(f)) start(f, v) // nothing to ask: run right away
        }}
      />

      <div ref={panelRef} className="slot">
        {selected && file && needsPanel(selected) && (
          <OptionsPanel
            feature={selected}
            values={values}
            disabled={working}
            onChange={setValues}
            onRun={() => start(selected, values)}
            command={optionError || blocker ? '' : commandFor(selected, values)}
            showCommand={showCommand}
            onToggleCommand={() => setShowCommand((v) => !v)}
            estimate={previewEstimate === null ? undefined : formatEstimate(previewEstimate)}
            blocker={blocker}
          >
            {selected.multiFile && (
              <FileList
                files={inputFiles(selected)}
                accepts={selected.accepts}
                minFiles={selected.minFiles ?? 1}
                disabled={working}
                onChange={applyList}
                onAdd={addFiles}
              />
            )}
            {selected.extraInput && (
              <ExtraFile label={selected.extraInput.label} accept={selected.extraInput.accept} file={logo} disabled={working} onFile={setLogo} />
            )}
            {selected.picker === 'crop' && frameUrl && (
              <CropPicker
                src={frameUrl}
                rect={{ x: Number(values.x), y: Number(values.y), w: Number(values.w), h: Number(values.h) }}
                onChange={(r: CropRect) => setValues((v) => ({ ...v, ...r }))}
              />
            )}
          </OptionsPanel>
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
            {state.log.length > 0 && <details><summary>Technical details</summary><pre>{state.log.join('\n')}</pre></details>}
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
