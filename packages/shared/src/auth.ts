import { z } from "zod";

export const UserProfileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional(),
  displayName: z.string().min(1).max(100).optional(),
  babyName: z.string().min(1).max(100).optional(),
  babyDueDate: z.string().date().optional(),
  babyBirthDate: z.string().date().optional(),
  subscriptionTier: z.enum(["free", "pro"]),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type UserProfile = z.infer<typeof UserProfileSchema>;

export const UpdateProfileRequestSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  babyName: z.string().min(1).max(100).optional(),
  babyDueDate: z.string().date().optional(),
  babyBirthDate: z.string().date().optional(),
});
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  requestId: z.string().optional(),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
