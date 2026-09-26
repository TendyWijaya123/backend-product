import z, { email } from "zod";
export const registerSchema = z.object({
  name: z.string(),
  email: z.email(),
  password: z.string().min(8),
});
