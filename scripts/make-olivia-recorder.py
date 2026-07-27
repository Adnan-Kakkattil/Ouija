"""Room 2 Challenge 4 — WAV with embedded ZIP (polyglot)."""
from __future__ import annotations

import io
import math
import struct
import wave
import zipfile
from pathlib import Path

FLAG = "flag{footsteps_at_midnight}"
OUT = Path("public/assets/files/olivia-recorder.wav")
SAMPLE_RATE = 22050
AMPLITUDE = 9000


def tone(freq: float, seconds: float, volume: float = 1.0) -> list[int]:
    n = int(SAMPLE_RATE * seconds)
    out: list[int] = []
    for i in range(n):
        t = i / SAMPLE_RATE
        env = min(1.0, i / (SAMPLE_RATE * 0.015), (n - i) / (SAMPLE_RATE * 0.04))
        env = max(0.0, env) * volume
        if freq <= 0:
            val = 0.0
        else:
            val = math.sin(2 * math.pi * freq * t) * 0.7
            # soft thud overtone for "footstep" feel on low pulses
            val += 0.25 * math.sin(2 * math.pi * (freq * 0.5) * t)
        noise = ((i * 1103515245 + 12345) & 0x7FFF) / 0x7FFF - 0.5
        sample = int(AMPLITUDE * env * (val + noise * 0.04))
        out.append(max(-32767, min(32767, sample)))
    return out


def build_audio() -> bytes:
    samples: list[int] = []
    # quiet room tone
    samples.extend(tone(110, 0.8, 0.25))
    # footsteps (low pulses)
    for _ in range(6):
        samples.extend(tone(70, 0.12, 1.0))
        samples.extend(tone(0, 0.35, 0.0))
    samples.extend(tone(165, 1.2, 0.35))
    samples.extend(tone(0, 0.4, 0.0))
    # distant door creak (glide)
    for i in range(int(SAMPLE_RATE * 0.6)):
        t = i / SAMPLE_RATE
        freq = 180 + 90 * t
        env = min(1.0, i / (SAMPLE_RATE * 0.05), (SAMPLE_RATE * 0.6 - i) / (SAMPLE_RATE * 0.1))
        val = math.sin(2 * math.pi * freq * t)
        samples.append(int(AMPLITUDE * 0.35 * max(0, env) * val))

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(b"".join(struct.pack("<h", s) for s in samples))
    return buf.getvalue()


def build_hidden_zip() -> bytes:
    zbuf = io.BytesIO()
    with zipfile.ZipFile(zbuf, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.writestr(
            "olivia-note.txt",
            "VOICE RECORDER — leftover message\n\n"
            "Someone entered while I was documenting.\n"
            "I heard footsteps at midnight.\n\n"
            f"{FLAG}\n",
        )
    return zbuf.getvalue()


def main() -> None:
    wav = build_audio()
    hidden = build_hidden_zip()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_bytes(wav + hidden)
    print("wrote", OUT, "bytes", OUT.stat().st_size)
    # sanity: zip signature present after wav
    assert b"PK" in OUT.read_bytes()
    print("embedded zip signature OK")


if __name__ == "__main__":
    main()
