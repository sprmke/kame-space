/**
 * Row look for search suggestions. `dropdown` is the desktop panel; `sheet` is the phone
 * full-screen search, where rows flow with the page and get larger tap targets. Recent
 * searches in the phone search reuse the `sheet` row so both lists line up exactly.
 */
export type SuggestionLayout = 'dropdown' | 'sheet';

export const SUGGESTION_ROW_CLASS: Record<SuggestionLayout, string> = {
  dropdown:
    'hover:bg-muted flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors',
  sheet:
    'hover:bg-muted active:bg-muted flex min-h-[60px] w-full cursor-pointer items-center gap-4 rounded-2xl px-2 py-2 text-left transition-colors',
};

export const SUGGESTION_TILE_CLASS: Record<SuggestionLayout, string> = {
  dropdown: 'bg-muted text-primary flex size-10 shrink-0 items-center justify-center rounded-xl',
  sheet: 'bg-muted text-brand-ink flex size-12 shrink-0 items-center justify-center rounded-xl',
};

export const SUGGESTION_LABEL_CLASS: Record<SuggestionLayout, string> = {
  dropdown: 'text-foreground block text-sm font-medium',
  sheet: 'text-foreground block truncate text-[15px] font-medium',
};

export const SUGGESTION_SUBTITLE_CLASS: Record<SuggestionLayout, string> = {
  dropdown: 'text-muted-foreground block truncate text-xs',
  sheet: 'text-muted-foreground block truncate text-[13px]',
};

export const SUGGESTION_TITLE_CLASS: Record<SuggestionLayout, string> = {
  dropdown: 'text-foreground mb-3 text-xs font-semibold',
  sheet: 'text-muted-foreground mb-1 px-2 text-xs font-semibold',
};

export const SUGGESTION_LIST_CLASS: Record<SuggestionLayout, string> = {
  dropdown: 'scrollbar-hide max-h-[min(42vh,300px)] space-y-1 overflow-y-auto',
  sheet: 'space-y-0.5',
};
