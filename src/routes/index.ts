import { Hono } from "hono";
import authRoute from "./auth-route";

const route = new Hono().basePath("/api");

route.get("/", (c) => {
  return c.json("Hi");
});

route.route("/", authRoute);
export default route;
