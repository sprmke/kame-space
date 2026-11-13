import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('contract-expiry-cron', 'CONTRACT_EXPIRY_CRON_SECRET', 'x-contract-expiry-cron-secret');
