import { describe, expect, it } from 'vitest';

import {
  hostTierDocumentChecklistItems,
  recommendedTierDocumentChecklistItems,
  readOrgVerificationDetail,
  resolveHostModes,
  buildHostTierChecklist,
  buildVerifiedTierChecklist,
  buildVerificationTiers,
  countApprovedTiers,
  verificationSidebarLabel,
  verificationStatusLabel,
  isHostVerificationHardRejectedFromDetail,
  isHostVerificationHardRejected,
  isHostVerificationChangesRequestedFromDetail,
  isHostVerificationChangesRequested,
  canSubmitVerifiedTier,
  canSubmitHostTier,
} from '@/features/dashboard/org/lib/orgVerificationTiers';

describe('hostTierDocumentChecklistItems', () => {
  it('hostTierDocumentChecklistItems is exported', () => {
    expect(typeof hostTierDocumentChecklistItems).toBe('function');
  });
});

describe('recommendedTierDocumentChecklistItems', () => {
  it('recommendedTierDocumentChecklistItems is exported', () => {
    expect(typeof recommendedTierDocumentChecklistItems).toBe('function');
  });
});

describe('readOrgVerificationDetail', () => {
  it('readOrgVerificationDetail is exported', () => {
    expect(typeof readOrgVerificationDetail).toBe('function');
  });
});

describe('resolveHostModes', () => {
  it('resolveHostModes is exported', () => {
    expect(typeof resolveHostModes).toBe('function');
  });
});

describe('buildHostTierChecklist', () => {
  it('buildHostTierChecklist is exported', () => {
    expect(typeof buildHostTierChecklist).toBe('function');
  });
});

describe('buildVerifiedTierChecklist', () => {
  it('buildVerifiedTierChecklist is exported', () => {
    expect(typeof buildVerifiedTierChecklist).toBe('function');
  });
});

describe('buildVerificationTiers', () => {
  it('buildVerificationTiers is exported', () => {
    expect(typeof buildVerificationTiers).toBe('function');
  });
});

describe('countApprovedTiers', () => {
  it('countApprovedTiers is exported', () => {
    expect(typeof countApprovedTiers).toBe('function');
  });
});

describe('verificationSidebarLabel', () => {
  it('verificationSidebarLabel is exported', () => {
    expect(typeof verificationSidebarLabel).toBe('function');
  });
});

describe('verificationStatusLabel', () => {
  it('verificationStatusLabel is exported', () => {
    expect(typeof verificationStatusLabel).toBe('function');
  });
});

describe('isHostVerificationHardRejectedFromDetail', () => {
  it('isHostVerificationHardRejectedFromDetail is exported', () => {
    expect(typeof isHostVerificationHardRejectedFromDetail).toBe('function');
  });
});

describe('isHostVerificationHardRejected', () => {
  it('isHostVerificationHardRejected is exported', () => {
    expect(typeof isHostVerificationHardRejected).toBe('function');
  });
});

describe('isHostVerificationChangesRequestedFromDetail', () => {
  it('isHostVerificationChangesRequestedFromDetail is exported', () => {
    expect(typeof isHostVerificationChangesRequestedFromDetail).toBe('function');
  });
});

describe('isHostVerificationChangesRequested', () => {
  it('isHostVerificationChangesRequested is exported', () => {
    expect(typeof isHostVerificationChangesRequested).toBe('function');
  });
});

describe('canSubmitVerifiedTier', () => {
  it('canSubmitVerifiedTier is exported', () => {
    expect(typeof canSubmitVerifiedTier).toBe('function');
  });
});

describe('canSubmitHostTier', () => {
  it('canSubmitHostTier is exported', () => {
    expect(typeof canSubmitHostTier).toBe('function');
  });
});

describe('tier 2 live identity check', () => {
  it('marks the identity item complete and relabels it when the live check replaced the selfie', () => {
    const detail = readOrgVerificationDetail(null);
    const item = buildVerifiedTierChecklist(detail, { liveIdentity: true }).find(
      (entry) => entry.id === 'selfie'
    );
    expect(item).toMatchObject({ label: 'Identity check', complete: true });
  });

  it('keeps the selfie label for legacy rows that uploaded a photo', () => {
    const base = readOrgVerificationDetail(null);
    const detail = {
      ...base,
      assets: { ...base.assets, selfieWithIdPath: 'org/o/selfie_with_id/x.jpg' },
    };
    const item = buildVerifiedTierChecklist(detail).find((entry) => entry.id === 'selfie');
    expect(item?.complete).toBe(true);
    expect(item?.label).not.toBe('Identity check');
  });

  it('reads the stored live marker from org settings', () => {
    const detail = readOrgVerificationDetail({
      verification: { liveIdentityVerifiedAt: '2026-11-09T00:00:00.000Z' },
    });
    expect(detail.liveIdentityVerifiedAt).toBe('2026-11-09T00:00:00.000Z');
    const item = buildVerifiedTierChecklist(detail, { liveIdentity: true }).find(
      (entry) => entry.id === 'selfie'
    );
    expect(item?.complete).toBe(true);
  });

  it('treats a live check as satisfying the tier 2 submit gate', () => {
    const detail = readOrgVerificationDetail(null);
    expect(canSubmitVerifiedTier(detail, { selfie: true })).toBe(true);
    expect(canSubmitVerifiedTier(detail, { selfie: false })).toBe(false);
  });
});
