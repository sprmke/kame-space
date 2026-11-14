import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract('analytics-ai-review-cron', 'ANALYTICS_AI_REVIEW_CRON_SECRET', 'x-analytics-ai-review-cron-secret');
