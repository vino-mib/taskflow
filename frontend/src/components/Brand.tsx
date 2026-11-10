export function Mark() {
  return (
    <svg className="mark" viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#1f6b56" />
      <path
        d="M8 21c3.2-6.4 5.6-7 8.2-3.2 2.2 3.2 3.6 3.4 8-5.2"
        fill="none"
        stroke="#e7f6f0"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
      <circle cx="8" cy="21" r="1.7" fill="#f4efe6" />
      <circle cx="24.2" cy="12.6" r="1.7" fill="#e7a15a" />
    </svg>
  )
}

export function Wordmark() {
  return (
    <span className="wordmark">
      <Mark />
      <span>TaskFlow</span>
    </span>
  )
}
