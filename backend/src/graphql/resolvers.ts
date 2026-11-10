import { Task, TaskDoc } from "../models/Task";
import { ProjectDoc } from "../models/Project";
import { authService } from "../services/auth.service";
import { projectService } from "../services/project.service";
import { taskService } from "../services/task.service";
import { appError } from "../utils/errors";
import type { Context } from "./context";

const iso = (d?: Date | null) => (d ? d.toISOString() : null);

// Throws if the request has no valid token; otherwise returns the user id.
const requireAuth = (ctx: Context): string => {
  if (!ctx.userId) throw appError("You must be logged in", "UNAUTHENTICATED");
  return ctx.userId;
};

export const resolvers = {
  Query: {
    me: async (_: unknown, __: unknown, ctx: Context) =>
      ctx.userId ? ctx.loaders.user.load(ctx.userId) : null,

    projects: (_: unknown, __: unknown, ctx: Context) =>
      projectService.listForUser(requireAuth(ctx)),

    project: (_: unknown, { id }: { id: string }, ctx: Context) =>
      projectService.assertAccess(id, requireAuth(ctx)),

    tasks: (_: unknown, args: any, ctx: Context) =>
      taskService.list(requireAuth(ctx), args.filter ?? {}, args.page, args.pageSize),
  },

  Mutation: {
    register: (_: unknown, { input }: any) => authService.register(input),
    login: (_: unknown, { email, password }: any) => authService.login(email, password),
    createProject: (_: unknown, { input }: any, ctx: Context) =>
      projectService.create(requireAuth(ctx), input),
    addMember: (_: unknown, { projectId, userId }: any, ctx: Context) =>
      projectService.addMember(requireAuth(ctx), projectId, userId),
    createTask: (_: unknown, { input }: any, ctx: Context) =>
      taskService.create(requireAuth(ctx), input),
    updateTask: (_: unknown, { id, input }: any, ctx: Context) =>
      taskService.update(requireAuth(ctx), id, input),
    deleteTask: (_: unknown, { id }: any, ctx: Context) =>
      taskService.remove(requireAuth(ctx), id),
  },

  // Field resolvers: how to fill nested fields. Loaders keep these efficient.
  User: {
    createdAt: (u: any) => iso(u.createdAt),
  },

  Project: {
    owner: (p: ProjectDoc, _: unknown, ctx: Context) => ctx.loaders.user.load(p.owner.toString()),
    members: async (p: ProjectDoc, _: unknown, ctx: Context) =>
      (await ctx.loaders.user.loadMany(p.members.map((m) => m.toString()))).filter(Boolean),
    tasks: async (p: ProjectDoc, { status }: { status?: string }) => {
      const filter: Record<string, unknown> = { project: p._id };
      if (status) filter.status = status;
      return Task.find(filter).sort({ createdAt: -1 });
    },
    createdAt: (p: any) => iso(p.createdAt),
  },

  Task: {
    project: (t: TaskDoc, _: unknown, ctx: Context) => ctx.loaders.project.load(t.project.toString()),
    assignee: (t: TaskDoc, _: unknown, ctx: Context) =>
      t.assignee ? ctx.loaders.user.load(t.assignee.toString()) : null,
    dueDate: (t: TaskDoc) => iso(t.dueDate),
    createdAt: (t: any) => iso(t.createdAt),
  },
};
