import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('ops-report-cron', 'OPS_REPORT_CRON_SECRET', 'x-ops-report-cron-secret');
