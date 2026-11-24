import { expect, test, type Page } from '@playwright/test';

import {
  HELP_E2E_ORG_PATH,
  HELP_E2E_PROPERTY_PATH,
  TICKET_CLOSED,
  TICKET_IN_PROGRESS,
  TICKET_OPEN,
  TICKET_RESOLVED,
  dismissConsent,
  helpPath,
  installHelpSupportMocks,
  openHelpSupport,
} from './shared/helpSupportHarness';
import { expectNoPageHorizontalOverflow } from '../../shared/layoutAssertions';

/**
 * Help & Support — org, property and parking mounts.
 *
 * Covers the FAQ catalogue and its mount filter, the guides, and the ticket
 * workspace (list, thread, reply, reopen, compose, scope params, error/empty,
 * phone density). Fixtures live in `shared/helpSupportHarness.ts`.
 */

const WIDTHS = [1440, 1280, 1024, 768, 430, 390, 360] as const;

/** Consent storage only applies to the origin it was recorded on. */
async function gotoHelp(page: Page, path: string) {
  await page.goto(path);
  await dismissConsent(page);
}

test.describe('@ci help & support module', () => {
  test.describe.configure({ mode: 'serial' });

  test('property mount lists property topics only', async ({ page }) => {
    await installHelpSupportMocks(page);
    await openHelpSupport(page, 'property');
    await expect(page.getByRole('textbox', { name: 'Search FAQs' })).toBeVisible();

    for (const topic of ['Bookings', 'Property Settings', 'Billing & Finance']) {
      await expect(page.getByRole('button', { name: new RegExp(topic) })).toBeVisible();
    }
    await expect(page.getByRole('button', { name: /^Plans & Billing/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Parking\b/ })).toHaveCount(0);
    // Guest-only and guest-audience answers never render on a host mount.
    await expect(page.getByText('How do I find my trip?')).toHaveCount(0);
    // Singular counts read as a question, not "1 questions".
    await expect(page.getByText('1 question', { exact: true }).first()).toBeVisible();
  });

  test('org mount lists org topics only', async ({ page }) => {
    await installHelpSupportMocks(page, { scope: 'org' });
    await openHelpSupport(page, 'org');
    await expect(page.getByRole('button', { name: /^Plans & Billing/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Team & Permissions/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Bookings/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Parking\b/ })).toHaveCount(0);
  });

  test('parking mount lists parking topics only', async ({ page }) => {
    await installHelpSupportMocks(page, { scope: 'parking' });
    await openHelpSupport(page, 'parking');
    await expect(page.getByRole('button', { name: /^Parking\b/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Activity & Audit/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Bookings/ })).toHaveCount(0);
  });

  test('a topic opens its answers and returns to all topics', async ({ page }) => {
    await installHelpSupportMocks(page);
    await openHelpSupport(page, 'property');

    await page.getByRole('button', { name: /^Bookings/ }).click();
    await expect(page.getByRole('heading', { name: 'Bookings', exact: true })).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Search Bookings' })).toBeVisible();

    const question = page.locator('summary').filter({ hasText: 'Why is a booking waiting' });
    await question.click();
    await expect(
      page.getByText('Every new booking lands in Pending review until you approve it.')
    ).toBeVisible();

    await page.getByRole('button', { name: 'All topics' }).click();
    await expect(page.getByRole('textbox', { name: 'Search FAQs' })).toBeVisible();
  });

  test('FAQ search covers answers and offers a ticket when nothing matches', async ({ page }) => {
    await installHelpSupportMocks(page);
    await openHelpSupport(page, 'property');
    const search = page.getByRole('textbox', { name: 'Search FAQs' });

    await search.fill('profit');
    await expect(
      page.locator('summary').filter({ hasText: 'How is net profit calculated?' })
    ).toBeVisible();

    await search.fill('no answer for this');
    await expect(page.getByText('No FAQs match that search')).toBeVisible();
    const newTicket = page.getByRole('link', { name: 'New ticket' });
    await expect(newTicket).toBeVisible();
    await newTicket.click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New ticket' })).toBeVisible();
  });

  test('guides group opens a sanitized article', async ({ page }) => {
    await installHelpSupportMocks(page);
    await gotoHelp(page, `${HELP_E2E_PROPERTY_PATH}/docs`);
    await expect(page.getByRole('heading', { name: 'Guides', exact: true })).toBeVisible();

    await page.getByRole('button', { name: /^Property/ }).click();
    const finance = page.locator('summary').filter({ hasText: 'Finance' }).first();
    await expect(finance).toBeVisible();
    await expect(finance).not.toContainText('operator guide');
    await expect(finance).not.toContainText('/org/');

    await finance.click();
    await expect(page.getByText('Does the ledger include stays?')).toBeVisible();
    await expect(
      page.getByText('Yes. Stays and manual transactions share one ledger.')
    ).toBeVisible();
  });

  test('ticket list shows statuses and a thread with its messages', async ({ page }) => {
    await installHelpSupportMocks(page);
    await gotoHelp(page, `${HELP_E2E_PROPERTY_PATH}/tickets/${TICKET_OPEN}`);

    await expect(page.getByText('My Tickets')).toBeVisible();
    for (const status of ['Open', 'In progress', 'Resolved', 'Closed']) {
      await expect(page.getByText(status, { exact: true }).first()).toBeVisible();
    }

    await expect(
      page.getByText(
        'When I attach the guest ID photo the form stops responding. Chrome on Windows.'
      )
    ).toBeVisible();
    await expect(
      page.getByText('Thanks for the report. Could you send a screenshot of the console?')
    ).toBeVisible();
    await expect(page.getByRole('img', { name: 'console.png' })).toBeVisible();
  });

  test('reply sends from the composer', async ({ page }) => {
    const state = await installHelpSupportMocks(page);
    await gotoHelp(page, `${HELP_E2E_PROPERTY_PATH}/tickets/${TICKET_OPEN}`);
    const reply = page.getByRole('textbox', { name: 'Reply' });
    await reply.fill('Sending the console log now.');
    await page.getByRole('button', { name: 'Send reply' }).click();

    await expect(page.getByText('Sending the console log now.')).toBeVisible();
    expect(state.replies.at(0)?.message).toBe('Sending the console log now.');
  });

  test('a closed ticket hides the composer and reopens', async ({ page }) => {
    const state = await installHelpSupportMocks(page);
    await gotoHelp(page, `${HELP_E2E_PROPERTY_PATH}/tickets/${TICKET_CLOSED}`);

    await expect(
      page.getByText('This ticket is closed. Reopen it to send another message.')
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Reply' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Reopen ticket' }).click();
    await expect(page.getByRole('textbox', { name: 'Reply' })).toBeVisible();
    expect(state.reopened).toContain(TICKET_CLOSED);
  });

  test('a resolved ticket explains that a reply reopens it', async ({ page }) => {
    await installHelpSupportMocks(page);
    await gotoHelp(page, `${HELP_E2E_PROPERTY_PATH}/tickets/${TICKET_RESOLVED}`);
    await expect(
      page.getByText('Marked resolved. Reply if you still need help and we will pick it back up.')
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Reply' })).toBeVisible();
  });

  test('new ticket validates the category fields and submits at property scope', async ({
    page,
  }) => {
    const state = await installHelpSupportMocks(page);
    await gotoHelp(page, `${HELP_E2E_PROPERTY_PATH}/tickets?compose=1`);
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const submit = dialog.getByRole('button', { name: 'Submit' });
    await expect(submit).toBeDisabled();

    // Business inquiries need a contact preference that the default bug form does not show.
    await dialog.getByRole('button', { name: /Business/ }).click();
    await expect(dialog.getByLabel('How should we reach you?')).toBeVisible();
    await dialog.getByLabel('Subject').fill('Partnership for two more units');
    await dialog.getByLabel('Details').fill('We would like to add two properties this quarter.');
    await expect(submit).toBeDisabled();
    await dialog.getByLabel('How should we reach you?').fill('owner@example.test');
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page).toHaveURL(/\/help-support\/tickets\/f6666666-6666-4666-8666-666666666666$/);
    expect(state.submitted).toHaveLength(1);
    expect(state.submitted[0]).toMatchObject({
      category: 'business_inquiry',
      subject: 'Partnership for two more units',
      contactPreference: 'owner@example.test',
      propertyId: 'property-team-e2e-001',
    });
  });

  test('parking tickets are listed and submitted at parking scope', async ({ page }) => {
    const state = await installHelpSupportMocks(page, { scope: 'parking' });
    await gotoHelp(page, `${helpPath('parking')}/tickets`);
    await expect(page.getByText('My Tickets')).toBeVisible();

    await gotoHelp(page, `${helpPath('parking')}/tickets?compose=1`);
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: /Question/ }).click();
    await dialog.getByLabel('Subject').fill('Slot light is out');
    await dialog.getByLabel('Details').fill('The light above slot 12A stopped working.');
    await dialog.getByRole('button', { name: 'Submit' }).click();

    await expect(page).toHaveURL(/\/help-support\/tickets\/f6666666-6666-4666-8666-666666666666$/);
    expect(state.submitted[0]).toMatchObject({ parkingId: 'parking-e2e-001' });
    expect(state.lastListQuery).toContain('parking_id=parking-e2e-001');
    expect(state.lastListQuery).not.toContain('property_id=');
  });

  test('org mount asks for org tickets, not a property', async ({ page }) => {
    const state = await installHelpSupportMocks(page, { scope: 'org' });
    await gotoHelp(page, `${HELP_E2E_ORG_PATH}/tickets`);
    await expect(page.getByText('My Tickets')).toBeVisible();
    expect(state.lastListQuery).toContain('org_slug=sample-stays-ph');
    expect(state.lastListQuery).not.toContain('property_id=');
    expect(state.lastListQuery).not.toContain('parking_id=');
  });

  test('a read-only teammate can still read help and open a ticket', async ({ page }) => {
    await installHelpSupportMocks(page, { permissionTemplate: 'read_only' });
    await openHelpSupport(page, 'property');
    await expect(page.getByRole('textbox', { name: 'Search FAQs' })).toBeVisible();
    await gotoHelp(page, `${HELP_E2E_PROPERTY_PATH}/tickets`);
    await expect(page.getByText('My Tickets')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('button', { name: 'New' })).toBeVisible();
  });

  test('empty and error states stay single-pane', async ({ page }) => {
    await installHelpSupportMocks(page, { failTickets: true });
    await gotoHelp(page, `${HELP_E2E_PROPERTY_PATH}/tickets`);
    await expect(page.getByText("Couldn't load tickets")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Pick a ticket')).toBeHidden();

    await installHelpSupportMocks(page, { emptyTickets: true });
    await gotoHelp(page, `${HELP_E2E_PROPERTY_PATH}/tickets`);
    await expect(page.getByText('No tickets yet')).toBeVisible();
    await expect(page.getByText('Pick a ticket')).toBeHidden();
  });

  test('phone ticket thread keeps the conversation and the composer usable', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installHelpSupportMocks(page);
    await gotoHelp(page, `${HELP_E2E_PROPERTY_PATH}/tickets/${TICKET_OPEN}`);

    await expect(
      page.getByText('When I attach the guest ID photo the form stops responding.')
    ).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Reply' })).toBeVisible();

    // The ticket workspace takes the full height: no module tiles above it and no
    // floating launcher over the Send button.
    await expect(page.getByRole('navigation', { name: 'Help and support' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Quick access/ })).toHaveCount(0);

    const bubbleBox = await page
      .getByText('When I attach the guest ID photo the form stops responding.')
      .boundingBox();
    const composerBox = await page.getByRole('textbox', { name: 'Reply' }).boundingBox();
    expect(bubbleBox).not.toBeNull();
    expect(composerBox).not.toBeNull();
    expect(bubbleBox!.y + bubbleBox!.height).toBeLessThan(composerBox!.y);
  });

  test('no horizontal overflow at supported widths', async ({ page }) => {
    await installHelpSupportMocks(page);

    // Boot once and resize: a full reload per width would recompile the route
    // chunks and say nothing extra about the layout.
    await page.setViewportSize({ width: 1440, height: 960 });
    await openHelpSupport(page, 'property');
    await expect(page.getByRole('textbox', { name: 'Search FAQs' })).toBeVisible({
      timeout: 30_000,
    });
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width >= 768 ? 960 : 844 });
      await expect(page.getByRole('textbox', { name: 'Search FAQs' })).toBeVisible({
        timeout: 15_000,
      });
      await expectNoPageHorizontalOverflow(page);
    }

    await page.setViewportSize({ width: 1440, height: 960 });
    await gotoHelp(page, `${HELP_E2E_PROPERTY_PATH}/tickets/${TICKET_IN_PROGRESS}`);
    await expect(page.getByRole('textbox', { name: 'Reply' })).toBeVisible({ timeout: 30_000 });
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: width >= 768 ? 960 : 844 });
      await expect(page.getByRole('textbox', { name: 'Reply' })).toBeVisible({ timeout: 15_000 });
      await expectNoPageHorizontalOverflow(page);
    }
  });
});
