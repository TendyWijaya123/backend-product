import { Hono } from "hono";
import route from "./routes";
import { config } from "dotenv";
import { errorHandler } from "./middleware/error-handler";
config();

const app = new Hono();

app.onError(errorHandler);

app.route("/", route);

export default app;
