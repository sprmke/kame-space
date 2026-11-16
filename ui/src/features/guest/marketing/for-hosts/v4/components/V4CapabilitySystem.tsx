import { V4Reveal } from '@/features/guest/marketing/for-hosts/v4/components/V4Reveal';
import { v4CapabilityGroups } from '@/features/guest/marketing/for-hosts/v4/data/hostLandingV4';

export function V4CapabilitySystem() {
  return (
    <section className="bg-background py-20 sm:py-28 lg:py-36">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <V4Reveal className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
          <h2 className="text-foreground max-w-[11ch] text-balance text-4xl font-bold tracking-[-0.045em] sm:text-5xl lg:text-6xl lg:leading-[1]">
            The tools behind the promise.
          </h2>
          <p className="text-muted-foreground max-w-xl text-pretty text-lg leading-8 lg:justify-self-end">
            Kame connects the work hosts usually split across booking apps, spreadsheets, chat
            threads, and design tools.
          </p>
        </V4Reveal>

        <div className="mt-14 grid gap-4 lg:mt-20 lg:grid-cols-12">
          {v4CapabilityGroups.map((group, index) => (
            <V4Reveal
              key={group.title}
              delay={(index % 3) * 0.05}
              className={
                index < 2
                  ? 'lg:col-span-6'
                  : index === 2
                    ? 'lg:col-span-5'
                    : index === 3
                      ? 'lg:col-span-4'
                      : 'lg:col-span-3'
              }
            >
              <article className="border-border bg-card hover:border-primary/30 group h-full rounded-[1.5rem] border p-6 transition-[transform,border-color,box-shadow] hover:-translate-y-1 hover:shadow-[0_24px_60px_-42px_rgba(15,23,42,0.5)] sm:p-7">
                <span className="bg-primary/10 text-primary flex size-11 items-center justify-center rounded-xl">
                  <group.icon className="size-5" aria-hidden />
                </span>
                <h3 className="text-foreground mt-6 text-xl font-bold tracking-tight">
                  {group.title}
                </h3>
                <p className="text-muted-foreground mt-2 text-sm leading-6">{group.description}</p>
                <ul className="border-border mt-6 space-y-3 border-t pt-5">
                  {group.features.map((feature) => (
                    <li
                      key={feature.label}
                      className="text-foreground/80 flex items-center gap-2.5 text-sm font-medium"
                    >
                      <feature.icon className="text-primary size-4 shrink-0" aria-hidden />
                      {feature.label}
                    </li>
                  ))}
                </ul>
              </article>
            </V4Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
