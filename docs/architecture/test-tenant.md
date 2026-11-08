# Test tenant (production)

One synthetic organization exists in production so an AI agent or a human can measure,
verify and reproduce things against the real database, real edge latency and real caches,
without touching a host's data.

It is **intentional, not a bug**. It is referenced by `scripts/dev/test-tenant.mjs`,
`docs/architecture/test-tenant.md` and the always-on rule `.cursor/rules/test-tenant.mdc`.
Do not "clean it up".

| Field         | Value                                                                          |
| ------------- | ------------------------------------------------------------------------------ |
| Org slug      | `kame-test-tenant`                                                             |
| Org name      | `Kame Test Tenant (not public)`                                                |
| Property slug | `kame-test-property` (status `INACTIVE`, reason `pending_verification`)        |
| Parking slug  | `kame-test-parking` (status `INACTIVE`)                                        |
| Probe owner   | `ai-perf-probe@kamehomes.space` (password in `supabase/.env.management.local`) |

## Why it is invisible, and why that cannot drift

Every public surface already keys off a listing being `ACTIVE`:

- `stateHasPublicPage()` (`_shared/propertyLifecycleState.ts`) returns false for anything that
  is not `live` or `paused`, so `get-public-property` 404s.
- `public_listing_search` is a trigger-maintained index **of ACTIVE rows only**, so listing
  pages, search, facets and map results never see the test rows.
- `stateAcceptsNewBookings()` is true only for `live`, so no booking can be created against it.

The database enforces the invariant rather than a convention:

```sql
-- at most one test tenant, for every writer including service role
CREATE UNIQUE INDEX organizations_single_test_tenant
  ON public.organizations ((is_test)) WHERE is_test;

-- a test listing can never be public
ALTER TABLE public.properties ADD CONSTRAINT properties_test_never_active
  CHECK (NOT is_test OR status <> 'ACTIVE');
```

The child flags (`properties.is_test`, `parkings.is_test`) are **derived by trigger** from the
org, so a flagged property inside a real org is impossible, and so is an unflagged property
inside the test org. `organizations.is_test` is immutable after insert.

Verified on production data inside a rolled-back transaction (2026-11-08): migration applies,
a second test org is rejected by the unique index, a caller-supplied `is_test = false` on a
test-org property is overridden to `true`, `status = 'ACTIVE'` is rejected, retyping
`organizations.is_test` is rejected, and both `public_listing_search` and the public `ACTIVE`
predicate return zero rows for the test property.

## What it is for

- Production measurements: dashboard cold open, edge latency, cache behaviour, `Server-Timing`.
- RBAC and guard behaviour against real data shapes (owner, org admin, property member).
- Reproducing a report against the deployed build.

## What it is not for

- **Not a staging environment.** It is one org. It does not model a real host's volume.
- **Not for new bookings.** A non-live listing cannot accept them, by design. Widening that
  means allowing `ACTIVE`, which breaks the invisibility guarantee, so it needs its own
  reviewed decision rather than a status update.
- **Not for writing to real tenants.** The probe account is scoped to the test org; never use
  it to mutate a real host's rows.

## Operating it

```bash
# read-only audit, safe any time
node scripts/dev/test-tenant.mjs

# create, once, after the migration is deployed
CONFIRM_TEST_TENANT=yes node scripts/dev/test-tenant.mjs --apply
```

The script:

- refuses to run `--apply` without `CONFIRM_TEST_TENANT=yes`;
- refuses if a **different** `is_test` org already exists;
- only ever writes rows belonging to the test org;
- is idempotent (`ON CONFLICT` on the slugs).

## Guardrails against a second one

| Layer                                           | What it stops                                                                             |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `organizations_single_test_tenant` unique index | A second `is_test` org, from any writer, including a service-role script or dashboard SQL |
| `sync_test_tenant_flag` trigger                 | Flagging a property or parking outside the test org, or forgetting the flag inside it     |
| `organizations_test_flag_immutable` trigger     | Retyping the flag and desynchronising children                                            |
| `--apply` confirmation env var                  | Accidental creation from a copied command                                                 |
| `test-tenant.mjs` foreign-org refusal           | Creating a second tenant under a different slug                                           |
| This doc + `.cursor/rules/test-tenant.mdc`      | A future agent deciding to "add another test org"                                         |

If a real need for a second tenant appears, the answer is **not** a second row. Change the
design: either widen this one deliberately (documented, with a decision) or use the local
seed dataset (`docs/guides/testing/local-seed-data.md`).

## Related

- `.cursor/rules/test-tenant.mdc` (always-on agent rule)
- `docs/guides/testing/local-seed-data.md` (the local equivalent, preferred for anything that
  does not specifically need production)
- `docs/workflow/in-progress/app-speed-root-cause-overhaul.md` (why it was created)
