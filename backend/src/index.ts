import { Hono } from "hono";
import cronRoute from "./routes/cronRoute";
import { cors } from "hono/cors";
import { loadCronJobs } from "./services/cronJobService";

const app = new Hono();

app.use(cors({
  origin: process.env.CORS_ORIGIN as string,
}));

app.route("/api/v1/cronJob", cronRoute);

await loadCronJobs();

export default app;