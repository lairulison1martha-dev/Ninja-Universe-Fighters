"""
Minimal dependency-free PNG reader/writer.

The project deliberately has no Python packages installed (no Pillow), and the
build tooling must keep working on a clean checkout, so this implements just
enough of the PNG spec to load the source artwork and write RGBA atlases.

Supports: 8-bit greyscale / RGB / palette / greyscale+alpha / RGBA, all five
scanline filters, and interlace method 0.
"""

import struct
import zlib

__all__ = ["read_png", "write_png", "Image"]


class Image:
    """A flat RGBA image. `px` is a bytearray of w * h * 4 bytes."""

    __slots__ = ("w", "h", "px")

    def __init__(self, w, h, px=None):
        self.w = w
        self.h = h
        self.px = px if px is not None else bytearray(w * h * 4)

    def idx(self, x, y):
        return (y * self.w + x) * 4

    def get(self, x, y):
        i = self.idx(x, y)
        return self.px[i], self.px[i + 1], self.px[i + 2], self.px[i + 3]

    def set(self, x, y, r, g, b, a=255):
        i = self.idx(x, y)
        self.px[i] = r
        self.px[i + 1] = g
        self.px[i + 2] = b
        self.px[i + 3] = a

    def alpha(self, x, y):
        return self.px[(y * self.w + x) * 4 + 3]

    def crop(self, x0, y0, w, h):
        out = Image(w, h)
        for y in range(h):
            sy = y0 + y
            if sy < 0 or sy >= self.h:
                continue
            src = (sy * self.w + x0) * 4
            dst = (y * w) * 4
            n = min(w, self.w - x0) * 4
            if n > 0:
                out.px[dst:dst + n] = self.px[src:src + n]
        return out

    def blit(self, other, x0, y0):
        """Copy `other` in, respecting its alpha (source-over)."""
        for y in range(other.h):
            ty = y0 + y
            if ty < 0 or ty >= self.h:
                continue
            for x in range(other.w):
                tx = x0 + x
                if tx < 0 or tx >= self.w:
                    continue
                sr, sg, sb, sa = other.get(x, y)
                if sa == 0:
                    continue
                if sa == 255:
                    self.set(tx, ty, sr, sg, sb, 255)
                    continue
                dr, dg, db, da = self.get(tx, ty)
                a = sa / 255.0
                self.set(
                    tx, ty,
                    int(sr * a + dr * (1 - a)),
                    int(sg * a + dg * (1 - a)),
                    int(sb * a + db * (1 - a)),
                    max(da, sa),
                )


def _paeth(a, b, c):
    p = a + b - c
    pa = abs(p - a)
    pb = abs(p - b)
    pc = abs(p - c)
    if pa <= pb and pa <= pc:
        return a
    if pb <= pc:
        return b
    return c


def read_png(path):
    """Load a PNG into an RGBA `Image`."""
    data = open(path, "rb").read()
    if data[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError(f"{path} is not a PNG")

    pos = 8
    idat = bytearray()
    palette = None
    trns = None
    width = height = bitdepth = colortype = interlace = 0

    while pos < len(data):
        (length,) = struct.unpack(">I", data[pos:pos + 4])
        tag = data[pos + 4:pos + 8]
        chunk = data[pos + 8:pos + 8 + length]
        pos += 12 + length

        if tag == b"IHDR":
            width, height, bitdepth, colortype, _comp, _filt, interlace = struct.unpack(">IIBBBBB", chunk)
        elif tag == b"PLTE":
            palette = chunk
        elif tag == b"tRNS":
            trns = chunk
        elif tag == b"IDAT":
            idat += chunk
        elif tag == b"IEND":
            break

    if bitdepth != 8:
        raise ValueError(f"{path}: only 8-bit PNGs are supported (got {bitdepth})")
    if interlace != 0:
        raise ValueError(f"{path}: interlaced PNGs are not supported")

    channels = {0: 1, 2: 3, 3: 1, 4: 2, 6: 4}[colortype]
    raw = zlib.decompress(bytes(idat))
    stride = width * channels

    # Undo the per-scanline filters in place.
    out = bytearray(height * stride)
    prev = bytearray(stride)
    p = 0
    for y in range(height):
        ft = raw[p]
        p += 1
        line = bytearray(raw[p:p + stride])
        p += stride
        if ft == 1:
            for i in range(channels, stride):
                line[i] = (line[i] + line[i - channels]) & 0xFF
        elif ft == 2:
            for i in range(stride):
                line[i] = (line[i] + prev[i]) & 0xFF
        elif ft == 3:
            for i in range(stride):
                a = line[i - channels] if i >= channels else 0
                line[i] = (line[i] + ((a + prev[i]) >> 1)) & 0xFF
        elif ft == 4:
            for i in range(stride):
                a = line[i - channels] if i >= channels else 0
                c = prev[i - channels] if i >= channels else 0
                line[i] = (line[i] + _paeth(a, prev[i], c)) & 0xFF
        elif ft != 0:
            raise ValueError(f"{path}: unknown filter type {ft}")
        out[y * stride:(y + 1) * stride] = line
        prev = line

    img = Image(width, height)
    px = img.px
    for i in range(width * height):
        s = i * channels
        d = i * 4
        if colortype == 0:      # grey
            v = out[s]
            px[d] = px[d + 1] = px[d + 2] = v
            px[d + 3] = 255
        elif colortype == 2:    # rgb
            px[d] = out[s]
            px[d + 1] = out[s + 1]
            px[d + 2] = out[s + 2]
            px[d + 3] = 255
        elif colortype == 3:    # palette
            n = out[s]
            px[d] = palette[n * 3]
            px[d + 1] = palette[n * 3 + 1]
            px[d + 2] = palette[n * 3 + 2]
            px[d + 3] = trns[n] if trns and n < len(trns) else 255
        elif colortype == 4:    # grey + alpha
            v = out[s]
            px[d] = px[d + 1] = px[d + 2] = v
            px[d + 3] = out[s + 1]
        else:                   # rgba
            px[d:d + 4] = out[s:s + 4]
    return img


def _filter_row(line, prev, bpp):
    """
    Pick the scanline filter that compresses best.

    The usual heuristic: keep the filter with the smallest sum of absolute
    (signed) differences, which correlates with how small deflate can make the
    row. It wins on photographic data; on the current sprite atlas — long runs
    of transparent zeros — plain None still compresses smaller, which is why
    write_png measures rather than assumes.
    """
    n = len(line)
    candidates = []

    none = bytes(line)
    candidates.append((0, none))

    sub = bytearray(n)
    for i in range(n):
        a = line[i - bpp] if i >= bpp else 0
        sub[i] = (line[i] - a) & 0xFF
    candidates.append((1, bytes(sub)))

    up = bytearray(n)
    for i in range(n):
        up[i] = (line[i] - prev[i]) & 0xFF
    candidates.append((2, bytes(up)))

    avg = bytearray(n)
    for i in range(n):
        a = line[i - bpp] if i >= bpp else 0
        avg[i] = (line[i] - ((a + prev[i]) >> 1)) & 0xFF
    candidates.append((3, bytes(avg)))

    pae = bytearray(n)
    for i in range(n):
        a = line[i - bpp] if i >= bpp else 0
        c = prev[i - bpp] if i >= bpp else 0
        pae[i] = (line[i] - _paeth(a, prev[i], c)) & 0xFF
    candidates.append((4, bytes(pae)))

    def score(data):
        return sum(v if v < 128 else 256 - v for v in data)

    ft, best = min(candidates, key=lambda c: score(c[1]))
    return ft, best


def _apply_filter(line, prev, bpp, mode):
    n = len(line)
    if mode == 0:
        return bytes(line)
    out = bytearray(n)
    for i in range(n):
        a = line[i - bpp] if i >= bpp else 0
        b = prev[i]
        if mode == 1:
            out[i] = (line[i] - a) & 0xFF
        elif mode == 2:
            out[i] = (line[i] - b) & 0xFF
        elif mode == 3:
            out[i] = (line[i] - ((a + b) >> 1)) & 0xFF
        else:
            c = prev[i - bpp] if i >= bpp else 0
            out[i] = (line[i] - _paeth(a, b, c)) & 0xFF
    return bytes(out)


def _filtered(img, mode):
    """Filter every scanline with `mode`; `None` picks per row adaptively."""
    stride = img.w * 4
    raw = bytearray()
    prev = bytearray(stride)
    for y in range(img.h):
        line = img.px[y * stride:(y + 1) * stride]
        if mode is None:
            ft, data = _filter_row(line, prev, 4)
        else:
            ft, data = mode, _apply_filter(line, prev, 4, mode)
        raw.append(ft)
        raw += data
        prev = line
    return bytes(raw)


def write_png(path, img):
    """
    Write an RGBA `Image` out as a PNG.

    The atlas is precached for offline play, so size matters more than encode
    time here: every filter strategy is tried and the smallest deflate output
    wins. On sprite sheets — large transparent runs, hard pixel edges — the
    best strategy is not the same one every time.
    """
    best = None
    for mode in (0, 1, 2, 3, 4, None):
        packed = zlib.compress(_filtered(img, mode), 9)
        if best is None or len(packed) < len(best):
            best = packed

    def chunk(tag, payload):
        return (struct.pack(">I", len(payload)) + tag + payload
                + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF))

    out = b"\x89PNG\r\n\x1a\n"
    out += chunk(b"IHDR", struct.pack(">IIBBBBB", img.w, img.h, 8, 6, 0, 0, 0))
    out += chunk(b"IDAT", best)
    out += chunk(b"IEND", b"")
    with open(path, "wb") as fh:
        fh.write(out)
    return len(out)
