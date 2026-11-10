import { isApolloError } from '@apollo/client'
import { graphqlUrl } from '../graphql/client.ts'

export function errorMessage(error: unknown): string {
  if (error instanceof Error && isApolloError(error)) {
    const message = error.graphQLErrors[0]?.message
    if (message) return message
    if (error.networkError) return offlineMessage()
  }
  if (error instanceof Error && error.message) {
    if (/failed to fetch|networkerror|network request failed|load failed/i.test(error.message)) {
      return offlineMessage()
    }
    return error.message
  }
  return 'Something went wrong.'
}

function offlineMessage(): string {
  return `Cannot reach the TaskFlow API at ${graphqlUrl}. Start the backend and try again.`
}
