import { z } from 'zod';

export const CronJobCreateSchema = z.object({
  userId: z.string().min(1, "UserID is required"),
  title: z.string().min(1, "Title is required"),
  url: z.url("URL is Required"),
  schedule: z.string().min(1, "Schedule is Required")
})

export const CronJobUpdateSchema = z.object({
  cronJobId: z.string().min(1, "CronJob ID is required"),
  userId: z.string().min(1, "User ID is required"),
  title: z.string().min(1, "Title is Required").optional(),
  url: z.url("URL is required").optional(),
  schedule: z.string().min(1, "Schedule is required").optional(),
}).refine((data) => data.title || data.url || data.schedule, {
  message: "At least one of 'title', 'url', or 'schedule' is required"
})
export const CronJobActionSchema = z.object({
  userId: z.string().min(1, "UserID is required"),
  cronJobId: z.string().min(1, "CronJob ID is required"),
})

export const CronJobTestRunSchema = z.object({
  url: z.url("Valid URL is Required")
})
