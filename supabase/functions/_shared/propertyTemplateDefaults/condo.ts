/**
 * Condo default pack for property templates.
 *
 * Every property type resolves to this pack until other packs exist. Copy here is the shipped
 * default; a later pass rewrites it once the wider placeholder set lands. Bodies are stored in
 * the shape the editor produces, with block placeholders alone in a `<p>`.
 */

export type CondoTemplateDefault = {
  content: string;
  /** Email only. Locked subjects (GAF, pet) ignore this because inbound approval parses them. */
  subject?: string;
};

export const CONDO_TEMPLATE_DEFAULTS: Record<string, CondoTemplateDefault> = {
  'house-rules': {
    content: `<h2>House Rules</h2>
<p>Welcome to our property! Please follow these guidelines to ensure a pleasant stay:</p>
<ul>
<li><strong>No smoking</strong> inside the property</li>
<li><strong>No parties or events</strong> without prior approval</li>
<li><strong>Quiet hours</strong> from 10 PM to 8 AM</li>
<li><strong>Pets</strong> allowed with prior approval and additional fee</li>
<li><strong>Maximum occupancy</strong> must be respected</li>
</ul>
<p>Please treat the property with care and respect. Any damages will be deducted from the security deposit.</p>`,
  },
  'check-in-instructions': {
    content: `<h2>Check-in Instructions</h2>
<p>Welcome! Here's everything you need to know for your check-in:</p>
<h3>Check-in Time</h3>
<p>Standard check-in time is <strong>2:00 PM</strong>. Early check-in may be available upon request.</p>
<h3>Getting Access</h3>
<ol>
<li>Upon arrival, proceed to the building lobby</li>
<li>Check in at the front desk with your valid ID</li>
<li>Collect your keys and parking pass (if applicable)</li>
</ol>
<h3>Self Check-in (After Hours)</h3>
<p>For late arrivals, use the lockbox code sent to your email. The lockbox is located near the main entrance.</p>`,
  },
  'check-out-instructions': {
    content: `<h2>Check-out Instructions</h2>
<p>Thank you for staying with us! Please follow these steps for check-out:</p>
<h3>Check-out Time</h3>
<p>Standard check-out time is <strong>11:00 AM</strong>. Late check-out may be available upon request.</p>
<h3>Before You Leave</h3>
<ul>
<li>Return all keys to the front desk or lockbox</li>
<li>Dispose of trash in designated bins</li>
<li>Ensure all windows and doors are locked</li>
<li>Turn off all lights and air conditioning</li>
<li>Check for personal belongings</li>
</ul>`,
  },
  'parking-reminders': {
    content: `<h2>Parking Reminders</h2>
<p>Important information about parking at our property:</p>
<h3>Parking Registration</h3>
<p>All vehicles must be registered with building security. Please provide:</p>
<ul>
<li>Vehicle plate number</li>
<li>Vehicle make/model</li>
<li>Vehicle color</li>
</ul>
<h3>Parking Rules</h3>
<ul>
<li>Park only in designated guest parking areas</li>
<li>Display your parking pass visibly on your dashboard</li>
<li>Do not park in reserved or handicap spaces without proper permits</li>
</ul>`,
  },
  'email-gaf-request': {
    content: `<p>{{urgent_notice}}</p>
<p>{{update_notice}}</p>
<p>Good day,</p>
<p>Kindly review the Guest Advise Form (GAF) request for <strong>{{tower_and_unit_number}}</strong>, dated from <strong>{{check_in_date}} to {{check_out_date}}</strong>, for your approval.</p>
<p>Please let me know if you need any additional information.</p>
<p>Thank you for your assistance.</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - GAF Request ({{check_in_date}} to {{check_out_date}})',
  },
  'email-pet-request': {
    content: `<p>{{urgent_notice}}</p>
<p>{{update_notice}}</p>
<p>Good day,</p>
<p>May we kindly request approval for our guest to bring a pet during their stay at <strong>{{tower_and_unit_number}}</strong> from <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong>.</p>
<p>{{pet_details_section}}</p>
<p>{{pet_attachments_section}}</p>
<p>Please let us know if you need any additional information or documentation.</p>
<p>Thank you for your consideration.</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - Pet Request ({{check_in_date}} to {{check_out_date}})',
  },
  'email-new-booking-request': {
    content: `<p>{{urgent_notice}}</p>
<p>A new booking request has been submitted. Please <strong>review and approve as soon as possible</strong>.</p>
<p>{{new_booking_detail_tables}}</p>
<p>{{downpayment_receipt_ai_section}}</p>
<p>{{booking_link_cta}}</p>`,
    subject: '{{tower_and_unit_number}} - New Booking Request {{stay_dates}}',
  },
  'email-booking-request-received': {
    content: `<p>Hi <strong>{{guest_facebook_name}}</strong>,</p>
<p>We received your booking request for <strong>{{property_name}}</strong> from <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong>.</p>
<p>Your host is reviewing it now. We will email you as soon as it is confirmed.</p>
<p>{{booking_request_received_flow_section}}</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - Booking Request Received {{stay_dates}}',
  },
  'email-booking-acknowledgement': {
    content: `<p>{{booking_acknowledgement_flow_section}}</p>
<p>Thank you for choosing {{property_name}}. We look forward to hosting you!</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - Booking Acknowledgement {{stay_dates}}',
  },
  'email-ready-for-checkin': {
    content: `<p>Dear <strong>{{guest_facebook_name}}</strong>,</p>
<p>Your check-in details are ready. We look forward to hosting you.</p>
<p>{{trip_cta_section}}</p>
<p>{{ready_for_checkin_booking_summary_section}}</p>
<p>{{payment_breakdown_section}}</p>
<p>{{gcash_payment_section}}</p>
<p>{{document_reminders_section}}</p>
<p>{{stay_guide_cta_section}}</p>
<p>{{ready_for_checkin_contact_section}}</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - Check-in Details {{stay_dates}}',
  },
  'email-sd-refund-form-request': {
    content: `<p>Hi <strong>{{guest_facebook_name}}</strong>,</p>
<p>Thank you for staying with us! We hope you had a wonderful stay! Please follow the check-out instructions below. After that, please open and fill out the SD refund form so that we can process your refund.</p>
<p>{{sd_refund_checklist_section}}</p>
<p>{{sd_refund_details_section}}</p>
<p>{{trip_cta_section}}</p>`,
    subject: '{{tower_and_unit_number}} - Check-out & SD Refund Details {{stay_dates}}',
  },
  'email-booking-cancelled-guest': {
    content: `<p>Hi <strong>{{guest_facebook_name}}</strong>,</p>
<p>{{cancellation_intro}}</p>
<p>This is for your stay at <strong>{{tower_and_unit_number}}</strong> from <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong>.</p>
<p>{{cancellation_detail_section}}</p>
<p>You can see the latest status any time from your trip page.</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - Booking Cancelled {{stay_dates}}',
  },
  'email-booking-cancelled-host': {
    content: `<p>Hello,</p>
<p>A booking was cancelled.</p>
<p>{{cancellation_detail_section}}</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - {{cancellation_host_title}} {{stay_dates}}',
  },
  'email-cancellation-request-guest': {
    content: `<p>Hi <strong>{{guest_facebook_name}}</strong>,</p>
<p><strong>{{cancellation_request_title}}</strong></p>
<p>{{cancellation_detail_section}}</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - {{cancellation_request_title}}',
  },
  'email-refund-sent-guest': {
    content: `<p>Hi <strong>{{guest_facebook_name}}</strong>,</p>
<p>Your refund has been sent.</p>
<p>{{cancellation_detail_section}}</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - Refund sent',
  },
  'email-pre-arrival-reminder': {
    content: `<p>Hi {{guest_first_name}},</p>
<p>Your stay at <strong>{{tower_and_unit_number}}</strong> starts on <strong>{{check_in_date}}</strong>. Check-in is from {{check_in_time}}, and check-out is by {{check_out_time}} on {{check_out_date}}.</p>
<p>{{balance_due_section}}</p>
<p>Directions, house rules and your arrival steps are on your trip page.</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - Check-in on {{check_in_date}}',
  },
  'email-parking-reminder': {
    content: `<p>Hi {{guest_first_name}},</p>
<p>You mentioned you need parking for your stay at <strong>{{tower_and_unit_number}}</strong> on {{check_in_date}}, and you have not reserved a slot yet.</p>
<p>Slots are limited, so book one before you arrive.</p>
<p>{{parking_cta_section}}</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - Reserve parking for your stay',
  },
  'email-review-request': {
    content: `<p>Hi {{guest_first_name}},</p>
<p>Thank you for staying at <strong>{{property_name}}</strong>. We hope you had a good stay.</p>
<p>Would you leave a short review? It helps future guests and helps us improve. You have {{review_window_days}} days to write it.</p>
<p>We will not see your review until we have reviewed your stay too, or until the window closes.</p>
<p>{{review_cta_section}}</p>
<p>{{email_signature_section}}</p>`,
    subject: 'How was your stay at {{property_name}}?',
  },
  'email-review-reminder': {
    content: `<p>Hi {{guest_first_name}},</p>
<p>The review window for your stay at <strong>{{property_name}}</strong> closes soon. If you have a minute, we would like to hear how it went.</p>
<p>{{review_cta_section}}</p>
<p>{{email_signature_section}}</p>`,
    subject: 'Reminder: review your stay at {{property_name}}',
  },
  'email-request-expired-guest': {
    content: `<p>Hi {{guest_first_name}},</p>
<p>Your booking request for <strong>{{property_name}}</strong> from <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong> expired because it was not confirmed in time. Nothing was charged.</p>
<p>We are sorry about that. If the dates are still open, you can send the request again from your trip page.</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - Request expired {{stay_dates}}',
  },
  'email-request-expiring-host': {
    content: `<p>Hi,</p>
<p><strong>{{guest_name}}</strong> asked for <strong>{{tower_and_unit_number}}</strong> from {{check_in_date}} to {{check_out_date}}, and the request is still waiting for your decision.</p>
<p>If no one answers it, it expires in {{expires_in_days}} days. The dates are released and the guest is told. Nothing has been charged, so there is nothing to refund.</p>
<p>{{booking_link_cta}}</p>`,
    subject:
      '{{tower_and_unit_number}} - Request expires in {{expires_in_days}} days {{stay_dates}}',
  },
  'email-building-admin-cancellation': {
    content: `<p>Good day,</p>
<p>Please cancel the GAF we sent for <strong>{{tower_and_unit_number}}</strong> for the stay from <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong>. The booking was cancelled, and these guests will not check in.</p>
<p>Thank you.</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - GAF cancellation {{stay_dates}}',
  },
};

export function condoTemplateDefault(key: string): CondoTemplateDefault | undefined {
  return CONDO_TEMPLATE_DEFAULTS[key];
}
