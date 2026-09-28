import z from "zod";
export const createProjectSchema = z.object({
  name: z.string().min(1),
  clientId: z.number().int().positive(),
});


export const updateProjectSchema = z.object({
  name: z.string().min(1).optional(),
  clientId: z.number().int().positive().optional(),
});