import { Hono } from "hono";
import authRoute from "./auth-route";
import db from "../db/prisma";

const route = new Hono().basePath("/api");

route.route("/", authRoute);
route.get("/test", (c) => {
  return c.json("aneh");
});

route.get("/test-db", async (c) => {
  console.log("BEFORE DB");

  const user = await db.user.findFirst();

  console.log("AFTER DB");

  return c.json({
    success: true,
    data: user,
  });
});
export default route;
