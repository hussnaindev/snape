#!/usr/bin/env python3
"""
Merge Tushy API video data into adult.json.

Reads the Next.js ISR JSON from tushy.com/videos (edges under pageProps.edges)
or a flat {videos: [...]} wrapper, converts to adult.json format, and replaces
existing TUSHY/TUSHYRAW entries with rich API data (portrait covers, cast, ratings).

Usage:
  python3 scripts/merge_tushy_data.py tushy_page_1.json
"""

import json
import sys
import hashlib
from pathlib import Path

MOBILE_JSON = Path("mobile/app/src/main/assets/adult.json")
DESKTOP_JSON = Path("desktop/adult.json")


def fix_url(url):
    if url and "cdn.tushy.comScene/" in url:
        url = url.replace("cdn.tushy.comScene/", "cdn.tushy.com/Scene/")
    return url


def build_cover_url(img_obj):
    src = (img_obj or {}).get("src", "")
    if not src:
        return None
    return fix_url(src)


def build_preview_url(url):
    return fix_url(url) if url and url.startswith("http") else None


def generate_subject_id(api_id):
    h = hashlib.md5(api_id.encode()).hexdigest()
    return str(int(h[:16], 16))


def find_existing_match(api_video, existing_entries):
    performers = {
        m.get("name", "").lower() for m in api_video.get("modelsSlugged", [])
    }
    if not performers:
        return None

    api_date = (api_video.get("releaseDate") or "")[:10]

    for entry in existing_entries:
        existing_title = entry.get("title", "").lower()
        existing_cast = {
            c.get("name", "").lower() for c in entry.get("cast", [])
        }
        combined = existing_cast | set(existing_title.split())

        if performers & combined:
            existing_date = (entry.get("releaseDate") or "")[:10]
            if api_date and existing_date:
                diff = _date_diff(api_date, existing_date)
                if abs(diff) <= 90:
                    return entry["subjectId"]
    return None


def _date_diff(d1, d2):
    from datetime import datetime, timezone

    try:
        dt1 = datetime.fromisoformat(d1).replace(tzinfo=timezone.utc)
        dt2 = datetime.fromisoformat(d2).replace(tzinfo=timezone.utc)
        return (dt1 - dt2).days
    except Exception:
        return 999


def api_video_to_adult_item(node, existing_sid=None):
    title = (node.get("title") or "").strip()
    if not title:
        return None

    slug = node.get("slug", "")
    api_id = node.get("id", slug)
    release_date = (node.get("releaseDate") or "")[:10]

    models = node.get("modelsSlugged", [])
    cast = [
        {"name": m["name"], "character": "Herself"}
        for m in models
        if m.get("name")
    ]

    images = node.get("images", {}).get("listing", [])
    portrait_img = images[0] if len(images) > 0 else None
    landscape_img = images[1] if len(images) > 1 else None

    cover_url = build_cover_url(portrait_img)
    backdrop_url = build_cover_url(landscape_img) or cover_url

    previews = node.get("previews", {}).get("listing", [])
    portrait_preview = (
        build_preview_url(previews[0].get("src") if isinstance(previews[0], dict) else previews[0]) if len(previews) > 0 else None
    )
    landscape_preview = (
        build_preview_url(previews[1].get("src") if isinstance(previews[1], dict) else previews[1]) if len(previews) > 1 else None
    )

    rating_raw = node.get("expertReview", {}).get("global")
    rating = rating_raw if rating_raw is not None else 0.0

    performer_names = ", ".join(m["name"] for m in models if m.get("name"))
    desc_parts = [f"A TUSHY scene"]
    if performer_names:
        desc_parts.append(f"starring {performer_names}")
    desc_parts.append(f". {title}.")
    description = " ".join(desc_parts)

    subject_id = existing_sid or generate_subject_id(api_id)
    adult_title = f"TUSHY {title}"

    return {
        "subjectId": subject_id,
        "title": adult_title,
        "postTitle": f"Trailer-{adult_title}",
        "releaseDate": release_date,
        "subjectType": 1,
        "duration": "",
        "discoveredBy": performer_names or title,
        "coverUrl": cover_url,
        "description": description,
        "genre": "Adult",
        "imdbRatingValue": f"{rating:.1f}",
        "studio": "TUSHY",
        "backdropUrl": backdrop_url,
        "rating": f"{rating:.1f}",
        "cast": cast,
        "recommendations": [],
        "tushySlug": slug,
        "tushyVideoId": node.get("videoId"),
        "tushyPreviewPortrait": portrait_preview,
        "tushyPreviewLandscape": landscape_preview,
        "isUpcoming": node.get("isUpcoming", False),
        "isExclusive": node.get("isExclusive", False),
    }


def load_api_videos(path):
    with open(path) as f:
        data = json.load(f)

    # Support both: {pageProps: {edges: [...]}} and {videos: [...]}
    edges = data.get("pageProps", {}).get("edges") or data.get("videos") or []
    nodes = []
    for e in edges:
        if isinstance(e, dict) and "node" in e:
            nodes.append(e["node"])
        else:
            nodes.append(e)
    return nodes


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 scripts/merge_tushy_data.py tushy_page_1.json")
        sys.exit(1)

    api_path = Path(sys.argv[1])
    if not api_path.exists():
        print(f"File not found: {api_path}")
        sys.exit(1)

    api_nodes = load_api_videos(api_path)
    print(f"Loaded {len(api_nodes)} API videos")

    with open(MOBILE_JSON) as f:
        mobile_data = json.load(f)

    existing_matches = mobile_data.get("matches", [])
    non_tushy = [
        m
        for m in existing_matches
        if m.get("studio", "").upper() not in ("TUSHY", "TUSHYRAW")
    ]
    existing_tushy = [
        m
        for m in existing_matches
        if m.get("studio", "").upper() in ("TUSHY", "TUSHYRAW")
    ]
    print(
        f"Existing: {len(non_tushy)} non-TUSHY, {len(existing_tushy)} TUSHY/TUSHYRAW"
    )

    converted = []
    matched_count = 0
    unmatched_count = 0
    used_sids = set()

    for node in api_nodes:
        existing_sid = find_existing_match(node, existing_tushy)
        item = api_video_to_adult_item(node, existing_sid=existing_sid)
        if item is None:
            continue

        sid = item["subjectId"]
        if sid in used_sids:
            sid = generate_subject_id(f"{node.get('id', '')}-{len(converted)}")
            item["subjectId"] = sid

        if existing_sid:
            matched_count += 1
            ex = next((e for e in existing_tushy if e["subjectId"] == existing_sid), None)
            if ex and ex.get("recommendations"):
                item["recommendations"] = ex["recommendations"]
        else:
            unmatched_count += 1

        used_sids.add(sid)
        converted.append(item)

    # Cross-recommendations among TUSHY entries
    tushy_ids = [c["subjectId"] for c in converted]
    for c in converted:
        if not c["recommendations"]:
            c["recommendations"] = [
                sid for sid in tushy_ids if sid != c["subjectId"]
            ][:26]

    new_matches = non_tushy + converted
    new_data = {
        "generatedAt": mobile_data["generatedAt"],
        "targetStudios": mobile_data["targetStudios"],
        "totalMatches": len(new_matches),
        "matches": new_matches,
    }

    print(f"\nConverted: {len(converted)} TUSHY videos")
    print(f"  Matched existing: {matched_count}")
    print(f"  New entries: {unmatched_count}")
    print(f"Total adult.json entries: {len(new_matches)}")

    with open(MOBILE_JSON, "w") as f:
        json.dump(new_data, f, indent=2, ensure_ascii=False)
    print(f"\nWrote {MOBILE_JSON}")

    if DESKTOP_JSON.exists():
        with open(DESKTOP_JSON, "r") as f:
            desktop_data = json.load(f)
        desktop_data["matches"] = new_matches
        desktop_data["totalMatches"] = len(new_matches)
        with open(DESKTOP_JSON, "w") as f:
            json.dump(desktop_data, f, indent=2, ensure_ascii=False)
        print(f"Wrote {DESKTOP_JSON}")

    print("\nDone!")


if __name__ == "__main__":
    main()
