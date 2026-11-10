# TaskFlow API — learn GraphQL + Node.js + MongoDB

**Stack:** Apollo Server 4 · Express 4 · TypeScript · Mongoose · MongoDB Atlas (free M0)

## The scenario

**TaskFlow** is a small team task tracker (think a mini Trello/Jira):

- Users **register / log in** and get a JWT.
- A user **creates Projects** and invites other users as **members**.
- Inside a project, members create **Tasks** with status (`TODO → IN_PROGRESS → DONE`),
  priority, due date and an optional assignee.
- Users only see projects they own or belong to. Tasks are **filterable and paginated**.

Why this scenario? It exercises everything a real API needs:
relations (User ↔ Project ↔ Task), authentication, authorization, validation,
pagination, filtering, and the N+1 problem (solved with DataLoader).

## Run it

```bash
npm install
cp .env.example .env      # then paste your Atlas connection string + a JWT secret
npm run dev               # http://localhost:4000/graphql
npm run typecheck
```

Open http://localhost:4000/graphql in the browser to use Apollo Sandbox.
To send the token, add the HTTP header: `Authorization: Bearer <token>`.

## Project structure

```
src/
├── index.ts                 # Express + Apollo bootstrap
├── config/  env.ts, db.ts   # validated env vars, Mongo connection
├── models/                  # Mongoose schemas (User, Project, Task)
├── graphql/
│   ├── typeDefs.ts          # the GraphQL schema (the API contract)
│   ├── resolvers.ts         # thin: auth check -> call service
│   └── context.ts           # per-request: userId from JWT + DataLoaders
├── services/                # business logic + authorization rules
└── utils/errors.ts          # error helper with codes
```

Request flow: `HTTP → Express → Apollo → resolver → service → Mongoose → MongoDB`

## Try these operations (in order)

```graphql
# 1) Register (no token needed)
mutation {
  register(input: { name: "Asha", email: "asha@example.com", password: "password123" }) {
    token
    user { id name }
  }
}

# 2) Create a project (add the token header first)
mutation {
  createProject(input: { name: "Website Revamp", description: "Q1 launch" }) { id name }
}

# 3) Create a task (use the project id from step 2)
mutation {
  createTask(input: { projectId: "PROJECT_ID", title: "Design homepage", priority: HIGH }) {
    id title status
  }
}

# 4) Update status
mutation {
  updateTask(id: "TASK_ID", input: { status: IN_PROGRESS }) { id status }
}

# 5) Nested query (watch DataLoader batch the user lookups)
query {
  projects {
    name
    owner { name }
    members { name email }
    tasks(status: IN_PROGRESS) { title assignee { name } }
  }
}

# 6) Filter + paginate
query {
  tasks(filter: { status: TODO }, page: 1, pageSize: 5) {
    total page pageSize
    items { title priority dueDate }
  }
}
```

## Learning path (follow in this order)

**Week 1 — Foundations**
1. TypeScript basics: types, interfaces, generics, `async/await` (typescriptlang.org/docs, "TypeScript for JS Programmers").
2. Node + Express: routing, middleware, JSON bodies. Build a tiny REST endpoint first.
3. MongoDB concepts: documents, collections, queries, indexes (MongoDB University free courses).

**Week 2 — GraphQL core** (graphql.org/learn)
4. Schema, types, `Query` vs `Mutation`, scalars, enums, input types, non-null `!`.
5. Resolvers: `(parent, args, context, info)`. Run the hello-world from Apollo's Getting Started docs.
6. In this project: read `typeDefs.ts`, then `resolvers.ts` side by side.

**Week 3 — Data layer** (mongoosejs.com/docs)
7. Mongoose schemas, models, validation, `ref`, `select: false`, indexes, timestamps.
8. Read `models/` then `services/`. Notice how queries use `$or`, `$in`, `$addToSet`, `skip/limit`.

**Week 4 — Real-world concerns**
9. Auth: password hashing (bcrypt), JWT, context, authorization in services.
10. DataLoader and the N+1 problem. Experiment: remove the loaders from `Project.owner`,
    enable `mongoose.set("debug", true)`, run query #5 and count DB calls. Put loaders back and compare.
11. Error handling (`GraphQLError` + extension codes), input validation with Zod.

**Week 5+ — Level up**
12. Tests (Vitest/Jest + `mongodb-memory-server`, or a test Atlas DB).
13. GraphQL Code Generator to replace the `any` types in resolvers with generated types.
14. Production hardening: Helmet, rate limiting, query depth/complexity limits, disable introspection (already done when `NODE_ENV=production`), logging.
15. Upgrade to Apollo Server 5 (uses `@as-integrations/express5`) once you're comfortable.

## Exercises (do these to really learn)

1. Add `Comment` (task, author, text) with `addComment` mutation and `Task.comments` field.
2. Add `removeMember` (owner only) and `updateProject` / `deleteProject` (delete should remove its tasks).
3. Add text search: `tasks(search: "homepage")` using a Mongo text index.
4. Add cursor-based pagination instead of page/pageSize.
5. Add a `myTasks` query (tasks assigned to me across all projects).
6. Add a `taskStats(projectId)` query using a Mongo aggregation (count per status).
7. Add refresh tokens, or roles (`ADMIN`, `MEMBER`).

## Common gotchas

- Atlas: add your IP under *Network Access*, and URL-encode special characters in the DB password.
- Never commit `.env`. Use a strong `JWT_SECRET`.
- Create DataLoaders **per request** (in context), never globally, or caches leak between users.
- Resolvers should stay thin; keep rules (who can do what) in services.
