import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('marketing-generation-sweeper', 'MARKETING_GENERATION_CRON_SECRET', 'x-marketing-generation-cron-secret');
