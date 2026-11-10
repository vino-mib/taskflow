import { ApolloClient, ApolloLink, HttpLink, InMemoryCache, type DefaultContext } from '@apollo/client'
import { readToken } from '../auth/storage.ts'

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

export const client = new ApolloClient({
  link: ApolloLink.from([authLink, new HttpLink({ uri: graphqlUrl })]),
  cache: new InMemoryCache(),
})
