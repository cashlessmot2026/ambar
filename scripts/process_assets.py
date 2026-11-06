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


# Pantallas de arranque iOS: (ancho CSS, alto CSS, densidad). Se generan en vertical y horizontal.
IOS_SCREENS = [
    (440, 956, 3), (402, 874, 3), (430, 932, 3), (393, 852, 3), (428, 926, 3), (390, 844, 3),
    (375, 812, 3), (414, 896, 3), (414, 896, 2), (414, 736, 3), (375, 667, 2), (320, 568, 2),
    (1032, 1376, 2), (1024, 1366, 2), (834, 1194, 2), (820, 1180, 2), (834, 1112, 2),
    (810, 1080, 2), (768, 1024, 2), (744, 1133, 2),
]


def make_splash(logo: Image.Image, w: int, h: int) -> Image.Image:
    img = Image.new("RGB", (w, h), BG)
    side = int(min(w, h) * 0.34)
    l = logo.copy()
    l.thumbnail((side, side), Image.LANCZOS)
    img.paste(l, ((w - l.width) // 2, (h - l.height) // 2), l)
    return img


def make_monochrome(logo: Image.Image, size: int) -> Image.Image:
    """Icono monocromo (Android 13+): solo la silueta en blanco sobre transparente, con margen de zona segura."""
    icon = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    inner = int(size * 0.56)
    l = logo.copy()
    l.thumbnail((inner, inner), Image.LANCZOS)
    icon.alpha_composite(l, ((size - l.width) // 2, (size - l.height) // 2))
    return icon


def make_shortcut(glyph_path: str, size: int = 96) -> Image.Image:
    """Icono de acceso directo: círculo dorado con un pictograma simple dibujado con Pillow."""
    from PIL import ImageDraw
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.ellipse((0, 0, size - 1, size - 1), fill=(212, 162, 76, 255))
    c = (20, 20, 20, 255)
    w = max(4, size // 14)
    if glyph_path == "menu":  # tenedor y cuchillo
        d.line((34, 24, 34, 72), fill=c, width=w); d.line((28, 24, 28, 44), fill=c, width=w); d.line((40, 24, 40, 44), fill=c, width=w)
        d.line((28, 44, 40, 44), fill=c, width=w); d.line((62, 24, 62, 72), fill=c, width=w); d.polygon([(62, 24), (70, 34), (70, 50), (62, 50)], fill=c)
    elif glyph_path == "pedido":  # bolsa
        d.rounded_rectangle((26, 38, 70, 74), radius=6, outline=c, width=w); d.arc((36, 22, 60, 50), 180, 360, fill=c, width=w)
    else:  # tarjeta con estrella
        d.rounded_rectangle((20, 30, 76, 68), radius=7, outline=c, width=w); d.line((20, 42, 76, 42), fill=c, width=w)
        d.regular_polygon((48, 56, 8), 5, fill=c)
    return img


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
    make_monochrome(logo, 512).save(PUBLIC / "icons" / "monochrome-512.png", optimize=True)
    for name in ("menu", "pedido", "tarjeta"):
        make_shortcut(name).save(PUBLIC / "icons" / f"shortcut-{name}.png", optimize=True)

    splash_dir = PUBLIC / "splash"
    splash_dir.mkdir(parents=True, exist_ok=True)
    for w, h, dpr in IOS_SCREENS:
        for pw, ph in ((w * dpr, h * dpr), (h * dpr, w * dpr)):
            make_splash(logo, pw, ph).save(splash_dir / f"splash-{pw}x{ph}.png", optimize=True)

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
