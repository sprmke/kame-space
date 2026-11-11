# Modal chrome — canonical padding, header and close control

Every dialog and bottom sheet in the app shares one chrome. This file is the
single source of truth for that chrome; the class strings live in
[`ui/src/components/ui/modal-chrome.ts`](../../ui/src/components/ui/modal-chrome.ts).

Before this spec each modal hand-rolled its own padding (`px-2` … `px-8`,
`py-2.5` … `py-6`), and **split modals rendered the dialog padding on top of
their own chrome padding on desktop**. `LegalDocumentSheet` (the in-app Terms /
Privacy / Cookie Policy sheet) was the worst case: its content started **49px**
from the modal edge instead of 21px, and its title sat 47px below the top. The
same double padding hit every `sheetLayout="split"` modal that did not restate
`p-0` in its own class list.

---

## 1. The two families

| Family                                                  | Chrome                           | Padding owner                  |
| ------------------------------------------------------- | -------------------------------- | ------------------------------ |
| **Split** (sticky header / scroll body / sticky footer) | `sheetLayout="split"`            | Header, body and footer        |
| **Card** (content inline in a padded dialog)            | default (`sheetLayout="scroll"`) | `DialogContent` (`p-4 sm:p-5`) |

A split modal's **dialog box must not add padding** (`p-0`). `ResponsiveModalContent`
forces that for `sheetLayout="split"`, so a split modal looks identical on
desktop (`lg+` centered dialog) and on phone/tablet (bottom sheet).

A card modal's **header and footer must not add padding** — they inherit the
dialog padding.

Both families therefore land on the same gutter: **16px on phone, 20px from `sm` up**.

---

## 2. The scale

| Zone             | Classes                          | Phone | `sm`+ |
| ---------------- | -------------------------------- | ----- | ----- |
| Header row       | `px-4 sm:px-5 py-3`              | 16/12 | 20/12 |
| Scrollable body  | `px-4 sm:px-5 py-4`              | 16/16 | 20/16 |
| Footer / actions | `px-4 sm:px-5 py-3`              | 16/12 | 20/12 |
| Title            | `text-base font-bold sm:text-lg` | 16px  | 18px  |

- **Header / footer are chrome** → tight (12px vertical). They repeat on every
  modal, so extra vertical space compounds.
- **Body is content** → 16px vertical. Form fields keep their own rhythm
  (`space-y-4`) inside it.
- Hairlines (`border-b` on the header, `border-t` on the footer) separate the
  zones instead of large gaps.

### Safe area

The footer keeps `pb-[max(env(safe-area-inset-bottom,0px),0.75rem)]` so the
action row clears the iOS home indicator on phone. The sheet header keeps a
`pt-[max(env(safe-area-inset-top,0px),1rem)]` guard where a sheet has no drag
handle.

---

## 3. Close control

`DialogContent` renders the close button **absolutely positioned** in the top
right of the dialog box. It is a **32px visual button with a ≥44px hit area**
(`before:-inset-1.5`), matching the `admin-overflow-trigger` pattern.

The smaller visual box is deliberate: with a 44px box the glyph sat ~4px **below**
the title baseline and read as a floating, oversized control. At 32px the glyph
center lands within ~2px of the title center, so the header row reads as one
balanced line.

The invisible hit pad is dropped at `lg+` (pointer device) so it can never
overlap a header action sitting next to the close button.

Modals that render the close button **inline** in the header row
(`GuestDialogShell`, `LegalDocumentSheet`) use the same class, so the two look
identical.

> If you add a header action next to the close button, keep it in the header row
> — do not stack it above or below the title.

---

## 4. Using it

### Prefer a shell

| Surface                          | Shell                                                                                         |
| -------------------------------- | --------------------------------------------------------------------------------------------- |
| Dashboard Save/Cancel form modal | `AdminDialogShell` (`ui/src/components/AdminDialogShell.tsx`)                                 |
| Guest-facing modal               | `GuestDialogShell` (`ui/src/features/guest/marketing/shared/components/GuestDialogShell.tsx`) |

Both shells take `headerClassName` / `bodyClassName` / `footerClassName` for
**layout** overrides only. Padding is not overridable — it is the canonical
scale.

### Hand-rolled modal

If a modal genuinely needs its own chrome (wizard, approval review, legal
document, lightbox), use `ResponsiveModalContent` with `sheetLayout="split"` and
apply the scale to its own zones:

```tsx
<ResponsiveModalContent sheetLayout="split" className="p-0 …">
  <ResponsiveModalHeader className="border-border shrink-0 border-b px-4 py-3 sm:px-5">
    …
  </ResponsiveModalHeader>
  <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">…</div>
  <ResponsiveModalFooter className="border-border shrink-0 border-t px-4 py-3 sm:px-5">
    …
  </ResponsiveModalFooter>
</ResponsiveModalContent>
```

`scripts/dev/normalize-modal-chrome.py` applies the same mapping mechanically
across the tree (it rewrites padding utilities per family). Run it after a bulk
chrome change, then review the diff.

### Exceptions

- **`AlertDialog`** — OS-style destructive confirm. It keeps its own compact
  `p-4 sm:p-5` padding and has no close button.
- **Full-screen lightboxes** (`modal-scrim-lightbox`) — fill the viewport.

---

## 5. Rules of thumb

1. One gutter everywhere: `px-4 sm:px-5`. Never `px-3`, `px-6` or `px-8`.
2. Header and footer are `py-3`; only the body is `py-4`.
3. A split modal's content box is `p-0` — the chrome owns the padding.
4. A card modal's header and footer add no padding — the dialog owns it.
5. The close glyph sits on the title baseline, not below it.

---

## Related docs

- [`.cursor/rules/mobile-responsive.mdc`](../../.cursor/rules/mobile-responsive.mdc) — §9 modals and dropdowns
- [`docs/architecture/overview.md`](overview.md) — full-app picture
- [`docs/architecture/skeleton-loaders.md`](skeleton-loaders.md) — loading states inside modal bodies
- [`docs/architecture/unsaved-changes.md`](unsaved-changes.md) — guard for editable modal forms
- [`docs/guides/routes/legal.md`](../guides/routes/legal.md) — the in-app legal document sheet
