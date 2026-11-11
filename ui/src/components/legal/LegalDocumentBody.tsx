import { legalSectionDomId, type LegalSection } from '@/lib/legal/legalMeta';
import { cn } from '@/lib/utils';

type LegalDocumentBodyProps = {
  sections: readonly LegalSection[];
  /** `page`: the full-width policy page. `sheet`: denser type inside the in-flow sheet. */
  variant?: 'page' | 'sheet';
  idPrefix?: string;
};

export function LegalDocumentBody({
  sections,
  variant = 'page',
  idPrefix = '',
}: LegalDocumentBodyProps) {
  const isSheet = variant === 'sheet';
  return (
    <div className="divide-border divide-y">
      {sections.map((section) => (
        <section
          key={section.id}
          id={legalSectionDomId(section.id, idPrefix)}
          aria-labelledby={`${legalSectionDomId(section.id, idPrefix)}-title`}
          className={cn(
            'scroll-mt-[calc(var(--public-nav-h,4rem)+1rem)]',
            isSheet ? 'scroll-mt-2 py-3.5 first:pt-0' : 'py-6 first:pt-0 md:py-10'
          )}
        >
          <h2
            id={`${legalSectionDomId(section.id, idPrefix)}-title`}
            className={cn(
              'text-foreground font-semibold tracking-tight',
              isSheet ? 'text-sm' : 'text-lg md:text-2xl'
            )}
          >
            {section.title}
          </h2>
          <div
            className={cn(
              'text-muted-foreground leading-relaxed',
              isSheet
                ? 'mt-1.5 space-y-2 text-sm'
                : 'mt-2.5 space-y-3 text-[15px] md:mt-4 md:space-y-4 md:text-base'
            )}
          >
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
            {section.items?.length ? (
              <ul className="marker:text-muted-foreground/60 list-disc space-y-1.5 pl-5">
                {section.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
          </div>
        </section>
      ))}
    </div>
  );
}
