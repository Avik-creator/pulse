import { Hono } from "hono";
import cronRoute from "./routes/cronRoute.js";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";
import { loadCronJobs } from "./services/cronJobService.js";

export const runtime = "edge";

const app = new Hono();

app.use(cors({
  origin: "*",
}));

app.route("/api/v1/cronJob", cronRoute);

await loadCronJobs();

export default handle(app);