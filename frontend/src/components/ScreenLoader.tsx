import { Wordmark } from './Brand.tsx'

export function ScreenLoader({ label }: { label: string }) {
  return (
    <div className="screen-loader" role="status">
      <Wordmark />
      <p>{label}</p>
    </div>
  )
}
