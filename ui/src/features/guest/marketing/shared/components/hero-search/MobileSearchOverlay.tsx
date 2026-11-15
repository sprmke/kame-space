import { useRef, type ReactNode } from 'react';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from 'framer-motion';
import { Building2, Car, Compass, Home, Search, X, type LucideIcon } from 'lucide-react';

import { MOBILE_SEARCH_CATEGORIES } from '@/features/guest/marketing/shared/lib/mobileSearchDisplay';
import type {
  MobileSearchCategory,
  MobileSearchStep,
} from '@/features/guest/marketing/shared/lib/mobileSearchState';

import { cn } from '@/lib/utils';

const CATEGORY_ICONS: Record<MobileSearchCategory, LucideIcon> = {
  all: Compass,
  properties: Home,
  developments: Building2,
  parkings: Car,
};

/** Shared rhythm for the sheet: quick, decisive, never bouncy. */
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const CARD_TRANSITION = { duration: 0.32, ease: EASE_OUT };
/** Tablets keep a phone-width column instead of 88px calendar cells. */
const SHEET_COLUMN = 'mx-auto w-full max-w-xl';

export type MobileSearchRow = {
  step: MobileSearchStep;
  label: string;
  value: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  /** `null` hides the category tabs (e.g. `/services`). */
  category: MobileSearchCategory | null;
  onCategoryChange: (category: MobileSearchCategory) => void;
  rows: MobileSearchRow[];
  activeStep: MobileSearchStep;
  onStepChange: (step: MobileSearchStep) => void;
  renderStep: (step: MobileSearchStep) => ReactNode;
  /** The When card owns its own footer (Skip / Next), so the sheet footer steps aside. */
  showFooter: boolean;
  canClear: boolean;
  onClearAll: () => void;
  onSearch: () => void;
};

/**
 * Phone full-screen search (below `lg`). One card per step on a muted canvas; exactly one is
 * open and the others collapse to a row showing their value. Radix Dialog supplies the focus
 * trap, scroll lock, Escape and `aria-modal`; `HeroSearch` owns every value and handler.
 */
export function MobileSearchOverlay({
  open,
  onClose,
  category,
  onCategoryChange,
  rows,
  activeStep,
  onStepChange,
  renderStep,
  showFooter,
  canClear,
  onClearAll,
  onSearch,
}: Props) {
  const reduceMotion = useReducedMotion();
  const sheetRef = useRef<HTMLDivElement>(null);
  const enter = reduceMotion ? { opacity: 0 } : { opacity: 0, y: 28 };
  const exit = reduceMotion
    ? { opacity: 0, transition: { duration: 0.12 } }
    : { opacity: 0, y: 20, transition: { duration: 0.18, ease: [0.4, 0, 1, 1] as const } };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <AnimatePresence>
        {open ? (
          <DialogPrimitive.Portal forceMount>
            <DialogPrimitive.Content
              forceMount
              asChild
              aria-describedby={undefined}
              onOpenAutoFocus={(event) => {
                // Land on the sheet itself: no keyboard pop on open, the guest sees
                // recents and suggestions first and taps the field when ready.
                event.preventDefault();
                sheetRef.current?.focus({ preventScroll: true });
              }}
            >
              <motion.div
                ref={sheetRef}
                tabIndex={-1}
                initial={enter}
                animate={{ opacity: 1, y: 0 }}
                exit={exit}
                transition={{ duration: reduceMotion ? 0.12 : 0.34, ease: EASE_OUT }}
                className="bg-muted fixed inset-0 z-[80] flex flex-col outline-none lg:hidden"
                data-mobile-search
              >
                <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>

                <header className="shrink-0 pt-[var(--safe-top)]">
                  <div className={cn(SHEET_COLUMN, 'flex h-12 items-center px-3')}>
                    <DialogPrimitive.Close
                      aria-label="Close search"
                      className="border-border bg-background text-foreground native-press relative flex size-9 items-center justify-center rounded-full border shadow-sm before:absolute before:-inset-1 before:content-['']"
                    >
                      <X className="size-4" aria-hidden />
                    </DialogPrimitive.Close>
                  </div>
                  {category ? <CategoryTabs value={category} onChange={onCategoryChange} /> : null}
                </header>

                <LayoutGroup>
                  <div
                    className={cn(
                      SHEET_COLUMN,
                      'scrollbar-hide flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-3 pt-2',
                      showFooter ? 'pb-4' : 'pb-[calc(0.75rem+var(--safe-bottom))]'
                    )}
                  >
                    {rows.map((row) =>
                      row.step === activeStep ? (
                        <motion.section
                          key={row.step}
                          layout={!reduceMotion}
                          initial={reduceMotion ? false : { opacity: 0.6 }}
                          animate={{ opacity: 1 }}
                          transition={CARD_TRANSITION}
                          aria-label={row.label}
                          className={cn(
                            'bg-card shrink-0 overflow-hidden rounded-3xl',
                            'shadow-[0_10px_30px_-12px_hsl(var(--foreground)/0.22),0_2px_6px_-2px_hsl(var(--foreground)/0.08)]',
                            row.step === 'when' && 'flex min-h-[22rem] flex-1 flex-col'
                          )}
                        >
                          {renderStep(row.step)}
                        </motion.section>
                      ) : (
                        <motion.button
                          key={row.step}
                          type="button"
                          layout={!reduceMotion}
                          transition={CARD_TRANSITION}
                          onClick={() => onStepChange(row.step)}
                          className={cn(
                            'bg-card native-press flex min-h-[3.5rem] shrink-0 items-center justify-between gap-4 rounded-2xl px-5 text-left',
                            'shadow-[0_2px_8px_-3px_hsl(var(--foreground)/0.14)]'
                          )}
                        >
                          <span className="text-muted-foreground shrink-0 text-sm font-medium">
                            {row.label}
                          </span>
                          <span className="text-foreground min-w-0 truncate text-sm font-semibold">
                            {row.value}
                          </span>
                        </motion.button>
                      )
                    )}
                  </div>
                </LayoutGroup>

                <AnimatePresence initial={false}>
                  {showFooter ? (
                    <motion.footer
                      key="footer"
                      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, transition: { duration: 0.1 } }}
                      transition={{ duration: 0.22, ease: EASE_OUT }}
                      className="border-border bg-background shrink-0 border-t px-5 pb-[calc(0.75rem+var(--safe-bottom))] pt-3"
                    >
                      <div className={cn(SHEET_COLUMN, 'flex items-center justify-between gap-4')}>
                        <button
                          type="button"
                          onClick={onClearAll}
                          disabled={!canClear}
                          className="text-foreground -ml-1 min-h-[44px] px-1 text-[15px] font-semibold underline underline-offset-4 transition-opacity disabled:no-underline disabled:opacity-40"
                        >
                          Clear all
                        </button>
                        <button
                          type="button"
                          onClick={onSearch}
                          className="gradient-primary text-primary-foreground native-press shadow-soft inline-flex h-12 items-center gap-2 rounded-xl px-6 text-[15px] font-semibold"
                        >
                          <Search className="size-[18px]" aria-hidden />
                          Search
                        </button>
                      </div>
                    </motion.footer>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        ) : null}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

function CategoryTabs({
  value,
  onChange,
}: {
  value: MobileSearchCategory;
  onChange: (category: MobileSearchCategory) => void;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <div
      role="tablist"
      aria-label="Search for"
      className={cn(SHEET_COLUMN, 'border-border grid grid-cols-4 border-b px-2')}
      onKeyDown={(event) => {
        if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
        event.preventDefault();
        const ids = MOBILE_SEARCH_CATEGORIES.map((item) => item.id);
        const index = ids.indexOf(value);
        const next = ids[(index + (event.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length]!;
        onChange(next);
        event.currentTarget.querySelector<HTMLButtonElement>(`[data-category="${next}"]`)?.focus();
      }}
    >
      {MOBILE_SEARCH_CATEGORIES.map((item) => {
        const Icon = CATEGORY_ICONS[item.id];
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            data-category={item.id}
            aria-selected={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(item.id)}
            className={cn(
              'relative flex min-h-[3.75rem] flex-col items-center justify-center gap-1 pb-2.5 pt-1.5',
              'transition-colors duration-200',
              selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <Icon
              className={cn(
                'size-[22px] transition-transform duration-200',
                selected && 'motion-safe:scale-110'
              )}
              strokeWidth={selected ? 2.1 : 1.8}
              aria-hidden
            />
            <span className={cn('text-xs', selected ? 'font-semibold' : 'font-medium')}>
              {item.label}
            </span>
            {selected ? (
              <motion.span
                layoutId={reduceMotion ? undefined : 'mobile-search-tab-indicator'}
                transition={{ duration: 0.28, ease: EASE_OUT }}
                className="bg-foreground absolute inset-x-4 bottom-0 h-0.5 rounded-full"
                aria-hidden
              />
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
