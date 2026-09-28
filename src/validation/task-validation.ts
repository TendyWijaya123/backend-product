import z from "zod";

export const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  projectId: z.number().int().positive(),
  clientVisible: z.boolean().default(false),
});

export const updateTaskStatusSchema = z.object({
  status: z.enum(["TODO", "IN_PROGRESS", "DONE"]),
  version: z.number().int().positive(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  assigneeId: z.number().int().positive().nullable().optional(),
  version: z.number().int().positive(),
});

export const createAttachmentSchema = z.object({
  fileName: z.string().min(1),
  fileUrl: z.string().url(),
});

export const assignTaskSchema = z.object({
  assigneeId: z.number().int().positive().nullable(),
  version: z.number().int().positive(),
});

export const createTaskDependencySchema = z.object({
  dependsOnId: z.number().int().positive(),
});
