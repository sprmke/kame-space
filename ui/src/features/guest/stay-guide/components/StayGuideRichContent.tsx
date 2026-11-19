import { sanitizeRichTextHtml } from '@/lib/sanitizeHtml';

const STAY_GUIDE_RICH_TEXT_CLASS = 'stay-guide-rich-text';

const richTextStyles = `
  .${STAY_GUIDE_RICH_TEXT_CLASS} {
    color: hsl(var(--showcase-ink-muted, var(--muted-foreground)));
    overflow-wrap: break-word;
    word-break: break-word;
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} table {
    display: block;
    max-width: 100%;
    overflow-x: auto;
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} h1 {
    font-size: 1.5rem;
    line-height: 1.25;
    font-weight: 700;
    margin: 1.5rem 0 0.75rem;
    letter-spacing: -0.02em;
    color: hsl(var(--showcase-ink, var(--foreground)));
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} h2 {
    font-size: 1.25rem;
    line-height: 1.3;
    font-weight: 700;
    margin: 1.25rem 0 0.75rem;
    letter-spacing: -0.02em;
    color: hsl(var(--showcase-ink, var(--foreground)));
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} h3 {
    font-size: 1.125rem;
    line-height: 1.35;
    font-weight: 600;
    margin: 1.25rem 0 0.5rem;
    color: hsl(var(--showcase-ink, var(--foreground)));
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} h4 {
    font-size: 1rem;
    line-height: 1.4;
    font-weight: 600;
    margin: 1.25rem 0 0.4rem;
    color: hsl(var(--showcase-ink, var(--foreground)));
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} > :first-child {
    margin-top: 0;
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} > :last-child {
    margin-bottom: 0;
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} blockquote {
    margin: 1.25rem 0;
    padding: 0.25rem 0 0.25rem 1rem;
    border-left: 3px solid hsl(var(--showcase-accent, var(--primary)) / 0.55);
    font-style: italic;
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} blockquote p {
    margin: 0;
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} hr {
    margin: 1.5rem 0;
    border: 0;
    border-top: 1px solid hsl(var(--showcase-ink-muted, var(--muted-foreground)) / 0.25);
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} p {
    margin: 0 0 1rem;
    line-height: 1.75;
    color: hsl(var(--showcase-ink-muted, var(--muted-foreground)));
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} p + h3,
  .${STAY_GUIDE_RICH_TEXT_CLASS} ul + h3,
  .${STAY_GUIDE_RICH_TEXT_CLASS} ol + h3,
  .${STAY_GUIDE_RICH_TEXT_CLASS} blockquote + h3 {
    margin-top: 1.75rem;
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} ul,
  .${STAY_GUIDE_RICH_TEXT_CLASS} ol {
    margin: 0 0 1rem;
    padding-left: 1.35rem;
    color: hsl(var(--showcase-ink-muted, var(--muted-foreground)));
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} ul {
    list-style-type: disc;
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} ol {
    list-style-type: decimal;
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} li {
    display: list-item;
    margin: 0.4rem 0;
    line-height: 1.65;
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} li p {
    margin: 0;
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} ul ul {
    list-style-type: circle;
    margin: 0.25rem 0;
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} a {
    color: hsl(var(--showcase-accent, var(--primary)));
    text-decoration: underline;
    text-underline-offset: 3px;
    word-break: break-word;
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} img {
    display: block;
    max-width: 100%;
    height: auto;
    border-radius: 0.75rem;
    margin: 1rem 0;
  }

  .${STAY_GUIDE_RICH_TEXT_CLASS} strong {
    font-weight: 600;
    color: hsl(var(--showcase-ink, var(--foreground)));
  }
`;

interface StayGuideRichContentProps {
  html: string;
  className?: string;
}

export function StayGuideRichContent({ html, className }: StayGuideRichContentProps) {
  if (!html.trim()) return null;

  return (
    <>
      <style>{richTextStyles}</style>
      <div
        className={[STAY_GUIDE_RICH_TEXT_CLASS, className].filter(Boolean).join(' ')}
        dangerouslySetInnerHTML={{ __html: sanitizeRichTextHtml(html) }}
      />
    </>
  );
}
