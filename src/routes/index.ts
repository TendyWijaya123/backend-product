import { Hono } from "hono";
import authRoute from "./auth-route";
import db from "../db/prisma";
import projectRoute from "./project-route";
import taskRoute from "./task-route";

const route = new Hono().basePath("/api");

route.route("/", authRoute);
route.route("/", projectRoute);
route.route("/", taskRoute);

route.get("/test", (c) => {
  return c.json("aneh");
});

export default route;
