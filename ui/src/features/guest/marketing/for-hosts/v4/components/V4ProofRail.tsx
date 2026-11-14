import { v4ProofPoints } from '@/features/guest/marketing/for-hosts/v4/data/hostLandingV4';

export function V4ProofRail() {
  return (
    <section aria-label="Kame host advantages" className="border-border bg-muted/35 border-b">
      <div className="container mx-auto grid px-4 sm:px-6 md:grid-cols-3 lg:px-8">
        {v4ProofPoints.map((point, index) => (
          <article
            key={point.label}
            className="border-border py-7 md:px-7 md:py-9 md:first:pl-0 md:last:pr-0 [&:not(:last-child)]:border-b md:[&:not(:last-child)]:border-b-0 md:[&:not(:last-child)]:border-r"
          >
            <div className="flex items-baseline gap-3">
              <span className="text-primary-strong dark:text-primary text-3xl font-bold tracking-[-0.04em] sm:text-4xl">
                {point.value}
              </span>
              <h2 className="text-foreground text-sm font-semibold sm:text-base">{point.label}</h2>
            </div>
            <p className="text-muted-foreground mt-2 max-w-sm text-sm leading-6">{point.note}</p>
            <span className="sr-only">Advantage {index + 1}</span>
          </article>
        ))}
      </div>
    </section>
  );
}
