import { Schema, model, InferSchemaType, HydratedDocument } from "mongoose";

// One row per signed-in device. The raw token is never stored, only its hash.
const refreshTokenSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
);

// Mongo deletes the row after expiresAt. The service also checks the date itself.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type RefreshTokenDoc = HydratedDocument<InferSchemaType<typeof refreshTokenSchema>>;
export const RefreshToken = model("RefreshToken", refreshTokenSchema);
