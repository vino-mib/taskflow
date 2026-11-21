import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { callApi, signIn } from "./auth.js";
import { GraphQLFailure } from "./graphql.js";

// stdout carries the MCP protocol in stdio mode, so all logging goes to stderr.

// ---------------------------------------------------------------------------
// GraphQL operations
// ---------------------------------------------------------------------------

const TASK_CORE = `
  id title description status priority dueDate
  assignee { id name }
`;

const TASK_FIELDS = `
  ${TASK_CORE}
  project { id name }
`;

const PROJECT_FIELDS = `
  id name description createdAt
  owner { id name }
  members { id name }
`;

const LIST_TASKS = `query Tasks($filter: TaskFilter, $page: Int, $pageSize: Int) {
  tasks(filter: $filter, page: $page, pageSize: $pageSize) {
    total page pageSize
    items { ${TASK_FIELDS} }
  }
}`;

const CREATE_TASK = `mutation CreateTask($input: CreateTaskInput!) {
  createTask(input: $input) { ${TASK_FIELDS} }
}`;

const UPDATE_TASK = `mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) {
  updateTask(id: $id, input: $input) { ${TASK_FIELDS} }
}`;

const DELETE_TASK = `mutation DeleteTask($id: ID!) {
  deleteTask(id: $id)
}`;

const LIST_PROJECTS = `query Projects {
  projects { ${PROJECT_FIELDS} tasks { id status } }
}`;

const PROJECT_NAMES = `query ProjectNames {
  projects { id name }
}`;

const GET_PROJECT = `query Project($id: ID!) {
  project(id: $id) { ${PROJECT_FIELDS} tasks { ${TASK_CORE} } }
}`;

const PROJECT_BRIEF = `query ProjectBrief($id: ID!) {
  project(id: $id) { id name tasks { id } }
}`;

const CREATE_PROJECT = `mutation CreateProject($input: CreateProjectInput!) {
  createProject(input: $input) { ${PROJECT_FIELDS} }
}`;

const UPDATE_PROJECT = `mutation UpdateProject($id: ID!, $input: UpdateProjectInput!) {
  updateProject(id: $id, input: $input) { ${PROJECT_FIELDS} }
}`;

const DELETE_PROJECT = `mutation DeleteProject($id: ID!) {
  deleteProject(id: $id)
}`;

const ADD_MEMBER = `mutation AddMember($projectId: ID!, $userId: ID!) {
  addMember(projectId: $projectId, userId: $userId) { ${PROJECT_FIELDS} }
}`;

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const STATUS = z.enum(["TODO", "IN_PROGRESS", "DONE"]);
const PRIORITY = z.enum(["LOW", "MEDIUM", "HIGH"]);
const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

// The API stores due dates as a timestamp. Noon UTC keeps the calendar day stable.
const toDueDate = (date: string) => `${date}T12:00:00.000Z`;

const text = (value: unknown): CallToolResult => ({
  content: [{ type: "text", text: typeof value === "string" ? value : JSON.stringify(value, null, 2) }],
});

const failure = (err: unknown): CallToolResult => ({
  isError: true,
  content: [
    {
      type: "text",
      text:
        err instanceof GraphQLFailure ? `${err.code}: ${err.message}` : err instanceof Error ? err.message : String(err),
    },
  ],
});

async function run(fn: () => Promise<unknown>): Promise<CallToolResult> {
  try {
    return text(await fn());
  } catch (err) {
    return failure(err);
  }
}

interface TaskRow {
  status: string;
}

interface ProjectRow {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  owner: { id: string; name: string };
  members: { id: string; name: string }[];
}

const countByStatus = (tasks: TaskRow[]) => ({
  TODO: tasks.filter((t) => t.status === "TODO").length,
  IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS").length,
  DONE: tasks.filter((t) => t.status === "DONE").length,
});

const groupByStatus = <T extends TaskRow>(tasks: T[]) => ({
  TODO: tasks.filter((t) => t.status === "TODO"),
  IN_PROGRESS: tasks.filter((t) => t.status === "IN_PROGRESS"),
  DONE: tasks.filter((t) => t.status === "DONE"),
});

async function listProjects() {
  const data = await callApi<{ projects: (ProjectRow & { tasks: TaskRow[] })[] }>(LIST_PROJECTS, {});
  return data.projects.map(({ tasks, ...project }) => ({ ...project, taskCounts: countByStatus(tasks) }));
}

async function loadProject(id: string) {
  const data = await callApi<{ project: ProjectRow & { tasks: (TaskRow & { id: string })[] } }>(GET_PROJECT, { id });
  const { tasks, ...project } = data.project;
  return { ...project, taskCounts: countByStatus(tasks), tasks: groupByStatus(tasks) };
}

const today = () => new Date().toISOString().slice(0, 10);

const server = new McpServer({ name: "taskflow", version: "1.1.0" });

// ---------------------------------------------------------------------------
// Tools: sign-in
// ---------------------------------------------------------------------------

server.registerTool(
  "login",
  {
    description:
      "Sign in to TaskFlow. Opens a sign-in page in the browser where the user enters their TaskFlow email and password. Other tools sign in automatically when needed.",
    inputSchema: {},
  },
  async () => run(async () => `Signed in to TaskFlow as ${(await signIn()).email}.`),
);

// ---------------------------------------------------------------------------
// Tools: projects
// ---------------------------------------------------------------------------

server.registerTool(
  "list_projects",
  {
    description:
      "List the projects the user owns or belongs to, with owner, members, and task counts by status. Use this to find a project id.",
    inputSchema: {},
  },
  async () => run(listProjects),
);

server.registerTool(
  "get_project",
  {
    description: "Get one project with its members and all of its tasks grouped by status.",
    inputSchema: {
      id: z.string().min(1).describe("Project id"),
    },
  },
  async ({ id }) => run(() => loadProject(id)),
);

server.registerTool(
  "create_project",
  {
    description: "Create a project. The user becomes its owner and first member.",
    inputSchema: {
      name: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
    },
  },
  async ({ name, description }) =>
    run(async () => {
      const data = await callApi<{ createProject: unknown }>(CREATE_PROJECT, { input: { name, description } });
      return data.createProject;
    }),
);

server.registerTool(
  "update_project",
  {
    description: "Rename a project or change its description. Only the project owner can do this.",
    inputSchema: {
      id: z.string().min(1).describe("Project id"),
      name: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
    },
  },
  async ({ id, ...changes }) =>
    run(async () => {
      if (!Object.values(changes).some((value) => value !== undefined)) {
        throw new Error("Nothing to update. Pass a name or a description.");
      }
      const data = await callApi<{ updateProject: unknown }>(UPDATE_PROJECT, { id, input: changes });
      return data.updateProject;
    }),
);

server.registerTool(
  "delete_project",
  {
    description:
      "Permanently delete a project AND ALL OF ITS TASKS. Only the project owner can do this. This cannot be undone. Without confirm set to true it deletes nothing and reports how many tasks would be lost, so ask the user first.",
    inputSchema: {
      id: z.string().min(1).describe("Project id"),
      confirm: z.boolean().optional().describe("Set to true only after the user has agreed to delete the project and its tasks"),
    },
  },
  async ({ id, confirm }) =>
    run(async () => {
      const { project } = await callApi<{ project: { id: string; name: string; tasks: { id: string }[] } }>(
        PROJECT_BRIEF,
        { id },
      );
      const count = project.tasks.length;
      if (confirm !== true) {
        throw new Error(
          `Not deleted. Deleting "${project.name}" permanently deletes the project and its ${count} task(s). Ask the user to confirm, then call delete_project again with confirm set to true.`,
        );
      }
      await callApi<{ deleteProject: boolean }>(DELETE_PROJECT, { id });
      return `Deleted project "${project.name}" and its ${count} task(s).`;
    }),
);

server.registerTool(
  "add_member",
  {
    description:
      "Add a user to a project by user id. Only the project owner can do this. There is no user search, so the user id must come from the person being added.",
    inputSchema: {
      projectId: z.string().min(1),
      userId: z.string().min(1).describe("Id of the user to add"),
    },
  },
  async ({ projectId, userId }) =>
    run(async () => {
      const data = await callApi<{ addMember: unknown }>(ADD_MEMBER, { projectId, userId });
      return data.addMember;
    }),
);

// ---------------------------------------------------------------------------
// Tools: tasks
// ---------------------------------------------------------------------------

server.registerTool(
  "list_tasks",
  {
    description:
      "List TaskFlow tasks the user can access. Defaults to status TODO. Optionally filter by status or project.",
    inputSchema: {
      status: STATUS.optional().describe("Task status. Defaults to TODO."),
      projectId: z.string().min(1).optional().describe("Only tasks in this project"),
      page: z.number().int().min(1).optional().describe("Page number, starting at 1"),
      pageSize: z.number().int().min(1).max(50).optional().describe("Tasks per page, up to 50"),
    },
  },
  async ({ status, projectId, page, pageSize }) =>
    run(async () => {
      const data = await callApi<{ tasks: unknown }>(LIST_TASKS, {
        filter: { status: status ?? "TODO", projectId },
        page: page ?? 1,
        pageSize: pageSize ?? 10,
      });
      return data.tasks;
    }),
);

server.registerTool(
  "create_task",
  {
    description: "Create a task in a project the user can access. New tasks start as TODO.",
    inputSchema: {
      projectId: z.string().min(1).describe("Project the task belongs to"),
      title: z.string().min(1).max(200),
      description: z.string().max(2000).optional(),
      priority: PRIORITY.optional().describe("Defaults to MEDIUM"),
      dueDate: DATE.optional().describe("Due date as YYYY-MM-DD"),
      assigneeId: z.string().min(1).optional().describe("User id of the assignee"),
    },
  },
  async ({ projectId, title, description, priority, dueDate, assigneeId }) =>
    run(async () => {
      const data = await callApi<{ createTask: unknown }>(CREATE_TASK, {
        input: {
          projectId,
          title,
          description,
          priority,
          dueDate: dueDate ? toDueDate(dueDate) : undefined,
          assigneeId,
        },
      });
      return data.createTask;
    }),
);

server.registerTool(
  "update_task",
  {
    description:
      "Update fields of a task the user can access. Pass only the fields to change. Use dueDate null to clear the due date.",
    inputSchema: {
      id: z.string().min(1).describe("Task id"),
      title: z.string().min(1).max(200).optional(),
      description: z.string().max(2000).optional(),
      status: STATUS.optional(),
      priority: PRIORITY.optional(),
      dueDate: DATE.nullable().optional().describe("YYYY-MM-DD, or null to clear"),
    },
  },
  async ({ id, dueDate, ...changes }) =>
    run(async () => {
      const input = {
        ...changes,
        dueDate: dueDate === undefined ? undefined : dueDate === null ? null : toDueDate(dueDate),
      };
      if (!Object.values(input).some((value) => value !== undefined)) {
        throw new Error("Nothing to update. Pass at least one field besides id.");
      }
      const data = await callApi<{ updateTask: unknown }>(UPDATE_TASK, { id, input });
      return data.updateTask;
    }),
);

server.registerTool(
  "delete_task",
  {
    description: "Delete a task the user can access. This cannot be undone.",
    inputSchema: {
      id: z.string().min(1).describe("Task id"),
    },
  },
  async ({ id }) =>
    run(async () => {
      await callApi<{ deleteTask: boolean }>(DELETE_TASK, { id });
      return `Deleted task ${id}.`;
    }),
);

// ---------------------------------------------------------------------------
// Resources: read-only context the user can attach to a chat
// ---------------------------------------------------------------------------

const JSON_MIME = "application/json";

const asJson = (uri: URL, value: unknown) => ({
  contents: [{ uri: uri.href, mimeType: JSON_MIME, text: JSON.stringify(value, null, 2) }],
});

server.registerResource(
  "projects",
  "taskflow://projects",
  {
    title: "TaskFlow projects",
    description: "Every project the user owns or belongs to, with task counts by status.",
    mimeType: JSON_MIME,
  },
  async (uri) => asJson(uri, await listProjects()),
);

server.registerResource(
  "project",
  new ResourceTemplate("taskflow://projects/{id}", {
    // Claude lists resources when it connects. Never open the browser for that:
    // show nothing until the user has signed in.
    list: async () => {
      try {
        const data = await callApi<{ projects: { id: string; name: string }[] }>(PROJECT_NAMES, {}, { interactive: false });
        return {
          resources: data.projects.map((p) => ({
            uri: `taskflow://projects/${p.id}`,
            name: p.name,
            mimeType: JSON_MIME,
          })),
        };
      } catch {
        return { resources: [] };
      }
    },
  }),
  {
    title: "TaskFlow project",
    description: "One project with its members and all of its tasks grouped by status.",
    mimeType: JSON_MIME,
  },
  async (uri, variables) => {
    const id = Array.isArray(variables.id) ? variables.id[0] : variables.id;
    return asJson(uri, await loadProject(id));
  },
);

// ---------------------------------------------------------------------------
// Prompts: reusable workflows the user picks. They only instruct Claude which
// tools to use, so they need nothing from the backend.
// ---------------------------------------------------------------------------

const userMessage = (body: string) => ({
  messages: [{ role: "user" as const, content: { type: "text" as const, text: body } }],
});

server.registerPrompt(
  "daily_standup",
  {
    title: "Daily standup",
    description: "Summarize what is in progress, overdue, and next up across all projects.",
  },
  () =>
    userMessage(
      [
        `Prepare my TaskFlow standup. Today is ${today()}.`,
        "1. Call list_tasks with status IN_PROGRESS, then with status TODO. If total is larger than the page size, fetch the remaining pages with pageSize 50.",
        "2. Report what is in progress, what is overdue (dueDate before today), and the next TODO tasks ordered by due date and then priority.",
        "3. Group by project and keep it short. Do not create, update, or delete anything.",
      ].join("\n"),
    ),
);

server.registerPrompt(
  "plan_project",
  {
    title: "Plan a project",
    description: "Turn a goal into a proposed task list, then create the tasks once approved.",
    argsSchema: {
      goal: z.string().min(1).describe("What needs to get done"),
      projectId: z.string().optional().describe("Existing project to add the tasks to"),
    },
  },
  ({ goal, projectId }) =>
    userMessage(
      [
        `Plan the work for this goal in TaskFlow: ${goal}`,
        projectId
          ? `Add the tasks to project ${projectId}.`
          : "Call list_projects to find the right project. If none fits, ask me whether to create one with create_project.",
        `Propose 5 to 10 tasks, each with a title, a one-line description, a priority, and a due date where one makes sense. Today is ${today()}.`,
        "Show the list and wait for my confirmation before calling create_task for each task.",
      ].join("\n"),
    ),
);

server.registerPrompt(
  "break_down_task",
  {
    title: "Break down a task",
    description: "Split one task into smaller tasks in the same project.",
    argsSchema: {
      projectId: z.string().min(1).describe("Project that contains the task"),
      task: z.string().min(1).describe("Task id or title"),
    },
  },
  ({ projectId, task }) =>
    userMessage(
      [
        "Break down one TaskFlow task into smaller tasks.",
        `1. Call get_project with id ${projectId} and find the task matching "${task}" by id or title.`,
        "2. Propose 3 to 6 subtasks as separate tasks in the same project, each with a title, a short description, and a priority. Reuse the original due date unless a subtask clearly needs an earlier one.",
        "3. Show the proposal and wait for my confirmation, then create them with create_task. Leave the original task unchanged.",
      ].join("\n"),
    ),
);

// ---------------------------------------------------------------------------

async function main() {
  await server.connect(new StdioServerTransport());
  console.error(`TaskFlow MCP ready. API: ${process.env.TASKFLOW_API_URL ?? "http://localhost:4000/graphql"}`);
}

main().catch((err) => {
  console.error("TaskFlow MCP failed to start:", err);
  process.exit(1);
});
