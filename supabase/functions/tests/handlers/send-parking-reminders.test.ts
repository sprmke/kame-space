import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('send-parking-reminders', 'PARKING_REMINDER_CRON_SECRET', 'x-parking-reminder-cron-secret');
