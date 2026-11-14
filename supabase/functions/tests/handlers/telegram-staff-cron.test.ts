import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('telegram-staff-cron', 'TELEGRAM_STAFF_CRON_SECRET', 'x-telegram-cron-secret');
