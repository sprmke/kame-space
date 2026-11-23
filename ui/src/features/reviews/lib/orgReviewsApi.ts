import type {
  PropertyReviewSummary,
  ReceivedReviewItem,
  ReviewListTab,
  ToWriteItem,
  WrittenReviewItem,
} from '@/features/reviews/lib/propertyReviewsApi';

export type OrgPropertyReviewRow = {
  propertyId: string;
  propertySlug: string;
  propertyName: string;
  count: number;
  avgOverall: number | null;
  responseRate: number;
  dueCount: number;
};

export type OrgReviewSummary = PropertyReviewSummary & {
  properties: OrgPropertyReviewRow[];
};

type WithProperty = {
  propertyId: string;
  propertySlug: string;
  propertyName: string;
};

/** `canRespond` is this caller's `reviews.responses:edit` on that listing. */
export type OrgReceivedReviewItem = ReceivedReviewItem & WithProperty & { canRespond: boolean };

export type OrgWrittenReviewItem = WrittenReviewItem & WithProperty;

/** `canWrite` is this caller's `reviews.guests:edit` on that listing. */
export type OrgToWriteItem = ToWriteItem & WithProperty & { canWrite: boolean };

export type OrgReviewListItem = OrgReceivedReviewItem | OrgWrittenReviewItem | OrgToWriteItem;

export type OrgReviewsPage = {
  tab: ReviewListTab;
  summary: OrgReviewSummary;
  items: OrgReviewListItem[];
  total: number;
};
