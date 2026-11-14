import * as React from 'react';

import { useAdminLayoutFillMain } from '@/features/dashboard/bookings/lib/adminLayoutFillMain';
import { findActiveSectionIdInContainer } from '@/features/dashboard/bookings/lib/adminSectionNavScroll';
import { SectionNavIssueDot } from '@/features/dashboard/org/components/property-settings/PropertySettingsFields';

import { FieldHelpTooltip } from '@/components/forms/FieldLabel';
import { bottomTabBarOffsetClassName } from '@/components/mobile/BottomTabBar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SlidingActivePill } from '@/components/ui/SlidingActivePill';
import { useSlidingActivePill } from '@/hooks/useSlidingActivePill';
import { cn } from '@/lib/utils';

import type { LucideIcon } from 'lucide-react';

export type AdminSectionNavItem = {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Show attention dot when this section has incomplete required fields. */
  hasIssue?: boolean;
  /** Trailing content for secondary nav rows (e.g. attention dot). Prefer `TierBadge` on
   * section/card titles instead of this slot. */
  badge?: React.ReactNode;
};

export type AdminSectionNavGroup = {
  label: string;
  sections: AdminSectionNavItem[];
};

type AdminSectionNavLayoutProps = {
  /** Flat section list — used when `sectionGroups` is omitted. */
  sections?: AdminSectionNavItem[];
  /** Grouped sidebar labels (PMA templates pattern). Flattened for scroll-spy. */
  sectionGroups?: AdminSectionNavGroup[];
  children: React.ReactNode;
  className?: string;
  /** Page title block — pinned above the scroll region on desktop; scrolls with content on mobile. */
  header?: React.ReactNode;
  /** Optional action row — pinned under the main content column on desktop (not under the section nav); scrolls with content on mobile. */
  footer?: React.ReactNode;
};

function flattenSectionGroups(groups: AdminSectionNavGroup[]): AdminSectionNavItem[] {
  return groups.flatMap((group) => group.sections);
}

const SectionNavGroupsContext = React.createContext<AdminSectionNavGroup[] | null>(null);

type SectionNavStore = {
  subscribe: (listener: () => void) => () => void;
  getActiveSection: () => string;
  getSections: () => AdminSectionNavItem[];
  scrollToSection: (sectionId: string) => void;
};

const SectionNavStoreContext = React.createContext<SectionNavStore | null>(null);

function useSectionNavStore(): SectionNavStore {
  const store = React.useContext(SectionNavStoreContext);
  if (!store) {
    throw new Error('useSectionNavStore must be used within AdminSectionNavLayout');
  }
  return store;
}

type InternalSectionNavStore = SectionNavStore & {
  _attach: () => void;
  _detach: () => void;
  _updateSections: (sections: AdminSectionNavItem[]) => void;
};

function createSectionNavStore(
  sections: AdminSectionNavItem[],
  scrollRef: React.RefObject<HTMLDivElement | null>
): InternalSectionNavStore {
  let activeSection = sections[0]?.id ?? '';
  const listeners = new Set<() => void>();
  let isProgrammaticScroll = false;
  let programmaticScrollTimer: ReturnType<typeof setTimeout> | null = null;
  let scrollThrottleTimer: ReturnType<typeof setTimeout> | null = null;
  let sectionIds = sections.map((section) => section.id);
  let currentSections = sections;
  let detachScroll: (() => void) | null = null;

  const notify = () => {
    for (const listener of listeners) listener();
  };

  const setActiveSection = (next: string) => {
    if (next === activeSection) return;
    activeSection = next;
    notify();
  };

  let programmaticTarget: string | null = null;
  let detachScrollEnd: (() => void) | null = null;

  const clearProgrammaticScroll = (targetSectionId: string) => {
    if (programmaticTarget !== targetSectionId) return;
    programmaticTarget = null;
    isProgrammaticScroll = false;
    detachScrollEnd?.();
    detachScrollEnd = null;
    if (programmaticScrollTimer) {
      clearTimeout(programmaticScrollTimer);
      programmaticScrollTimer = null;
    }
    setActiveSection(targetSectionId);
  };

  const scrollToSection = (sectionId: string) => {
    // Never scrollIntoView the rail itself — that jumps the menu list. Content scrolls only.
    setActiveSection(sectionId);
    programmaticTarget = sectionId;
    isProgrammaticScroll = true;

    detachScrollEnd?.();
    if (programmaticScrollTimer) clearTimeout(programmaticScrollTimer);

    const element = document.getElementById(`section-${sectionId}`);
    const container = scrollRef.current;

    const finish = () => clearProgrammaticScroll(sectionId);

    if (container && element) {
      const onScrollEnd = () => finish();
      container.addEventListener('scrollend', onScrollEnd, { once: true });
      detachScrollEnd = () => container.removeEventListener('scrollend', onScrollEnd);

      const containerTop = container.getBoundingClientRect().top;
      const elementTop = element.getBoundingClientRect().top;
      const top = elementTop - containerTop + container.scrollTop - 8;
      container.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });

      // Fallback when scrollend is unsupported or smooth scroll is interrupted.
      programmaticScrollTimer = setTimeout(finish, 2500);
    } else if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      programmaticScrollTimer = setTimeout(finish, 2500);
    } else {
      finish();
    }
  };

  const syncActiveFromScroll = () => {
    if (isProgrammaticScroll) return;
    const container = scrollRef.current;
    if (!container) return;
    setActiveSection(findActiveSectionIdInContainer(container, sectionIds));
  };

  const onScroll = () => {
    if (isProgrammaticScroll) return;
    if (scrollThrottleTimer) return;
    // Throttle only — no debounce. Neighbor-to-neighbor updates keep the spring glide smooth.
    scrollThrottleTimer = setTimeout(() => {
      scrollThrottleTimer = null;
      syncActiveFromScroll();
    }, 50);
  };

  const attachScroll = () => {
    detachScroll?.();

    const container = scrollRef.current;
    if (!container) return;

    container.addEventListener('scroll', onScroll, { passive: true });
    syncActiveFromScroll();

    const resizeObserver = new ResizeObserver(() => {
      syncActiveFromScroll();
    });
    resizeObserver.observe(container);
    /*
     * The scrollport keeps its size while the cards inside it grow (async
     * settings loads), so observing only the container leaves the first sync
     * running against a half-laid-out page and the wrong row highlighted.
     */
    for (const child of container.children) resizeObserver.observe(child);

    detachScroll = () => {
      container.removeEventListener('scroll', onScroll);
      resizeObserver.disconnect();
      detachScrollEnd?.();
      detachScrollEnd = null;
      if (scrollThrottleTimer) clearTimeout(scrollThrottleTimer);
      if (programmaticScrollTimer) clearTimeout(programmaticScrollTimer);
      programmaticTarget = null;
      isProgrammaticScroll = false;
    };
  };

  const store: SectionNavStore = {
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getActiveSection: () => activeSection,
    getSections: () => currentSections,
    scrollToSection,
  };

  return Object.assign(store, {
    _attach: attachScroll,
    _detach: () => detachScroll?.(),
    _updateSections: (nextSections: AdminSectionNavItem[]) => {
      currentSections = nextSections;
      sectionIds = nextSections.map((section) => section.id);
      if (!sectionIds.includes(activeSection)) {
        setActiveSection(sectionIds[0] ?? '');
      }
      syncActiveFromScroll();
    },
  });
}

function sectionNavItemClass(active: boolean) {
  return cn(
    'group relative z-[1] flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-200',
    active
      ? 'text-primary-foreground'
      : // Same idle treatment as the main sidebar: no fill so the spring pill can glide cleanly.
        'text-foreground hover:bg-muted/60 hover:text-foreground'
  );
}

const SectionNavButton = React.forwardRef<
  HTMLButtonElement,
  {
    section: AdminSectionNavItem;
    active: boolean;
    onSelect: (id: string) => void;
  }
>(function SectionNavButton({ section, active, onSelect }, ref) {
  const Icon = section.icon;
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => onSelect(section.id)}
      className={sectionNavItemClass(active)}
    >
      <Icon
        className={cn(
          'size-4 shrink-0 transition-colors',
          active ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-foreground'
        )}
        aria-hidden
      />
      <span className="truncate">{section.label}</span>
      {section.badge ?? (section.hasIssue ? <SectionNavIssueDot className="ml-auto" /> : null)}
    </button>
  );
});

function SectionNavGroupLabel({ label }: { label: string }) {
  return (
    <div className="px-3 py-2">
      <p className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{label}</p>
    </div>
  );
}

function SectionNavSeparator() {
  return <div className="border-border/60 my-2 border-t" role="separator" />;
}

const SectionNavList = React.memo(function SectionNavList({ className }: { className?: string }) {
  const store = useSectionNavStore();
  const sectionGroups = React.useContext(SectionNavGroupsContext);
  const activeSection = React.useSyncExternalStore(store.subscribe, store.getActiveSection);
  const sections = React.useSyncExternalStore(store.subscribe, store.getSections);
  const sectionIdsKey = React.useMemo(
    () => sections.map((section) => section.id).join('\0'),
    [sections]
  );
  const groupStructureKey = React.useMemo(
    () =>
      sectionGroups
        ?.map((group) => `${group.label}:${group.sections.map((section) => section.id).join(',')}`)
        .join('\0') ?? '',
    [sectionGroups]
  );
  const { containerRef, setItemRef, bounds } = useSlidingActivePill(activeSection || null, [
    sectionIdsKey,
    groupStructureKey,
  ]);

  if (sectionGroups?.length) {
    return (
      <nav
        ref={containerRef}
        className={cn('relative space-y-1', className)}
        aria-label="Page sections"
      >
        {bounds ? (
          <SlidingActivePill bounds={bounds} className="bg-primary-strong rounded-lg shadow-sm" />
        ) : null}
        {sectionGroups.map((group, groupIndex) => (
          <React.Fragment key={group.label}>
            {groupIndex > 0 ? <SectionNavSeparator /> : null}
            <SectionNavGroupLabel label={group.label} />
            {group.sections.map((section) => (
              <SectionNavButton
                key={section.id}
                ref={setItemRef(section.id)}
                section={section}
                active={activeSection === section.id}
                onSelect={store.scrollToSection}
              />
            ))}
          </React.Fragment>
        ))}
      </nav>
    );
  }

  return (
    <nav
      ref={containerRef}
      className={cn('relative space-y-1', className)}
      aria-label="Page sections"
    >
      {bounds ? (
        <SlidingActivePill bounds={bounds} className="bg-primary-strong rounded-lg shadow-sm" />
      ) : null}
      {sections.map((section) => (
        <SectionNavButton
          key={section.id}
          ref={setItemRef(section.id)}
          section={section}
          active={activeSection === section.id}
          onSelect={store.scrollToSection}
        />
      ))}
    </nav>
  );
});

export function AdminSectionNavLayout({
  sections,
  sectionGroups,
  children,
  className,
  header,
  footer,
}: AdminSectionNavLayoutProps) {
  useAdminLayoutFillMain(true);

  const resolvedSections = React.useMemo(
    () => (sectionGroups?.length ? flattenSectionGroups(sectionGroups) : (sections ?? [])),
    [sectionGroups, sections]
  );

  const contentScrollRef = React.useRef<HTMLDivElement>(null);
  const storeRef = React.useRef<InternalSectionNavStore | null>(null);

  if (!storeRef.current) {
    storeRef.current = createSectionNavStore(resolvedSections, contentScrollRef);
  }

  const store = storeRef.current;

  React.useEffect(() => {
    store._updateSections(resolvedSections);
  }, [resolvedSections, store]);

  React.useLayoutEffect(() => {
    store._attach();
    return () => {
      store._detach();
    };
  }, [store]);

  return (
    <SectionNavStoreContext.Provider value={store}>
      <SectionNavGroupsContext.Provider value={sectionGroups ?? null}>
        <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', className)}>
          {header ? (
            <div className="bg-background relative z-20 hidden shrink-0 lg:block lg:pb-5">
              {header}
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row lg:gap-8 xl:gap-10">
            {/* Hidden in a medium AI canvas (index.css), like tablets: the content needs the room. */}
            <aside
              data-section-nav-aside
              className="bg-background relative z-10 hidden w-56 shrink-0 lg:block lg:self-start"
            >
              <Card>
                <CardContent
                  data-section-nav-scroll
                  className="max-h-[calc(100dvh-10rem)] overflow-y-auto overscroll-contain p-2 sm:p-2"
                >
                  <SectionNavList />
                </CardContent>
              </Card>
            </aside>

            {/*
              Main column owns scroll + desktop sticky footer so the unsaved bar
              never spans under the secondary section nav (Integrations, etc.).
              lg:pr-16 on the footer clears the fixed notification FAB.
            */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <div
                ref={contentScrollRef}
                data-admin-content-scroll
                className={cn(
                  'min-h-0 min-w-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain',
                  /* Scrollable tab clearance — scrollport fills height; last cards clear the dock. */
                  bottomTabBarOffsetClassName()
                )}
              >
                {header ? <div className="pb-3 lg:hidden">{header}</div> : null}
                <div className="mx-auto w-full max-w-4xl space-y-6">{children}</div>
                {footer ? (
                  <div className="border-separator mx-auto mt-3 w-full max-w-4xl border-t pt-3 lg:hidden">
                    {footer}
                  </div>
                ) : null}
              </div>

              {footer ? (
                <div className="border-separator bg-background relative z-20 hidden shrink-0 border-t pt-3 lg:block lg:pr-16">
                  <div className="mx-auto w-full max-w-4xl">{footer}</div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </SectionNavGroupsContext.Provider>
    </SectionNavStoreContext.Provider>
  );
}

type AdminSectionGroupHeadingProps = {
  title: string;
  count?: number;
  /** e.g. a `<TierBadge>` after the count when the whole group requires a higher plan. */
  badge?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
};

/** Main-content group title (PMA templates page pattern). */
export function AdminSectionGroupHeading({
  title,
  count,
  badge,
  action,
  className,
}: AdminSectionGroupHeadingProps) {
  return (
    <div className={cn('flex flex-wrap items-center justify-between gap-2', className)}>
      <div className="flex items-baseline gap-2">
        <h2 className="text-section-title">{title}</h2>
        {count != null ? (
          <span className="bg-muted text-muted-foreground inline-flex min-h-[22px] items-center self-center rounded-full px-2 text-xs font-medium">
            {count}
          </span>
        ) : null}
        {badge}
      </div>
      {action}
    </div>
  );
}

type AdminSectionProps = {
  id: string;
  title: string;
  icon?: LucideIcon;
  description?: string;
  /** Optional ? tooltip next to the title (plain-language help). */
  titleHelp?: string;
  /** e.g. a `<TierBadge>` next to the section title when this card requires a higher plan. */
  badge?: React.ReactNode;
  headerAction?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  /** Tighter padding/gaps for embedded surfaces (e.g. Setup Guide). */
  dense?: boolean;
};

export const AdminSection = React.memo(function AdminSection({
  id,
  title,
  icon: Icon,
  description,
  titleHelp,
  badge,
  headerAction,
  children,
  className,
  dense = false,
}: AdminSectionProps) {
  const helpText = titleHelp?.trim() ?? '';
  return (
    <Card id={`section-${id}`} className={cn('scroll-mt-2', className)}>
      <CardHeader
        className={cn(
          dense && 'space-y-1 p-3 sm:space-y-1 sm:p-4',
          headerAction && 'flex flex-row items-center justify-between gap-3 space-y-0'
        )}
      >
        <div className={cn(headerAction && 'min-w-0 space-y-1.5')}>
          <CardTitle className="flex items-center gap-2">
            {Icon ? <Icon className="size-4 shrink-0" aria-hidden /> : null}
            <span className="min-w-0">{title}</span>
            {helpText ? <FieldHelpTooltip label={title} help={helpText} /> : null}
            {badge}
          </CardTitle>
          {description ? <CardDescription>{description}</CardDescription> : null}
        </div>
        {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
      </CardHeader>
      <CardContent
        className={cn(
          dense ? 'space-y-3 p-3 pt-0 sm:space-y-4 sm:p-4 sm:pt-0' : 'space-y-3 sm:space-y-6'
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
});
