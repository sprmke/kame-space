---
title: 'QA packet 08: inbox, notifications, templates'
status: planned
stage: planned
kind: reference
tags: [qa, audit, inbox, notifications, templates, email]
updated: 2026-11-13
---

# 08 Communications: inbox, notifications, templates

**Rows:** PROP-07, PROP-08, PROP-09 · **Personas:** `owner`, `org-admin`, `operations`, `viewer`, `custom`; `guest` and `guest-form` in a second context · **Tiers:** Free, Starter (`quickReplies`, `customTemplates`), Business (`metaChatChannel`, `aiChatAutoReply`, `aiReceptionist`) · **Environments:** L with mocked Meta; Telegram with a throwaway bot if the owner provides one; P test tenant for viewing and reversible template edits. Never send to real guests or real Pages.

## References

Guides: `org/property/inbox.md`, `notifications.md`, `staff.md`, `operations.md`, `templates.md`, `properties/chat.md`, `account/messages.md`. Architecture: `guest-emails.md`, `integrations.md`, `ai-platform.md`, `pwa.md` (push). Manual guides: `guest-chat-ai-manual.md`, `voice-receptionist-manual.md`, `pwa-device-qa.md`. Skills: `social-inbox`, `meta-messaging`, `notifications`, `emails`, `gmail-listener`. Specs: `ui/e2e/features/inbox` (2), `guest-chat` (1). Earlier QA: `09-inbox`, `10-notifications`, `11-templates`, `19-phase4`. In progress: `guest-inbox-meta-sync-overhaul`, `notifications-page-restructure`, `telegram-delivery-and-history`. `for-testing`: `chat-templates`.

## Probe beyond the generic lenses

**Inbox (PROP-07)**

- Thread list: channels (web, Messenger, Instagram), filters, search, unread counts, assignment or status if present, pagination or infinite scroll, real-time arrival, ordering after a new message.
- Thread view: send text, emoji, attachments, long messages, links; failed send and retry; message from a guest arriving while typing; read receipts; booking context panel and its links.
- Quick replies and chat templates: insert, placeholders resolved with booking data, plan gate.
- AI suggest: quality, edit before send, disclosure; AI auto-reply: on and off per property, hours or rules, handoff to human, never replies twice, never leaks another guest's data, stops when credits run out. Limits are super-admin controlled (C21).
- Channels: connect Meta (upgrade prompt below Business; OAuth start on Business), disconnect, token expiry banner, webhook health, the 24-hour messaging window rule.
- Org `inbox` redirect and the parking inbox as a delta.
- Phone: list to thread navigation as a native stack, keyboard does not cover the composer.

**Notifications (PROP-08)**

- Tabs per the restructure plan (activity, push, Telegram, plus staff and operations which now redirect here). Each save path and unsaved-changes guard.
- Build the routing matrix: every event type × channel (in-app, push, email, Telegram) × recipient group. Trigger each event from its real source page and confirm delivery once to the right people and not to others (C14).
- Push: permission prompt timing, subscribe, unsubscribe, several devices, notification click deep-links to the right page signed in and signed out.
- Telegram: module enable, token and chat validation (an invalid token must fail clearly), Save and test, Send preview, each Telegram cron's message content (`telegram-admin`, `-finance`, `-maintenance`, `-marketing`, `-staff`), delivery history.
- In-app notification center: unread badge equals unread items, mark read, mark all, links.

**Templates (PROP-09)**

- Sections list: every template; integration status; edit, preview, reset to default; placeholders list is complete and each placeholder resolves in a real send; WYSIWYG output equals the real email in at least two mail clients _(owner-run if blocked)_.
- Dynamic branding: subject, From, shell, logo per property and org.
- Dynamic section data sources for live sends: house rules, payment instructions, arrival info come from current settings (C10, C13).
- Broken input: unknown placeholder, unclosed tag, pasted Word HTML, script tag, very long template, emoji.
- Plan gate `customTemplates`: Free uses defaults; what happens to custom templates after downgrade.
- For each workflow email, send one from the real trigger after editing its template and read the result.

## Hidden surfaces

`social-*`, `meta-*`, `meta-inbox-webhook`, `meta-inbox-webhook-healthcheck`, `reply-*`, `send-*`, `push-*`, `telegram-*` functions and crons, `notification-*`, `voice-*`, `ai-*`, `guest-chat-reply.html`, the per-property template store and `configurable-template-send.html`, AI gateway and metering.

## Connections and journeys

Source of C13, C14, C24; reader of C25. J14, J15, J16, J17, J29.

## Known risks

- Legacy static email HTML still has a dead `{{urgentBlock}}` placeholder; prove no live path renders it.
- Inbox Meta sync is being overhauled; audit against the SHA and note which behavior is mid-change.
- Never record BotFather tokens, chat IDs or Page tokens in findings.
