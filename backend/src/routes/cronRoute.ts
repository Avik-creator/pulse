import { Hono } from "hono";
import { createCronjob, cronTestRun, deleteCronjob, disableCronjob, enableCronjob, testPoint, updateCronjob } from "../controllers/cronCrontroller";

const cronRoute = new Hono();

cronRoute.post("/create", createCronjob);
cronRoute.post("/test", cronTestRun);
cronRoute.post("/enable", enableCronjob);
cronRoute.post("/disable", disableCronjob);
cronRoute.post("/delete", deleteCronjob);
cronRoute.post("/update", updateCronjob);
cronRoute.post("/test-point", testPoint);

export default cronRoute;