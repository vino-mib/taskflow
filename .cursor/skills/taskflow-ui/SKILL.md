---
name: taskflow-ui
description: >-
  Add or change TaskFlow screens, forms, and Apollo operations. Use when editing
  frontend/src pages, components, auth, or graphql/operations.ts, or when the
  user asks for a new screen, board behavior, filter, or GraphQL call from the UI.
---

# TaskFlow UI changes

## Where things go

- Routes in `frontend/src/App.tsx`: `/login`, `/register`, `/` projects, `/projects/:id`, `/tasks`.
- Operations only in `frontend/src/graphql/operations.ts`. The client in `frontend/src/graphql/client.ts` attaches `Authorization: Bearer <taskflow_token>` and refreshes it from `taskflow_refresh_token` on `UNAUTHENTICATED`.
- Session in `frontend/src/auth/`. Show GraphQL and network failures with `errorMessage` from `frontend/src/lib/errors.ts`.
- After a write, pass `refetchQueries: REFRESH` (`Project`, `Projects`, `Tasks`). `awaitRefetchQueries: true` when the open screen must show the new data before the dialog closes.
- Login and logout call `client.clearStore()` after writing or clearing the token.

## API shapes the UI must follow

- Task status is `TODO`, `IN_PROGRESS`, or `DONE`. Priority is `LOW`, `MEDIUM`, or `HIGH`. New tasks start as `TODO`. `CreateTaskInput` has no status field.
- Send due dates as noon UTC: `` `${yyyyMmDd}T12:00:00.000Z` `` via `dateInputToIso`. Empty description is `""`, not null. Empty assignee is `assigneeId: null`.
- `addMember(projectId, userId)` is owner-only. The UI asks for a user id. The signed-in id is copied from the sidebar. Do not invent an email lookup.
- Page size for `tasks` is `PAGE_SIZE` (10), maximum 50 on the server.

## Screen patterns

- Projects page: `PROJECTS` query, create dialog, then navigate to `/projects/:id`.
- Board: `PROJECT` query, group `tasks` by status, drag calls `updateTask` with only `{ status }` and an optimistic response.
- List and All tasks: `TASKS` with `TaskFilter`. All tasks also loads `PROJECTS` for the filter dropdowns. A project-scoped list passes `projectId` and `members` and skips that second query.
- Protect routes with `RequireAuth`. Public auth screens use `GuestOnly`.

Match the existing warm light theme in `frontend/src/index.css` (`--accent`, Fraunces headings, Outfit body). Do not add a component library for a single control.
