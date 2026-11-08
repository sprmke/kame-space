import { beforeEach, describe, expect, it, vi } from 'vitest';

const toast = { success: vi.fn(), error: vi.fn() };
const writeText = vi.fn();

vi.mock('sonner', () => ({ toast }));

const { copyGuestLink } = await import('@/features/dashboard/custom-pages/lib/copyGuestLink');

describe('copyGuestLink', () => {
  beforeEach(() => {
    toast.success.mockReset();
    toast.error.mockReset();
    writeText.mockReset();
    vi.stubGlobal('navigator', { clipboard: { writeText } });
  });

  it('copies the link and names the page that was copied', async () => {
    writeText.mockResolvedValue(undefined);

    await copyGuestLink('/p/monaco', 'Listing');

    expect(writeText).toHaveBeenCalledWith('/p/monaco');
    expect(toast.success).toHaveBeenCalledWith('Listing link copied');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('reports a blocked clipboard instead of throwing', async () => {
    writeText.mockRejectedValue(new Error('denied'));

    await expect(copyGuestLink('/p/monaco', 'Listing')).resolves.toBeUndefined();
    expect(toast.error).toHaveBeenCalledWith('Could not copy link');
    expect(toast.success).not.toHaveBeenCalled();
  });
});
