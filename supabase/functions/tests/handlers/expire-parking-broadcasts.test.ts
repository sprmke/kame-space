import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('expire-parking-broadcasts', 'PARKING_BROADCAST_EXPIRE_CRON_SECRET', 'x-parking-broadcast-expire-cron-secret');
