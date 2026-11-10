import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

export const TASK_STATUSES = ["TODO", "IN_PROGRESS", "DONE"] as const;
export const PRIORITIES = ["LOW", "MEDIUM", "HIGH"] as const;

const taskSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    status: { type: String, enum: TASK_STATUSES, default: "TODO" },
    priority: { type: String, enum: PRIORITIES, default: "MEDIUM" },
    dueDate: { type: Date, default: null },
    project: { type: Schema.Types.ObjectId, ref: "Project", required: true, index: true },
    assignee: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true }
);

taskSchema.index({ project: 1, status: 1 }); // speeds up filtered task lists

export type TaskDoc = HydratedDocument<InferSchemaType<typeof taskSchema>>;
export const Task = model("Task", taskSchema);
