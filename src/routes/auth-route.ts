import { Hono } from "hono";
import { registerSchema } from "../validation/auth-validation";
import zValidator from "../middleware/validation-middleware";

const authRoute = new Hono().basePath("/auth");

authRoute.post("/register", zValidator("json", registerSchema), (c) => {
  const data = c.req.valid("json");
  return c.json(data);
});
export default authRoute;
