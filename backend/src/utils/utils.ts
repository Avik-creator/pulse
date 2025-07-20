import { CronExpressionParser } from 'cron-parser';
import axios from 'axios';

export const getNextTwoExecutions = (cronSchedule: string) => {
  const now = new Date()

  const interval = CronExpressionParser.parse(cronSchedule, {
    currentDate: now,
  });

  const nextTime = []

  for (let i = 0; i < 2; i++) {
    nextTime.push(interval.next().toDate())
  }

  return nextTime;
}

export const getCronExpression = (schedule: string) => {
  return `*/${schedule} * * * *`;
}

export const execute = async (url: string) => {
  try {
    const response = await axios.head(url, {
      timeout: 10000,
    });
    return response;
  } catch (err) {
    throw err;
  }
};
