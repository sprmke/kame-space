---
title: 'Mobile native (v3) shell'
status: active
tags: [architecture, mobile, ui]
updated: 2026-11-20
---

# Mobile native (v3) shell

Phone (`max-lg`) admin and public chrome for the native-app redesign. Desktop (`lg+`) is unchanged. Plan: `docs/workflow/for-testing/mobile-native-app-redesign.md` (device QA open before `done/`).

## Shell pieces

| Piece              | Path                                                       | Role                                                               |
| ------------------ | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| `AdminMobilePage`  | `ui/src/components/mobile/AdminMobilePage.tsx`             | Phone: brand `AppBar` + `ContentSheet`; desktop: `AdminPageHeader` |
| `AppBar`           | `ui/src/components/mobile/native/AppBar.tsx`               | Root / detail / flow variants                                      |
| Tab set            | `adminBottomNav.ts` + `adminTabForRoute.ts`                | D2 property / parking / org; D9 super-admin                        |
| Work / You hubs    | `…/work`, `…/you`                                          | Module overflow and account chrome (replaces More)                 |
| Workspace switcher | `WorkspaceSwitcherSheet` + `ScopeChip` / `HeroTenantScope` | Scope change from the app bar                                      |
| Ask Kame           | `AdminNativeChromeProvider` → shared AI launcher           | App-bar control; no phone FAB                                      |
| Guest tabs         | `MarketingBottomNav`                                       | D10 signed-out / signed-in sets                                    |

## Scroll and safe area

- Interim: admin root stays `h-screen` / `h-dvh` with an inner `main` scroller (`data-admin-content-scroll`). Document scroll (D13) waits on a fill-main audit.
- Safe-area tokens: `--safe-top` / `--safe-bottom` (and left/right). Capture specs can override via `SAFE_AREA=1`.
- Tab clearance: `bottomTabBarOffsetClassName()` on the scrollport that actually scrolls.

## Navigation memory and transitions

- `adminTabMemory` remembers the last path per tab per scope; re-tap scrolls then returns to the tab root.
- `useNavDirection` sets `html[data-nav-transition]` for push / pop CSS.
- Back: `useMobileBack(fallback)` so deep links never dead-end.

## Pattern families

Bodies compose from `ui/src/components/mobile/native/` (strips, rows, sheets, empty states). Family map and mascot budget: design-system companion + `kame-mascot.mdc`.

## Testing

- Vitest: `adminTabForRoute`, contrast, mascot roles, strip helpers.
- Playwright: `adminNativeShell.spec.ts`; chrome capture `mobileChromeScreens.spec.ts` with `PLAYWRIGHT_CAPTURE_SCREENS=1` → `ui/e2e/artifacts/mobile-chrome/<label>/`.
- Manual device matrix: plan §10 (iPhone / Android Safari and PWA).

## Related

- Rules: `mobile-native-ui.mdc`, `mobile-native-v3.mdc`, `mobile-responsive.mdc`, `kame-mascot.mdc`
- Skills: `native-mobile-redesign`, `mobile-responsive`
- `DESIGN.md` § responsive / mascot pointers
