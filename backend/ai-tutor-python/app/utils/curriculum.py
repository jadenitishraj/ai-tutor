"""
Curriculum helpers – direct Python port of the JS utility functions
used in both curriculum/route.js and refine-curriculum/route.js.
"""

import json
import re
from typing import Optional


# ── regex helpers ─────────────────────────────────────────────────────────────

_PLACEHOLDER_RE = re.compile(r"key concepts|generic|tbd", re.IGNORECASE)
_CHAPTER_PREFIX_RE = re.compile(r"^Chapter\s+\d+\s*:", re.IGNORECASE)
_CHAPTER_LINE_RE = re.compile(r"Chapter\s+\d+\s*:[^\n]+", re.IGNORECASE)
_QUOTED_RE = re.compile(r"[\"']([^\"']+)[\"']")
_OBJECT_RE = re.compile(r"\{[\s\S]*\}")
_ARRAY_RE = re.compile(r"\[[\s\S]*\]")
_BLOB_CHAPTER_RE = re.compile(r"Chapter\s+\d+\s*:[^\n'\",\]]+", re.IGNORECASE)
_WHITESPACE_RE = re.compile(r"\s+")
_ALPHA_RE = re.compile(r"[A-Za-z]")


def normalize_curriculum(raw, expected_count: int) -> list[str]:
    items: list = []

    if isinstance(raw, list):
        items = raw
    elif isinstance(raw, dict) and isinstance(raw.get("curriculum"), list):
        items = raw["curriculum"]

    cleaned = [item.strip() for item in items if isinstance(item, str) and item.strip()]
    return cleaned[:expected_count] if cleaned else []


def extract_curriculum_from_text(text: str, expected_count: int) -> list[str]:
    clean = re.sub(r"```json|```", "", text or "").strip()

    # 1. Try full JSON parse
    try:
        result = normalize_curriculum(json.loads(clean), expected_count)
        if result:
            return result
    except Exception:
        pass

    # 2. Object-like match  { … }
    m = _OBJECT_RE.search(clean)
    if m:
        try:
            result = normalize_curriculum(json.loads(m.group()), expected_count)
            if result:
                return result
        except Exception:
            pass

    # 3. Array-like match  [ … ]
    m = _ARRAY_RE.search(clean)
    if m:
        try:
            result = normalize_curriculum(json.loads(m.group()), expected_count)
            if result:
                return result
        except Exception:
            pass

    # 4. Quoted titles
    quoted = [m.group(1).strip() for m in _QUOTED_RE.finditer(clean) if m.group(1).strip()]
    if quoted:
        return quoted[:expected_count]

    # 5. "Chapter N: …" lines
    chapter_lines = [line.strip() for line in _CHAPTER_LINE_RE.findall(clean)]
    if chapter_lines:
        return chapter_lines[:expected_count]

    return []


def is_placeholder_title(value: str) -> bool:
    return bool(_PLACEHOLDER_RE.search(value or ""))


def build_topic_fallback(topic: str, expected_count: int) -> list[str]:
    safe = (topic or "the topic").strip()
    templates = [
        f"Chapter 1: What Is {safe}?",
        f"Chapter 2: Core Foundations of {safe}",
        f"Chapter 3: Building Blocks of {safe}",
        f"Chapter 4: Practical Use Cases in {safe}",
        f"Chapter 5: Common Mistakes in {safe}",
        f"Chapter 6: Best Practices for {safe}",
        f"Chapter 7: Advanced Patterns in {safe}",
        f"Chapter 8: Real-World Projects in {safe}",
        f"Chapter 9: Troubleshooting {safe}",
        f"Chapter 10: Mastering {safe}",
        f"Chapter 11: Expert Workflows for {safe}",
        f"Chapter 12: Scaling with {safe}",
        f"Chapter 13: Optimization in {safe}",
        f"Chapter 14: Case Studies on {safe}",
        f"Chapter 15: Next Steps in {safe}",
    ]
    return templates[:expected_count]


def sanitize_curriculum_for_save(
    curriculum: list,
    expected_count: int,
    topic: Optional[str] = None,
) -> list[str]:
    # Flatten
    items: list[str] = []
    for item in curriculum:
        if isinstance(item, list):
            items.extend(item)
        else:
            items.append(item)

    # Blob detection: single string containing chapter titles
    if (
        len(items) == 1
        and isinstance(items[0], str)
        and re.search(r"curriculum|Chapter\s+\d+", items[0], re.IGNORECASE)
    ):
        blob_chapters = _BLOB_CHAPTER_RE.findall(items[0])
        if blob_chapters:
            items = blob_chapters

    cleaned: list[str] = []
    for idx, item in enumerate(items):
        if not isinstance(item, str):
            continue
        item = _WHITESPACE_RE.sub(" ", item).strip()
        if not item or len(item) >= 180:
            continue
        if not _ALPHA_RE.search(item):
            continue
        if is_placeholder_title(item):
            continue
        # Ensure "Chapter N:" prefix
        if not _CHAPTER_PREFIX_RE.match(item):
            item = f"Chapter {idx + 1}: {item}"
        cleaned.append(item)
        if len(cleaned) == expected_count:
            break

    if not cleaned:
        return []

    if topic and len(cleaned) < expected_count:
        fallback = build_topic_fallback(topic, expected_count)
        merged = cleaned + fallback[len(cleaned):]
        return merged[:expected_count]

    return cleaned
