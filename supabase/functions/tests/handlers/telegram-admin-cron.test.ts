import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('telegram-admin-cron', 'TELEGRAM_ADMIN_CRON_SECRET', 'x-telegram-cron-secret');
