import { Hono } from "hono";
import cronRoute from "./routes/cronRoute";
import { cors } from "hono/cors";
import { handle } from "hono/vercel";
import { loadCronJobs } from "./services/cronJobService";

const app = new Hono();

app.use(cors({
  origin: "*",
}));

app.route("/api/v1/cronJob", cronRoute);

// Initialize cron jobs
(async () => {
  await loadCronJobs();
})();

export default handle(app);