import { Hono } from "hono";
import requiredPermission from "../middleware/rbac-middleware";
import { JWTPayload } from "hono/utils/jwt/types";
import { buildTasksQuery } from "../filters/task-query";
import {
  canUpdateTaskStatus,
  getTaskAccessFilter,
} from "../policy/task-policy";
import db from "../db/prisma";
import PERMISSION from "../constants/permissions";
import { AppError } from "../middleware/error-handler";
import zValidator from "../middleware/validation-middleware";
import {
  assignTaskSchema,
  createTaskDependencySchema,
  createTaskSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from "../validation/task-validation";
import { getProjectAccessFilter } from "../policy/project-policy";
import { mkdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const taskRoute = new Hono().basePath("tasks");

taskRoute.get("/", requiredPermission(PERMISSION.TASK_READ), async (c) => {
  const user = c.get("jwtPayload") as JWTPayload;

  const result = buildTasksQuery(c.req.query());

  const accessFilter = getTaskAccessFilter(user);

  const tasks = await db.task.findMany({
    ...result.query,
    where: {
      AND: [result.query.where ?? {}, accessFilter, { deletedAt: null }],
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      clientVisible: true,
      projectId: true,
      project: {
        select: {
          id: true,
          name: true,
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return c.json({
    success: true,
    data: tasks,
  });
});

taskRoute.get("/:id", requiredPermission(PERMISSION.TASK_READ), async (c) => {
  const user = c.get("jwtPayload") as JWTPayload;

  const taskId = Number(c.req.param("id"));

  if (Number.isNaN(taskId)) {
    throw new AppError("Invalid task ID", 400, "INVALID_TASK_ID");
  }

  const accessFilter = getTaskAccessFilter(user);

  const task = await db.task.findFirst({
    where: {
      AND: [{ id: taskId }, accessFilter, { deletedAt: null }],
    },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      clientVisible: true,
      projectId: true,
      project: {
        select: {
          id: true,
          name: true,
          client: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!task) {
    throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
  }

  return c.json({
    success: true,
    data: task,
  });
});

taskRoute.post(
  "/",
  requiredPermission(PERMISSION.TASK_CREATE),
  zValidator("json", createTaskSchema),
  async (c) => {
    const user = c.get("jwtPayload") as JWTPayload;

    const body = c.req.valid("json");

    const project = await db.project.findFirst({
      where: {
        AND: [
          { id: body.projectId },
          getProjectAccessFilter(user),
          { deletedAt: null },
        ],
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
    }

    const task = await db.task.create({
      data: {
        title: body.title,
        description: body.description,
        projectId: body.projectId,
        clientVisible: body.clientVisible,
      },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        clientVisible: true,
        projectId: true,
      },
    });

    return c.json(
      {
        success: true,
        data: task,
      },
      201,
    );
  },
);

taskRoute.patch(
  "/:id/status",
  requiredPermission(PERMISSION.TASK_UPDATE_STATUS),
  zValidator("json", updateTaskStatusSchema),
  async (c) => {
    const user = c.get("jwtPayload") as JWTPayload;

    const taskId = Number(c.req.param("id"));

    if (Number.isNaN(taskId)) {
      throw new AppError("Invalid task ID", 400, "INVALID_TASK_ID");
    }

    const body = c.req.valid("json");

    const task = await db.task.findFirst({
      where: {
        AND: [{ id: taskId }, getTaskAccessFilter(user), { deletedAt: null }],
      },
      select: {
        id: true,
        status: true,
        assigneeId: true,
        version: true,
      },
    });

    if (!task) {
      throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
    }

    if (task.version !== body.version) {
      throw new AppError(
        "Task has been modified by another user",
        409,
        "STALE_TASK_VERSION",
      );
    }

    canUpdateTaskStatus(user, task.assigneeId, body.status);

    const result = await db.task.updateMany({
      where: {
        id: taskId,
        version: body.version,
        deletedAt: null,
      },
      data: {
        status: body.status,
        version: {
          increment: 1,
        },
      },
    });

    if (result.count === 0) {
      throw new AppError(
        "Task was modified by another user",
        409,
        "STALE_TASK_VERSION",
      );
    }

    return c.json({
      success: true,
      message: "Task status updated successfully",
    });
  },
);

taskRoute.patch(
  "/:id/assignee",
  requiredPermission(PERMISSION.TASK_ASSIGN),
  zValidator("json", assignTaskSchema),
  async (c) => {
    const user = c.get("jwtPayload") as JWTPayload;

    const taskId = Number(c.req.param("id"));

    if (Number.isNaN(taskId)) {
      throw new AppError("Invalid task ID", 400, "INVALID_TASK_ID");
    }

    const body = c.req.valid("json");

    const task = await db.task.findFirst({
      where: {
        AND: [{ id: taskId }, getTaskAccessFilter(user), { deletedAt: null }],
      },
      select: {
        id: true,
        assigneeId: true,
        version: true,
      },
    });

    if (!task) {
      throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
    }

    if (task.version !== body.version) {
      throw new AppError(
        "Task has been modified by another user",
        409,
        "STALE_TASK_VERSION",
      );
    }

    // Kalau assigneeId tidak null, pastikan user tersebut valid
    if (body.assigneeId !== null) {
      const assignee = await db.user.findFirst({
        where: {
          id: body.assigneeId,
          deletedAt: null,
        },
        select: {
          id: true,
        },
      });

      if (!assignee) {
        throw new AppError("Assignee not found", 404, "ASSIGNEE_NOT_FOUND");
      }
    }

    const result = await db.task.updateMany({
      where: {
        id: taskId,
        version: body.version,
        deletedAt: null,
      },
      data: {
        assigneeId: body.assigneeId,
        version: {
          increment: 1,
        },
      },
    });

    if (result.count === 0) {
      throw new AppError(
        "Task was modified by another user",
        409,
        "STALE_TASK_VERSION",
      );
    }

    await db.taskAuditLog.create({
      data: {
        taskId,
        userId: Number(user.sub),
        changedColumn: "assigneeId",
        oldValue: task.assigneeId?.toString() ?? null,
        newValue: body.assigneeId?.toString() ?? null,
      },
    });

    return c.json({
      success: true,
      message: "Task assignee updated successfully",
    });
  },
);

taskRoute.put(
  "/:id",
  requiredPermission(PERMISSION.TASK_UPDATE),
  zValidator("json", updateTaskSchema),
  async (c) => {
    const user = c.get("jwtPayload") as JWTPayload;

    const taskId = Number(c.req.param("id"));

    if (Number.isNaN(taskId)) {
      throw new AppError("Invalid task ID", 400, "INVALID_TASK_ID");
    }

    const body = c.req.valid("json");

    const task = await db.task.findFirst({
      where: {
        AND: [{ id: taskId }, getTaskAccessFilter(user), { deletedAt: null }],
      },
      select: {
        id: true,
        title: true,
        description: true,
        assigneeId: true,
        version: true,
      },
    });

    if (!task) {
      throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
    }

    if (user.role === "INTERNAL_TEAM" && body.description !== undefined) {
      throw new AppError(
        "Internal Team cannot change task description",
        403,
        "DESCRIPTION_UPDATE_FORBIDDEN",
      );
    }

    if (task.version !== body.version) {
      throw new AppError(
        "Task has been modified by another user",
        409,
        "STALE_TASK_VERSION",
      );
    }

    const updatedTask = await db.$transaction(async (tx) => {
      const result = await tx.task.updateMany({
        where: {
          id: taskId,
          version: body.version,
          deletedAt: null,
        },
        data: {
          ...(body.title !== undefined && {
            title: body.title,
          }),

          ...(body.description !== undefined && {
            description: body.description,
          }),

          ...(body.assigneeId !== undefined && {
            assigneeId: body.assigneeId,
          }),

          version: {
            increment: 1,
          },
        },
      });

      if (result.count === 0) {
        throw new AppError(
          "Task was modified by another user",
          409,
          "STALE_TASK_VERSION",
        );
      }

      const auditLogs = [];

      if (body.title !== undefined && body.title !== task.title) {
        auditLogs.push({
          taskId,
          userId: Number(user.sub),
          changedColumn: "title",
          oldValue: task.title,
          newValue: body.title,
        });
      }

      if (
        body.description !== undefined &&
        body.description !== task.description
      ) {
        auditLogs.push({
          taskId,
          userId: Number(user.sub),
          changedColumn: "description",
          oldValue: task.description,
          newValue: body.description,
        });
      }

      if (
        body.assigneeId !== undefined &&
        body.assigneeId !== task.assigneeId
      ) {
        auditLogs.push({
          taskId,
          userId: Number(user.sub),
          changedColumn: "assigneeId",
          oldValue: task.assigneeId?.toString() ?? null,
          newValue: body.assigneeId?.toString() ?? null,
        });
      }

      if (auditLogs.length > 0) {
        await tx.taskAuditLog.createMany({
          data: auditLogs,
        });
      }

      // 7. Ambil task setelah update
      return tx.task.findUnique({
        where: {
          id: taskId,
        },
        select: {
          id: true,
          title: true,
          description: true,
          status: true,
          assigneeId: true,
          projectId: true,
          version: true,
        },
      });
    });

    return c.json({
      success: true,
      data: updatedTask,
    });
  },
);

taskRoute.get(
  "/:id/attachments",
  requiredPermission(PERMISSION.TASK_READ),
  async (c) => {
    const user = c.get("jwtPayload") as JWTPayload;

    const taskId = Number(c.req.param("id"));

    if (Number.isNaN(taskId)) {
      throw new AppError("Invalid task ID", 400, "INVALID_TASK_ID");
    }

    const task = await db.task.findFirst({
      where: {
        AND: [{ id: taskId }, getTaskAccessFilter(user), { deletedAt: null }],
      },
      select: {
        id: true,
      },
    });

    if (!task) {
      throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
    }

    const attachments = await db.taskAttachment.findMany({
      where: {
        taskId,
        deletedAt: null,
      },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
        uploadedById: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return c.json({
      success: true,
      data: attachments,
    });
  },
);

taskRoute.post(
  "/:id/attachments",
  requiredPermission(PERMISSION.TASK_ATTACHMENT_CREATE),
  async (c) => {
    const user = c.get("jwtPayload") as JWTPayload;

    const taskId = Number(c.req.param("id"));

    if (Number.isNaN(taskId)) {
      throw new AppError("Invalid task ID", 400, "INVALID_TASK_ID");
    }

    // =========================
    // CHECK TASK ACCESS
    // =========================

    const accessFilter = getTaskAccessFilter(user);

    const task = await db.task.findFirst({
      where: {
        AND: [{ id: taskId }, accessFilter, { deletedAt: null }],
      },
      select: {
        id: true,
      },
    });

    if (!task) {
      throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
    }

    // =========================
    // GET FILE
    // =========================

    const body = await c.req.parseBody();

    const file = body.file;

    if (!(file instanceof File)) {
      throw new AppError("Attachment file is required", 400, "FILE_REQUIRED");
    }

    // =========================
    // FILE SIZE
    // =========================

    const MAX_FILE_SIZE = 10 * 1024 * 1024;

    if (file.size === 0) {
      throw new AppError("Attachment file cannot be empty", 400, "EMPTY_FILE");
    }

    if (file.size > MAX_FILE_SIZE) {
      throw new AppError(
        "Attachment file cannot exceed 10 MB",
        400,
        "FILE_TOO_LARGE",
      );
    }

    // =========================
    // FILE EXTENSION
    // =========================

    const extension = file.name.includes(".")
      ? file.name.substring(file.name.lastIndexOf("."))
      : "";

    // =========================
    // GENERATE FILE KEY
    // =========================

    const fileKey = `tasks/${task.id}/${crypto.randomUUID()}${extension}`;

    const filePath = join(process.cwd(), "uploads", fileKey);

    // =========================
    // CREATE DIRECTORY
    // =========================

    await mkdir(join(process.cwd(), "uploads", "tasks", String(task.id)), {
      recursive: true,
    });

    // =========================
    // SAVE FILE
    // =========================

    await Bun.write(filePath, file);

    // =========================
    // FILE URL
    // =========================

    const fileUrl = `/api/tasks/${task.id}/attachments/${fileKey}`;

    try {
      // =========================
      // SAVE DATABASE
      // =========================

      const attachment = await db.taskAttachment.create({
        data: {
          taskId: task.id,
          uploadedById: Number(user.sub),
          fileName: file.name,
          fileKey,
          fileUrl,
        },
        select: {
          id: true,
          fileName: true,
          fileUrl: true,
          uploadedById: true,
          createdAt: true,
        },
      });

      return c.json(
        {
          success: true,
          data: attachment,
        },
        201,
      );
    } catch (error) {
      if (existsSync(filePath)) {
        await unlink(filePath);
      }

      throw error;
    }
  },
);

taskRoute.delete(
  "/:id/attachments/:attachmentId",
  requiredPermission(PERMISSION.TASK_ATTACHMENT_DELETE),
  async (c) => {
    const user = c.get("jwtPayload") as JWTPayload;

    const taskId = Number(c.req.param("id"));
    const attachmentId = Number(c.req.param("attachmentId"));

    if (Number.isNaN(taskId)) {
      throw new AppError("Invalid task ID", 400, "INVALID_TASK_ID");
    }

    if (Number.isNaN(attachmentId)) {
      throw new AppError("Invalid attachment ID", 400, "INVALID_ATTACHMENT_ID");
    }

    const attachment = await db.taskAttachment.findFirst({
      where: {
        AND: [
          { id: attachmentId },
          { taskId },
          { deletedAt: null },
          {
            task: {
              AND: [getTaskAccessFilter(user), { deletedAt: null }],
            },
          },
        ],
      },
      select: {
        id: true,
        fileName: true,
        fileUrl: true,
      },
    });

    if (!attachment) {
      throw new AppError("Attachment not found", 404, "ATTACHMENT_NOT_FOUND");
    }

    await db.taskAttachment.update({
      where: {
        id: attachment.id,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return c.json({
      success: true,
      message: "Attachment deleted successfully",
    });
  },
);

taskRoute.get(
  "/:id/dependencies",
  requiredPermission(PERMISSION.TASK_READ),
  async (c) => {
    const user = c.get("jwtPayload") as JWTPayload;

    const taskId = Number(c.req.param("id"));

    if (Number.isNaN(taskId)) {
      throw new AppError("Invalid task ID", 400, "INVALID_TASK_ID");
    }

    const task = await db.task.findFirst({
      where: {
        AND: [{ id: taskId }, getTaskAccessFilter(user), { deletedAt: null }],
      },
      select: {
        id: true,
      },
    });

    if (!task) {
      throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
    }

    const dependencies = await db.taskDependency.findMany({
      where: {
        taskId,
        dependsOn: {
          deletedAt: null,
        },
      },
      select: {
        dependsOn: {
          select: {
            id: true,
            title: true,
            status: true,
            assigneeId: true,
          },
        },
      },
    });

    return c.json({
      success: true,
      data: dependencies.map((dependency) => dependency.dependsOn),
    });
  },
);

taskRoute.post(
  "/:id/dependencies",
  requiredPermission(PERMISSION.TASK_DEPENDENCY_CREATE),
  zValidator("json", createTaskDependencySchema),
  async (c) => {
    const user = c.get("jwtPayload") as JWTPayload;

    const taskId = Number(c.req.param("id"));

    if (Number.isNaN(taskId)) {
      throw new AppError("Invalid task ID", 400, "INVALID_TASK_ID");
    }

    const body = c.req.valid("json");

    const dependsOnId = body.dependsOnId;

    if (taskId === dependsOnId) {
      throw new AppError(
        "A task cannot depend on itself",
        400,
        "SELF_DEPENDENCY",
      );
    }

    // =========================
    // TASK
    // =========================

    const task = await db.task.findFirst({
      where: {
        AND: [{ id: taskId }, getTaskAccessFilter(user), { deletedAt: null }],
      },
      select: {
        id: true,
        projectId: true,
      },
    });

    if (!task) {
      throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
    }

    // =========================
    // DEPENDENCY TASK
    // =========================

    const dependencyTask = await db.task.findFirst({
      where: {
        id: dependsOnId,
        deletedAt: null,
      },
      select: {
        id: true,
        projectId: true,
        title: true,
        status: true,
      },
    });

    if (!dependencyTask) {
      throw new AppError(
        "Dependency task not found",
        404,
        "DEPENDENCY_TASK_NOT_FOUND",
      );
    }

    // Dependency harus berada di project yang sama
    if (task.projectId !== dependencyTask.projectId) {
      throw new AppError(
        "Task dependency must belong to the same project",
        400,
        "CROSS_PROJECT_DEPENDENCY",
      );
    }

    // =========================
    // CREATE DEPENDENCY
    // =========================

    const dependency = await db.taskDependency.create({
      data: {
        taskId: task.id,
        dependsOnId: dependencyTask.id,
      },
      select: {
        taskId: true,
        dependsOnId: true,
        dependsOn: {
          select: {
            id: true,
            title: true,
            status: true,
          },
        },
      },
    });

    return c.json(
      {
        success: true,
        message: "Task dependency created successfully",
        data: dependency,
      },
      201,
    );
  },
);

taskRoute.delete(
  "/:id/dependencies/:dependsOnId",
  requiredPermission(PERMISSION.TASK_DEPENDENCY_DELETE),
  async (c) => {
    const user = c.get("jwtPayload") as JWTPayload;

    const taskId = Number(c.req.param("id"));
    const dependsOnId = Number(c.req.param("dependsOnId"));

    if (Number.isNaN(taskId)) {
      throw new AppError("Invalid task ID", 400, "INVALID_TASK_ID");
    }

    if (Number.isNaN(dependsOnId)) {
      throw new AppError(
        "Invalid dependency task ID",
        400,
        "INVALID_DEPENDENCY_TASK_ID",
      );
    }

    // Pastikan task utama bisa diakses user
    const task = await db.task.findFirst({
      where: {
        AND: [{ id: taskId }, getTaskAccessFilter(user), { deletedAt: null }],
      },
      select: {
        id: true,
      },
    });

    if (!task) {
      throw new AppError("Task not found", 404, "TASK_NOT_FOUND");
    }

    // Cari dependency
    const dependency = await db.taskDependency.findUnique({
      where: {
        taskId_dependsOnId: {
          taskId,
          dependsOnId,
        },
      },
    });

    if (!dependency) {
      throw new AppError("Dependency not found", 404, "DEPENDENCY_NOT_FOUND");
    }

    // Hapus dependency
    await db.taskDependency.delete({
      where: {
        taskId_dependsOnId: {
          taskId,
          dependsOnId,
        },
      },
    });

    return c.json({
      success: true,
      message: "Task dependency deleted successfully",
    });
  },
);
export default taskRoute;
