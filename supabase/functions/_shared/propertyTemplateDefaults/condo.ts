/**
 * Condo default pack for property templates.
 *
 * Every property type resolves to this pack until other packs exist. Copy is written for
 * Philippine condo hosts: no Azure-only literals, no fixed times that can contradict Settings,
 * and building specifics come from placeholders.
 *
 * Bodies are stored in the shape the editor produces. Block placeholders sit alone in a `<p>`
 * so the send pipeline can replace them without breaking the surrounding paragraph.
 */

export type CondoTemplateDefault = {
  content: string;
  /** Email only. Locked subjects (GAF, pet) ignore this because inbound approval parses them. */
  subject?: string;
};

export const CONDO_TEMPLATE_DEFAULTS: Record<string, CondoTemplateDefault> = {
  'welcome-note': {
    content: `<h2>Welcome</h2>
<p>Hi {{guest_first_name}}, welcome to {{property_name}}. We are happy to host you.</p>
<p>This guide covers your stay from arrival to check-out: how to get in, how things work, and what to do before you leave. Keep it open on your phone during your stay.</p>
<p>{{contact_section}}</p>`,
  },
  'getting-here': {
    content: `<h2>Getting here</h2>
<p>{{property_name}} is at {{property_address}}.</p>
<p>{{map_cta_section}}</p>
<h3>By car</h3>
<ul>
<li>Use the main gate and tell the guard you are staying at {{tower_and_unit_number}}.</li>
<li>Drop off at your tower lobby. Do not leave your car in the drop-off area.</li>
<li>If you booked parking, see the Parking section of this guide.</li>
</ul>
<h3>By taxi or ride-hailing</h3>
<p>Set the pin to the address above and ask to be dropped at your tower lobby.</p>`,
  },
  'check-in-instructions': {
    content: `<h2>Check-in</h2>
<p>Check-in is from <strong>{{check_in_time}}</strong> on <strong>{{check_in_date}}</strong>. If you plan to arrive earlier, message us first so we can check if the unit is ready.</p>
<h3>At the lobby</h3>
<ol>
<li>Go to the reception desk of your tower.</li>
<li>Show a valid ID for each registered guest.</li>
<li>Tell the receptionist you are checking in to <strong>{{tower_and_unit_number}}</strong>.</li>
<li>Collect the access card or visitor pass if the building gives one.</li>
</ol>
<h3>Getting into the unit</h3>
<p>Your door code and Wi-Fi details are under Essentials at the top of this guide. They appear shortly before check-in.</p>
<p>Only guests registered with the building can stay in the unit. Visitors need our approval first.</p>`,
  },
  'house-rules': {
    content: `<h2>House rules</h2>
<p>Please follow these rules during your stay. They keep the unit in good shape and keep us on good terms with the building and our neighbors.</p>
<p>{{house_rules_list}}</p>
<h3>Building rules</h3>
<p>The building's own rules apply to all guests, including rules for the lobby, elevators, pool and common areas. Building staff may ask you to follow them at any time.</p>
<h3>Damage</h3>
<p>Tell us about any damage or broken item as soon as you notice it. Damage beyond normal use may be charged to you or deducted from your security deposit.</p>`,
  },
  'using-the-unit': {
    content: `<h2>Using the unit</h2>
<h3>Air conditioning</h3>
<p>Keep doors and windows closed while the aircon is on, and turn it off when you go out.</p>
<h3>Water heater</h3>
<p>Switch on the heater a few minutes before your shower and switch it off after.</p>
<h3>Kitchen</h3>
<ul>
<li>Cookware, plates and utensils are in the kitchen cabinets.</li>
<li>Please wash and put away what you use.</li>
<li>Never leave the stove on unattended.</li>
</ul>
<h3>TV and internet</h3>
<p>The Wi-Fi details are under Essentials. Sign out of your streaming accounts before you leave.</p>
<h3>Trash and recycling</h3>
<p>The building requires waste segregation. Please sort your trash before you throw it out.</p>
<ul>
<li><strong>Biodegradable:</strong> food scraps and kitchen waste</li>
<li><strong>Recyclable:</strong> plastic bottles, cans and clean paper</li>
<li><strong>Residual:</strong> everything else</li>
</ul>
<p>Collection schedule: {{garbage_schedule}}</p>
<p>Before you check out, bag all trash and take it to the garbage room or chute on your floor.</p>
<h3>If something stops working</h3>
<p>Message us right away. Please do not try to repair appliances yourself.</p>`,
  },
  'building-amenities': {
    content: `<h2>Building amenities</h2>
<p>As our guest, you may use the building amenities below. The building sets the hours, fees and rules.</p>
<h3>Swimming pool</h3>
<ul>
<li>Bring your access card or visitor pass. The pool desk may ask for it.</li>
<li>Wear proper swimwear.</li>
<li>An adult must watch children at all times.</li>
<li>No glass or alcohol in the pool area.</li>
</ul>
<h3>Gym</h3>
<p>Wear workout clothes and closed shoes. Wipe down equipment after use.</p>
<h3>Common areas</h3>
<p>Keep noise down in hallways and elevators, and do not leave items in the corridor.</p>
<p>Ask the reception desk for today's hours.</p>`,
  },

  'parking-reminders': {
    content: `<h2>Parking</h2>
<p>Parking is only for guests who arranged a slot with us before arrival.</p>
<h3>Your vehicle</h3>
<ul>
<li>Plate number: <strong>{{car_plate_number}}</strong></li>
<li>Vehicle: {{car_brand_model}}, {{car_color}}</li>
</ul>
<h3>Parking rules</h3>
<ul>
<li>Park only in the slot assigned to you.</li>
<li>Show your parking pass when the guard asks for it.</li>
<li>Do not park in reserved, PWD or loading areas.</li>
<li>Keep valuables out of sight.</li>
</ul>`,
  },
  'pet-guidelines': {
    content: `<h2>Pet guidelines</h2>
<p>Your pet is welcome for this stay. Please follow these rules so we can keep hosting pets.</p>
<ul>
<li>Keep your pet on a leash or in a carrier in the lobby, elevators and common areas.</li>
<li>Pets are not allowed in the pool, gym or other amenities.</li>
<li>Clean up after your pet right away, inside and outside the unit.</li>
<li>Do not leave your pet alone in the unit for long periods.</li>
<li>Keep your pet off beds and sofas unless you cover them with your own blanket.</li>
</ul>
<p>Extra cleaning or damage caused by your pet may be charged or deducted from your security deposit.</p>`,
  },
  'emergency-and-safety': {
    content: `<h2>Emergency and safety</h2>
<p>In an emergency, call <strong>911</strong> first, then tell us.</p>
<p>{{emergency_contacts_section}}</p>
<h3>Fire</h3>
<ul>
<li>Find the nearest fire exit on your floor when you arrive.</li>
<li>Use the stairs, never the elevator.</li>
</ul>
<h3>Earthquake</h3>
<ul>
<li>Drop, cover and hold on until the shaking stops.</li>
<li>Leave by the stairs once it is safe and follow building staff.</li>
</ul>
<h3>Power or water interruption</h3>
<p>If the power or water goes out, message us and we will check with the building.</p>`,
  },

  'check-out-instructions': {
    content: `<h2>Check-out</h2>
<p>Check-out is by <strong>{{check_out_time}}</strong> on <strong>{{check_out_date}}</strong>. Need more time? Message us before your check-out day and we will check if a late check-out is possible.</p>
<h3>Before you leave</h3>
<ol>
<li>Bag all trash and take it out. Please do not leave unwashed dishes.</li>
<li>Turn off the lights, aircon and appliances. Leave the refrigerator on.</li>
<li>Close the windows and lock the door.</li>
<li>Check closets, drawers, the bathroom and outlets for your belongings.</li>
<li>Return the access card and visitor pass to the lobby reception, or where we asked you to leave them.</li>
<li>Message us once you have left so we can inspect the unit.</li>
</ol>`,
  },
  'email-gaf-request': {
    content: `<p>{{urgent_notice}}</p>
<p>{{update_notice}}</p>
<p>Good day,</p>
<p>Please find attached the Guest Advice Form (GAF) for <strong>{{tower_and_unit_number}}</strong> for the stay from <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong> ({{guests_label}}).</p>
<p>Kindly review it for approval. You can reply to this email with the approved form, or let us know if you need anything else.</p>
<p>Thank you.</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - GAF Request ({{check_in_date}} to {{check_out_date}})',
  },
  'email-pet-request': {
    content: `<p>{{urgent_notice}}</p>
<p>{{update_notice}}</p>
<p>Good day,</p>
<p>We would like to request approval for our guest to bring a pet to <strong>{{tower_and_unit_number}}</strong> from <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong>. The pet details are below, and the documents are attached.</p>
<p>{{pet_details_section}}</p>
<p>{{pet_attachments_section}}</p>
<p>You can reply to this email with the approved form, or let us know if you need anything else.</p>
<p>Thank you.</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - Pet Request ({{check_in_date}} to {{check_out_date}})',
  },
  'email-new-booking-request': {
    content: `<p>{{urgent_notice}}</p>
<p><strong>{{guest_name}}</strong> sent a booking request for <strong>{{tower_and_unit_number}}</strong>. Please review it soon so the guest is not left waiting.</p>
<p>{{new_booking_detail_tables}}</p>
<p>{{downpayment_receipt_ai_section}}</p>
<p>{{booking_link_cta}}</p>`,
    subject: '{{tower_and_unit_number}} - New booking request {{stay_dates}}',
  },
  'email-booking-request-received': {
    content: `<p>Hi {{guest_first_name}},</p>
<p>Thanks for your booking request for <strong>{{property_name}}</strong> from <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong> ({{nights_label}}, {{guests_label}}).</p>
<p>Your request is not confirmed yet. Here is what happens next.</p>
<p>{{booking_request_received_flow_section}}</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - Booking request received {{stay_dates}}',
  },
  'email-booking-acknowledgement': {
    content: `<p>Hi {{guest_first_name}},</p>
<p>Good news. Your booking at <strong>{{property_name}}</strong> is confirmed.</p>
<p>{{booking_acknowledgement_flow_section}}</p>
<p>Thank you for choosing {{property_name}}. We look forward to hosting you.</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - Booking confirmed {{stay_dates}}',
  },
  'email-ready-for-checkin': {
    content: `<p>Hi {{guest_first_name}},</p>
<p>You are all set for your stay at <strong>{{property_name}}</strong>. Here are your check-in details.</p>
<p>{{trip_cta_section}}</p>
<p>{{ready_for_checkin_booking_summary_section}}</p>
<p>{{payment_breakdown_section}}</p>
<p>{{gcash_payment_section}}</p>
<p>{{document_reminders_section}}</p>
<p>{{arrival_access_note_section}}</p>
<p>{{stay_guide_cta_section}}</p>
<p>{{ready_for_checkin_contact_section}}</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - Check-in details {{stay_dates}}',
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
  'email-sd-refund-form-request': {
    content: `<p>Hi {{guest_first_name}},</p>
<p>Thank you for staying with us. Your check-out is by <strong>{{check_out_time}}</strong> on <strong>{{check_out_date}}</strong>.</p>
<p>{{check_out_instructions_section}}</p>
<p>{{sd_refund_details_section}}</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - Check-out and deposit refund {{stay_dates}}',
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
  'email-booking-cancelled-guest': {
    content: `<p>Hi {{guest_first_name}},</p>
<p>{{cancellation_intro}}</p>
<p>This was for your stay at <strong>{{tower_and_unit_number}}</strong> from <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong>.</p>
<p>{{cancellation_detail_section}}</p>
<p>If a refund is due, we send it based on the cancellation policy above. You can check its status on your trip page.</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - Booking cancelled {{stay_dates}}',
  },
  'email-request-expired-guest': {
    content: `<p>Hi {{guest_first_name}},</p>
<p>Your booking request for <strong>{{property_name}}</strong> from <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong> expired because it was not confirmed in time. Nothing was charged.</p>
<p>We are sorry about that. If the dates are still open, you can send the request again from your trip page.</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - Request expired {{stay_dates}}',
  },
  'email-cancellation-request-guest': {
    content: `<p>Hi {{guest_first_name}},</p>
<p><strong>{{cancellation_request_title}}</strong></p>
<p>{{cancellation_request_message}}</p>
<p>{{cancellation_detail_section}}</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - {{cancellation_request_title}}',
  },
  'email-refund-sent-guest': {
    content: `<p>Hi {{guest_first_name}},</p>
<p>We sent your refund for your stay at <strong>{{tower_and_unit_number}}</strong>. Depending on your bank or e-wallet, it may take a few days to show.</p>
<p>{{cancellation_detail_section}}</p>
<p>{{trip_cta_section}}</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - Refund sent',
  },
  'email-building-admin-cancellation': {
    content: `<p>Good day,</p>
<p>Please cancel the GAF we sent for <strong>{{tower_and_unit_number}}</strong> for the stay from <strong>{{check_in_date}}</strong> to <strong>{{check_out_date}}</strong>. The booking was cancelled, and these guests will not check in.</p>
<p>Thank you.</p>
<p>{{email_signature_section}}</p>`,
    subject: '{{tower_and_unit_number}} - GAF cancellation {{stay_dates}}',
  },
  'email-request-expiring-host': {
    content: `<p>Hi,</p>
<p><strong>{{guest_name}}</strong> asked for <strong>{{tower_and_unit_number}}</strong> from {{check_in_date}} to {{check_out_date}}, and the request is still waiting for your decision.</p>
<p>If no one answers it, it expires in {{expires_in_days}} days. The dates are released and the guest is told. Nothing has been charged, so there is nothing to refund.</p>
<p>{{booking_link_cta}}</p>`,
    subject:
      '{{tower_and_unit_number}} - Request expires in {{expires_in_days}} days {{stay_dates}}',
  },
  'email-booking-cancelled-host': {
    content: `<p>Hi,</p>
<p>{{cancellation_host_intro}}</p>
<p>{{cancellation_detail_section}}</p>
<p>{{booking_link_cta}}</p>`,
    subject: '{{tower_and_unit_number}} - {{cancellation_host_title}} {{stay_dates}}',
  },
  'message-balance-reminder': {
    content: `<p>Hi {{guest_first_name}}, a reminder that your remaining balance for your stay on {{check_in_date}} is <strong>{{total_guest_balance}}</strong>.</p>
<p>{{gcash_payment_section}}</p>
<p>Once paid, upload your receipt on your trip page.</p>
<p>{{trip_cta_section}}</p>`,
  },
  'message-document-follow-up': {
    content: `<p>Hi {{guest_first_name}}, we still need a few documents before your stay on {{check_in_date}}. The building needs them to register you as a guest.</p>
<p>Please upload them on your trip page.</p>
<p>{{trip_cta_section}}</p>`,
  },
  'message-check-in-day': {
    content: `<p>Hi {{guest_first_name}}, today is check-in day. The unit is ready from {{check_in_time}}.</p>
<p>Your arrival steps and access details are on your trip page.</p>
<p>{{trip_cta_section}}</p>
<p>Message us here if anything comes up on the way. Safe travels.</p>`,
  },
  'message-early-check-in': {
    content: `<p>Hi {{guest_first_name}}, thanks for asking. Check-in starts at {{check_in_time}}.</p>
<p>We cannot confirm an early check-in yet because it depends on when the unit is ready after the previous guest. We will message you on {{check_in_date}} as soon as we know.</p>`,
  },
  'message-late-check-out': {
    content: `<p>Hi {{guest_first_name}}, thanks for asking. Check-out is by {{check_out_time}} on {{check_out_date}}.</p>
<p>A late check-out depends on whether a guest arrives after you. We will confirm by the evening before. An extra fee may apply.</p>`,
  },

  'message-noise-reminder': {
    content: `<p>Hi {{guest_first_name}}, the building let us know about noise from the unit. Please keep the volume down, especially during quiet hours ({{quiet_hours}}).</p>
<p>Repeated complaints can lead to a fine from the building. Thank you for understanding.</p>`,
  },
  'message-check-out-reminder': {
    content: `<p>Hi {{guest_first_name}}, a reminder that check-out is tomorrow, {{check_out_date}}, by {{check_out_time}}.</p>
<p>The check-out steps are on your trip page.</p>
<p>{{trip_cta_section}}</p>
<p>Please message us once you have left the unit so we can start the inspection.</p>`,
  },
  'message-thank-you': {
    content: `<p>Hi {{guest_first_name}}, thank you for staying at {{property_name}}. We hope you had a great time.</p>
<p>If you have a minute, we would appreciate a short review.</p>
<p>{{review_cta_section}}</p>
<p>We would be happy to host you again.</p>`,
  },
  'message-lost-and-found': {
    content: `<p>Hi {{guest_first_name}}, we found something in the unit after your stay: <strong>[item]</strong>.</p>
<p>Let us know if it is yours and how you want to get it back. We can keep it for you for a few weeks, or send it to you at your cost.</p>`,
  },
};

export function condoTemplateDefault(key: string): CondoTemplateDefault | undefined {
  return CONDO_TEMPLATE_DEFAULTS[key];
}
