import { isApolloError, useApolloClient, useMutation } from '@apollo/client'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LOGIN, LOGOUT, ME, REGISTER } from '../graphql/operations.ts'
import type { AuthPayload, RegisterInput, User } from '../types.ts'
import { AuthContext } from './context.ts'
import { clearSession, onSessionCleared, refreshSession, writeSession } from './session.ts'
import { readRefreshToken, readToken } from './storage.ts'

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useApolloClient()
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(() => !readToken() && !readRefreshToken())
  const [loginMut] = useMutation<{ login: AuthPayload }, { email: string; password: string }>(LOGIN)
  const [registerMut] = useMutation<{ register: AuthPayload }, { input: RegisterInput }>(REGISTER)

  useEffect(() => onSessionCleared(() => setUser(null)), [])

  useEffect(() => {
    if (!readToken() && !readRefreshToken()) return
    let active = true

    const loadMe = () => client.query<{ me: User | null }>({ query: ME, fetchPolicy: 'network-only' })

    async function restore() {
      if (readToken()) {
        try {
          const result = await loadMe()
          if (!active) return
          if (result.data.me) {
            setUser(result.data.me)
            return
          }
        } catch (error: unknown) {
          if (!active) return
          const offline = error instanceof Error && isApolloError(error) && Boolean(error.networkError)
          if (offline) return
        }
      }

      if (!readRefreshToken()) {
        clearSession()
        return
      }

      const refreshed = await refreshSession()
      if (!active || refreshed !== 'ok') return
      const result = await loadMe()
      if (!active) return
      if (result.data.me) setUser(result.data.me)
      else clearSession()
    }

    restore()
      .catch(() => undefined)
      .finally(() => {
        if (active) setReady(true)
      })

    return () => {
      active = false
    }
  }, [client])

  const adoptSession = useCallback(
    async (payload: AuthPayload) => {
      const previous = readRefreshToken()
      writeSession(payload.token, payload.refreshToken)
      if (previous && previous !== payload.refreshToken) {
        await client.mutate({ mutation: LOGOUT, variables: { refreshToken: previous } }).catch(() => undefined)
      }
      setUser(payload.user)
      await client.clearStore().catch(() => undefined)
    },
    [client],
  )

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await loginMut({ variables: { email, password } })
      if (!data?.login) throw new Error('Login failed')
      await adoptSession(data.login)
    },
    [adoptSession, loginMut],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      const { data } = await registerMut({ variables: { input } })
      if (!data?.register) throw new Error('Could not create the account')
      await adoptSession(data.register)
    },
    [adoptSession, registerMut],
  )

  const logout = useCallback(async () => {
    const refreshToken = readRefreshToken()
    if (refreshToken) {
      await client.mutate({ mutation: LOGOUT, variables: { refreshToken } }).catch(() => undefined)
    }
    clearSession()
    await client.clearStore().catch(() => undefined)
  }, [client])

  const value = useMemo(
    () => ({ user, ready, login, register, logout }),
    [user, ready, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
