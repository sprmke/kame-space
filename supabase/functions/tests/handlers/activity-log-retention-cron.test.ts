import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('activity-log-retention-cron', 'ACTIVITY_LOG_RETENTION_CRON_SECRET', 'x-activity-log-retention-cron-secret');
