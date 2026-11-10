import { isValidObjectId } from "mongoose";
import { Task } from "../models/Task";
import { Project } from "../models/Project";
import { appError } from "../utils/errors";
import { projectService } from "./project.service";

interface TaskFilter {
  projectId?: string | null;
  status?: string | null;
  assigneeId?: string | null;
}

export const taskService = {
  async create(userId: string, input: any) {
    await projectService.assertAccess(input.projectId, userId);
    return Task.create({
      title: input.title,
      description: input.description ?? "",
      priority: input.priority ?? "MEDIUM",
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      assignee: input.assigneeId ?? null,
      project: input.projectId,
    });
  },

  // Paginated list, restricted to projects the user can access.
  async list(userId: string, filter: TaskFilter = {}, page = 1, pageSize = 10) {
    const accessible = await Project.find({ $or: [{ owner: userId }, { members: userId }] }).distinct("_id");
    const query: Record<string, unknown> = { project: { $in: accessible } };

    if (filter.projectId) {
      if (!accessible.some((id) => id.toString() === filter.projectId))
        throw appError("You don't have access to this project", "FORBIDDEN");
      query.project = filter.projectId;
    }
    if (filter.status) query.status = filter.status;
    if (filter.assigneeId) query.assignee = filter.assigneeId;

    const safeSize = Math.min(Math.max(pageSize, 1), 50); // cap page size
    const safePage = Math.max(page, 1);
    const [items, total] = await Promise.all([
      Task.find(query).sort({ createdAt: -1 }).skip((safePage - 1) * safeSize).limit(safeSize),
      Task.countDocuments(query),
    ]);
    return { items, total, page: safePage, pageSize: safeSize };
  },

  async update(userId: string, id: string, input: any) {
    if (!isValidObjectId(id)) throw appError("Invalid task id", "BAD_USER_INPUT");
    const task = await Task.findById(id);
    if (!task) throw appError("Task not found", "NOT_FOUND");
    await projectService.assertAccess(task.project.toString(), userId);

    const { assigneeId, dueDate, ...rest } = input;
    Object.entries(rest).forEach(([k, v]) => v !== undefined && v !== null && ((task as any)[k] = v));
    if (assigneeId !== undefined) task.assignee = assigneeId;
    if (dueDate !== undefined) task.dueDate = dueDate ? new Date(dueDate) : null;
    return task.save();
  },

  async remove(userId: string, id: string) {
    if (!isValidObjectId(id)) throw appError("Invalid task id", "BAD_USER_INPUT");
    const task = await Task.findById(id);
    if (!task) throw appError("Task not found", "NOT_FOUND");
    await projectService.assertAccess(task.project.toString(), userId);
    await task.deleteOne();
    return true;
  },
};
