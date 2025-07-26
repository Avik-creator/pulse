import { PrismaClient } from "../generated/prisma/client";
import { Context } from "hono";
import cron from "node-cron";
import {
  execute,
  getCronExpression,
  getNextTwoExecutions,
} from "../utils/utils";
import {
  deleteOlderEvents,
  executeJobWithRetry,
  MAX_RETRIES,
  scheduledjobs,
} from "../services/cronJobService";
import {
  CronJobActionSchema,
  CronJobCreateSchema,
  CronJobTestRunSchema,
  CronJobUpdateSchema,
} from "../validator/cron.validator";

const prisma = new PrismaClient();

export const createCronjob = async (c: Context) => {
  try {
    const body = await c.req.json();
    const result = CronJobCreateSchema.safeParse(body);

    if (!result.success) {
      console.error("Error validating CronJobCreate schema : ", result.error);
      return c.json("Validation failed", 400);
    }

    const { userId, title, url, schedule } = result.data;

    const newCronJob = await prisma.cronJob.create({
      data: {
        userId,
        title,
        url,
        cronSchedule: schedule,
        active: true,
      },
    });

    const cronExpression = getCronExpression(schedule);

    const job = cron.schedule(cronExpression, async () => {
      const executionTime = new Date();
      let retriesLeft = MAX_RETRIES;
      await executeJobWithRetry(
        url,
        newCronJob.id,
        executionTime,
        title,
        retriesLeft
      );
      scheduledjobs.set(newCronJob.id, job);
    });

    const nextExecutions = getNextTwoExecutions(cronExpression);
    for (const nextTime of nextExecutions) {
      const now = new Date();
      if (nextTime <= now) {
        return c.json("Invalid schedule", 400);
      }
      await prisma.event.create({
        data: {
          cronJobId: newCronJob.id,
          time: nextTime,
          status: "PENDING",
        },
      });
    }

    job.start();
    console.log("Cron job created!");
    return c.json({ message: "Cron job created!!" }, 200);
  } catch (err) {
    console.error("Error in adding cronjob: ", err);
    return c.json({ message: "Internal server error" }, 500);
  }
};

export const cronTestRun = async (c: Context) => {
  try {
    const body = await c.req.json();
    const result = CronJobTestRunSchema.safeParse(body);
    
    if (!result.success) {
      console.error("Error validating url : ", result.error);
      return c.json("Validation failed", 400);
    }

    const { url } = result.data;

    const response = await execute(url);
    if (response) {
      return c.json({ message: "Test run success" }, 200);
    }
  } catch (err: any) {
    console.error("Error in test run: ", err);
    if (err.response?.status === 403) {
      return c.json({
        message: "CORS error: Access denied",
      }, err.response.status);
    } else if (err.request) {
      return c.json({
        message: "No response received. Possible CORS or server issue.",
      }, 500);
    } else {
      return c.json({
        message: "Test run failed.",
      }, 500);
    }
  }
};

export const enableCronjob = async (c: Context) => {
  try {
    const body = await c.req.json();
    const result = CronJobActionSchema.safeParse(body);
    
    if (!result.success) {
      console.error("Error validating CronJobAction schema : ", result.error);
      return c.json("Validation failed", 400);
    }

    const { cronJobId, userId } = result.data;

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return c.json("unauthorized", 401);
    }

    const job = await prisma.cronJob.findFirst({
      where: {
        id: cronJobId,
      },
    });

    if (!job) {
      return c.json("Job not found", 404);
    }

    const updatedCronjob = await prisma.cronJob.update({
      where: {
        id: cronJobId,
      },
      data: {
        active: true,
      },
    });

    const cronExpression = getCronExpression(updatedCronjob.cronSchedule);
    const nextExecutions = getNextTwoExecutions(cronExpression);

    for (const nextTime of nextExecutions) {
      await prisma.event.create({
        data: {
          cronJobId: updatedCronjob.id,
          time: nextTime,
          status: "PENDING",
        },
      });
    }
    
    const scheduledjob = scheduledjobs.get(job.id);
    if (scheduledjob) {
      scheduledjob.start();
      console.log("job restarted!");
    } else {
      // if no job
      const scheduledJob = cron.schedule(cronExpression, async () => {
        const executionTime = new Date();
        let retriesLeft = MAX_RETRIES;
        await executeJobWithRetry(
          updatedCronjob.url,
          updatedCronjob.id,
          executionTime,
          updatedCronjob.title,
          retriesLeft
        );

        // checks for the scheduled events
        const scheduledEvents = await prisma.event.findMany({
          where: {
            cronJobId: updatedCronjob.id,
            status: "PENDING",
          },
        });

        // if scheduled events length is 1 then create one
        if (scheduledEvents.length === 1) {
          const nextExecutions = getNextTwoExecutions(cronExpression);

          await prisma.event.create({
            data: {
              cronJobId: updatedCronjob.id,
              time: nextExecutions[1],
              status: "PENDING",
            },
          });
        }
        if (scheduledEvents.length === 0) {
          const nextExecutions = getNextTwoExecutions(cronExpression);
          for (const nextTime of nextExecutions) {
            await prisma.event.create({
              data: {
                cronJobId: updatedCronjob.id,
                time: nextTime,
                status: "PENDING",
              },
            });
          }
        }
      });
      // save the job in-memory and starts
      scheduledjobs.set(updatedCronjob.id, scheduledJob);
      scheduledJob.start();
      console.log("Job scheduled again and started!!");
    }

    await deleteOlderEvents(cronJobId);
    return c.json("Cronjob enabled successfully", 200);
  } catch (err) {
    console.error("Couldn't enable the job");
    return c.json("Internal server error", 500);
  }
};

export const disableCronjob = async (c: Context) => {
  try {
    const body = await c.req.json();
    const result = CronJobActionSchema.safeParse(body);
    
    if (!result.success) {
      console.error("Error validating CronJobAction schema : ", result.error);
      return c.json("Validation failed", 400);
    }

    const { cronJobId, userId } = result.data;

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user) {
      return c.json("unauthorized", 401);
    }

    const job = await prisma.cronJob.findFirst({
      where: {
        id: cronJobId,
      },
    });

    if (!job) {
      return c.json("Job not found", 404);
    }

    const updatdCronjob = await prisma.cronJob.update({
      where: {
        id: cronJobId,
      },
      data: {
        active: false,
      },
    });
    
    await prisma.event.deleteMany({
      where: {
        cronJobId: cronJobId,
        status: "PENDING",
      },
    });

    const scheduledjob = scheduledjobs.get(job.id);
    if (scheduledjob) {
      scheduledjob.stop();
      console.log("job stopped!");
    }

    return c.json("Cronjob disabled successfully", 200);
  } catch (err) {
    console.error("Couldn't disable the job");
    return c.json("Internal server error", 500);
  }
};

export const deleteCronjob = async (c: Context) => {
  try {
    const query = c.req.query();
    const result = CronJobActionSchema.safeParse(query);

    if (!result.success) {
      console.error("Error validating CronJobActionSchema  : ", result.error);
      return c.json("Validation failed", 400);
    }

    const { userId, cronJobId } = result.data;

    const user = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });
    
    if (!user) {
      return c.json("Unauthorized", 401);
    }

    const job = await prisma.cronJob.findFirst({
      where: {
        id: cronJobId,
      },
    });

    if (!job) {
      return c.json("Cronjob not found", 404);
    }

    await prisma.$transaction([
      prisma.event.deleteMany({
        where: {
          cronJobId: cronJobId,
        },
      }),
      prisma.cronJob.delete({
        where: {
          id: cronJobId,
        },
      }),
    ]);
    
    return c.json("Cronjob deleted successfully", 200);
  } catch (err) {
    console.error("Error in deleting cronjob : ", err);
    return c.json("Internal server error", 500);
  }
};

export const updateCronjob = async (c: Context) => {
  try {
    const body = await c.req.json();
    const result = CronJobUpdateSchema.safeParse(body);

    if (!result.success) {
      console.error("Error validating CronJobUpdateSchema : ", result.error);
      return c.json("Validation failed", 400);
    }

    const { cronJobId, userId, title, url, schedule } = result.data;

    const cronjob = await prisma.cronJob.findFirst({
      where: {
        userId,
        id: cronJobId,
      },
    });

    if (!cronjob) {
      return c.json({ message: "Cronjob not found" }, 404);
    }

    const updated = await prisma.cronJob.update({
      where: {
        userId,
        id: cronJobId,
      },
      data: {
        cronSchedule: schedule,
        title,
        url,
      },
    });
    
    console.log(updated);
    if (!updated) {
      return c.json({ message: "Couldn't update cronjob" }, 400);
    }

    const ExistingJob = scheduledjobs.get(updated.id);
    if (ExistingJob) {
      ExistingJob.stop();
      scheduledjobs.delete(updated.id);

      const cronExpression = getCronExpression(updated.cronSchedule);

      const newScheduledJob = cron.schedule(cronExpression, async () => {
        const executionTime = new Date();
        let retriesLeft = MAX_RETRIES;

        await executeJobWithRetry(
          url as string,
          updated.id,
          executionTime,
          updated.title,
          retriesLeft
        );

        // checks for the scheduled events
        const scheduledEvents = await prisma.event.findMany({
          where: {
            cronJobId: updated.id,
            status: "PENDING",
          },
        });

        if (scheduledEvents.length === 1) {
          const nextExecutions = getNextTwoExecutions(cronExpression);

          await prisma.event.create({
            data: {
              cronJobId: updated.id,
              time: nextExecutions[1],
              status: "PENDING",
            },
          });
        }

        if (scheduledEvents.length === 0) {
          const nextExecutions = getNextTwoExecutions(cronExpression);
          for (const nextTime of nextExecutions) {
            await prisma.event.create({
              data: {
                cronJobId: updated.id,
                time: nextTime,
                status: "PENDING",
              },
            });
          }
        }
      });

      scheduledjobs.set(updated.id, newScheduledJob);
      newScheduledJob.start();
      await deleteOlderEvents(cronJobId);
    }

    return c.json({ message: "Cronjob updated!" }, 200);
  } catch (err) {
    console.error("Error in updating cronjob: ", err);
    return c.json({ message: "Internal server error" }, 500);
  }
};

export const testPoint = async (c: Context) => {
  return c.json("OK!", 200);
};