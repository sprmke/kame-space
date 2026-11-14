import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('complete-parking-bookings', 'PARKING_COMPLETION_CRON_SECRET', 'x-parking-completion-cron-secret');
