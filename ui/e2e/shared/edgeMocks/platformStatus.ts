import type { EdgeMock } from '../interceptEdge';

/** Payload of `get-public-platform-status` (`jsonSuccess` envelope, anon-safe). */
export type PlatformStatus = {
  maintenanceMode: boolean;
  maintenanceMessage: string | null;
  signupsEnabled: boolean;
};

/**
 * The status banner every page reads on boot. Kept here rather than inline in each spec so
 * the field names stay tied to the edge function, not to whichever page mocked it first.
 */
export function mockPlatformStatus(overrides: Partial<PlatformStatus> = {}): EdgeMock {
  const status: PlatformStatus = {
    maintenanceMode: false,
    maintenanceMessage: null,
    signupsEnabled: true,
    ...overrides,
  };

  return {
    name: 'get-public-platform-status',
    method: 'GET',
    body: { success: true, data: status },
  };
}
