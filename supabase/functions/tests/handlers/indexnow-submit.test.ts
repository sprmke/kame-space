import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('indexnow-submit', 'INDEXNOW_CRON_SECRET', 'x-indexnow-cron-secret');
