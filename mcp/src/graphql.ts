export const API_URL = process.env.TASKFLOW_API_URL ?? "http://localhost:4000/graphql";

// A GraphQL error returned by the TaskFlow API, with its extension code
// (UNAUTHENTICATED, FORBIDDEN, NOT_FOUND, BAD_USER_INPUT, ...).
export class GraphQLFailure extends Error {
  constructor(message: string, readonly code: string) {
    super(message);
    this.name = "GraphQLFailure";
  }
}

interface GraphQLResponse<T> {
  data?: T | null;
  errors?: { message: string; extensions?: { code?: string } }[];
}

export async function gql<T>(query: string, variables: Record<string, unknown>, token?: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new Error(`Cannot reach TaskFlow API at ${API_URL}. Is the backend running?`);
  }

  const body = (await res.json().catch(() => null)) as GraphQLResponse<T> | null;
  if (!body) throw new Error(`TaskFlow API returned HTTP ${res.status} without a GraphQL response`);

  const [first] = body.errors ?? [];
  if (first) throw new GraphQLFailure(first.message, first.extensions?.code ?? "INTERNAL_SERVER_ERROR");
  if (!body.data) throw new Error("TaskFlow API returned no data");
  return body.data;
}
