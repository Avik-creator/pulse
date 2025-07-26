import { Hono } from "hono";
import { createCronjob, cronTestRun, deleteCronjob, disableCronjob, enableCronjob, testPoint, updateCronjob } from "../controllers/cronCrontroller.js";

const cronRoute = new Hono();

cronRoute.get("/", (c) => c.json({ message: "Hello World" }));
cronRoute.post("/create", createCronjob);
cronRoute.post("/test", cronTestRun);
cronRoute.post("/enable", enableCronjob);
cronRoute.post("/disable", disableCronjob);
cronRoute.post("/delete", deleteCronjob);
cronRoute.post("/update", updateCronjob);
cronRoute.post("/test-point", testPoint);

export default cronRoute;