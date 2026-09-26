import { Context, Next } from "hono";
import { AppError } from "./error-handler";
import { JWTPayload } from "hono/utils/jwt/types";

const requiredPermission = (permission: string) => {
  return async (c: Context, next: Next) => {
    const user = c.get("jwtPayload") as
      | (JWTPayload & { permissions?: string[] })
      | undefined;

    if (!user) {
      throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    }

    const permissions = user.permissions ?? [];
    if (!permissions.includes(permission)) {
      throw new AppError(
        "You do not have permission to perform this action",
        403,
        "FORBIDDEN",
      );
    }

    await next();
  };
};

export default requiredPermission;
