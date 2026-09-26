import { Hono } from "hono";
import authMiddleware from "../middleware/auth-middleware";
import db from "../db/prisma";
import { success } from "zod";
import TASK_STATUS from "../constants/task-status";
import requiredPermission from "../middleware/rbac-middleware";
import PERMISSION from "../constants/permissions";

const projectRoute = new Hono().basePath("/projects");
projectRoute.use("/*", authMiddleware);

projectRoute.get(
  "/",
  requiredPermission(PERMISSION.PROJECT_READ),
  async (c) => {
    const projects = await db.project.findMany({
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
      data: projects.map((project) => {
        return {
          id: project.id,
          name: project.name,
          totalTasks: project._count.tasks,
          completedTasks: project.tasks.length,
        };
      }),
    });
  },
);

export default projectRoute;
