# TaskFlow

TaskFlow is a small team task tracker, similar to a mini Trello or Jira. Users sign up, create projects, invite teammates by user id, and move tasks through `TODO → IN_PROGRESS → DONE`.

- **`backend/`**: GraphQL API (Apollo Server 4, Express, TypeScript, Mongoose, MongoDB)
- **`frontend/`**: React + Vite web app (Apollo Client, React Router)

## Features

- Register, log in, and stay signed in with a JWT (7-day expiry)
- Projects you own or belong to, with members
- Tasks with status, priority, due date, description, and assignee
- Drag-and-drop board per project, plus a list view
- All-tasks view with filters (project, status, assignee) and pagination

## Project structure

```
taskflow-api/
├── backend/            GraphQL API (see backend/README.md)
│   └── src/
│       ├── index.ts        Express + Apollo bootstrap
│       ├── graphql/        typeDefs.ts (schema), resolvers.ts, context.ts
│       ├── services/       business logic and access rules
│       ├── models/         Mongoose schemas (User, Project, Task)
│       └── config/         env validation, MongoDB connection
└── frontend/           React + Vite app (see frontend/README.md)
    └── src/
        ├── graphql/        Apollo client and operations
        ├── auth/           session and token storage
        ├── pages/          Projects, Project board, All tasks
        └── components/     shared UI
```

## Prerequisites

- Node.js 20 or newer
- A MongoDB database (MongoDB Atlas free tier works)

## Setup

### 1. Backend

```bash
cd backend
npm install
```

Create `backend/.env`:

```env
PORT=4000
NODE_ENV=development
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/taskflow?retryWrites=true&w=majority
JWT_SECRET=any-long-random-string-16-chars-or-more
```

- URL-encode special characters in the database password (for example `@` becomes `%40`).
- In Atlas, allow your IP under **Network Access**. Without it the server fails at startup with `Could not connect to any servers`.
- Never commit `.env`. The root `.gitignore` already excludes it.

Start the API:

```bash
npm run dev
```

GraphQL is available at http://localhost:4000/graphql. Apollo Sandbox loads there in a browser.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

The app reads the API address from `VITE_GRAPHQL_URL`, which defaults to `http://localhost:4000/graphql`. To change it, create `frontend/.env`:

```env
VITE_GRAPHQL_URL=http://localhost:4000/graphql
```

## Scripts

| Location | Command | What it does |
| --- | --- | --- |
| `backend` | `npm run dev` | Run the API with hot reload |
| `backend` | `npm run build` | Compile TypeScript to `dist/` |
| `backend` | `npm start` | Run the compiled build |
| `backend` | `npm run typecheck` | Type-check without emitting files |
| `frontend` | `npm run dev` | Run the Vite dev server |
| `frontend` | `npm run build` | Type-check and produce a production build |
| `frontend` | `npm run lint` | Run oxlint |
| `frontend` | `npm run preview` | Serve the production build locally |

## Using the API

Every request goes to `POST /graphql`. Operations that need a user send the JWT in a header:

```
Authorization: Bearer <token>
```

Get a token from `login` or `register`:

```graphql
mutation {
  login(email: "asha@example.com", password: "password123") {
    token
    user { id name }
  }
}
```

Then query your projects with that header:

```graphql
query {
  projects {
    id
    name
    owner { name }
    members { id name email }
    tasks(status: TODO) { id title priority }
  }
}
```

Main operations:

| Kind | Operation | Purpose |
| --- | --- | --- |
| Query | `me` | Current user |
| Query | `projects` | Projects you can access |
| Query | `project(id)` | One project with access check |
| Query | `tasks(filter, page, pageSize)` | Paginated tasks across accessible projects |
| Mutation | `register`, `login` | Create an account or sign in |
| Mutation | `createProject`, `addMember` | Create a project, add a member by user id (owner only) |
| Mutation | `createTask`, `updateTask`, `deleteTask` | Manage tasks |

The full schema lives in `backend/src/graphql/typeDefs.ts`.

## Troubleshooting

- **`Could not connect to any servers in your MongoDB Atlas cluster`**: add your current IP under Atlas **Network Access**, then restart `npm run dev`.
- **`UNAUTHENTICATED` on every request**: the token is missing, malformed, or expired. Log in again.
- **Frontend shows "Cannot reach the TaskFlow API"**: the backend is not running, or `VITE_GRAPHQL_URL` points to the wrong address.

## More documentation

- [backend/README.md](backend/README.md): API internals, GraphQL learning path, exercises
- [frontend/README.md](frontend/README.md): frontend screens and how they map to operations
