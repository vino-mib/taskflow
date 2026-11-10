import type { Priority, TaskStatus } from '../types.ts'

export const STATUSES: { value: TaskStatus; label: string }[] = [
  { value: 'TODO', label: 'To do' },
  { value: 'IN_PROGRESS', label: 'In progress' },
  { value: 'DONE', label: 'Done' },
]

export const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'LOW', label: 'Low' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' },
]

export const PAGE_SIZE = 10

export function statusLabel(status: TaskStatus): string {
  return STATUSES.find((item) => item.value === status)?.label ?? status
}

export function priorityLabel(priority: Priority): string {
  return PRIORITIES.find((item) => item.value === priority)?.label ?? priority
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? (parts[1]?.[0] ?? '') : ''
  return (first + second).toUpperCase() || '?'
}

const HUES = [152, 18, 200, 32, 262, 88, 122, 340]

export function avatarHue(id: string): number {
  let total = 0
  for (const char of id) total = (total + char.charCodeAt(0)) % HUES.length
  return HUES[total] ?? 152
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return ''
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number)
  if (!year || !month || !day) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
    ...(year !== new Date().getFullYear() ? { year: 'numeric' as const } : {}),
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function toDateInput(iso: string | null | undefined): string {
  if (!iso) return ''
  return iso.slice(0, 10)
}

export function dateInputToIso(value: string): string | null {
  if (!value) return null
  return `${value}T12:00:00.000Z`
}

export function isOverdue(iso: string | null | undefined, status: TaskStatus): boolean {
  if (!iso || status === 'DONE') return false
  const today = new Date()
  const month = String(today.getMonth() + 1).padStart(2, '0')
  const day = String(today.getDate()).padStart(2, '0')
  return iso.slice(0, 10) < `${today.getFullYear()}-${month}-${day}`
}

export function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}
