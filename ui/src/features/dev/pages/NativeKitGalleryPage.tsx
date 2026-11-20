import { useState } from 'react';

import { BedDouble, CalendarDays, Inbox, Users, Wrench } from 'lucide-react';

import { ActionRowCard } from '@/components/mobile/native/ActionRowCard';
import { AppBar } from '@/components/mobile/native/AppBar';
import { CheckRow } from '@/components/mobile/native/CheckRow';
import { ContentSheet } from '@/components/mobile/native/ContentSheet';
import { DisclosureSection } from '@/components/mobile/native/DisclosureSection';
import { DrillRow } from '@/components/mobile/native/DrillRow';
import { EmptyState } from '@/components/mobile/native/EmptyState';
import { FactStrip } from '@/components/mobile/native/FactStrip';
import { FilterChips } from '@/components/mobile/native/FilterChips';
import { IconTile } from '@/components/mobile/native/IconTile';
import { ListRow } from '@/components/mobile/native/ListRow';
import { ListSection } from '@/components/mobile/native/ListSection';
import { MetricStrip } from '@/components/mobile/native/MetricStrip';
import { NativeAvatar } from '@/components/mobile/native/NativeAvatar';
import { NextActionCard } from '@/components/mobile/native/NextActionCard';
import { PILL_TONES } from '@/components/mobile/native/pillTone';
import { SearchField } from '@/components/mobile/native/SearchField';
import { SegmentedTabs } from '@/components/mobile/native/SegmentedTabs';
import { StatusPill } from '@/components/mobile/native/StatusPill';
import { SummaryStrip } from '@/components/mobile/native/SummaryStrip';
import { SwipeableRow } from '@/components/mobile/native/SwipeableRow';
import { TodaySummaryCard } from '@/components/mobile/native/TodaySummaryCard';
import { ToggleRow } from '@/components/mobile/native/ToggleRow';
import { usePageTitle } from '@/lib/pageTitle';

/**
 * Dev-only gallery for the v3 native kit (`/dev/native-kit`).
 * Excluded from production builds via `import.meta.env.DEV` at the route.
 */
export function NativeKitGalleryPage() {
  usePageTitle('Native kit');
  const [search, setSearch] = useState('');
  const [segment, setSegment] = useState('cards');
  const [chip, setChip] = useState('all');
  const [toggleOn, setToggleOn] = useState(true);
  const [checkOn, setCheckOn] = useState(false);
  const [barVariant, setBarVariant] = useState<'root' | 'detail' | 'flow'>('root');

  return (
    <div className="bg-canvas min-h-dvh lg:mx-auto lg:max-w-xl">
      {barVariant === 'root' ? (
        <AppBar
          variant="root"
          title="Bookings"
          scope={{ name: 'Solea Mactan', parentLine: 'Sample Stays PH' }}
          actionLabel="Add booking"
          onAction={() => undefined}
          onAskKame={() => undefined}
          askKameLabelled
          onMore={() => undefined}
        />
      ) : null}
      {barVariant === 'detail' ? (
        <AppBar
          variant="detail"
          title="Maria Torres"
          onBack={() => setBarVariant('root')}
          status={{ tone: 'attention', label: 'Arriving' }}
        />
      ) : null}
      {barVariant === 'flow' ? (
        <AppBar
          variant="flow"
          title="Parking request"
          onClose={() => setBarVariant('root')}
          step={2}
          total={3}
          stepLabel="Vehicle"
        />
      ) : null}

      <ContentSheet className="space-y-6">
        <section className="space-y-2">
          <h2 className="text-native-section">App bar</h2>
          <SegmentedTabs
            items={[
              { key: 'root', label: 'Root' },
              { key: 'detail', label: 'Detail' },
              { key: 'flow', label: 'Flow' },
            ]}
            value={barVariant}
            onChange={(key) => setBarVariant(key as typeof barVariant)}
          />
        </section>

        <section className="space-y-2">
          <h2 className="text-native-section">Summary</h2>
          <TodaySummaryCard
            mascotPose="dashboard-overview"
            stats={[
              { label: 'Arrivals', value: 3 },
              { label: 'Checkouts', value: 2 },
              { label: 'Unread', value: 5 },
              { label: 'Due', value: 1 },
            ]}
          />
          <SummaryStrip
            segments={[
              { count: 3, label: 'action required', filterKey: 'action' },
              { count: 2, label: 'pending docs', filterKey: 'docs' },
              { count: 26, label: 'confirmed', filterKey: 'ok' },
            ]}
            onSelect={() => undefined}
          />
          <MetricStrip
            metrics={[
              { label: 'Revenue', value: '₱48k', delta: '+12%', deltaPositive: true },
              { label: 'Occupancy', value: '76%', delta: '-2%', deltaPositive: false },
              { label: 'ADR', value: '₱4.2k' },
            ]}
          />
        </section>

        <section className="space-y-2">
          <h2 className="text-native-section">Toolbar</h2>
          <SearchField value={search} onChange={setSearch} placeholder="Search bookings" />
          <SegmentedTabs
            items={[
              { key: 'cards', label: 'Cards', count: 12 },
              { key: 'calendar', label: 'Calendar' },
            ]}
            value={segment}
            onChange={setSegment}
          />
          <FilterChips
            items={[
              { key: 'all', label: 'All' },
              { key: 'today', label: 'Today' },
              { key: 'action', label: 'Action required' },
            ]}
            value={chip}
            onChange={(v) => setChip(typeof v === 'string' ? v : (v[0] ?? 'all'))}
          />
        </section>

        <section className="space-y-2">
          <h2 className="text-native-section">Pills</h2>
          <div className="flex flex-wrap gap-2">
            {PILL_TONES.map((tone) => (
              <StatusPill key={tone} tone={tone}>
                {tone}
              </StatusPill>
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h2 className="text-native-section">Rows</h2>
          <ActionRowCard
            lead={<NativeAvatar name="Maria Torres" />}
            title="Maria Torres"
            meta="Nov 19 to 22 · A-201"
            actionLabel="Check in"
            onAction={() => undefined}
            onClick={() => undefined}
          />
          <ListSection title="Needs attention">
            <ListRow
              lead={<IconTile icon={Inbox} />}
              title="Guest message"
              meta="Asking about early check-in"
              trailing={<StatusPill tone="attention">New</StatusPill>}
              chevron
              onClick={() => undefined}
            />
            <ListRow
              lead={<IconTile icon={Wrench} />}
              title="AC filter"
              meta="Due today"
              trailing={<StatusPill tone="critical">Overdue</StatusPill>}
              chevron
              onClick={() => undefined}
            />
          </ListSection>
          <div className="border-hairline bg-card rounded-native-row overflow-hidden border">
            <DrillRow title="Email automation" value="3 active flows" onClick={() => undefined} />
            <ToggleRow
              title="Push alerts"
              description="This device"
              checked={toggleOn}
              onCheckedChange={setToggleOn}
            />
            <ToggleRow
              title="Smart Pricing"
              description="Plan locked"
              checked={false}
              onCheckedChange={() => undefined}
              locked
            />
            <CheckRow
              title="Replace AC filter"
              meta="Due today"
              checked={checkOn}
              onToggle={() => setCheckOn((v) => !v)}
            />
          </div>
          <SwipeableRow
            leading={{ key: 'done', label: 'Done', onClick: () => undefined }}
            trailing={{
              key: 'delete',
              label: 'Delete',
              tone: 'destructive',
              onClick: () => undefined,
            }}
          >
            <ListRow title="Swipe row" meta="Leading Done · trailing Delete" />
          </SwipeableRow>
        </section>

        <section className="space-y-3">
          <h2 className="text-native-section">Detail</h2>
          <FactStrip
            facts={[
              { icon: CalendarDays, label: 'Nov 19 to 22' },
              { icon: Users, label: '2 guests' },
              { icon: BedDouble, label: 'A-201' },
            ]}
          />
          <NextActionCard
            title="Guest is ready to check in"
            context="Valid ID and payment on file"
            actionLabel="Check in"
            onAction={() => undefined}
          />
          <div className="border-hairline bg-card rounded-native-row overflow-hidden border">
            <DisclosureSection icon={Users} title="Guest and contact" preview="Maria Torres">
              <p className="text-native-body text-muted-foreground">maria@example.com</p>
            </DisclosureSection>
            <DisclosureSection title="Payments" preview="₱12,000 paid" defaultOpen>
              <p className="text-native-body text-muted-foreground">Down payment received</p>
            </DisclosureSection>
          </div>
        </section>

        <section>
          <h2 className="text-native-section mb-2">Empty</h2>
          <EmptyState
            mascotPose="guest-inbox"
            title="No messages yet"
            actionLabel="New message"
            onAction={() => undefined}
          />
        </section>

        <p className="text-native-meta text-center">
          Dev gallery · light and dark via theme toggle
        </p>
      </ContentSheet>
    </div>
  );
}
