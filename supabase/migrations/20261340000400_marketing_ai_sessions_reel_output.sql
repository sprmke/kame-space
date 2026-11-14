-- AI Studio gets a fourth output, "reel" (plan: docs/workflow/planned/
-- marketing-ai-studio-quality-and-flow-overhaul.md, item 8.1).
--
-- A reel conversation stores its versions in marketing_ai_post_versions: spec holds the
-- director's direction (recipe, photo order, short lines) and format is instagram-story.
-- Only the allowed session outputs change; the list RPC already filters by any output.

ALTER TABLE public.marketing_ai_sessions
  DROP CONSTRAINT IF EXISTS marketing_ai_sessions_output_check;
ALTER TABLE public.marketing_ai_sessions
  ADD CONSTRAINT marketing_ai_sessions_output_check
  CHECK (output IN ('post', 'image', 'video', 'reel'));
