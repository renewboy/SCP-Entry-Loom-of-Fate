#!/usr/bin/env python3
"""Builds the Chinese half of the report font: AR PL KaitiM GB with worn, inked outlines.

Each glyph is rasterized, its ink bled and roughened, then traced back to outlines, so its strokes
sit beside Special Elite's Latin. Glyphs are split into the same frequency slices Google Fonts uses
for Noto Serif SC, so a page downloads only the slices it shows.

Usage: build_typewriter_font.py <gkai00mp.ttf> <noto unicode.json> <copyright file> <output dir>
Needs fontTools, brotli, numpy, scipy, opencv-python and Pillow.
"""
import hashlib
import json
import multiprocessing
import os
import re
import sys

import cv2
import numpy as np
from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont
from PIL import Image, ImageDraw, ImageFont
from scipy.ndimage import gaussian_filter

FAMILY = 'Special Elite'  # Same family as the Latin font, so every report-font style picks these up by unicode-range
FILE_PREFIX = 'loom-typewriter-cn'
FONT_NAME = 'Loom Typewriter CN'
NOTICE = 'Modified from AR PL KaitiM GB by SCP Entry: Loom of Fate: outlines redrawn with worn ink edges, subset and renamed.'

CJK_RANGES = [(0x3000, 0x303F), (0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xFF00, 0xFFEF)]
MIN_SLICE_GLYPHS = 40

EM = 512
PAD = 64
SIZE = EM + PAD * 2
UPM = 1000
BASELINE = 0.88
CENTER_Y = 380
ASCENT = 880
DESCENT = -120

# Kai bodies sit small in the em; this lines them up with the Latin beside them
SCALE = 1.08
SPREAD = 17          # Pixels the ink spreads before the edge is cut, thickening thin Kai strokes
BLEED = 4.0          # Softness of that edge
LEVEL = 0.46         # Where the edge is cut
TILT = 0.22          # A slug strikes one side harder
BLOTCH = 0.05        # Coarse unevenness across the glyph
ROUGH_LOW = (0.18, 8)
ROUGH_HIGH = (0.10, 3)
HOLE = 2.4           # Dry spots inside strokes; a higher value means fewer
SPECK = 2.9          # Ink specks beside strokes; a higher value means fewer
JITTER = 4           # Glyphs sit slightly off their line, in raster pixels
ROTATE = 0.7         # And slightly off square, in degrees
MIN_AREA = 16
SIMPLIFY = 1.0


def is_cjk(code):
    return any(start <= code <= end for start, end in CJK_RANGES)


def parse_unicode_range(text):
    codes = set()
    for part in text.split(','):
        match = re.fullmatch(r'\s*U\+([0-9a-fA-F]+)(?:-([0-9a-fA-F]+))?\s*', part)
        if match:
            start = int(match.group(1), 16)
            codes.update(range(start, int(match.group(2) or match.group(1), 16) + 1))
    return codes


def plan_slices(font_codes, noto_ranges):
    """Google's slices, keeping only what this font has; tiny ones join the next so requests stay few"""
    remaining = {code for code in font_codes if is_cjk(code)}
    slices = []
    current = []
    # Numbered keys are the Chinese slices; the rest are scripts such as latin and cyrillic
    numbered = [key for key in noto_ranges if key.strip('[]').isdigit()]
    for key in sorted(numbered, key=lambda name: int(name.strip('[]'))):
        current.extend(sorted(remaining & parse_unicode_range(noto_ranges[key])))
        remaining -= set(current)
        if len(current) >= MIN_SLICE_GLYPHS:
            slices.append(current)
            current = []
    current.extend(sorted(remaining))
    if current:
        slices.append(current)
    return slices


def wear(char, font):
    image = Image.new('L', (SIZE, SIZE), 0)
    ImageDraw.Draw(image).text((PAD, PAD + EM * BASELINE), char, font=font, fill=255, anchor='ls')
    mask = np.asarray(image, dtype=np.float32) / 255
    rng = np.random.default_rng(int(hashlib.md5(char.encode()).hexdigest()[:8], 16))

    def noise(sigma):
        field = gaussian_filter(rng.standard_normal((SIZE, SIZE)).astype(np.float32), sigma)
        return field / field.std()

    # Dense glyphs spread less, or their counters would clog
    grow = max(0.45, 1.15 - float(mask.mean()) / 0.16 * 0.55)
    kernel = max(3, int(SPREAD * grow) | 1)
    spread = cv2.dilate(mask, cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (kernel, kernel)))
    field = gaussian_filter(spread, BLEED)

    angle = rng.uniform(0, 6.283)
    yy, xx = np.mgrid[0:SIZE, 0:SIZE] / SIZE - 0.5
    tilt = (np.cos(angle) * xx + np.sin(angle) * yy) * TILT * rng.uniform(0.3, 1)
    level = LEVEL + tilt + noise(38) * BLOTCH + noise(ROUGH_LOW[1]) * ROUGH_LOW[0] + noise(ROUGH_HIGH[1]) * ROUGH_HIGH[0]
    # The noise only moves edges near strokes; without the floor it grows ink fog around the glyph
    ink = (field > level) & (field > 0.16)
    ink &= ~((noise(3.2) > HOLE) & (noise(26) > 0.35))
    specks = (noise(3.0) > SPECK) & (gaussian_filter(spread, 5) > 0.12)
    ink |= specks & (field > 0.04)
    return (ink * 255).astype(np.uint8), rng


def trace(ink, rng):
    contours, _ = cv2.findContours(ink, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_NONE)
    pen = TTGlyphPen(None)
    dy = rng.normal(0, JITTER) * UPM / EM
    dx = rng.normal(0, JITTER * 0.5) * UPM / EM
    angle = np.radians(rng.normal(0, ROTATE))
    cos, sin = np.cos(angle), np.sin(angle)
    for contour in contours:
        if cv2.contourArea(contour) < MIN_AREA:
            continue
        polygon = cv2.approxPolyDP(contour, SIMPLIFY, True)[:, 0, :].astype(float)
        if len(polygon) < 3:
            continue
        xs = (polygon[:, 0] - PAD - EM / 2) * UPM / EM * SCALE
        ys = ((EM * BASELINE + PAD - polygon[:, 1]) * UPM / EM - CENTER_Y) * SCALE
        points = [(round(UPM / 2 + cos * x - sin * y + dx), round(CENTER_Y + sin * x + cos * y + dy)) for x, y in zip(xs, ys)]
        points = [point for index, point in enumerate(points) if point != points[index - 1]]
        if len(points) < 3:
            continue
        # Every traced vertex is off-curve: the edge stays soft and no on-curve points are stored
        pen.qCurveTo(*points, None)
        pen.closePath()
    return pen.glyph()


def build_slice(job):
    index, codes, source, output_dir, copyright_text = job
    font = ImageFont.truetype(source, EM)
    glyph_order = ['.notdef']
    glyphs = {'.notdef': TTGlyphPen(None).glyph()}
    cmap = {}
    for code in codes:
        name = f'uni{code:04X}'
        ink, rng = wear(chr(code), font)
        glyphs[name] = trace(ink, rng)
        glyph_order.append(name)
        cmap[code] = name
    builder = FontBuilder(UPM, isTTF=True)
    builder.setupGlyphOrder(glyph_order)
    builder.setupCharacterMap(cmap)
    builder.setupGlyf(glyphs)
    builder.setupHorizontalMetrics({name: (UPM, getattr(builder.font['glyf'][name], 'xMin', 0) or 0) for name in glyph_order})
    builder.setupHorizontalHeader(ascent=ASCENT, descent=DESCENT)
    builder.setupNameTable({
        'copyright': copyright_text,
        'familyName': FONT_NAME,
        'styleName': 'Regular',
        'description': NOTICE,
        'licenseDescription': 'Arphic Public License. See LICENSE.txt beside this file.',
    })
    builder.setupOS2(sTypoAscender=ASCENT, sTypoDescender=DESCENT, usWinAscent=ASCENT, usWinDescent=-DESCENT)
    builder.setupPost()
    builder.font.flavor = 'woff2'
    file_name = f'{FILE_PREFIX}-{index:03d}.woff2'
    builder.save(os.path.join(output_dir, file_name))
    return index, file_name, codes


def unicode_range(codes):
    runs = []
    for code in codes:
        if runs and runs[-1][1] == code - 1:
            runs[-1][1] = code
        else:
            runs.append([code, code])
    return ','.join(f'U+{start:x}' if start == end else f'U+{start:x}-{end:x}' for start, end in runs)


def write_license(copyright_path, output_dir):
    with open(copyright_path, encoding='utf8') as file:
        text = file.read()
    body = text[text.index('ARPHIC PUBLIC LICENSE'):]
    with open(os.path.join(output_dir, 'LICENSE.txt'), 'w', encoding='utf8') as file:
        file.write(f'{NOTICE}\nThe generator is scripts/build_typewriter_font.py in this project.\n\n{body}')


def main():
    source, unicode_json, copyright_path, output_dir = sys.argv[1:5]
    os.makedirs(output_dir, exist_ok=True)
    source_font = TTFont(source, lazy=True)
    copyright_text = source_font['name'].getDebugName(0) or 'Copyright Arphic Technology Co., Ltd.'
    with open(unicode_json, encoding='utf8') as file:
        slices = plan_slices(source_font.getBestCmap(), json.load(file))
    jobs = [(index, codes, source, output_dir, copyright_text) for index, codes in enumerate(slices)]
    with multiprocessing.Pool() as pool:
        results = pool.map(build_slice, jobs, chunksize=1)
    with open(os.path.join(output_dir, 'font.css'), 'w', encoding='utf8') as file:
        file.write(f'/* Generated by scripts/build_typewriter_font.py. {NOTICE} */\n')
        for _, file_name, codes in sorted(results):
            file.write(f'@font-face {{ font-family: "{FAMILY}"; src: url("./{file_name}") format("woff2"); font-display: swap; unicode-range: {unicode_range(codes)}; }}\n')
    write_license(copyright_path, output_dir)
    print(f'{sum(len(result[2]) for result in results)} glyphs in {len(results)} slices')


if __name__ == '__main__':
    main()
