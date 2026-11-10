import { avatarHue, initials } from '../lib/format.ts'

export function Avatar({ name, id, size = 'md' }: { name: string; id: string; size?: 'sm' | 'md' }) {
  return (
    <span
      className={`avatar avatar-${size}`}
      style={{ background: `hsl(${avatarHue(id)} 42% 28%)` }}
      title={name}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  )
}
