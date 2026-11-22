import { useState } from 'react';

import { Check, ChevronDown, LayoutGrid, Palette, Plus } from 'lucide-react';

import { useMarketingThemeEditor } from '@/features/dashboard/marketing/components/themes/MarketingThemeEditor';
import { useMarketingTheme } from '@/features/dashboard/marketing/components/themes/MarketingThemeProvider';
import { ThemeSwatchDots } from '@/features/dashboard/marketing/components/themes/ThemePreview';
import type { MarketingThemeEntry } from '@/features/dashboard/marketing/lib/theme/marketingThemeLibrary';

import { MobileChoiceSheet } from '@/components/mobile/MobileChoiceSheet';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { useIsBelowLg } from '@/hooks/useMediaQuery';
import { cn } from '@/lib/utils';

function itemCountLabel(count: number): string | null {
  if (count === 0) return null;
  return count === 1 ? '1 item' : `${count} items`;
}

type Props = {
  className?: string;
  /**
   * Phone density: swatch + short name only. Themes / edit live in the sheet.
   * Keeps the studio header on one row next to the mode tabs.
   */
  compact?: boolean;
};

/**
 * Where you are in Marketing: theme switch + edit.
 * Compact mode is for the tab-row trailing slot on phone.
 */
export function ThemeContextBar({ className, compact = false }: Props) {
  const { library, active, openTheme, showThemes } = useMarketingTheme();
  const { canCreate, canEdit, openEditor, openNewTheme } = useMarketingThemeEditor();
  const isBelowLg = useIsBelowLg();
  const [sheetOpen, setSheetOpen] = useState(false);

  if (!active) {
    return (
      <Skeleton
        className={cn(compact ? 'h-8 w-28 rounded-lg' : 'h-9 w-56 rounded-lg', className)}
      />
    );
  }

  // Built-ins aren't edited in place; "Customize" makes a copy (needs add access).
  const canChangeActive = active.editable ? canEdit : canCreate;
  const editLabel = active.editable ? 'Edit theme' : 'Customize';
  const themes = library.mine.some((entry) => entry.key === active.key)
    ? library.mine
    : [...library.mine, active];

  const pick = (entry: MarketingThemeEntry) => {
    setSheetOpen(false);
    if (entry.key !== active.key) openTheme(entry.key);
  };

  const compactTrigger = (
    <button
      type="button"
      className="hover:bg-muted/60 flex h-8 max-w-[2.75rem] min-w-0 items-center justify-center gap-1 rounded-lg border border-border/80 bg-background px-1.5 max-lg:min-h-[36px] sm:max-w-[9rem] sm:justify-start sm:gap-1.5 sm:px-2 sm:text-xs sm:font-semibold"
      aria-label={`Theme: ${active.name}. Change theme`}
      onClick={isBelowLg ? () => setSheetOpen(true) : undefined}
    >
      <ThemeSwatchDots tokens={active.tokens} className="scale-90" />
      <span className="hidden truncate sm:inline">{active.name}</span>
      <ChevronDown
        className="text-muted-foreground hidden size-3.5 shrink-0 sm:block"
        aria-hidden
      />
    </button>
  );

  const fullTrigger = (
    <button
      type="button"
      className="hover:bg-muted/60 flex min-h-[36px] min-w-0 flex-1 items-center gap-2 rounded-lg px-2 text-sm font-semibold max-lg:min-h-[44px] sm:max-w-[16rem] sm:flex-none"
      aria-label={`Theme: ${active.name}. Change theme`}
      onClick={isBelowLg ? () => setSheetOpen(true) : undefined}
    >
      <ThemeSwatchDots tokens={active.tokens} />
      <span className="truncate">{active.name}</span>
      <ChevronDown className="text-muted-foreground size-4 shrink-0" aria-hidden />
    </button>
  );

  const trigger = compact ? compactTrigger : fullTrigger;

  const themeList = (
    <ul className="px-2 py-1">
      {themes.map((entry) => (
        <li key={entry.key}>
          <button
            type="button"
            onClick={() => pick(entry)}
            className="hover:bg-muted/60 flex min-h-[48px] w-full items-center gap-3 rounded-lg px-2 text-left"
          >
            <ThemeSwatchDots tokens={entry.tokens} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{entry.name}</span>
              {itemCountLabel(entry.itemCount) ? (
                <span className="text-muted-foreground block text-xs">
                  {itemCountLabel(entry.itemCount)}
                </span>
              ) : null}
            </span>
            {entry.key === active.key ? (
              <Check className="text-primary size-4" aria-hidden />
            ) : null}
          </button>
        </li>
      ))}
    </ul>
  );

  const sheetFooter = (
    <div className="border-border/60 mt-1 border-t px-2 py-1">
      {canChangeActive ? (
        <button
          type="button"
          onClick={() => {
            setSheetOpen(false);
            openEditor({ mode: 'edit', entry: active });
          }}
          className="hover:bg-muted/60 flex min-h-[48px] w-full items-center gap-3 rounded-lg px-2 text-sm"
        >
          <Palette className="size-4" aria-hidden />
          {editLabel}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setSheetOpen(false);
          openNewTheme();
        }}
        className="hover:bg-muted/60 flex min-h-[48px] w-full items-center gap-3 rounded-lg px-2 text-sm"
      >
        <Plus className="size-4" aria-hidden />
        {canCreate ? 'New theme' : 'More looks'}
      </button>
      <button
        type="button"
        onClick={() => {
          setSheetOpen(false);
          showThemes();
        }}
        className="hover:bg-muted/60 flex min-h-[48px] w-full items-center gap-3 rounded-lg px-2 text-sm"
      >
        <LayoutGrid className="size-4" aria-hidden />
        All themes
      </button>
    </div>
  );

  if (compact) {
    if (isBelowLg) {
      return (
        <nav aria-label="Theme" className={cn('flex shrink-0 items-center', className)}>
          {trigger}
          <MobileChoiceSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Themes">
            {themeList}
            {sheetFooter}
          </MobileChoiceSheet>
        </nav>
      );
    }

    return (
      <nav aria-label="Theme" className={cn('flex shrink-0 items-center', className)}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72">
            <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">
              Switch theme
            </DropdownMenuLabel>
            <div className="max-h-72 overflow-y-auto">
              {themes.map((entry) => (
                <DropdownMenuItem
                  key={entry.key}
                  onSelect={() => pick(entry)}
                  className="gap-2.5 py-2"
                >
                  <ThemeSwatchDots tokens={entry.tokens} />
                  <span className="min-w-0 flex-1 truncate">{entry.name}</span>
                  {entry.key === active.key ? (
                    <Check className="text-primary size-4" aria-hidden />
                  ) : null}
                </DropdownMenuItem>
              ))}
            </div>
            <DropdownMenuSeparator />
            {canChangeActive ? (
              <DropdownMenuItem
                onSelect={() => openEditor({ mode: 'edit', entry: active })}
                className="gap-2.5"
              >
                <Palette className="size-4" aria-hidden />
                {editLabel}
              </DropdownMenuItem>
            ) : null}
            <DropdownMenuItem onSelect={openNewTheme} className="gap-2.5">
              <Plus className="size-4" aria-hidden />
              {canCreate ? 'New theme' : 'More looks'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={showThemes} className="gap-2.5">
              <LayoutGrid className="size-4" aria-hidden />
              All themes
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </nav>
    );
  }

  const switcher = isBelowLg ? (
    <>
      {trigger}
      <MobileChoiceSheet open={sheetOpen} onOpenChange={setSheetOpen} title="Themes">
        {themeList}
        {sheetFooter}
      </MobileChoiceSheet>
    </>
  ) : (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-muted-foreground text-xs font-medium">
          Switch theme
        </DropdownMenuLabel>
        <div className="max-h-72 overflow-y-auto">
          {themes.map((entry) => (
            <DropdownMenuItem key={entry.key} onSelect={() => pick(entry)} className="gap-2.5 py-2">
              <ThemeSwatchDots tokens={entry.tokens} />
              <span className="min-w-0 flex-1 truncate">{entry.name}</span>
              {itemCountLabel(entry.itemCount) ? (
                <span className="text-muted-foreground text-xs">{entry.itemCount}</span>
              ) : null}
              {entry.key === active.key ? (
                <Check className="text-primary size-4" aria-hidden />
              ) : null}
            </DropdownMenuItem>
          ))}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={openNewTheme} className="gap-2.5">
          <Plus className="size-4" aria-hidden />
          {canCreate ? 'New theme' : 'More looks'}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={showThemes} className="gap-2.5">
          <LayoutGrid className="size-4" aria-hidden />
          All themes
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );

  return (
    <nav
      aria-label="Theme"
      className={cn('flex min-w-0 items-center gap-0.5 max-sm:w-full', className)}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={showThemes}
        className="text-muted-foreground hover:text-foreground gap-1.5 px-2 max-lg:min-h-[44px] max-sm:min-w-[44px]"
        aria-label="All themes"
      >
        <LayoutGrid className="size-4" aria-hidden />
        <span className="max-sm:hidden">Themes</span>
      </Button>
      <span className="text-muted-foreground/60 px-0.5" aria-hidden>
        /
      </span>
      {switcher}
      {canChangeActive ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => openEditor({ mode: 'edit', entry: active })}
          className="ml-1 shrink-0 gap-1.5 max-xl:min-w-[36px] max-xl:px-2.5 max-lg:min-h-[44px]"
          aria-label={editLabel}
          title={editLabel}
        >
          <Palette className="size-4" aria-hidden />
          <span className="max-sm:sr-only">{editLabel}</span>
        </Button>
      ) : null}
    </nav>
  );
}
