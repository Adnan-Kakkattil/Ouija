"""Generate Room 1 Challenge 6 — Haunted Music Box WAV with LSB-hidden flag."""
from __future__ import annotations

import math
import struct
import wave
from pathlib import Path

FLAG = "flag{listen_to_the_whispers}"
OUT = Path("public/assets/files/haunted-musicbox.wav")
SAMPLE_RATE = 22050
AMPLITUDE = 12000

# Music-box-ish pentatonic phrase (Hz)
MELODY = [
    (523.25, 0.35),  # C5
    (587.33, 0.35),  # D5
    (659.25, 0.45),  # E5
    (784.00, 0.55),  # G5
    (659.25, 0.35),  # E5
    (587.33, 0.35),  # D5
    (523.25, 0.70),  # C5
    (0.0, 0.25),
    (392.00, 0.40),  # G4
    (523.25, 0.40),  # C5
    (587.33, 0.40),  # D5
    (659.25, 0.80),  # E5
    (0.0, 0.20),
    (523.25, 0.30),
    (659.25, 0.30),
    (784.00, 0.30),
    (880.00, 0.90),  # A5
]


def tone(freq: float, seconds: float) -> list[int]:
    n = int(SAMPLE_RATE * seconds)
    samples: list[int] = []
    for i in range(n):
        t = i / SAMPLE_RATE
        if freq <= 0:
            samples.append(0)
            continue
        # Soft attack/release + light overtones (tiny music box)
        env = min(1.0, i / (SAMPLE_RATE * 0.02), (n - i) / (SAMPLE_RATE * 0.04))
        env = max(0.0, env)
        val = (
            math.sin(2 * math.pi * freq * t)
            + 0.35 * math.sin(2 * math.pi * freq * 2 * t)
            + 0.12 * math.sin(2 * math.pi * freq * 3 * t)
        )
        # faint room hiss
        hiss = ((i * 1103515245 + 12345) & 0x7FFF) / 0x7FFF - 0.5
        sample = int(AMPLITUDE * env * (val * 0.72 + hiss * 0.03))
        samples.append(max(-32767, min(32767, sample)))
    return samples


def embed_lsb(samples: list[int], message: str) -> list[int]:
    payload = (message + "\0").encode("utf-8")
    bits: list[int] = []
    for byte in payload:
        for b in range(7, -1, -1):
            bits.append((byte >> b) & 1)
    if len(bits) > len(samples):
        raise SystemExit("Audio too short for payload")
    out = list(samples)
    for i, bit in enumerate(bits):
        out[i] = (out[i] & ~1) | bit
    return out


def main() -> None:
    samples: list[int] = []
    for freq, dur in MELODY:
        samples.extend(tone(freq, dur))
    # pad so LSB decode tools have room
    while len(samples) < 22050 * 6:
        samples.append(0)

    samples = embed_lsb(samples, FLAG)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(OUT), "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SAMPLE_RATE)
        wf.writeframes(b"".join(struct.pack("<h", s) for s in samples))
    print("wrote", OUT, "bytes", OUT.stat().st_size)

    # verify LSB round-trip
    with wave.open(str(OUT), "rb") as wf:
        raw = wf.readframes(wf.getnframes())
    recovered_bits = []
    for i in range(0, len(raw), 2):
        sample = struct.unpack_from("<h", raw, i)[0]
        recovered_bits.append(sample & 1)
        if len(recovered_bits) >= (len(FLAG) + 1) * 8 and len(recovered_bits) % 8 == 0:
            chars = []
            ok = True
            for j in range(0, len(recovered_bits), 8):
                byte = 0
                for bit in recovered_bits[j : j + 8]:
                    byte = (byte << 1) | bit
                if byte == 0:
                    break
                if byte < 32 or byte > 126:
                    ok = False
                    break
                chars.append(chr(byte))
            text = "".join(chars)
            if ok and text.startswith("flag{"):
                print("verify:", text)
                return
    raise SystemExit("LSB verify failed")


if __name__ == "__main__":
    main()
