import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('query-cache-sweep-cron', 'QUERY_CACHE_SWEEP_CRON_SECRET', 'x-query-cache-sweep-cron-secret');
