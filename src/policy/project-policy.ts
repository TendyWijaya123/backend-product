import { JWTPayload } from "hono/utils/jwt/types";
import { AppError } from "../middleware/error-handler";

export function getProjectAccessFilter(user: JWTPayload) {
  switch (user.role) {
    case "PRODUCT_MANAGER":
      return {};

    case "INTERNAL_TEAM":
      return {
        members: {
          some: {
            userId: Number(user.sub),
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
        clientId: user.clientId,
      };

    default:
      throw new AppError("You cannot access projects", 403, "FORBIDDEN");
  }
}
