import { BadgeCheck, Bot, Car, CheckCircle2, KeyRound, Wifi } from 'lucide-react';

import { V4Reveal } from '@/features/guest/marketing/for-hosts/v4/components/V4Reveal';

export function V4GuestExperience() {
  return (
    <section className="bg-muted/35 overflow-hidden py-20 sm:py-28 lg:py-36">
      <div className="container mx-auto grid items-center gap-14 px-4 sm:px-6 lg:grid-cols-[0.9fr_1.1fr] lg:gap-20 lg:px-8">
        <V4Reveal>
          <p className="text-primary-strong dark:text-primary text-sm font-semibold">
            Your guest experience is part of the product
          </p>
          <h2 className="text-foreground mt-4 max-w-[12ch] text-balance text-4xl font-bold tracking-[-0.045em] sm:text-5xl lg:text-6xl lg:leading-[1]">
            Fewer questions. More confidence.
          </h2>
          <p className="text-muted-foreground mt-6 max-w-lg text-pretty text-lg leading-8">
            Guests get booking progress, payments, arrival details, house rules, parking, and
            support in one trip hub. You spend less time repeating the basics.
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="flex gap-3">
              <BadgeCheck className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <p className="text-foreground text-sm font-semibold">Trust before booking</p>
                <p className="text-muted-foreground mt-1 text-sm leading-6">
                  Reviewed host and listing information.
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Bot className="text-primary mt-0.5 size-5 shrink-0" aria-hidden />
              <div>
                <p className="text-foreground text-sm font-semibold">Help after hours</p>
                <p className="text-muted-foreground mt-1 text-sm leading-6">
                  AI answers supported property questions.
                </p>
              </div>
            </div>
          </div>
        </V4Reveal>

        <V4Reveal delay={0.1} className="relative mx-auto w-full max-w-[620px] py-6">
          <div className="bg-primary/15 absolute inset-8 rounded-full blur-3xl" />
          <div className="relative grid grid-cols-[0.82fr_1fr] items-center gap-3 sm:gap-5">
            <div className="translate-y-6 rounded-[1.75rem] border-[6px] border-slate-900 bg-white p-2 shadow-[0_28px_70px_-32px_rgba(15,23,42,0.65)] sm:border-[8px] sm:p-3 dark:bg-slate-950">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
              <div className="bg-primary-strong rounded-2xl p-3 text-white sm:p-4">
                <p className="text-[9px] text-white/55 sm:text-[11px]">Your stay</p>
                <p className="mt-1 text-xs font-bold sm:text-base">Monaco City View</p>
                <p className="mt-3 text-[9px] text-white/50 sm:text-[11px]">Check-in</p>
                <p className="mt-0.5 text-[10px] font-semibold sm:text-sm">Nov 21 · 2:00 PM</p>
              </div>
              <div className="mt-3 space-y-2">
                {[
                  { icon: KeyRound, label: 'Arrival guide' },
                  { icon: Wifi, label: 'Wi-Fi details' },
                  { icon: Car, label: 'Parking request' },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="bg-muted/70 flex items-center gap-2 rounded-xl p-2 sm:p-3"
                  >
                    <item.icon className="text-primary size-3.5 shrink-0" aria-hidden />
                    <span className="text-foreground truncate text-[9px] font-semibold sm:text-xs">
                      {item.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-[1.75rem] border-[6px] border-slate-900 bg-white p-2 shadow-[0_28px_70px_-32px_rgba(15,23,42,0.65)] sm:border-[8px] sm:p-3 dark:bg-slate-950">
              <div className="mx-auto mb-3 h-1.5 w-12 rounded-full bg-slate-300 dark:bg-slate-700" />
              <p className="text-muted-foreground px-1 text-[9px] font-semibold sm:text-xs">
                Booking progress
              </p>
              <div className="mt-3 space-y-1.5 sm:space-y-2">
                {[
                  'Booking confirmed',
                  'Payment recorded',
                  'Documents approved',
                  'Ready for check-in',
                ].map((label, index) => (
                  <div
                    key={label}
                    className="border-border flex items-center gap-2 rounded-xl border p-2 sm:p-3"
                  >
                    <CheckCircle2
                      className={
                        index === 3
                          ? 'text-primary size-3.5 shrink-0'
                          : 'size-3.5 shrink-0 text-emerald-500'
                      }
                      aria-hidden
                    />
                    <span className="text-foreground text-[9px] font-medium sm:text-xs">
                      {label}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-primary/10 mt-3 rounded-xl p-2.5 sm:p-3">
                <div className="text-primary flex items-center gap-2 text-[9px] font-semibold sm:text-xs">
                  <Bot className="size-3.5" aria-hidden />
                  Ask Kame
                </div>
                <p className="text-muted-foreground mt-1.5 text-[8px] leading-4 sm:text-[11px]">
                  Get a quick answer about your stay.
                </p>
              </div>
            </div>
          </div>
        </V4Reveal>
      </div>
    </section>
  );
}
