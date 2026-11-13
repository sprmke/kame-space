import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('review-lifecycle-cron', 'REVIEW_LIFECYCLE_CRON_SECRET', 'x-review-lifecycle-cron-secret');
