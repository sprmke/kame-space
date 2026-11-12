-- Multi-residence Phase 0: preserve today's behavior before the generic default changes.
--
-- `mergeDocumentRequirements(undefined)` currently returns Azure's GAF + pet steps, so every
-- development without an explicit list inherits them. Phase 0 changes that default to an
-- empty list so a NEW residence starts with no building approvals.
--
-- To keep today's behavior byte-identical for residences that already exist, copy the
-- current default list into every development row that has no explicit list. New rows
-- created after this migration get the empty default.
--
-- Idempotent: only rows where the key is absent are touched.

UPDATE public.developments
SET settings = jsonb_set(
  -- `||` guarantees the parent object exists: jsonb_set does not create
  -- intermediate objects for a multi-level path.
  COALESCE(settings, '{}'::jsonb)
    || jsonb_build_object('workflowDefaults', COALESCE(settings -> 'workflowDefaults', '{}'::jsonb)),
  '{workflowDefaults,documentRequirements}',
  '[
    {
      "id": "gaf",
      "label": "GAF Request",
      "order": 1,
      "pdfTemplateId": "gaf",
      "approvalSource": "email-listener",
      "triggerCondition": "always",
      "calendarIcon": null
    },
    {
      "id": "pet",
      "label": "Pet Approval",
      "order": 2,
      "pdfTemplateId": "pet",
      "approvalSource": "email-listener",
      "triggerCondition": "has_pets",
      "calendarIcon": "🐶"
    }
  ]'::jsonb,
  true
)
WHERE settings #> '{workflowDefaults,documentRequirements}' IS NULL;
