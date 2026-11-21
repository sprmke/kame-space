/**
 * list-host-playbook-articles-admin — GET all Improvement Playbook articles, active or not
 * (super admin editor). Host Analytics module Phase 4 CRUD.
 * Plan: docs/workflow/in-progress/host-analytics-module.md
 */

import { createServiceClient } from '../_shared/orgAuth.ts';
import { jsonSuccess, requireHttpMethod, parsePageLimit } from '../_shared/httpResponse.ts';
import { serveSuperAdmin } from '../_shared/serveEdge.ts';

serveSuperAdmin('list-host-playbook-articles-admin', async (req) => {
  requireHttpMethod(req, 'GET');

  const url = new URL(req.url);
  const p = url.searchParams;
  const { page, limit } = parsePageLimit(p);
  const search = p.get('q')?.trim() ?? '';
  const status = p.get('status')?.trim() ?? 'all';

  const supabase = createServiceClient();
  const fromIdx = (page - 1) * limit;
  const toIdx = fromIdx + limit - 1;

  let query = supabase.from('host_playbook_articles').select('*', { count: 'exact' });
  if (search) {
    const pattern = `%${search.replace(/[%,()]/g, ' ')}%`;
    query = query.or(`title.ilike.${pattern},body.ilike.${pattern},category.ilike.${pattern}`);
  }
  if (status === 'published') query = query.eq('is_active', true);
  if (status === 'unpublished') query = query.eq('is_active', false);

  const { data, error, count } = await query
    .order('category', { ascending: true })
    .order('sort_order', { ascending: true })
    .range(fromIdx, toIdx);

  if (error) throw new Error(error.message);

  return jsonSuccess(req, { articles: data ?? [], total: count ?? 0, page, limit });
});
