#!/usr/bin/env python3
"""
Build the Property Templates before/after UI review.

    python3 scripts/dev/build-templates-ux-review.py

Reads:
  docs/workflow/in-progress/templates-ux-review/screenshots/before
  docs/workflow/in-progress/templates-ux-review/screenshots/after

Writes:
  .../screenshots/compare/<name>.png   side-by-side pair with BEFORE / AFTER bars
  .../screenshots/review.html          one section per screen, with captions
"""

from __future__ import annotations

import html
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path("docs/workflow/in-progress/templates-ux-review")
BEFORE = ROOT / "screenshots/before"
AFTER = ROOT / "screenshots/after"
OUT = ROOT / "screenshots/compare"
INDEX = ROOT / "screenshots/review.html"

BAR_H = 40
GAP = 24
BG = (247, 248, 250)
BAR_BEFORE = (120, 32, 32)
BAR_AFTER = (17, 94, 89)
INK = (24, 28, 33)

CAPTIONS: dict[str, str] = {
    "01-desktop-default": "Subtitle now names the whole surface (guide, messages, emails, alerts).",
    "03-desktop-rail-row-menu": "Row menu is now 'Template actions for …' so it never collides with a group of the same name.",
    "04-desktop-rail-group-menu": "Group menu is now 'Group actions for …' for screen readers and voice control.",
    "18-desktop-new-template-dialog": "New template defaults to Custom instead of landing inside Stay guide.",
    "23-desktop-move-dialog": "Custom is offered as a destination again, even when folders exist.",
    "26-desktop-send-to-guest": "The picker shows the guest email under the name and announces the selected row.",
    "30-phone-list": "The list clears the floating Quick Access hub at the end of the scroll.",
    "34-phone-editor": "Back moved onto the title row and the description is hidden on phone, so the editor starts higher.",
    "41-free-upgrade-modal": "One Starter pill anchors the action group instead of two pills floating above the header.",
    "43-readonly-desktop": "Read-only members get a Preview-only tab; there is no editable body to type into.",
    "51-empty-desktop": "An empty library is an empty state, not a failed load with a Reload button.",
    "52-error-desktop": "The load failure is centered in the content area instead of sitting in a full-width empty card.",
}


def load_font(size: int):
    try:
        return ImageFont.load_default(size=size)
    except TypeError:
        return ImageFont.load_default()


def bar(width: int, label: str, color: tuple[int, int, int]) -> Image.Image:
    image = Image.new("RGB", (width, BAR_H), color)
    draw = ImageDraw.Draw(image)
    font = load_font(18)
    bbox = draw.textbbox((0, 0), label, font=font)
    draw.text(
        ((width - (bbox[2] - bbox[0])) / 2, (BAR_H - (bbox[3] - bbox[1])) / 2 - 2),
        label,
        fill=(255, 255, 255),
        font=font,
    )
    return image


def pair(name: str) -> Path:
    before = Image.open(BEFORE / f"{name}.png").convert("RGB")
    after = Image.open(AFTER / f"{name}.png").convert("RGB")
    height = max(before.height, after.height)
    width = before.width + GAP + after.width
    canvas = Image.new("RGB", (width, height + BAR_H), BG)
    canvas.paste(bar(before.width, "BEFORE", BAR_BEFORE), (0, 0))
    canvas.paste(bar(after.width, "AFTER", BAR_AFTER), (before.width + GAP, 0))
    canvas.paste(before, (0, BAR_H))
    canvas.paste(after, (before.width + GAP, BAR_H))
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / f"{name}.png"
    canvas.save(target)
    return target


def main() -> None:
    names = sorted(
        {path.stem for path in BEFORE.glob("*.png")} & {path.stem for path in AFTER.glob("*.png")}
    )
    if not names:
        raise SystemExit("No matching screenshots. Run the capture pass for before and after first.")

    written = [pair(name) for name in names]

    sections = []
    for name, path in zip(names, written):
        caption = CAPTIONS.get(name, "Unchanged in this pass.")
        sections.append(
            "<section>"
            f"<h2>{html.escape(name.replace('-', ' '))}</h2>"
            f"<p>{html.escape(caption)}</p>"
            f'<img src="compare/{path.name}" alt="{html.escape(name)} before and after" loading="lazy" />'
            "</section>"
        )

    INDEX.write_text(
        "<!doctype html><html><head><meta charset='utf-8' />"
        "<meta name='viewport' content='width=device-width, initial-scale=1' />"
        "<title>Property Templates UI review</title>"
        "<style>"
        "body{margin:0;background:#f7f8fa;color:#181c21;font-family:system-ui,-apple-system,'Segoe UI',sans-serif}"
        "header{padding:32px 24px;background:#115e59;color:#fff}"
        "h1{margin:0 0 6px;font-size:24px}p{margin:0;font-size:14px;line-height:1.5}"
        "main{max-width:1500px;margin:0 auto;padding:24px}"
        "section{background:#fff;border:1px solid #e5e7eb;border-radius:12px;padding:16px;margin:0 0 20px}"
        "h2{margin:0 0 4px;font-size:15px;text-transform:capitalize}"
        "section p{margin:0 0 12px;color:#4b5563}"
        "img{display:block;width:100%;height:auto;border-radius:8px}"
        "</style></head><body>"
        "<header><h1>Property Templates · UI review</h1>"
        f"<p>{len(names)} screens, captured at every supported width and state. Left is the branch base (main), right is this change.</p>"
        "</header><main>" + "".join(sections) + "</main></body></html>",
        encoding="utf-8",
    )
    print(json.dumps({"pairs": len(names), "index": str(INDEX)}, indent=2))


if __name__ == "__main__":
    main()
