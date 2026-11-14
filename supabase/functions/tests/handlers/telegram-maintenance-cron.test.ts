import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('telegram-maintenance-cron', 'TELEGRAM_MAINTENANCE_CRON_SECRET', 'x-telegram-cron-secret');
