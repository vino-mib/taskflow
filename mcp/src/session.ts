import { mkdir, readFile, rm, writeFile } from "fs/promises";
import { homedir } from "os";
import path from "path";

// Tokens for one TaskFlow user. The access token lasts 1 hour; the refresh token
// lasts 7 days and is rotated on every refresh, so the stored copy must be replaced.
export interface Session {
  email: string;
  token: string;
  refreshToken: string;
}

const DIR = path.join(homedir(), ".taskflow-mcp");
const FILE = path.join(DIR, "session.json");

export async function loadSession(): Promise<Session | null> {
  try {
    return JSON.parse(await readFile(FILE, "utf8")) as Session;
  } catch {
    return null;
  }
}

export async function saveSession(session: Session): Promise<void> {
  await mkdir(DIR, { recursive: true, mode: 0o700 });
  await writeFile(FILE, JSON.stringify(session), { mode: 0o600 });
}

export async function clearSession(): Promise<void> {
  await rm(FILE, { force: true });
}
