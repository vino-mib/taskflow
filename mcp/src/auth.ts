import { gql, GraphQLFailure } from "./graphql.js";
import { browserLogin } from "./loginPage.js";
import { clearSession, loadSession, saveSession, type Session } from "./session.js";

const REFRESH = `mutation Refresh($refreshToken: String!) {
  refresh(refreshToken: $refreshToken) { token refreshToken }
}`;

// Thrown when the user has to sign in again (no session, or the refresh token is dead).
export class SignInRequired extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SignInRequired";
  }
}

// Concurrent tool calls share one sign-in or one refresh. Refresh tokens rotate,
// so two parallel refreshes with the same token would invalidate each other.
let signingIn: Promise<Session> | null = null;
let refreshing: Promise<Session> | null = null;

export function signIn(): Promise<Session> {
  if (!signingIn) {
    signingIn = (async () => {
      try {
        const session = await browserLogin();
        await saveSession(session);
        return session;
      } finally {
        signingIn = null;
      }
    })();
  }
  return signingIn;
}

async function refreshFrom(stale: Session): Promise<Session> {
  // Another call may have refreshed while this one was waiting.
  const current = await loadSession();
  if (current && current.token !== stale.token) return current;

  if (!refreshing) {
    refreshing = (async () => {
      try {
        const data = await gql<{ refresh: { token: string; refreshToken: string } }>(REFRESH, {
          refreshToken: stale.refreshToken,
        });
        const next: Session = { ...stale, token: data.refresh.token, refreshToken: data.refresh.refreshToken };
        await saveSession(next);
        return next;
      } catch (err) {
        // The refresh token expired or was revoked: the user has to sign in again.
        if (err instanceof GraphQLFailure && err.code === "UNAUTHENTICATED") {
          await clearSession();
          throw new SignInRequired("Your TaskFlow session expired. Use the login tool to sign in again.");
        }
        throw err;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

interface CallOptions {
  // false: never open the browser. Fail instead if the user is not signed in.
  // Used for background requests such as listing resources when Claude connects.
  interactive?: boolean;
}

// Runs a GraphQL operation as the signed-in user. Signs in if needed, and refreshes
// once when the access token has expired (UNAUTHENTICATED), then retries.
export async function callApi<T>(
  query: string,
  variables: Record<string, unknown>,
  { interactive = true }: CallOptions = {},
): Promise<T> {
  let session = await loadSession();
  if (!session) {
    if (!interactive) throw new SignInRequired("Not signed in to TaskFlow. Use the login tool.");
    session = await signIn();
  }

  try {
    return await gql<T>(query, variables, session.token);
  } catch (err) {
    if (!(err instanceof GraphQLFailure && err.code === "UNAUTHENTICATED")) throw err;
  }

  try {
    const fresh = await refreshFrom(session);
    return await gql<T>(query, variables, fresh.token);
  } catch (err) {
    if (err instanceof SignInRequired && interactive) {
      const next = await signIn();
      return gql<T>(query, variables, next.token);
    }
    throw err;
  }
}
