# TaskFlow web

React + Vite client for the TaskFlow GraphQL API in `../backend`.

## Run

1. Start the API so GraphQL is available at `http://localhost:4000/graphql`.
2. In this folder:

```bash
npm install
npm run dev
```

Open http://localhost:5173. Register an account, then create a project and tasks.

To point at a different API, copy `.env.example` to `.env` and set `VITE_GRAPHQL_URL`.

After sign-in, the app stores the JWT and sends `Authorization: Bearer <token>` on every GraphQL request.

## Screens and operations

| Screen | GraphQL |
| --- | --- |
| Sign in / register | `login`, `register`, `me` |
| Projects | `projects`, `createProject` |
| Project board | `project`, `createTask`, `updateTask`, `deleteTask`, `addMember` |
| Project list and All tasks | `tasks` with `filter`, `page`, and `pageSize` |

Members are added by user id. Copy yours from the sidebar and share it with a project owner.
