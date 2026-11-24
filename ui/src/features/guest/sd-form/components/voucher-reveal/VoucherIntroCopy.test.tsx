import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { voucherReelPool } from '@/features/guest/sd-form/lib/voucher';

import { VoucherIntroCopy } from './VoucherIntroCopy';

const pool = voucherReelPool(undefined);

describe('VoucherIntroCopy', () => {
  it('thanks the guest for the review when they left one', () => {
    render(<VoucherIntroCopy prizePool={pool} style="wheel" reviewSubmitted />);
    expect(screen.getByText(/Thanks for your review!/)).toBeTruthy();
  });

  it('drops the review thank-you when the guest skipped the review step', () => {
    render(<VoucherIntroCopy prizePool={pool} style="wheel" reviewSubmitted={false} />);
    expect(screen.queryByText(/Thanks for your review/)).toBeNull();
    // The offer itself must survive the copy change.
    expect(screen.getByText(/Tap below to win/)).toBeTruthy();
  });
});
