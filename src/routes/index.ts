import { Hono } from "hono";
import authRoute from "./auth-route";

const route = new Hono().basePath("/api");

route.route("/", authRoute);
export default route;
