/** User-facing copy for the AI assistant's parking claim/decline tool results. */
export function parkingBroadcastActionMessage(code: string): string {
  switch (code) {
    case 'slot_unavailable':
      return 'This slot is already booked for these dates.';
    case 'offer_expired':
      return 'This offer expired. Open the next request instead.';
    case 'already_claimed':
      return 'Another host already accepted this request.';
    case 'parking_not_found':
      return 'This parking slot is no longer available.';
    case 'booking_not_found':
      return 'This request no longer exists.';
    default:
      return code;
  }
}
