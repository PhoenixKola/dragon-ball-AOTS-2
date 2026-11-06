"""Build Kaioken body frames from approved base Goku art, keeping the aura separate."""
from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
ACTORS = ROOT / "public/assets/reviewed/actors"
SOURCE = ROOT / "art-sources/production/batch4"
CANVAS = (288, 272)
TARGET_HEIGHT = 186
BASELINE = 232

POSES: dict[str, list[Path]] = {
    "idle": [ACTORS / f"goku_idle_frame_{i:02d}.png" for i in range(1, 5)],
    "attack": [ACTORS / f"goku_attack_frame_{i:02d}.png" for i in range(1, 5)],
    "charge": [SOURCE / f"kaioken_charge_frame_{i:02d}.png" for i in range(1, 5)],
    "special": [ACTORS / f"goku_special_frame_{i:02d}.png" for i in range(1, 5)],
    "guard": [ACTORS / f"goku_guard_frame_{i:02d}.png" for i in range(1, 5)],
    "hurt": [ACTORS / f"goku_hurt_frame_{i:02d}.png" for i in range(1, 5)],
    "ko": [ACTORS / "goku_ko.png"],
    "victory": [ACTORS / "goku_victory.png"],
}


def fit(path: Path, already_powerup_canvas: bool = False) -> Image.Image:
    im = Image.open(path).convert("RGBA")
    if already_powerup_canvas:
        if im.size != CANVAS:
            raise ValueError(f"unexpected power-up canvas: {path} {im.size}")
        return im
    box = im.getchannel("A").getbbox()
    if box is None:
        raise ValueError(f"empty sprite: {path}")
    im = im.crop(box)
    reference = Image.open(ACTORS / "goku_idle.png").convert("RGBA").getchannel("A").getbbox()
    reference_height = reference[3] - reference[1]
    scale = TARGET_HEIGHT / reference_height
    width, height = max(1, round(im.width * scale)), max(1, round(im.height * scale))
    im = im.resize((width, height), Image.Resampling.NEAREST)
    out = Image.new("RGBA", CANVAS)
    out.alpha_composite(im, (round((CANVAS[0] - width) / 2), BASELINE - height))
    return out


def main() -> None:
    for pose, frames in POSES.items():
        for i, source in enumerate(frames, start=1):
            if not source.is_file():
                raise FileNotFoundError(source)
            out = ACTORS / f"goku_kaioken_{pose}_frame_{i:02d}.png"
            fit(source, already_powerup_canvas=(pose == "charge")).save(out)
            print(f"{out.relative_to(ROOT)} <- {source.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
