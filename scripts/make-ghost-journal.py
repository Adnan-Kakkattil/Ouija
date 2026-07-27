import pyzipper
from pathlib import Path

root = Path("public/assets/files")
root.mkdir(parents=True, exist_ok=True)
inner = root / "_journal_page.txt"
inner.write_text(
    "THE GHOST'S JOURNAL\n"
    "Blackmoor House — undated\n\n"
    "I write these lines from behind the wallpaper.\n"
    "The boards remember every footfall. The circle\n"
    "keeps calling my name, and each time the planchette\n"
    "moves I feel the walls tighten.\n\n"
    "If you have opened this page, you already know:\n"
    "I am not free.\n\n"
    "flag{the_ghost_is_trapped}\n\n"
    "— O.\n",
    encoding="utf-8",
)
out = root / "ghost-journal.zip"
with pyzipper.AESZipFile(
    out, "w", compression=pyzipper.ZIP_DEFLATED, encryption=pyzipper.WZ_AES
) as zf:
    zf.setpassword(b"haunted")
    zf.write(inner, arcname="journal.txt")
inner.unlink(missing_ok=True)
print("wrote", out, out.stat().st_size)
