import { GraphQLError } from "graphql";

type Code = "UNAUTHENTICATED" | "FORBIDDEN" | "NOT_FOUND" | "BAD_USER_INPUT";

// Consistent, client-friendly errors: message + machine-readable code.
export const appError = (message: string, code: Code) =>
  new GraphQLError(message, { extensions: { code } });
