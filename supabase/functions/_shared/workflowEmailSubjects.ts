/**
 * Workflow email subjects.
 *
 * One builder per subject line so the Azure golden set (`scripts/dev/golden/`) can snapshot
 * them and Phase 3 can make them per-residence without touching the send paths.
 */

import { formatEmailDateRange } from './propertyEmailBranding.ts';

/**
 * Same-day check-in (Asia/Manila) — **subject line** prefix for ops-facing
 * mail (GAF, Pet, Parking broadcast, **New Booking Request** notify to
 * `EMAIL_REPLY_TO`). Guest-facing templates (acknowledgement, check-in details,
 * SD refund form request subject, etc.) do not use this prefix on the subject.
 */
export function urgentEmailSubjectPrefix(isUrgent: boolean): string {
  return isUrgent ? '🚨 URGENT - ' : '';
}

/**
 * Checks if a booking is urgent (same-day check-in)
 * @param checkInDate - Check-in date in MM-DD-YYYY or YYYY-MM-DD format
 * @returns true if check-in is today (in Philippine timezone UTC+8)
 */
export function isUrgentBooking(checkInDate: string): boolean {
  try {
    console.log('🔍 Checking if booking is urgent...');

    // Parse the check-in date (supports both MM-DD-YYYY and YYYY-MM-DD formats)
    let checkInDateStr = checkInDate;

    // If date is in MM-DD-YYYY format, convert to YYYY-MM-DD
    if (checkInDate.match(/^\d{2}-\d{2}-\d{4}$/)) {
      const [month, day, year] = checkInDate.split('-');
      checkInDateStr = `${year}-${month}-${day}`;
      console.log('  Converted to YYYY-MM-DD:', checkInDateStr);
    }

    // Get today's date in Philippine timezone (UTC+8)
    const philippineTime = new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Manila' })
    );
    const todayStr =
      philippineTime.getFullYear() +
      '-' +
      String(philippineTime.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(philippineTime.getDate()).padStart(2, '0');

    console.log("  Today's date (Philippine time):", todayStr);
    console.log('  Check-in date (normalized):', checkInDateStr);
    console.log('  Is urgent:', checkInDateStr === todayStr);

    return checkInDateStr === todayStr;
  } catch (error) {
    console.error('❌ Error checking if booking is urgent:', error);
    return false;
  }
}

/** GAF request subject — ops-facing, so it carries the urgent and update prefixes. */
export function buildGafRequestSubject(input: {
  unitLabel: string;
  displayCheckInDate: string;
  displayCheckOutDate: string;
  isUrgent: boolean;
  isUpdate: boolean;
}): string {
  const urgentPrefix = urgentEmailSubjectPrefix(input.isUrgent);
  const updatePrefix = input.isUpdate ? 'UPDATED - ' : '';
  return `${urgentPrefix}${updatePrefix}${input.unitLabel} - GAF Request ${formatEmailDateRange(
    input.displayCheckInDate,
    input.displayCheckOutDate
  )}`;
}

/** Pet request subject — ops-facing, so it carries the urgent and update prefixes. */
export function buildPetRequestSubject(input: {
  unitLabel: string;
  displayCheckInDate: string;
  displayCheckOutDate: string;
  isUrgent: boolean;
  isUpdate: boolean;
}): string {
  const urgentPrefix = urgentEmailSubjectPrefix(input.isUrgent);
  const updatePrefix = input.isUpdate ? 'UPDATED - ' : '';
  return `${urgentPrefix}${updatePrefix}${input.unitLabel} - Pet Request ${formatEmailDateRange(
    input.displayCheckInDate,
    input.displayCheckOutDate
  )}`;
}

/** Ready-for-check-in subject — guest-facing, so no urgent prefix. */
export function buildReadyForCheckinSubject(input: {
  unitLabel: string;
  displayCheckInDate: string;
  displayCheckOutDate: string;
}): string {
  return `${input.unitLabel} - Check-in Details ${formatEmailDateRange(
    input.displayCheckInDate,
    input.displayCheckOutDate
  )}`;
}
