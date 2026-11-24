/**
 * A cold load that never settles looks identical to a slow one. After a while say so and
 * offer the retry the host would otherwise have to guess at (reload the page).
 */
export function InboxSlowLoadNote({ onRetry }: { onRetry?: () => void }) {
  return (
    <div
      role="status"
      className="text-muted-foreground flex items-center justify-center gap-2 px-3 py-2 text-xs"
    >
      <span>Taking longer than usual.</span>
      {onRetry ? (
        <button
          type="button"
          className="text-foreground min-h-[44px] font-medium underline underline-offset-2"
          onClick={onRetry}
        >
          Retry
        </button>
      ) : null}
    </div>
  );
}
