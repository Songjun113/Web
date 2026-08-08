"""Create a private, evidence-backed review list from a local achievement folder.

This scanner never edits public website data. It stores file fingerprints and
review candidates under .achievement-sync/, which is excluded from Git.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import re
import sys
import zipfile
from datetime import datetime, timezone
from pathlib import Path
from xml.etree import ElementTree

SUPPORTED = {".pdf", ".docx", ".md", ".markdown", ".csv", ".xlsx"}
TYPE_RULES = {
    "paper": ("paper", "论文", "preprint", "article", "conference", "journal"),
    "patent": ("patent", "专利", "发明"),
    "award": ("award", "奖", "竞赛", "competition", "honor"),
    "project": ("project", "项目", "software", "系统", "prototype", "课题"),
}
TRACK_RULES = {
    "mixed-reality-ai": ("mixed reality", "mr", "vr", "混合现实", "虚拟现实", "spatial", "场景生成"),
    "eeg-decoding": ("eeg", "脑电", "bci", "脑机", "motor intention", "语言解码", "language"),
    "stroke-rehabilitation": ("stroke", "卒中", "康复", "rehabilitation", "motor recovery", "精神康复"),
}
SENSITIVE_PATTERNS = (
    re.compile(r"\b1[3-9]\d{9}\b"),
    re.compile(r"\b\d{17}[0-9Xx]\b"),
    re.compile(r"\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b"),
    re.compile(r"(?:住址|地址|Address)\s*[:：]?\s*[^\n,，;；]{4,80}", re.I),
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def redact(text: str) -> tuple[str, bool]:
    changed = False
    for pattern in SENSITIVE_PATTERNS:
        text, count = pattern.subn("[REDACTED]", text)
        changed = changed or count > 0
    return " ".join(text.split()), changed


def xml_text(archive: zipfile.ZipFile, member: str) -> str:
    root = ElementTree.fromstring(archive.read(member))
    return " ".join(node.text or "" for node in root.iter() if node.tag.endswith("}t"))


def extract_docx(path: Path) -> str:
    with zipfile.ZipFile(path) as archive:
        return xml_text(archive, "word/document.xml")


def extract_xlsx(path: Path) -> str:
    with zipfile.ZipFile(path) as archive:
        parts = []
        if "xl/sharedStrings.xml" in archive.namelist():
            parts.append(xml_text(archive, "xl/sharedStrings.xml"))
        for member in archive.namelist():
            if member.startswith("xl/worksheets/sheet") and member.endswith(".xml"):
                parts.append(xml_text(archive, member))
        return " ".join(parts)


def extract_csv(path: Path) -> str:
    with path.open("r", encoding="utf-8-sig", errors="replace", newline="") as stream:
        return " ".join(" ".join(row) for row in csv.reader(stream))


def extract_pdf(path: Path) -> tuple[str, str | None]:
    try:
        from pypdf import PdfReader  # type: ignore
    except ImportError:
        return "", "pypdf is unavailable; filename-only review"
    try:
        reader = PdfReader(str(path))
        return " ".join((page.extract_text() or "") for page in reader.pages[:20]), None
    except Exception as exc:  # malformed/encrypted PDFs remain reviewable by filename
        return "", f"PDF extraction failed: {exc}"


def extract(path: Path) -> tuple[str, str | None]:
    try:
        if path.suffix.lower() in {".md", ".markdown"}:
            return path.read_text(encoding="utf-8", errors="replace"), None
        if path.suffix.lower() == ".csv":
            return extract_csv(path), None
        if path.suffix.lower() == ".docx":
            return extract_docx(path), None
        if path.suffix.lower() == ".xlsx":
            return extract_xlsx(path), None
        if path.suffix.lower() == ".pdf":
            return extract_pdf(path)
    except Exception as exc:
        return "", f"Extraction failed: {exc}"
    return "", "Unsupported file type"


def classify(text: str, rules: dict[str, tuple[str, ...]], fallback: str) -> str:
    lowered = text.casefold()
    scores = {key: sum(lowered.count(term.casefold()) for term in terms) for key, terms in rules.items()}
    best = max(scores, key=scores.get)
    return best if scores[best] else fallback


def candidate(path: Path, fingerprint: str, change: str) -> dict:
    raw_text, warning = extract(path)
    safe_text, sensitive = redact(raw_text)
    safe_title, title_sensitive = redact(path.stem)
    combined = f"{safe_title} {safe_text[:6000]}"
    date_match = re.search(r"(?:19|20)\d{2}(?:[-_.年](?:0?[1-9]|1[0-2]))?(?:[-_.月](?:0?[1-9]|[12]\d|3[01]))?", combined)
    return {
        "candidateId": fingerprint[:12],
        "change": change,
        "suggestedType": classify(combined, TYPE_RULES, "project"),
        "suggestedResearchTrack": classify(combined, TRACK_RULES, "needs-review"),
        "titleZh": safe_title,
        "titleEn": "",
        "date": date_match.group(0).replace("年", "-").replace("月", "-") if date_match else "",
        "summaryEvidence": safe_text[:420],
        "sourceFile": path.name,
        "fingerprint": fingerprint,
        "publicUrl": "",
        "sensitiveContentRedacted": sensitive or title_sensitive,
        "status": "needs-review" if warning or not safe_text else "candidate",
        "warning": warning,
    }


def scan(source: Path, state_dir: Path) -> dict:
    if not source.is_dir():
        raise FileNotFoundError(f"Achievement source directory is unavailable: {source}")
    files = sorted(path for path in source.rglob("*") if path.is_file() and path.suffix.lower() in SUPPORTED)
    state_path = state_dir / "scan-state.json"
    previous = json.loads(state_path.read_text(encoding="utf-8")) if state_path.exists() else {"files": {}}
    old_files = previous.get("files", {})
    old_by_hash = {item["sha256"]: rel for rel, item in old_files.items()}
    current = {}
    candidates = []
    for path in files:
        relative = path.relative_to(source).as_posix()
        fingerprint = sha256(path)
        current[relative] = {"sha256": fingerprint, "size": path.stat().st_size, "modifiedNs": path.stat().st_mtime_ns}
        if relative not in old_files:
            change = "renamed" if fingerprint in old_by_hash else "added"
            candidates.append(candidate(path, fingerprint, change))
        elif old_files[relative]["sha256"] != fingerprint:
            candidates.append(candidate(path, fingerprint, "modified"))
    current_hashes = {item["sha256"] for item in current.values()}
    for relative, info in old_files.items():
        if relative not in current and info["sha256"] not in current_hashes:
            candidates.append({"change": "removed", "sourceFile": Path(relative).name, "fingerprint": info["sha256"], "status": "needs-review"})
    now = datetime.now(timezone.utc).isoformat()
    report = {"ok": True, "sourceAvailable": True, "scannedAt": now, "fileCount": len(files), "candidateCount": len(candidates), "candidates": candidates}
    state_dir.mkdir(parents=True, exist_ok=True)
    (state_dir / "candidates.json").write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    state_path.write_text(json.dumps({"version": 1, "scannedAt": now, "files": current}, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", default=r"D:\File\成果与简历")
    parser.add_argument("--state-dir", default=".achievement-sync")
    args = parser.parse_args()
    try:
        report = scan(Path(args.source), Path(args.state_dir))
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    except Exception as exc:
        print(json.dumps({"ok": False, "sourceAvailable": False, "error": str(exc)}, ensure_ascii=False), file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
