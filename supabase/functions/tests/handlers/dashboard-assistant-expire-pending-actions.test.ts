import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('dashboard-assistant-expire-pending-actions', 'DASHBOARD_ASSISTANT_EXPIRE_CRON_SECRET', 'x-dashboard-assistant-expire-cron-secret');
