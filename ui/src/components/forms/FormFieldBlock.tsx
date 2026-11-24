import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Apply when a control itself receives an error prop (Input `error`, etc.). */
export const FORM_FIELD_ERROR_CONTROL_CLASS =
  'border-destructive bg-destructive/5 field-focus-error';

/**
 * Label + control + optional error for dashboard modal forms that do not use
 * shadcn FormField. When `error` is set, nested inputs / textareas / bordered
 * buttons get a destructive border (not only helper text).
 */
export function FormFieldBlock({
  label,
  required,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'block min-w-0',
        error &&
          cn(
            '[&_input]:border-destructive [&_input]:bg-destructive/5',
            '[&_textarea]:border-destructive [&_textarea]:bg-destructive/5',
            '[&_button.border]:border-destructive [&_button.border]:bg-destructive/5',
            '[&_button.border-input]:border-destructive [&_button.border-input]:bg-destructive/5'
          ),
        className
      )}
    >
      <span className="text-overline mb-1.5 block">
        {label}
        {required ? (
          <>
            {' '}
            <span className="text-destructive" aria-hidden>
              *
            </span>
          </>
        ) : null}
      </span>
      {children}
      {hint ? <p className="text-caption text-muted-foreground mt-1">{hint}</p> : null}
      {error ? (
        /* red-700/red-400 instead of `text-destructive`: the destructive token is 3.78:1
         * at 12px on white, below WCAG AA for body-size text. */
        <p role="alert" className="mt-1 text-xs font-medium text-red-700 dark:text-red-400">
          {error}
        </p>
      ) : null}
    </div>
  );
}
