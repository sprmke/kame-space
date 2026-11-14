import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('platform-billing-cron', 'PLATFORM_BILLING_CRON_SECRET', 'x-platform-billing-cron-secret');
