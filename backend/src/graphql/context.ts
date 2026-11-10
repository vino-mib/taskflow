import type { Request } from "express";
import DataLoader from "dataloader";
import { User, UserDoc } from "../models/User";
import { Project, ProjectDoc } from "../models/Project";
import { authService } from "../services/auth.service";

// DataLoader batches many .load(id) calls in one tick into a single DB query
// (solves the N+1 problem in nested GraphQL queries).
function batchById<T extends { id: string }>(find: (ids: string[]) => Promise<T[]>) {
  return new DataLoader<string, T | null>(async (ids) => {
    const docs = await find([...ids]);
    const map = new Map(docs.map((d) => [d.id, d]));
    return ids.map((id) => map.get(id) ?? null);
  });
}

export const createLoaders = () => ({
  user: batchById<UserDoc>((ids) => User.find({ _id: { $in: ids } })),
  project: batchById<ProjectDoc>((ids) => Project.find({ _id: { $in: ids } })),
});

export interface Context {
  userId: string | null;
  loaders: ReturnType<typeof createLoaders>;
}

// Runs for every request: read JWT, build fresh loaders (cache is per request).
export async function buildContext(req: Request): Promise<Context> {
  const header = req.headers.authorization ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  return { userId: token ? authService.verifyToken(token) : null, loaders: createLoaders() };
}
