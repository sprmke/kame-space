/**
 * Payment receipt PDF for an org subscription payment. A payment receipt, not a BIR official
 * receipt (the footer says so). Standard Helvetica has no peso glyph, so amounts print as "PHP".
 */

import { PDFDocument, StandardFonts, rgb } from 'https://esm.sh/pdf-lib@1.17.1';

export type ReceiptLine = { label: string; amountPhp: number };

export type ReceiptData = {
  brandName: string;
  receiptNumber: string;
  paidAtLabel: string;
  orgName: string;
  legalName?: string | null;
  address?: string | null;
  tin?: string | null;
  planName: string;
  periodLabel?: string | null;
  paymentMethodLabel: string;
  lines: ReceiptLine[];
  totalPaidPhp: number;
  note?: string | null;
};

export function formatReceiptAmount(amountPhp: number): string {
  const rounded = Math.round(amountPhp);
  const sign = rounded < 0 ? '-' : '';
  return `${sign}PHP ${Math.abs(rounded).toLocaleString('en-PH')}`;
}

/** Standard fonts only cover WinAnsi: replace anything else so drawText never throws. */
function safe(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, '-')
    .replace(/₱/g, 'PHP ')
    .replace(/[^\x20-\x7E -ÿ]/g, '?');
}

export async function buildReceiptPdf(data: ReceiptData): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const ink = rgb(0.1, 0.1, 0.1);
  const muted = rgb(0.4, 0.4, 0.4);
  const rule = rgb(0.85, 0.85, 0.85);

  const left = 56;
  const right = 539;
  let y = 780;

  const text = (value: string, x: number, size = 11, font = regular, color = ink) =>
    page.drawText(safe(value), { x, y, size, font, color });
  const textRight = (value: string, size = 11, font = regular) => {
    const width = font.widthOfTextAtSize(safe(value), size);
    page.drawText(safe(value), { x: right - width, y, size, font, color: ink });
  };
  const line = () => {
    page.drawLine({ start: { x: left, y }, end: { x: right, y }, thickness: 0.6, color: rule });
  };

  text(data.brandName, left, 18, bold);
  y -= 22;
  text('Payment receipt', left, 12, regular, muted);
  y -= 36;

  text('Receipt number', left, 9, regular, muted);
  text('Date paid', 300, 9, regular, muted);
  y -= 14;
  text(data.receiptNumber, left, 12, bold);
  text(data.paidAtLabel, 300, 12, bold);
  y -= 34;

  text('Billed to', left, 9, regular, muted);
  y -= 14;
  text(data.legalName?.trim() || data.orgName, left, 12, bold);
  if (data.address?.trim()) {
    y -= 15;
    text(data.address.trim().slice(0, 90), left, 10);
  }
  if (data.tin?.trim()) {
    y -= 15;
    text(`TIN ${data.tin.trim()}`, left, 10);
  }
  y -= 34;

  text('Plan', left, 9, regular, muted);
  text('Paid with', 300, 9, regular, muted);
  y -= 14;
  text(data.planName, left, 12, bold);
  text(data.paymentMethodLabel, 300, 12, bold);
  if (data.periodLabel) {
    y -= 15;
    text(data.periodLabel, left, 10, regular, muted);
  }
  y -= 30;

  line();
  y -= 20;
  for (const item of data.lines) {
    text(item.label.slice(0, 70), left, 11);
    textRight(formatReceiptAmount(item.amountPhp));
    y -= 20;
  }
  y += 6;
  line();
  y -= 22;
  text('Total paid', left, 12, bold);
  textRight(formatReceiptAmount(data.totalPaidPhp), 13, bold);
  y -= 46;

  if (data.note?.trim()) {
    text(data.note.trim().slice(0, 100), left, 10, regular, muted);
    y -= 18;
  }
  text(
    'This is a payment receipt. It is not an official receipt (BIR). Billing questions: reply to the receipt email.',
    left,
    8,
    regular,
    muted
  );

  return await pdf.save();
}
