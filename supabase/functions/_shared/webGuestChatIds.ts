/** Shared IDs for guest web chat messages (avoids circular imports). */

export function buildWebThreadId(propertyId: string, guestUserId: string): string {
  return `web:${propertyId}:${guestUserId}`;
}

export function buildParkingWebThreadId(parkingId: string, guestUserId: string): string {
  return `web:parking:${parkingId}:${guestUserId}`;
}

/**
 * Host-opened web thread when the booking has no signed-in guest yet.
 * Claimed into a normal guest thread once the guest opens chat from their trip.
 */
export function buildBookingWebThreadId(bookingId: string): string {
  return `web:booking:${bookingId}`;
}

export function buildWebMessageExternalId(): string {
  return `web:${crypto.randomUUID()}`;
}
