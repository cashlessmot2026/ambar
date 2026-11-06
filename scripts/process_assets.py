"""Genera los assets de la PWA a partir de los archivos originales del negocio.

Uso: python scripts/process_assets.py
- logo.jpeg            -> public/logo.png (trazos blancos sobre fondo transparente)
- logo                 -> public/icons/*.png (iconos PWA)
- landing page/*.png   -> public/landing/N.webp
- landing page/*.mp4   -> public/landing/hero.mp4
"""
from pathlib import Path
import shutil

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SRC_LANDING = ROOT / "landing page"
PUBLIC = ROOT / "public"
BG = (14, 14, 16)


def make_logo() -> Image.Image:
    img = Image.open(ROOT / "logo.jpeg").convert("RGB")
    w, h = img.size
    gray = img.convert("L")
    # Máscara del círculo negro: los trazos blancos solo cuentan si están dentro de él.
    dark = gray.point(lambda v: 255 if v < 60 else 0)
    bbox = dark.getbbox()
    cx, cy = (bbox[0] + bbox[2]) / 2, (bbox[1] + bbox[3]) / 2
    r = min(bbox[2] - bbox[0], bbox[3] - bbox[1]) / 2 - 6
    alpha = Image.new("L", (w, h), 0)
    gp, ap = gray.load(), alpha.load()
    for y in range(h):
        for x in range(w):
            if (x - cx) ** 2 + (y - cy) ** 2 <= r * r:
                v = gp[x, y]
                ap[x, y] = 0 if v < 70 else min(255, int((v - 70) * 255 / 150))
    alpha = alpha.filter(ImageFilter.SMOOTH)
    logo = Image.new("RGBA", (w, h), (255, 255, 255, 0))
    logo.putalpha(alpha)
    return logo.crop(alpha.getbbox())


def make_icon(logo: Image.Image, size: int, pad: float) -> Image.Image:
    icon = Image.new("RGBA", (size, size), BG + (255,))
    inner = int(size * (1 - 2 * pad))
    l = logo.copy()
    l.thumbnail((inner, inner), Image.LANCZOS)
    icon.alpha_composite(l, ((size - l.width) // 2, (size - l.height) // 2))
    return icon


def main() -> None:
    (PUBLIC / "icons").mkdir(parents=True, exist_ok=True)
    (PUBLIC / "landing").mkdir(parents=True, exist_ok=True)

    logo = make_logo()
    logo.save(PUBLIC / "logo.png", optimize=True)
    make_icon(logo, 192, 0.12).save(PUBLIC / "icons" / "icon-192.png")
    make_icon(logo, 512, 0.12).save(PUBLIC / "icons" / "icon-512.png")
    make_icon(logo, 512, 0.22).save(PUBLIC / "icons" / "maskable-512.png")
    make_icon(logo, 180, 0.12).convert("RGB").save(PUBLIC / "icons" / "apple-touch-icon.png")
    make_icon(logo, 64, 0.06).save(PUBLIC / "favicon.png")

    images = sorted(SRC_LANDING.glob("*.png"))
    for i, p in enumerate(images, 1):
        im = Image.open(p).convert("RGB")
        if p.name.startswith("Captura"):
            # Las capturas de Instagram traen flechas del carrusel en los bordes y puntos abajo.
            w, h = im.size
            im = im.crop((int(w * 0.05), 0, int(w * 0.95), int(h * 0.97)))
        im.thumbnail((1200, 1600), Image.LANCZOS)
        im.save(PUBLIC / "landing" / f"{i}.webp", "WEBP", quality=80)
    videos = sorted(SRC_LANDING.glob("*.mp4"))
    if videos:
        shutil.copyfile(videos[0], PUBLIC / "landing" / "hero.mp4")
    print(f"logo {logo.size}, {len(images)} imágenes, {len(videos)} video(s)")


if __name__ == "__main__":
    main()
