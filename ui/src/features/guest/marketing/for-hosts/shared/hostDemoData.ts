/**
 * Sample demo data shared by the live for-hosts landing (workflow scenes and guest phones).
 * Guest names and amounts are sample data.
 */

export const v3Images = {
  hero: 'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1400&q=80',
  marketing: 'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=900&q=80',
  listing: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
  closing: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1800&q=80',
} as const;

export const v3Workflow = {
  eyebrow: 'How it works',
  title: 'One booking. Six steps. Nothing missed.',
  lead: 'Direct, Airbnb, or walk-in, every booking takes the same path. You step in once.',
  sampleGuest: { name: 'Bea Villareal', initials: 'BV', stay: 'Nov 14 to 17', unit: 'Unit 12F' },
  stages: [
    {
      status: 'Pending review',
      title: 'Review',
      body: 'Form, IDs, and payment proof land on one card. AI checks the receipt. You accept.',
      needsYou: true,
    },
    {
      status: 'Pending documents',
      title: 'Documents',
      body: 'GAF and pet forms fill and send themselves. Parking gets booked. Approvals come back and attach.',
    },
    {
      status: 'Ready for check-in',
      title: 'Check-in',
      body: 'The guest gets a confirmation with check-in details, approved documents, and a stay guide.',
    },
    {
      status: 'Ready for check-out',
      title: 'Stay',
      body: 'The balance is settled at check-in. Before check-out, the guest gets the checklist and refund form.',
    },
    {
      status: 'Pending SD refund',
      title: 'Deposit',
      body: 'The guest sends refund details. A reminder keeps the deposit on time.',
    },
    {
      status: 'Completed',
      title: 'Done',
      body: 'Income posts to finance. The guest is asked for a review and gets a voucher for next time.',
    },
  ],
} as const;

export const v3WorkflowScenes = {
  review: {
    title: 'New booking',
    items: [
      { label: 'Guest form', meta: '3 guests' },
      { label: 'Valid ID', meta: '2 photos' },
      { label: 'Payment proof', meta: '₱3,000' },
    ],
    matched: 'Matched',
    accept: 'Accept',
    accepted: 'Accepted',
  },
  documents: {
    files: ['GAF', 'Parking', 'Pet form'],
    admin: 'Building admin',
    /** Labels on the two lanes: requests go out, approved copies come back. */
    out: 'Request sent',
    back: 'Approved copy back',
    reviewing: 'Reviewing',
    replied: 'Replied',
    sent: 'Sent',
    approved: 'Approved',
  },
  checkin: {
    to: 'Bea Villareal',
    sending: 'Sending',
    sent: 'Sent',
    title: "You're all set",
    rows: [
      { label: 'Check-in', value: 'Nov 14, 2 PM' },
      { label: 'Check-out', value: 'Nov 17, 11 AM' },
      { label: 'Unit', value: '12F' },
      { label: 'Guests', value: '3' },
    ],
    attachments: ['Approved GAF', 'Parking endorsement', 'Approved pet form'],
    cta: 'Open stay guide',
  },
  stay: {
    range: 'Nov 14 to 17',
    days: ['14', '15', '16', '17'],
    phases: ['Check-in day', 'Night 2 of 3', 'Check-out day'],
    events: [
      { title: 'Balance settled', meta: '₱6,000 paid', when: 'Nov 14' },
      { title: 'Check-out email sent', meta: 'Checklist and refund form', when: 'Nov 17' },
    ],
  },
  deposit: {
    amount: '₱3,000',
    reminder: 'Deposit refund due today',
    from: 'You',
    to: 'Bea',
    done: 'Refunded',
  },
  done: {
    finance: 'Finance',
    previous: { name: 'Marco Reyes', meta: 'Nov 7 to 9', amount: '+₱8,450' },
    entry: { name: 'Bea Villareal', meta: 'Nov 14 to 17', amount: '+₱12,897' },
    status: 'Completed',
    trip: { title: 'Thanks for staying', voucher: '₱500 off your next stay' },
  },
} as const;

export const v3Guests = {
  eyebrow: 'For your guests',
  title: 'What your guests see',
  lead: 'Your own booking page, a stay guide, and a trip page with chat. No app to install.',
  screens: [
    {
      key: 'book',
      title: 'Book direct',
      body: 'Guests book on your own page. No platform fee.',
    },
    {
      key: 'guide',
      title: 'Stay guide',
      body: 'Check-in time, Wi-Fi, and how to get in.',
    },
    {
      key: 'trip',
      title: 'Trip and chat',
      body: 'Booking status and a direct line to you.',
    },
  ],
  listing: {
    name: 'Azure North 12F',
    place: 'San Fernando, Pampanga',
    rate: '₱3,499',
    nights: '3 nights',
    total: '₱10,497',
    rating: '4.9',
  },
  guide: {
    checkIn: '2:00 PM',
    checkOut: '11:00 AM',
    wifi: { network: 'Kame_12F', password: 'stay2026' },
    steps: ['Show your stay pass at the lobby', 'Take the elevator to 12F', 'Door code: 4821'],
    parking: 'Slot B-14',
  },
  trip: {
    status: 'Ready for check-in',
    progress: 3,
    progressSteps: 5,
    host: 'Mika',
    messages: [
      { from: 'guest', text: 'Hi! Can we check in at 1 PM?' },
      { from: 'host', text: 'Sure, the unit is ready. See you at 1!' },
      { from: 'guest', text: 'Thank you!' },
    ],
  },
} as const;
