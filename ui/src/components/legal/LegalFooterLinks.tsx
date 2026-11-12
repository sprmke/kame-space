import { Fragment } from 'react';

import { LegalLink } from '@/components/legal/LegalLink';
import type { LegalDocId } from '@/lib/legal/legalMeta';
import { cn } from '@/lib/utils';

const FOOTER_DOCS: readonly { doc: LegalDocId; label: string }[] = [
  { doc: 'terms', label: 'Terms' },
  { doc: 'privacy', label: 'Privacy' },
  { doc: 'cookies', label: 'Cookies' },
];

type LegalFooterLinksProps = {
  className?: string;
  /** Hide Cookies where space is tight (account menus). */
  includeCookies?: boolean;
};

/** "Terms · Privacy · Cookies" row for layout footers and account menus. */
export function LegalFooterLinks({ className, includeCookies = true }: LegalFooterLinksProps) {
  const docs = includeCookies ? FOOTER_DOCS : FOOTER_DOCS.filter((d) => d.doc !== 'cookies');
  return (
    <nav aria-label="Legal" className={cn('text-muted-foreground text-xs', className)}>
      <ul className="flex flex-wrap items-center justify-center gap-x-1">
        {docs.map(({ doc, label }, index) => (
          <Fragment key={doc}>
            {index > 0 ? (
              <li aria-hidden className="text-muted-foreground/50">
                ·
              </li>
            ) : null}
            <li>
              <LegalLink
                doc={doc}
                className="text-muted-foreground hover:text-foreground inline-flex min-h-[44px] items-center px-1 font-normal no-underline sm:min-h-8"
              >
                {label}
              </LegalLink>
            </li>
          </Fragment>
        ))}
      </ul>
    </nav>
  );
}
