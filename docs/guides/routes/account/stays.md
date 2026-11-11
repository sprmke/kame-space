---
title: 'Guest Stays — redirect'
status: active
tags: [guides, routes, account]
updated: 2026-11-10
---

# Guest Stays — redirect

Route: `/account/stays` → **`/account/messages`**

The guest inbox is called **Messages** again (guest journey plan, decision D2). The full guide
lives at [messages.md](./messages.md).

## Host-facing knowledge

The guest account area calls this section **Messages**. It is the same inbox where guests read and
reply to conversations with hosts, including property and parking chats.

**Common host questions**

- Q: A guest clicked Stays and landed somewhere else. Is that expected?
  A: Yes. The old Stays link redirects to **Messages**, which is the same inbox with a clearer
  name.
- Q: Did the guest lose any conversations?
  A: No. The redirect only changes the address. Every existing thread is still in **Messages**.

---

## Testing

| Layer | Path / spec                                | Manual |
| ----- | ------------------------------------------ | ------ |
| E2E   | `legacyRouteRedirectSmoke.spec.ts` (`@ci`) | —      |
| N/A   | Redirect-only                              | —      |
