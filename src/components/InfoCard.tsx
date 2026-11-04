import { toRows, type MediaInfo } from '../ffmpeg/probe'

export function InfoCard({ info, log }: { info: MediaInfo | null; log: string[] }) {
  return (
    <div className="result">
      {info ? (
        <table className="info">
          <tbody>{toRows(info).map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody>
        </table>
      ) : (
        <p>This file seems damaged or isn't a video, audio or image file.</p>
      )}
      <details><summary>Technical details</summary><pre>{log.join('\n')}</pre></details>
    </div>
  )
}
