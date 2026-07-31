#!/usr/bin/env python3
"""
Voice synthesizer — F5-TTS engine (MIT, commercial OK).

Loads F5-TTS once, transcribes the reference voice (cached), then renders every
line of the catalog and writes one WAV per line. Runs on the developer machine;
the resulting files are committed and served as static MP3s by the app.

Usage:
    synthesize_f5.py lines.json outdir --ref REFERENCE.mp3 [--cache DIR] [--device auto|cpu|mps|cuda]

lines.json is a JSON array of { "id": string, "text": string }.
"""
import argparse
import hashlib
import json
import os
import sys
import time

os.environ.setdefault("PYTHONHASHSEED", "0")


def pick_device() -> str:
    import torch

    if torch.cuda.is_available():
        return "cuda"
    if torch.backends.mps.is_available():
        return "mps"
    return "cpu"


def reference_hash(ref: str) -> str:
    with open(ref, "rb") as f:
        return hashlib.sha256(f.read()).hexdigest()[:8]


def transcript_of(ref: str, cache_dir: str) -> str:
    """Transcribe the reference with faster-whisper, cached next to the run."""
    os.makedirs(cache_dir, exist_ok=True)
    cache = os.path.join(cache_dir, f"ref-{reference_hash(ref)}.txt")
    if os.path.exists(cache):
        with open(cache, encoding="utf-8") as f:
            return f.read().strip()
    from faster_whisper import WhisperModel

    model = WhisperModel("base", device="cpu", compute_type="int8")
    segments, info = model.transcribe(ref, language="en", beam_size=5)
    text = " ".join(s.text for s in segments).strip()
    with open(cache, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"[voices] reference transcript ({info.language}): {text}", flush=True)
    return text


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("lines", help="JSON array of {id, text}")
    ap.add_argument("outdir", help="directory for the generated WAV files")
    ap.add_argument("--ref", required=True, help="reference voice sample (mp3/wav)")
    ap.add_argument("--cache", required=True, help="cache dir for the transcript")
    ap.add_argument("--device", default="auto", help="auto | cpu | mps | cuda")
    ap.add_argument("--speed", type=float, default=float(os.environ.get("F5_SPEED", "0.86")),
                    help="speaking pace, <1 is slower and more deliberate")
    ap.add_argument("--steps", type=int, default=int(os.environ.get("F5_STEPS", "24")),
                    help="diffusion steps (32 = best quality, 24 = fast, 16 = quick)")
    args = ap.parse_args()

    with open(args.lines, encoding="utf-8") as f:
        lines = json.load(f)

    os.makedirs(args.outdir, exist_ok=True)
    device = pick_device() if args.device == "auto" else args.device
    ref_text = transcript_of(args.ref, args.cache)
    print(f"[voices] engine=f5 device={device} speed={args.speed} steps={args.steps} lines={len(lines)} ref={args.ref}", flush=True)

    from f5_tts.api import F5TTS

    tts = F5TTS(device=device)

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
            tts.infer(
                ref_file=args.ref,
                ref_text=ref_text,
                gen_text=text,
                file_wave=out,
                remove_silence=True,
                target_rms=0.1,
                speed=args.speed,
                nfe_step=args.steps,
            )
        except Exception as e:  # noqa: BLE001
            print(f"[voices] {i}/{len(lines)} FAILED {item['id']}: {e}", flush=True)
            return 1
        print(
            f"[voices] {i}/{len(lines)} {item['id']} in {time.time() - t0:.1f}s",
            flush=True,
        )

    print(f"[voices] done in {time.time() - start:.0f}s -> {args.outdir}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
