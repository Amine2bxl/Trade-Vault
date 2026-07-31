#!/usr/bin/env python3
"""
Voice synthesizer — Jarvis's cloned voice, fully offline.

Loads the XTTS-v2 model once, then renders every line of the catalog with the
cloned voice and writes one WAV per line. This runs on the developer machine;
the resulting files are committed and served as static MP3s by the app.

Usage:
    synthesize.py lines.json outdir [--ref REFERENCE.mp3] [--device auto|cpu|mps]

lines.json is a JSON array of { "id": string, "text": string }.
"""
import argparse
import json
import os
import sys
import time

os.environ.setdefault("COQUI_TOS_AGREED", "1")


def pick_device() -> str:
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("lines", help="JSON array of {id, text}")
    ap.add_argument("outdir", help="directory for the generated WAV files")
    ap.add_argument("--ref", required=True, help="reference voice sample (mp3/wav)")
    ap.add_argument("--device", default="auto", help="auto | cpu | mps | cuda")
    args = ap.parse_args()

    with open(args.lines, encoding="utf-8") as f:
        lines = json.load(f)

    os.makedirs(args.outdir, exist_ok=True)
    device = pick_device() if args.device == "auto" else args.device
    print(f"[voices] device={device} lines={len(lines)} ref={args.ref}", flush=True)

    # Load once, render everything with the same session.
    from TTS.api import TTS

    tts = TTS("tts_models/multilingual/multi-dataset/xtts_v2").to(device)

    start = time.time()
    for i, item in enumerate(lines, 1):
        text = item["text"].strip()
        if not text:
            continue
        out = os.path.join(args.outdir, f"{item['id']}.wav")
        if os.path.exists(out):
            print(f"[voices] {i}/{len(lines)} skip (exists) {item['id']}", flush=True)
            continue
        t0 = time.time()
        try:
            tts.tts_to_file(
                text=text,
                speaker_wav=args.ref,
                language="en",
                file_path=out,
            )
        except Exception as e:  # noqa: BLE001
            print(f"[voices] {i}/{len(lines)} FAILED {item['id']}: {e}", flush=True)
            return 1
        print(
            f"[voices] {i}/{len(lines)} {item['id']} in {time.time() - t0:.1f}s",
            flush=True,
        )

    print(
        f"[voices] done in {time.time() - start:.0f}s -> {args.outdir}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
