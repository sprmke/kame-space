import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('identity-captures-purge-cron', 'IDENTITY_PURGE_CRON_SECRET', 'x-identity-purge-cron-secret');
