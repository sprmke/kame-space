-- Property templates v2: editable subjects, default hash for "new default available", and the
-- `message` category for host-sent guest messages.

ALTER TABLE public.property_template_contents
  ADD COLUMN IF NOT EXISTS subject TEXT,
  ADD COLUMN IF NOT EXISTS default_hash TEXT;

COMMENT ON COLUMN public.property_template_contents.subject IS
  'Host-edited email subject. NULL falls through to the shipped default. GAF and pet subjects ignore this because inbound approval parses them.';
COMMENT ON COLUMN public.property_template_contents.default_hash IS
  'Hash of the shipped default at save time. Differs from the current default means a new default is available.';

ALTER TABLE public.property_template_contents
  DROP CONSTRAINT IF EXISTS property_template_contents_category_check;

ALTER TABLE public.property_template_contents
  ADD CONSTRAINT property_template_contents_category_check
  CHECK (category IN ('standard', 'email', 'custom', 'message'));

COMMENT ON COLUMN public.property_template_contents.category IS
  'Behaviour: standard = guide section, email = automated workflow email, message = host-sent guest message, custom = host-owned template.';

-- Host-owned emails were never wired to the workflow. They become messages, which can be sent
-- in chat or by email on demand.
UPDATE public.property_template_contents
SET category = 'message', updated_at = now()
WHERE template_key LIKE 'custom-%' AND category = 'email';
