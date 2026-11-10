import { isApolloError, useApolloClient, useMutation } from '@apollo/client'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { LOGIN, ME, REGISTER } from '../graphql/operations.ts'
import type { AuthPayload, RegisterInput, User } from '../types.ts'
import { AuthContext } from './context.ts'
import { clearToken, readToken, writeToken } from './storage.ts'

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useApolloClient()
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(() => !readToken())
  const [loginMut] = useMutation<{ login: AuthPayload }, { email: string; password: string }>(LOGIN)
  const [registerMut] = useMutation<{ register: AuthPayload }, { input: RegisterInput }>(REGISTER)

  useEffect(() => {
    if (!readToken()) return
    let active = true

    client
      .query<{ me: User | null }>({ query: ME, fetchPolicy: 'network-only' })
      .then((result) => {
        if (!active) return
        if (result.data.me) setUser(result.data.me)
        else clearToken()
      })
      .catch((error: unknown) => {
        if (!active) return
        const offline = error instanceof Error && isApolloError(error) && Boolean(error.networkError)
        if (!offline) clearToken()
      })
      .finally(() => {
        if (active) setReady(true)
      })

    return () => {
      active = false
    }
  }, [client])

  const login = useCallback(
    async (email: string, password: string) => {
      const { data } = await loginMut({ variables: { email, password } })
      if (!data?.login) throw new Error('Login failed')
      writeToken(data.login.token)
      setUser(data.login.user)
      await client.clearStore().catch(() => undefined)
    },
    [client, loginMut],
  )

  const register = useCallback(
    async (input: RegisterInput) => {
      const { data } = await registerMut({ variables: { input } })
      if (!data?.register) throw new Error('Could not create the account')
      writeToken(data.register.token)
      setUser(data.register.user)
      await client.clearStore().catch(() => undefined)
    },
    [client, registerMut],
  )

  const logout = useCallback(async () => {
    clearToken()
    setUser(null)
    await client.clearStore().catch(() => undefined)
  }, [client])

  const value = useMemo(
    () => ({ user, ready, login, register, logout }),
    [user, ready, login, register, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
