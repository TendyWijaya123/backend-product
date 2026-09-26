import { zValidator as zv } from "@hono/zod-validator";

const zValidator = (target: any, schema: any) => {
  return zv(target, schema, (result, c) => {
    if (!result.success) {
      return c.json(
        {
          message: "Validation failed",
          errors: result.error.issues,
        },
        400,
      );
    }
  });
};

export default zValidator;
