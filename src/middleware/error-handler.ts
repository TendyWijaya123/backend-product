import { Prisma } from "@prisma/client";
import type { Context } from "hono";

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number,
    public code: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const errorHandler = (err: Error, c: Context) => {
  if (err instanceof AppError) {
    return c.json(
      {
        success: false,
        error: {
          code: err.code,
          message: err.message,
        },
      },
      err.statusCode as any,
    );
  }

  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2003"
  ) {
    return c.json(
      {
        success: false,
        error: {
          code: "INVALID_REFERENCE",
          message: "Referenced resource does not exist",
        },
      },
      400,
    );
  }

  if (
    err instanceof Prisma.PrismaClientKnownRequestError &&
    err.code === "P2002"
  ) {
    return c.json(
      {
        success: false,
        error: {
          code: "DUPLICATE_RESOURCE",
          message: "Resource already exists",
        },
      },
      409,
    );
  }

  console.error(err);

  return c.json(
    {
      success: false,
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Internal server error",
      },
    },
    500,
  );
};
