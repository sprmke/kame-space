import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('telegram-finance-cron', 'TELEGRAM_FINANCE_CRON_SECRET', 'x-telegram-cron-secret');
