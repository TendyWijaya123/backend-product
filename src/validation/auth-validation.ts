import z, { email } from "zod";
export const registerSchema = z.object({
  name: z.string(),
  email: z.email(),
  password: z.string().min(8),
  roleId: z.number().int().positive(),
  departmentId: z.number().int().positive().optional(),
  clientId: z.number().int().positive().optional(),
});

export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});
