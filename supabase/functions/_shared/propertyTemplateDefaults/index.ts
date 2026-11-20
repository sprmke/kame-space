/**
 * Template pack resolver.
 *
 * Every property resolves to the condo pack for now. `properties.type` is already available on
 * the row, so adding a house / villa / resort pack later is a resolver change plus a content
 * file, not a schema change.
 */

import {
  CONDO_TEMPLATE_DEFAULTS,
  condoTemplateDefault,
  type CondoTemplateDefault,
} from './condo.ts';

export type PropertyTemplatePackId = 'condo';

export const PROPERTY_TEMPLATE_PACK_IDS: readonly PropertyTemplatePackId[] = ['condo'];

/** Normalized pack id for a property row's `type`. Unknown types fall back to condo. */
export function resolveTemplatePack(_propertyType?: string | null): PropertyTemplatePackId {
  return 'condo';
}

export function resolveTemplatePackDefault(
  key: string,
  _propertyType?: string | null
): CondoTemplateDefault | undefined {
  return condoTemplateDefault(key);
}

export { CONDO_TEMPLATE_DEFAULTS, condoTemplateDefault };
export type { CondoTemplateDefault };
