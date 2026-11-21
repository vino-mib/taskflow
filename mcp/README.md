# TaskFlow MCP server

A [Model Context Protocol](https://modelcontextprotocol.io) server that lets Claude Desktop or Claude Code read and manage your TaskFlow projects and tasks. It calls the TaskFlow GraphQL API in `backend/`, so the same access rules apply: you can only see and change projects you own or belong to.

## What it exposes

### Tools

| Tool | Purpose |
| --- | --- |
| `login` | Open the sign-in page in your browser. Other tools sign in automatically when needed |
| `list_projects` | Projects you own or belong to, with owner, members, and task counts by status. Use it to find a project id |
| `get_project` | One project with its members and all of its tasks, grouped by status |
| `create_project` | Create a project. You become its owner and first member |
| `update_project` | Rename a project or change its description. Owner only |
| `delete_project` | Delete a project **and all of its tasks**. Owner only. Requires `confirm: true` |
| `add_member` | Add a user to a project by user id. Owner only |
| `list_tasks` | Tasks you can access. Defaults to `TODO`. Filter by `status` or `projectId`, paged with `page` and `pageSize` (max 50) |
| `create_task` | Create a task in a project. New tasks start as `TODO` |
| `update_task` | Change any of a task's fields. Pass only the fields to change |
| `delete_task` | Delete one task |

`delete_project` deletes nothing unless `confirm` is `true`. Without it, the tool reports how many tasks would be lost, so Claude should ask you before confirming.

### Resources

Resources are read-only context you can attach to a chat.

| URI | Contents |
| --- | --- |
| `taskflow://projects` | Every project you can access, with task counts by status |
| `taskflow://projects/{id}` | One project with its members and tasks grouped by status |

### Prompts

Prompts are reusable workflows you pick from the prompt menu.

| Prompt | Arguments | What it does |
| --- | --- | --- |
| `daily_standup` | none | Summarizes in-progress, overdue, and next TODO tasks across projects. Read-only |
| `plan_project` | `goal`, optional `projectId` | Proposes 5 to 10 tasks for a goal and creates them after you confirm |
| `break_down_task` | `projectId`, `task` (id or title) | Proposes subtasks for one task and creates them after you confirm |

## Requirements

- Node.js 18 or newer
- The TaskFlow backend running (`npm run dev` in `backend/`). The server calls `http://localhost:4000/graphql` by default
- A TaskFlow account

## Setup

```bash
cd mcp
npm install
```

Check that the server starts (it waits for input on stdin, so stop it with Ctrl+C):

```bash
npm start
```

## Sign-in

The server never asks Claude for your password, and it never stores it. The first time a tool needs you signed in, it:

1. Starts a small server on `127.0.0.1` and opens a sign-in page in your browser. The URL is also printed to stderr if the browser doesn't open.
2. Sends your email and password from that page to the TaskFlow API.
3. Saves the returned access and refresh tokens to `~/.taskflow-mcp/session.json` (on Windows, `C:\Users\<you>\.taskflow-mcp\session.json`), readable only by your user where the OS supports it.

The access token expires after 1 hour, so the server refreshes it automatically. Refresh tokens rotate on every refresh, and the new one is saved each time. The refresh token lasts 7 days. After that, or after you sign out elsewhere, the next tool call asks you to sign in again.

The sign-in page times out after 5 minutes.

Listing resources never opens the sign-in page. Until you have signed in, the resource list is empty.

To sign out, delete `~/.taskflow-mcp/session.json`.

## Connect to Claude Desktop

Add the server to `claude_desktop_config.json` (on Windows, `%APPDATA%\Claude\claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "taskflow": {
      "command": "C:\\nvm4w\\nodejs\\node.exe",
      "args": [
        "C:\\Users\\<you>\\Downloads\\taskflow-api\\mcp\\node_modules\\tsx\\dist\\cli.mjs",
        "C:\\Users\\<you>\\Downloads\\taskflow-api\\mcp\\src\\server.ts"
      ],
      "env": {
        "TASKFLOW_API_URL": "http://localhost:4000/graphql"
      }
    }
  }
}
```

Replace the paths with your own. `command` is the full path to your Node.js binary (`where node` on Windows, `which node` on macOS and Linux). Using the full path means Claude always runs the Node version you tested with.

Then fully quit Claude Desktop, including the system tray icon, and reopen it. Closing the window isn't enough, because the app only reads the config at launch.

## Connect to Claude Code

```bash
claude mcp add taskflow \
  -e TASKFLOW_API_URL=http://localhost:4000/graphql \
  -- node "C:\Users\<you>\Downloads\taskflow-api\mcp\node_modules\tsx\dist\cli.mjs" "C:\Users\<you>\Downloads\taskflow-api\mcp\src\server.ts"
```

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `TASKFLOW_API_URL` | `http://localhost:4000/graphql` | TaskFlow GraphQL endpoint |

## Project layout

```
mcp/
  src/
    server.ts     Tools, resources, and prompts
    auth.ts       Sign-in, token refresh, and the callApi helper
    loginPage.ts  Browser sign-in page served on 127.0.0.1
    graphql.ts    Minimal GraphQL client for the TaskFlow API
    session.ts    Reads and writes ~/.taskflow-mcp/session.json
```

## Development

```bash
npm run typecheck   # tsc --noEmit
```

Keep stdout clean. In stdio mode the MCP protocol uses stdout, so log to stderr with `console.error`. A stray `console.log` breaks the connection.

When you add or rename a GraphQL operation, update the matching query in `server.ts` and check it against the backend schema in `backend/src/graphql/typeDefs.ts`.

## Troubleshooting

- **`Cannot reach TaskFlow API`**: the backend isn't running, or `TASKFLOW_API_URL` points somewhere else. Start `npm run dev` in `backend/`.
- **`Your TaskFlow session expired`**: the refresh token is no longer valid. Ask Claude to use the `login` tool.
- **Server missing from Claude Desktop**: check the config JSON, then fully quit and reopen the app.
- **`ReplicaSetNoPrimary` or Atlas errors in the backend**: this is a MongoDB connection problem, not an MCP one. Check your IP under Atlas **Network Access**.
