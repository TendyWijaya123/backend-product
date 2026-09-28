import type { JWTPayload } from "hono/utils/jwt/types";
import { AppError } from "../middleware/error-handler";

export function getTaskAccessFilter(user: JWTPayload) {
  switch (user.role) {
    case "PRODUCT_MANAGER":
      return {};

    case "INTERNAL_TEAM":
      return {
        project: {
          members: {
            some: {
              userId: Number(user.sub),
            },
          },
        },
      };

    case "CLIENT_GUEST":
      if (user.clientId === null) {
        throw new AppError(
          "User is not associated with a client",
          403,
          "FORBIDDEN",
        );
      }

      return {
        project: {
          clientId: user.clientId,
        },
        clientVisible: true,
      };

    default:
      throw new AppError("You cannot access tasks", 403, "FORBIDDEN");
  }
}

export function canUpdateTaskStatus(
  user: JWTPayload,
  assigneeId: number | null,
  newStatus: string,
) {
  const userId = Number(user.sub);

  if (user.role === "PRODUCT_MANAGER") {
    if (newStatus === "DONE") {
      throw new AppError(
        "Product Manager cannot move task to DONE",
        403,
        "TASK_COMPLETION_FORBIDDEN",
      );
    }

    return;
  }

  if (assigneeId === userId) {
    return;
  }

  throw new AppError(
    "Only the task assignee can update task status",
    403,
    "TASK_STATUS_UPDATE_FORBIDDEN",
  );
}
