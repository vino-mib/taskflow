import { isValidObjectId } from "mongoose";
import { Project } from "../models/Project";
import { User } from "../models/User";
import { appError } from "../utils/errors";

export const projectService = {
  // Owner or member can access a project.
  async assertAccess(projectId: string, userId: string) {
    if (!isValidObjectId(projectId)) throw appError("Invalid project id", "BAD_USER_INPUT");
    const project = await Project.findById(projectId);
    if (!project) throw appError("Project not found", "NOT_FOUND");
    const allowed =
      project.owner.toString() === userId || project.members.some((m) => m.toString() === userId);
    if (!allowed) throw appError("You don't have access to this project", "FORBIDDEN");
    return project;
  },

  // async so the resolver gets a Promise. Mongoose queries can be executed only once.
  async listForUser(userId: string) {
    return Project.find({ $or: [{ owner: userId }, { members: userId }] }).sort({ createdAt: -1 });
  },

  create(userId: string, input: { name: string; description?: string | null }) {
    return Project.create({
      name: input.name,
      description: input.description ?? "",
      owner: userId,
      members: [userId],
    });
  },

  async addMember(userId: string, projectId: string, memberId: string) {
    const project = await this.assertAccess(projectId, userId);
    if (project.owner.toString() !== userId)
      throw appError("Only the owner can add members", "FORBIDDEN");
    if (!(await User.exists({ _id: memberId }))) throw appError("User not found", "NOT_FOUND");
    await Project.updateOne({ _id: projectId }, { $addToSet: { members: memberId } });
    return Project.findById(projectId).exec();
  },
};
