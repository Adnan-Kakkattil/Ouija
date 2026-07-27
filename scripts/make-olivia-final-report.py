"""Build Room 2 Challenge 3 — Olivia's final report ZIP."""
from pathlib import Path

import pyzipper

# Password = interiors of Room 2 flags 1 + 2
PASSWORD = b"olivia_investigated_she_found_evidence"

root = Path("public/assets/files")
root.mkdir(parents=True, exist_ok=True)
inner = root / "_final_report.txt"
inner.write_text(
    "OLIVIA'S FINAL REPORT\n"
    "Blackmoor Mansion — Investigation Room\n"
    "Filed under: Hollow Road / disappearances\n\n"
    "The newspaper trail and my first-night notes agree.\n"
    "The ghost stories sold to the parish are a cover.\n"
    "What I found does not haunt the upper floors.\n\n"
    "Conclusion:\n"
    "The truth is hidden beneath the house.\n"
    "The next step is the basement.\n\n"
    "ouija{truth_lies_below}\n\n"
    "— Olivia H.\n",
    encoding="utf-8",
)
out = root / "olivia-final-report.zip"
with pyzipper.AESZipFile(
    out, "w", compression=pyzipper.ZIP_DEFLATED, encryption=pyzipper.WZ_AES
) as zf:
    zf.setpassword(PASSWORD)
    zf.write(inner, arcname="final-report.txt")
inner.unlink(missing_ok=True)
print("wrote", out, out.stat().st_size, "password set")
