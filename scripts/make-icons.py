"""Renders icons/icon-{16,32,48,128}.png with no dependencies: a blue rounded tile with a white speech bubble."""
import os, struct, zlib

def inside_rrect(x, y, x0, y0, x1, y1, r):
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r and x0 <= x <= x1 and y0 <= y <= y1

def inside_tri(x, y, a, b, c):
    def s(p, q, r): return (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1])
    d1, d2, d3 = s((x, y), a, b), s((x, y), b, c), s((x, y), c, a)
    return not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))

def sample(u, v):
    """u, v in [0,1]. Returns RGBA."""
    if not inside_rrect(u, v, 0, 0, 1, 1, 0.22):
        return (0, 0, 0, 0)
    top, bottom = (0x2B, 0x88, 0xE8), (0x0A, 0x5C, 0xC2)
    bg = tuple(round(top[i] + (bottom[i] - top[i]) * v) for i in range(3))
    bubble = inside_rrect(u, v, 0.2, 0.22, 0.8, 0.66, 0.11) or inside_tri(u, v, (0.3, 0.6), (0.46, 0.6), (0.3, 0.8))
    if bubble:
        line = (0.31 <= u <= 0.69 and 0.355 <= v <= 0.415) or (0.31 <= u <= 0.56 and 0.475 <= v <= 0.535)
        return (*bg, 255) if line else (255, 255, 255, 255)
    return (*bg, 255)

def render(size, ss=6):
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            acc = [0, 0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    r, g, b, a = sample((x + (sx + 0.5) / ss) / size, (y + (sy + 0.5) / ss) / size)
                    acc[0] += r * a; acc[1] += g * a; acc[2] += b * a; acc[3] += a
            a = acc[3]
            row += bytes([round(acc[0] / a), round(acc[1] / a), round(acc[2] / a), round(a / ss / ss)] if a else [0, 0, 0, 0])
        rows.append(bytes(row))
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)
    return (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 6, 0, 0, 0))
            + chunk(b'IDAT', zlib.compress(b''.join(rows), 9)) + chunk(b'IEND', b''))

out = os.path.join(os.path.dirname(__file__), '..', 'icons')
for size in (16, 32, 48, 128):
    with open(os.path.join(out, f'icon-{size}.png'), 'wb') as f:
        f.write(render(size))
print('icons written')
