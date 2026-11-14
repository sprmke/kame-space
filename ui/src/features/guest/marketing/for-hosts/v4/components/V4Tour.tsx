import { HostDashboardTourPlayer } from '@/features/guest/marketing/for-hosts/components/HostDashboardTourPlayer';
import { V4Reveal } from '@/features/guest/marketing/for-hosts/v4/components/V4Reveal';

export function V4Tour() {
  return (
    <section id="tour" className="bg-muted/35 scroll-mt-24 py-20 sm:py-28 lg:py-36">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <V4Reveal className="mx-auto max-w-3xl text-center">
          <p className="text-primary-strong dark:text-primary text-sm font-semibold">
            See the real workspace
          </p>
          <h2 className="text-foreground mt-4 text-balance text-4xl font-bold tracking-[-0.045em] sm:text-5xl lg:text-6xl lg:leading-[1]">
            One dashboard, from booking to growth.
          </h2>
          <p className="text-muted-foreground mx-auto mt-6 max-w-2xl text-pretty text-lg leading-8">
            Tour the booking workflow, pricing, finance, maintenance, guest inbox, and marketing
            tools hosts use every day.
          </p>
        </V4Reveal>
        <V4Reveal delay={0.08} className="mx-auto mt-12 max-w-6xl sm:mt-16">
          <div className="border-border bg-card rounded-[1.75rem] border p-2 shadow-[0_35px_100px_-55px_rgba(15,23,42,0.75)] sm:p-4">
            <HostDashboardTourPlayer
              variant="marketing"
              chapterNavigation="strip"
              playWhenInView
              regionLabel="Kame host workspace tour"
            />
          </div>
        </V4Reveal>
      </div>
    </section>
  );
}
