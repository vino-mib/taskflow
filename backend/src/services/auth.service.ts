import { createHash, randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { RefreshToken } from "../models/RefreshToken";
import { User, UserDoc } from "../models/User";
import { appError } from "../utils/errors";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

const ACCESS_TTL = "1h";
const REFRESH_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const signAccessToken = (userId: string) =>
  jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: ACCESS_TTL });

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

// Access token is a 1-hour JWT. Refresh token is an opaque random string whose
// hash is saved, so it can be revoked and rotated. The raw value is returned once.
async function issueSession(user: UserDoc) {
  const refreshToken = randomBytes(32).toString("base64url");
  await RefreshToken.create({
    user: user.id,
    tokenHash: hashToken(refreshToken),
    expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
  });
  return { token: signAccessToken(user.id), refreshToken, user };
}

export const authService = {
  async register(input: unknown) {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) throw appError(parsed.error.issues[0].message, "BAD_USER_INPUT");

    const { name, email, password } = parsed.data;
    if (await User.exists({ email: email.toLowerCase() }))
      throw appError("Email already registered", "BAD_USER_INPUT");

    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
    return issueSession(user);
  },

  async login(email: string, password: string) {
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user || !(await bcrypt.compare(password, user.password)))
      throw appError("Invalid email or password", "UNAUTHENTICATED");
    return issueSession(user);
  },

  // Swap a valid refresh token for a new access token and a new refresh token.
  // The presented token is deleted first, so it cannot be used twice.
  async refresh(rawToken: string) {
    const existing = await RefreshToken.findOneAndDelete({ tokenHash: hashToken(rawToken) });
    if (!existing || existing.expiresAt.getTime() <= Date.now())
      throw appError("Refresh token is invalid or expired. Log in again.", "UNAUTHENTICATED");

    const user = await User.findById(existing.user);
    if (!user) throw appError("Refresh token is invalid or expired. Log in again.", "UNAUTHENTICATED");
    return issueSession(user);
  },

  async revokeRefreshToken(rawToken: string) {
    await RefreshToken.deleteOne({ tokenHash: hashToken(rawToken) });
    return true;
  },

  verifyToken(token: string): string | null {
    try {
      const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
      return payload.sub;
    } catch {
      return null;
    }
  },
};
