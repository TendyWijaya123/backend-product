import { Hono } from "hono";
import route from "./routes";

const app = new Hono();

app.route("/", route);

export default app;
