import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { env } from "../config/env";
import { User } from "../models/User";
import { appError } from "../utils/errors";

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
});

const signToken = (userId: string) =>
  jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: "7d" });

export const authService = {
  async register(input: unknown) {
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) throw appError(parsed.error.issues[0].message, "BAD_USER_INPUT");

    const { name, email, password } = parsed.data;
    if (await User.exists({ email: email.toLowerCase() }))
      throw appError("Email already registered", "BAD_USER_INPUT");

    const user = await User.create({ name, email, password: await bcrypt.hash(password, 10) });
    return { token: signToken(user.id), user };
  },

  async login(email: string, password: string) {
    const user = await User.findOne({ email: email.toLowerCase() }).select("+password");
    if (!user || !(await bcrypt.compare(password, user.password)))
      throw appError("Invalid email or password", "UNAUTHENTICATED");
    return { token: signToken(user.id), user };
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
