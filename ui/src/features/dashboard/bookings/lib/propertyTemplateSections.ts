import { Car, ClipboardList, Home, LogIn, LogOut } from 'lucide-react';

import type { PropertyTemplateCategory } from '@/features/dashboard/bookings/hooks/usePropertyTemplates';

import type { LucideIcon } from 'lucide-react';

export type PropertyTemplateSectionMeta = {
  templateKey: string;
  label: string;
  icon: LucideIcon;
  category: PropertyTemplateCategory;
};

/**
 * Standard guide sections, kept static for the Stay Guide page editor, which maps chapters to
 * editable rich-text sections before the template list loads. The Templates rail reads the
 * server registry (`group` / `chapter`) instead.
 */
export const STANDARD_TEMPLATE_SECTIONS: PropertyTemplateSectionMeta[] = [
  { templateKey: 'house-rules', label: 'House rules', icon: Home, category: 'standard' },
  {
    templateKey: 'check-in-instructions',
    label: 'Check-in',
    icon: LogIn,
    category: 'standard',
  },
  {
    templateKey: 'check-out-instructions',
    label: 'Check-out',
    icon: LogOut,
    category: 'standard',
  },
  {
    templateKey: 'parking-reminders',
    label: 'Parking',
    icon: Car,
    category: 'standard',
  },
];

const ICONS_BY_KEY: Record<string, LucideIcon> = Object.fromEntries(
  STANDARD_TEMPLATE_SECTIONS.map((section) => [section.templateKey, section.icon])
);

export function iconForTemplateKey(templateKey: string): LucideIcon {
  return ICONS_BY_KEY[templateKey] ?? ClipboardList;
}
