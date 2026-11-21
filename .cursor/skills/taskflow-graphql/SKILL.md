---
name: taskflow-graphql
description: >-
  Add or change TaskFlow GraphQL queries, mutations, inputs, and auth rules.
  Use when editing backend/src/graphql, backend/src/services, Mongoose models,
  or when the user asks for a new API field, resolver, or access check.
---

# TaskFlow GraphQL changes

## Checklist

1. Add the type, input, enum, argument, and root field in `backend/src/graphql/typeDefs.ts`.
2. Put the rule in `backend/src/services/`. Call `projectService.assertAccess` before reading or writing a project or its tasks.
3. Resolver: `requireAuth(ctx)` then the service. `register`, `login`, `refresh`, and `logout` stay public.
4. `return await` the Mongoose call. Never return a `Query` from a resolver or from an `async` function without awaiting it.
5. Throw with `appError(message, code)`. Codes: `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `BAD_USER_INPUT`.
6. Add the operation in `frontend/src/graphql/operations.ts` and the result type in `frontend/src/types.ts`. Reuse `UserFields` and `TaskFields`.

## Who can do what

- Owner or member: read the project, create, update, and delete its tasks.
- Owner only: `addMember`. Members are added by user id with `$addToSet`. There is no user search and no `removeMember`.
- Lists: `Project.find({ $or: [{ owner: userId }, { members: userId }] })`. Tasks outside those projects are hidden.

Nested user and project fields go through `ctx.loaders`, which are built in `buildContext` for that request only.

## Example: updateProject

Schema:

```graphql
input UpdateProjectInput {
  name: String
  description: String
}
extend the Mutation:
updateProject(id: ID!, input: UpdateProjectInput!): Project!
```

Service: `assertAccess`, then reject unless `project.owner` is `userId`, then assign only defined fields and `return project.save()`.

Resolver:

```ts
updateProject: (_: unknown, { id, input }: { id: string; input: { name?: string; description?: string } }, ctx: Context) =>
  projectService.update(requireAuth(ctx), id, input),
```

Frontend: a `mutation UpdateProject` that returns `id`, `name`, and `description`, and `refetchQueries: ['Project', 'Projects']`.
