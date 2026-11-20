import { cronPostContract } from '../harness/cronPostContract.ts';

cronPostContract(
  'data-subject-requests-cron',
  'DATA_SUBJECT_REQUESTS_CRON_SECRET',
  'x-data-subject-cron-secret'
);
