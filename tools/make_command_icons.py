"""Draws the four battle-command icons that had no validated art (Defend, Flee, Sparking, Skills) as 32x32 framed pixel icons
in the same frame as public/assets/reviewed/icons/skills/*.png. Usage: python -I tools/make_command_icons.py"""
import os
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SK = os.path.join(ROOT, 'public', 'assets', 'reviewed', 'icons', 'skills')
OUT = os.path.join(ROOT, 'public', 'assets', 'reviewed', 'icons', 'commands')
INNER = (23, 33, 64, 255)
LIGHT = (211, 234, 255, 255)


def frame():
    im = Image.open(os.path.join(SK, 'atk_goku.png')).convert('RGBA')
    d = ImageDraw.Draw(im)
    d.rectangle((6, 6, 25, 25), fill=INNER)   # clear the template glyph, keep the frame
    return im, d


def px(d, pts, col):
    for x, y in pts: d.point((x, y), fill=col)


def defend():
    im, d = frame()
    body = (58, 128, 232, 255); dark = (24, 70, 160, 255); hi = (150, 200, 255, 255); gold = (255, 205, 70, 255)
    shield = [(9, 8), (22, 8), (22, 17), (19, 21), (15, 24), (12, 21), (9, 17)]
    shield = [(9, 8), (22, 8), (22, 16), (16, 24), (9, 16)]
    d.polygon(shield, fill=body, outline=LIGHT)
    d.polygon([(16, 9), (21, 9), (21, 16), (16, 22)], fill=dark)       # shaded right half
    d.line([(11, 10), (11, 15)], fill=hi); d.line([(12, 10), (14, 10)], fill=hi)
    d.rectangle((14, 12, 17, 15), fill=gold); px(d, [(15, 11), (16, 16)], gold)  # emblem
    return im


def flee():
    im, d = frame()
    org = (255, 170, 50, 255); yel = (255, 225, 110, 255); dust = (150, 175, 220, 255)
    for ox in (0, 7):                                                   # double chevron pointing left (running away)
        d.polygon([(15 - ox + 4, 9), (15 - ox, 16), (15 - ox + 4, 23), (15 - ox + 7, 23), (15 - ox + 3, 16), (15 - ox + 7, 9)], fill=org if ox == 0 else yel)
    d.line([(20, 12), (24, 12)], fill=dust); d.line([(21, 16), (24, 16)], fill=dust); d.line([(20, 20), (24, 20)], fill=dust)
    return im


def sparking():
    im, d = frame()
    purple = (150, 70, 235, 255); mid = (205, 130, 255, 255); gold = (255, 225, 110, 255)
    d.polygon([(16, 7), (20, 13), (22, 11), (23, 18), (20, 23), (12, 23), (9, 18), (10, 11), (12, 13)], fill=purple, outline=(235, 200, 255, 255))
    d.polygon([(16, 12), (19, 18), (18, 22), (14, 22), (13, 18)], fill=mid)
    d.polygon([(16, 16), (17, 19), (16, 22), (15, 19)], fill=gold)
    return im


def skills():
    im, d = frame()
    cyan = (110, 220, 255, 255); blue = (60, 140, 240, 255); white = (235, 250, 255, 255)
    d.polygon([(16, 7), (18, 14), (25, 16), (18, 18), (16, 25), (14, 18), (7, 16), (14, 14)], fill=blue, outline=cyan)
    d.polygon([(16, 11), (17, 15), (21, 16), (17, 17), (16, 21), (15, 17), (11, 16), (15, 15)], fill=white)
    return im


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for name, fn in (('defend', defend), ('flee', flee), ('sparking', sparking), ('skills', skills)):
        fn().save(os.path.join(OUT, name + '.png'))
    print('ok')
