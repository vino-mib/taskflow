import { ApolloClient, ApolloLink, HttpLink, InMemoryCache, Observable, type DefaultContext } from '@apollo/client'
import { onError } from '@apollo/client/link/error'
import { refreshSession } from '../auth/session.ts'
import { readRefreshToken, readToken } from '../auth/storage.ts'

export const graphqlUrl = import.meta.env.VITE_GRAPHQL_URL || 'http://localhost:4000/graphql'

const authLink = new ApolloLink((operation, forward) => {
  const token = readToken()
  operation.setContext((previous: DefaultContext) => {
    const headers = (previous.headers as Record<string, string> | undefined) ?? {}
    return {
      headers: {
        ...headers,
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    }
  })
  return forward(operation)
})

const SKIP_REFRESH = new Set(['Login', 'Register', 'Refresh', 'Logout'])

// An expired access token comes back as UNAUTHENTICATED. Swap the refresh token once and retry.
const refreshLink = onError(({ graphQLErrors, networkError, operation, forward }) => {
  const unauthenticated = graphQLErrors?.some((error) => error.extensions?.code === 'UNAUTHENTICATED')
  if (!unauthenticated || SKIP_REFRESH.has(operation.operationName) || operation.getContext().refreshed) return
  if (!readRefreshToken()) return

  operation.setContext({ refreshed: true })
  return new Observable((observer) => {
    let subscription: { unsubscribe: () => void } | undefined
    refreshSession().then((result) => {
      if (result === 'ok') {
        subscription = forward(operation).subscribe(observer)
        return
      }
      observer.error(networkError ?? graphQLErrors?.[0] ?? new Error('You must be logged in'))
    })
    return () => subscription?.unsubscribe()
  })
})

export const client = new ApolloClient({
  link: ApolloLink.from([refreshLink, authLink, new HttpLink({ uri: graphqlUrl })]),
  cache: new InMemoryCache(),
})
