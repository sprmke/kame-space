import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('telegram-marketing-cron', 'TELEGRAM_CRON_SECRET', 'x-telegram-cron-secret');
