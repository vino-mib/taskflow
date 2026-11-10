import { Link, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../auth/context.ts'
import { Avatar } from './Avatar.tsx'
import { Wordmark } from './Brand.tsx'
import { useToast } from './toast-context.ts'

export function Shell() {
  const { user, logout } = useAuth()
  const toast = useToast()
  const { pathname } = useLocation()
  const projectsActive = pathname === '/' || pathname.startsWith('/projects/')
  const tasksActive = pathname === '/tasks'

  async function copyId() {
    if (!user) return
    try {
      await navigator.clipboard.writeText(user.id)
      toast('User id copied')
    } catch {
      toast('Could not copy the user id')
    }
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <Link to="/" className="wordmark-link">
          <Wordmark />
        </Link>
        <nav className="nav" aria-label="Primary">
          <Link
            className={projectsActive ? 'nav-link is-active' : 'nav-link'}
            to="/"
            aria-current={pathname === '/' ? 'page' : undefined}
          >
            Projects
          </Link>
          <Link
            className={tasksActive ? 'nav-link is-active' : 'nav-link'}
            to="/tasks"
            aria-current={tasksActive ? 'page' : undefined}
          >
            All tasks
          </Link>
        </nav>
        {user && (
          <div className="sidebar-user">
            <Avatar name={user.name} id={user.id} />
            <div className="who">
              <strong>{user.name}</strong>
              <span title={user.email}>{user.email}</span>
            </div>
            <button type="button" className="id-chip" onClick={() => { void copyId() }} title="Copy user id">
              {user.id}
            </button>
            <button type="button" className="btn-sidebar" onClick={() => { void logout() }}>
              Log out
            </button>
          </div>
        )}
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
