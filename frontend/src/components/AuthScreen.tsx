import { useEffect, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/context.ts'
import { graphqlUrl } from '../graphql/client.ts'
import { errorMessage } from '../lib/errors.ts'
import { isEmail } from '../lib/format.ts'
import { Banner } from './Banner.tsx'
import { Wordmark } from './Brand.tsx'

export function AuthScreen({ mode }: { mode: 'login' | 'register' }) {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  useEffect(() => {
    document.title = mode === 'login' ? 'Sign in · TaskFlow' : 'Create account · TaskFlow'
  }, [mode])

  async function submit(event: FormEvent) {
    event.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    if (mode === 'register' && name.trim().length < 2) {
      setError('Name must be at least 2 characters.')
      return
    }
    if (!isEmail(cleanEmail)) {
      setError('Enter a valid email.')
      return
    }
    if (mode === 'register' && password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!password) {
      setError('Enter your password.')
      return
    }

    setPending(true)
    setError('')
    try {
      if (mode === 'login') await login(cleanEmail, password)
      else await register({ name: name.trim(), email: cleanEmail, password })
      navigate(destinationFrom(location.state), { replace: true })
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="auth">
      <section className="auth-brand">
        <Wordmark />
        <h1>Work, in one quiet board.</h1>
        <p>Projects, members, and tasks for a small team. Sign in, then move work from to do to done.</p>
        <div className="auth-preview" aria-hidden="true">
          <article>
            <span className="pip todo" />
            Draft the brief
          </article>
          <article>
            <span className="pip progress" />
            Review the homepage
          </article>
          <article>
            <span className="pip done" />
            Ship the launch
          </article>
        </div>
      </section>
      <section className="auth-panel">
        <form className="auth-card" onSubmit={(event) => { void submit(event) }}>
          <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
          <p className="lede">
            {mode === 'login'
              ? 'Use the email and password you registered with.'
              : 'You will get a user id you can share so someone can add you to a project.'}
          </p>
          {mode === 'register' && (
            <label className="field">
              <span>Name</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                autoComplete="name"
                autoFocus
              />
            </label>
          )}
          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoFocus={mode === 'login'}
            />
          </label>
          <label className="field">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
            {mode === 'register' && <small>At least 8 characters.</small>}
          </label>
          <Banner message={error} />
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
          <p className="switch">
            {mode === 'login' ? (
              <>
                New here? <Link to="/register">Create an account</Link>
              </>
            ) : (
              <>
                Already registered? <Link to="/login">Sign in</Link>
              </>
            )}
          </p>
          <p className="api-hint">API · {graphqlUrl}</p>
        </form>
      </section>
    </div>
  )
}

function destinationFrom(state: unknown): string {
  if (!state || typeof state !== 'object' || !('from' in state)) return '/'
  const from = (state as { from?: unknown }).from
  if (typeof from !== 'string') return '/'
  if (!from.startsWith('/') || from.startsWith('//')) return '/'
  if (from === '/login' || from === '/register') return '/'
  return from
}
