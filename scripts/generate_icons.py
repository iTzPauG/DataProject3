"""One-time icon generation script for GADO.

Reads category, subcategory, and mood metadata from the recommendation flow
and generates static PNG icons under `main/frontend/assets/icons/`.

This is intentionally an offline utility. The app never calls image generation
at runtime.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import time
from pathlib import Path

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from google import genai
from google.genai import types

ROOT = Path(__file__).resolve().parents[1]
BACKEND_DIR = ROOT / "main" / "backend"
if str(BACKEND_DIR) not in sys.path:
    sys.path.append(str(BACKEND_DIR))

from config import GEMINI_API_KEY, GOOGLE_GENAI_API_KEY  # noqa: E402
from services.recommendation.category_flow import FLOW_DEFINITIONS  # noqa: E402
from icon_prompt_agent import IconJob, IconPromptAgent, PROMPT_AGENT_MODEL  # noqa: E402

OUT_DIR = ROOT / "main" / "frontend" / "assets" / "icons"
DEFAULT_IMAGE_MODEL = os.getenv("ICON_IMAGE_MODEL", "nano banana 2 pro")


def slugify(value: str) -> str:
    value = value.strip().lower()
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-") or "icon"


def iter_icon_jobs() -> list[tuple[IconJob, str]]:
    jobs: list[tuple[IconJob, str]] = []
    seen: set[tuple[str, str]] = set()

    for category_id, definition in FLOW_DEFINITIONS.items():
        category_label = definition.get("label", category_id)
        default_key = (category_id, "default")
        if default_key not in seen:
            seen.add(default_key)
            jobs.append(
                (
                    IconJob(
                        category=category_id,
                        category_label=category_label,
                        item_type="default",
                        item_id="default",
                        label=category_label,
                    ),
                    "default",
                )
            )

        for subcat in definition.get("subcategories", []):
            key = (category_id, subcat["id"])
            if key in seen:
                continue
            seen.add(key)
            jobs.append(
                (
                    IconJob(
                        category=category_id,
                        category_label=category_label,
                        item_type="subcategory",
                        item_id=subcat["id"],
                        label=subcat.get("label", subcat["id"]),
                        emoji=subcat.get("emoji", ""),
                    ),
                    subcat["id"],
                )
            )

        for mood in definition.get("moods", []):
            key = (category_id, mood["id"])
            if key in seen:
                continue
            seen.add(key)
            jobs.append(
                (
                    IconJob(
                        category=category_id,
                        category_label=category_label,
                        item_type="mood",
                        item_id=mood["id"],
                        label=mood.get("label", mood["id"]),
                        emoji=mood.get("emoji", ""),
                    ),
                    mood["id"],
                )
            )
    return jobs


def write_index(entries: list[tuple[str, str]]) -> None:
    lines = [
        "export const iconIndex: Record<string, number> = {",
    ]
    for category, name in sorted(entries):
        asset_path = f"./{category}/{name}.png"
        lines.append(f'  "{category}:{name}": require("{asset_path}"),')
    lines.append("};")
    (OUT_DIR / "index.ts").write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_client(required: bool) -> genai.Client | None:
    api_key = GOOGLE_GENAI_API_KEY or GEMINI_API_KEY
    if not api_key:
        if required:
            raise RuntimeError("GOOGLE_GENAI_API_KEY (or GEMINI_API_KEY) is required.")
        return None
    return genai.Client(api_key=api_key)


def print_prompt_preview(index: int, total: int, job: IconJob, output_name: str, prompt_plan: dict) -> None:
    print(f"[{index}/{total}] {job.id} -> {output_name}.png")
    print(f"  subject: {prompt_plan['primary_subject']}")
    print(f"  prompt: {prompt_plan['render_prompt']}")
    print("  plan-json:")
    print(json.dumps(prompt_plan, ensure_ascii=False, indent=2))
    print("-" * 80)


def generate_icons(
    limit: int | None,
    delay_s: float,
    force: bool,
    dry_run_prompts: bool,
    no_prompt_agent: bool,
    prompt_model: str,
    image_model: str,
    refresh_prompts: bool,
) -> None:
    needs_client = (not dry_run_prompts) or (not no_prompt_agent)
    client = build_client(required=needs_client)
    prompt_agent = IconPromptAgent(
        client=client,
        model=prompt_model,
        use_llm=not no_prompt_agent,
    )

    jobs = iter_icon_jobs()
    if limit is not None:
        jobs = jobs[:limit]

    generated_entries: list[tuple[str, str]] = []
    for index, (job, output_name) in enumerate(jobs, start=1):
        prompt_plan = prompt_agent.plan(job, refresh=refresh_prompts)
        asset_name = slugify(output_name)

        if dry_run_prompts:
            print_prompt_preview(index, len(jobs), job, asset_name, prompt_plan.to_dict())
            continue

        category_dir = OUT_DIR / job.category
        category_dir.mkdir(parents=True, exist_ok=True)
        output_file = category_dir / f"{asset_name}.png"

        if output_file.exists() and not force:
            print(f"[skip] {job.id} -> {output_file}")
            generated_entries.append((job.category, asset_name))
            continue

        print(f"[{index}/{len(jobs)}] generating {job.id}")
        response = client.models.generate_images(
            model=image_model,
            prompt=prompt_plan.render_prompt,
            config=types.GenerateImagesConfig(
                number_of_images=1,
                aspect_ratio="1:1",
                output_mime_type="image/png",
            ),
        )

        image_bytes = response.generated_images[0].image.image_bytes
        output_file.write_bytes(image_bytes)
        generated_entries.append((job.category, asset_name))
        time.sleep(delay_s)

    if dry_run_prompts:
        print(f"Previewed {len(jobs)} icon prompt plans")
        return

    write_index(generated_entries)
    print(f"Wrote {len(generated_entries)} icon references to {OUT_DIR / 'index.ts'}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=None, help="Only generate the first N icons.")
    parser.add_argument("--delay", type=float, default=0.5, help="Delay between API calls in seconds.")
    parser.add_argument("--force", action="store_true", help="Overwrite existing PNG files.")
    parser.add_argument("--dry-run-prompts", action="store_true", help="Print prompt plans without generating PNG files.")
    parser.add_argument("--no-prompt-agent", action="store_true", help="Disable the text-model planner and use deterministic fallback prompts.")
    parser.add_argument("--prompt-model", default=PROMPT_AGENT_MODEL, help="Text model used by the icon prompt agent.")
    parser.add_argument(
        "--image-model",
        default=DEFAULT_IMAGE_MODEL,
        help="Image generation model (e.g., 'nano banana 2 pro' or 'imagen-4.0-generate-001').",
    )
    parser.add_argument("--refresh-prompts", action="store_true", help="Ignore cached prompt plans and rebuild them.")
    args = parser.parse_args()
    generate_icons(
        limit=args.limit,
        delay_s=args.delay,
        force=args.force,
        dry_run_prompts=args.dry_run_prompts,
        no_prompt_agent=args.no_prompt_agent,
        prompt_model=args.prompt_model,
        image_model=args.image_model,
        refresh_prompts=args.refresh_prompts,
    )


if __name__ == "__main__":
    main()


