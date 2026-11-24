import html
import pathlib

BASE = pathlib.Path('docs/workflow/in-progress/help-support-ux-review/screenshots')

# name -> (finding id, note)
NOTES = {
    'faqs-property-1920': ('F1', 'Module nav is navigation, not a KPI row: compact cards, no reserved trend row'),
    'faqs-property-1440': ('F1', 'Module nav no longer pushes the FAQ search below a tall card row'),
    'faqs-property-1280': ('F1', 'Same density at the 4-up breakpoint'),
    'faqs-property-1024': ('F1', 'FAQ content starts higher; tiles readable above the fold'),
    'faqs-property-768': ('F1', 'Tablet: compact 2x2 nav, all four FAQ topics visible without scrolling'),
    'faqs-property-430': ('F1', 'Phone width: compact nav'),
    'faqs-property-390': ('F1', 'Phone width: compact nav'),
    'faqs-property-360': ('F1', 'Smallest supported width: compact nav, no clipped labels'),
    'faqs-org-1440': ('F3', 'Org mount: singular counts read "1 question", not "1 questions"'),
    'faqs-parking-1440': ('F3', 'Parking mount: singular counts fixed'),
    'faq-category-property-1440': ('F3', 'Topic view: count meta fixed'),
    'faq-search-empty-1440': ('F4', 'No-match search now offers a New ticket escape hatch instead of a dead end'),
    'faqs-loading-1440': ('F5', 'Loading skeleton mirrors the search field and 2-up topic grid'),
    'guides-1440': ('—', 'Unchanged reference'),
    'guides-group-open-1440': ('—', 'Unchanged reference'),
    'faqs-error-1440': ('—', 'Unchanged reference'),
    'faqs-empty-1440': ('—', 'Unchanged reference'),
    'tickets-list-390': ('F7', 'Phone: module tiles stay, but the list no longer sits under the floating launcher'),
    'tickets-thread-390': ('F7', 'Phone ticket detail is full height: the conversation is visible above the reply box'),
    'tickets-thread-360': ('F7', '360: full-height thread, readable messages, composer clear of the tab bar'),
    'tickets-thread-1440': ('F7', 'Desktop thread (reference)'),
    'tickets-thread-org-1440': ('—', 'Org mount reference'),
    'tickets-thread-parking-1440': ('—', 'Parking mount reference'),
    'tickets-error-1440': ('F8', 'List failure is a single-pane error, no hollow "Pick a ticket" pane'),
    'tickets-empty-1440': ('F8', 'Empty list is single pane'),
    'tickets-empty-390': ('F7', 'Phone empty state'),
    'tickets-new-modal-1440': ('F9', 'Compose: submitting no longer bounces back to the list'),
    'tickets-new-modal-390': ('F9', 'Phone compose sheet (reference)'),
    'tickets-closed-1440': ('—', 'Closed ticket reference'),
    'tickets-resolved-1440': ('—', 'Resolved ticket reference'),
}

GROUPS = [
    ('FAQs', lambda n: n.startswith('faq')),
    ('Guides', lambda n: n.startswith('guides')),
    ('Tickets', lambda n: n.startswith('tickets')),
]


def group_for(name: str) -> str:
    for label, test in GROUPS:
        if test(name):
            return label
    return 'Other'


pairs = sorted((BASE / 'before').glob('*.png'))
assert pairs, 'no before captures'
rows = []
for before in pairs:
    after = BASE / 'after' / before.name
    if not after.exists():
        raise SystemExit(f'missing after capture for {before.name}')
    stem = before.stem
    finding, note = NOTES.get(stem, ('—', ''))
    rows.append(
        {
            'name': stem,
            'group': group_for(stem),
            'finding': finding,
            'note': note,
            'before': f'before/{before.name}',
            'after': f'after/{after.name}',
        }
    )

cards = []
for row in rows:
    cards.append(
        f"""
      <article class="card" data-group="{html.escape(row['group'])}" data-name="{html.escape(row['name'])}">
        <header>
          <div>
            <h2>{html.escape(row['name'])}</h2>
            <p>{html.escape(row['note'])}</p>
          </div>
          <span class="badge">{html.escape(row['finding'])}</span>
        </header>
        <div class="frame" data-state="after">
          <img class="shot before" src="{html.escape(row['before'])}" alt="Before: {html.escape(row['name'])}" loading="lazy" />
          <img class="shot after" src="{html.escape(row['after'])}" alt="After: {html.escape(row['name'])}" loading="lazy" />
          <span class="tag">After</span>
        </div>
        <div class="controls">
          <button type="button" class="toggle" aria-pressed="false">Show before</button>
          <a href="{html.escape(row['before'])}" target="_blank" rel="noreferrer">Before</a>
          <a href="{html.escape(row['after'])}" target="_blank" rel="noreferrer">After</a>
        </div>
      </article>"""
    )

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Help &amp; Support — before / after</title>
<style>
  :root {{ color-scheme: light; --teal:#0f766e; --ink:#0f172a; --muted:#64748b; --line:#e2e8f0; --bg:#f8fafc; }}
  * {{ box-sizing: border-box; }}
  body {{ margin:0; background:var(--bg); color:var(--ink); font:14px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }}
  .wrap {{ max-width: 1180px; margin: 0 auto; padding: 32px 20px 80px; }}
  h1 {{ font-size: 26px; margin: 0 0 6px; letter-spacing: -0.02em; }}
  .lede {{ color: var(--muted); margin: 0 0 20px; max-width: 78ch; }}
  .filters {{ display:flex; flex-wrap:wrap; gap:8px; margin: 0 0 24px; position: sticky; top:0; background:var(--bg); padding: 10px 0; z-index:2; border-bottom:1px solid var(--line); }}
  .filters button {{ border:1px solid var(--line); background:#fff; color:var(--ink); border-radius:999px; padding:6px 14px; cursor:pointer; font:inherit; }}
  .filters button[aria-pressed="true"] {{ background:var(--teal); border-color:var(--teal); color:#fff; }}
  .grid {{ display:flex; flex-direction:column; gap:26px; }}
  .card {{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:16px; }}
  .card header {{ display:flex; gap:16px; align-items:flex-start; justify-content:space-between; margin-bottom:12px; }}
  .card h2 {{ font-size:15px; margin:0; font-variant-numeric: tabular-nums; }}
  .card p {{ margin:4px 0 0; color:var(--muted); max-width:80ch; }}
  .badge {{ flex:none; border-radius:999px; background:#ccfbf1; color:#115e59; font-weight:600; font-size:12px; padding:3px 10px; }}
  .frame {{ position:relative; background:#fff; border:1px solid var(--line); border-radius:12px; overflow:hidden; }}
  .shot {{ display:block; width:100%; height:auto; }}
  .frame .before {{ display:none; }}
  .frame[data-state="before"] .before {{ display:block; }}
  .frame[data-state="before"] .after {{ display:none; }}
  .tag {{ position:absolute; top:10px; right:10px; background:rgba(15,23,42,.78); color:#fff; border-radius:6px; padding:2px 8px; font-size:11px; letter-spacing:.02em; }}
  .controls {{ display:flex; align-items:center; gap:14px; margin-top:10px; }}
  .toggle {{ font:inherit; padding:6px 12px; border-radius:8px; border:1px solid var(--line); background:#fff; cursor:pointer; }}
  .toggle:hover {{ border-color:var(--teal); color:var(--teal); }}
  .controls a {{ color:var(--teal); text-decoration:none; font-size:13px; }}
  .controls a:hover {{ text-decoration:underline; }}
  .hidden {{ display:none !important; }}
  .meta {{ color:var(--muted); font-size:12px; margin-top:40px; }}
</style>
</head>
<body>
<div class="wrap">
  <h1>Help &amp; Support — before / after</h1>
  <p class="lede">Property, parking and organization mounts, captured from the same fixtures at each supported width. Every card toggles between the mainline build and this change. Findings are numbered in <code>docs/workflow/in-progress/help-support-ux-review/README.md</code>.</p>
  <div class="filters" role="group" aria-label="Filter captures">
    <button type="button" data-filter="All" aria-pressed="true">All ({len(rows)})</button>
    <button type="button" data-filter="FAQs" aria-pressed="false">FAQs</button>
    <button type="button" data-filter="Guides" aria-pressed="false">Guides</button>
    <button type="button" data-filter="Tickets" aria-pressed="false">Tickets</button>
  </div>
  <div class="grid">{''.join(cards)}
  </div>
  <p class="meta">Captured with Playwright against a mocked Supabase, Asia/Manila, light theme. Toggle a card, or open the two images directly.</p>
</div>
<script>
  document.querySelectorAll('.card').forEach((card) => {{
    const frame = card.querySelector('.frame');
    const tag = card.querySelector('.tag');
    const button = card.querySelector('.toggle');
    button.addEventListener('click', () => {{
      const showBefore = frame.dataset.state !== 'before';
      frame.dataset.state = showBefore ? 'before' : 'after';
      tag.textContent = showBefore ? 'Before' : 'After';
      button.textContent = showBefore ? 'Show after' : 'Show before';
      button.setAttribute('aria-pressed', String(showBefore));
    }});
  }});
  const filters = document.querySelectorAll('.filters button');
  filters.forEach((button) => {{
    button.addEventListener('click', () => {{
      filters.forEach((other) => other.setAttribute('aria-pressed', String(other === button)));
      const filter = button.dataset.filter;
      document.querySelectorAll('.card').forEach((card) => {{
        const show = filter === 'All' || card.dataset.group === filter;
        card.classList.toggle('hidden', !show);
      }});
    }});
  }});
</script>
</body>
</html>
"""

(BASE / 'review.html').write_text(page)
print(f'wrote {BASE / "review.html"} with {len(rows)} pairs')
