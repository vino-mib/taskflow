import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

const projectSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    owner: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    members: [{ type: Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

export type ProjectDoc = HydratedDocument<InferSchemaType<typeof projectSchema>>;
export const Project = model("Project", projectSchema);
