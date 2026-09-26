import { Hono } from "hono";

const projectRoute = new Hono().basePath("/projects");

export default projectRoute;
