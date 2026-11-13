import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('pre-arrival-reminders', 'PRE_ARRIVAL_REMINDER_CRON_SECRET', 'x-pre-arrival-reminder-cron-secret');
