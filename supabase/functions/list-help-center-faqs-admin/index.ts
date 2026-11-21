/**
 * list-help-center-faqs-admin — GET all FAQ items, published or not (super admin editor).
 * Docs: docs/workflow/for-testing/help-support-center.md, Module 4.
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonSuccess, requireHttpMethod, parsePageLimit } from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';

serveSuperAdmin('list-help-center-faqs-admin', async (req) => {
  requireHttpMethod(req, 'GET');

  const url = new URL(req.url);
  const p = url.searchParams;
  const { page, limit } = parsePageLimit(p);
  const search = p.get('q')?.trim() ?? '';
  const status = p.get('status')?.trim() ?? 'all';

  const supabase = createServiceClient();
  const fromIdx = (page - 1) * limit;
  const toIdx = fromIdx + limit - 1;

  let query = supabase.from('help_center_faqs').select('*', { count: 'exact' });
  if (search) {
    const pattern = `%${search.replace(/[%,()]/g, ' ')}%`;
    query = query.or(`question.ilike.${pattern},answer.ilike.${pattern},category.ilike.${pattern}`);
  }
  if (status === 'published') query = query.eq('is_published', true);
  if (status === 'unpublished') query = query.eq('is_published', false);

  const { data, error, count } = await query
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .range(fromIdx, toIdx);

  if (error) throw new Error(error.message);

  return jsonSuccess(req, { faqs: data ?? [], total: count ?? 0, page, limit });
});
