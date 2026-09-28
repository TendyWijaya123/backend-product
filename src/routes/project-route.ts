import { Hono } from "hono";
import authMiddleware from "../middleware/auth-middleware";
import db from "../db/prisma";
import { success } from "zod";
import TASK_STATUS from "../constants/task-status";
import requiredPermission from "../middleware/rbac-middleware";
import PERMISSION from "../constants/permissions";
import { buildProjectsQuery } from "../filters/project-query";
import { AppError } from "../middleware/error-handler";
import { getProjectAccessFilter } from "../policy/project-policy";
import { JWTPayload } from "hono/utils/jwt/types";
import { buildTasksQuery } from "../filters/task-query";
import { getTaskAccessFilter } from "../policy/task-policy";
import zValidator from "../middleware/validation-middleware";
import {
  createProjectSchema,
  updateProjectSchema,
} from "../validation/project-validation";

const projectRoute = new Hono().basePath("/projects");
projectRoute.use("/*", authMiddleware);

projectRoute.get(
  "/",
  requiredPermission(PERMISSION.PROJECT_READ),
  async (c) => {
    const user = c.get("jwtPayload") as JWTPayload;

    const result = buildProjectsQuery(c.req.query());

    const accessFilter = getProjectAccessFilter(user);

    const projects = await db.project.findMany({
      ...result.query,

      where: {
        AND: [
          result.query.where ?? {},
          accessFilter,
          {
            deletedAt: null,
          },
        ],
      },

      select: {
        id: true,
        name: true,

        _count: {
          select: {
            tasks: true,
          },
        },

        tasks: {
          where: {
            status: TASK_STATUS.DONE,
          },
          select: {
            id: true,
          },
        },
      },
    });

    return c.json({
      success: true,
      data: projects.map((project) => ({
        id: project.id,
        name: project.name,
        totalTasks: project._count.tasks,
        completedTasks: project.tasks.length,
      })),
    });
  },
);

projectRoute.get(
  "/:id",
  requiredPermission(PERMISSION.PROJECT_READ),
  async (c) => {
    const user = c.get("jwtPayload") as JWTPayload;

    const projectId = Number(c.req.param("id"));

    if (Number.isNaN(projectId)) {
      throw new AppError("Invalid project ID", 400, "INVALID_PROJECT_ID");
    }

    const accessFilter = getProjectAccessFilter(user);

    const project = await db.project.findFirst({
      where: {
        AND: [
          {
            id: projectId,
          },
          accessFilter,
          {
            deletedAt: null,
          },
        ],
      },
      select: {
        id: true,
        name: true,
        client: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!project) {
      throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
    }

    return c.json({
      success: true,
      data: project,
    });
  },
);

projectRoute.get(
  "/:id/tasks",
  requiredPermission(PERMISSION.TASK_READ),
  async (c) => {
    const user = c.get("jwtPayload") as JWTPayload;

    const projectId = Number(c.req.param("id"));

    if (Number.isNaN(projectId)) {
      throw new AppError("Invalid project ID", 400, "INVALID_PROJECT_ID");
    }

    const result = buildTasksQuery(c.req.query());

    const accessFilter = getTaskAccessFilter(user);

    const tasks = await db.task.findMany({
      ...result.query,

      where: {
        AND: [
          result.query.where ?? {},

          accessFilter,

          {
            projectId,
          },

          {
            deletedAt: null,
          },
        ],
      },

      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        projectId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return c.json({
      success: true,
      data: tasks,
    });
  },
);

projectRoute.post(
  "/",
  requiredPermission(PERMISSION.PROJECT_CREATE),
  zValidator("json", createProjectSchema),
  async (c) => {
    const body = await c.req.json();

    const project = await db.project.create({
      data: {
        name: body.name,
        clientId: body.clientId,
      },
      select: {
        id: true,
        name: true,
        clientId: true,
      },
    });

    return c.json(
      {
        success: true,
        data: project,
      },
      201,
    );
  },
);

projectRoute.put(
  "/:id",
  requiredPermission(PERMISSION.PROJECT_UPDATE),
  zValidator("json", updateProjectSchema),
  async (c) => {
    const projectId = Number(c.req.param("id"));

    if (Number.isNaN(projectId)) {
      throw new AppError("Invalid project ID", 400, "INVALID_PROJECT_ID");
    }

    const body = c.req.valid("json");

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
      },
    });

    if (!project) {
      throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
    }

    const updatedProject = await db.project.update({
      where: {
        id: projectId,
      },
      data: body,
      select: {
        id: true,
        name: true,
        clientId: true,
      },
    });

    return c.json({
      success: true,
      data: updatedProject,
    });
  },
);

projectRoute.delete(
  "/:id",
  requiredPermission(PERMISSION.PROJECT_DELETE),
  async (c) => {
    const projectId = Number(c.req.param("id"));

    if (Number.isNaN(projectId)) {
      throw new AppError("Invalid project ID", 400, "INVALID_PROJECT_ID");
    }

    const project = await db.project.findFirst({
      where: {
        id: projectId,
        deletedAt: null,
      },
    });

    if (!project) {
      throw new AppError("Project not found", 404, "PROJECT_NOT_FOUND");
    }

    await db.project.update({
      where: {
        id: projectId,
      },
      data: {
        deletedAt: new Date(),
      },
    });

    return c.json({
      success: true,
      message: "Project deleted successfully",
    });
  },
);

export default projectRoute;
