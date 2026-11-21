import { clearRefreshToken, clearToken, readRefreshToken, writeRefreshToken, writeToken } from './storage.ts'

const graphqlUrl = import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4000/graphql'

export type RefreshResult = 'ok' | 'invalid' | 'offline'

const listeners = new Set<() => void>()
let inflight: Promise<RefreshResult> | null = null

export function onSessionCleared(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function writeSession(token: string, refreshToken: string): void {
  writeToken(token)
  writeRefreshToken(refreshToken)
}

export function clearSession(): void {
  clearToken()
  clearRefreshToken()
  listeners.forEach((listener) => listener())
}

// One refresh at a time. Parallel 401s share this promise and then retry with the new access token.
export function refreshSession(): Promise<RefreshResult> {
  if (!inflight) {
    inflight = refreshOnce().finally(() => {
      inflight = null
    })
  }
  return inflight
}

async function refreshOnce(): Promise<RefreshResult> {
  const refreshToken = readRefreshToken()
  if (!refreshToken) return 'invalid'

  try {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        query: `mutation Refresh($refreshToken: String!) {
          refresh(refreshToken: $refreshToken) { token refreshToken }
        }`,
        variables: { refreshToken },
      }),
    })
    const body = (await response.json()) as {
      data?: { refresh?: { token: string; refreshToken: string } | null }
    }
    const next = body.data?.refresh
    if (!next?.token || !next.refreshToken) {
      clearSession()
      return 'invalid'
    }
    writeSession(next.token, next.refreshToken)
    return 'ok'
  } catch {
    return 'offline'
  }
}
