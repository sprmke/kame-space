import { LegalFooterLinks } from '@/components/legal/LegalFooterLinks';

/**
 * Tiny floating pill for the bespoke showcase and stay guide templates (surface inventory
 * #23). These pages have no shared footer region — each template owns its full layout — so
 * this mounts as a sibling overlay instead of touching every template's markup. Lower
 * z-index than any dialog (gallery lightboxes included, `z-[100]+`) so it never blocks one.
 */
export function ShowcaseLegalFooterLink() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center pb-[max(0.5rem,env(safe-area-inset-bottom))]">
      <div className="border-border/60 bg-background/80 supports-[backdrop-filter]:bg-background/60 pointer-events-auto rounded-full border px-3 py-1 shadow-sm backdrop-blur-sm">
        <LegalFooterLinks includeCookies={false} className="text-[11px]" />
      </div>
    </div>
  );
}
