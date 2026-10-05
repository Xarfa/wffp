# -*- coding: utf-8 -*-
"""wffp visitor map: fetch GoatCounter locations, render the dot-map SVG committed to the site.

Stdlib only. The land grid + country points below were generated from Natural Earth
and are embedded so the Action needs no downloads. Run weekly by
.github/workflows/visitor-map.yml.

Env: GOATCOUNTER_TOKEN - GoatCounter API key (repo secret). Without it the script
writes the empty-state map and exits 0, so a missing token never breaks the workflow.
"""
import json, os, sys, urllib.request
from datetime import date, timedelta

SITE = "rattrywu"
OUT = "assets/visitors.svg"
DAYS = 30
COLS, ROWS = 96, 40
LON0, LON1 = -180.0, 180.0
LAT0, LAT1 = -57.0, 84.0
PITCH = 4.5
PAD = 4
INK, MUTE, LINE, ACCENT = "#141414", "#6E6F6B", "#E7E6E1", "#E8571A"
W = int(COLS * PITCH + PAD * 2)
H = int(ROWS * PITCH + PAD * 2)
OX, OY = PAD, PAD

LAND_HEX = [
    "0000007efc00000000000000",
    "000094efff07180000080000",
    "0000ee07ff070080003fe000",
    "00806f0ffe030040f4ffe300",
    "f1ff8932fc00f087ffffffff",
    "f2ffff3b1c0cf8f9ffffffff",
    "f0ff7f181800deffffffff33",
    "00f07f780040c8ffffff1f0c",
    "00f0fffb01a0fcffffff1f04",
    "00c0ffff0000ffffffff1f00",
    "0080ff7f0080ffffffff1f00",
    "0080ff1f0040fbd8ffff4f00",
    "0080ff0f00c0a4dfffff2300",
    "0000ff0f004007fcffff3400",
    "0000fe0700c007feffff0000",
    "00007e0000e0ffffffff0100",
    "0000380400f0ff9dffff0000",
    "0000300600f0fffff83f0000",
    "0000302100f0ff7b780e0000",
    "0000800300f8ff3f101c0000",
    "0000000200f0ff27101c0000",
    "000000fc00f0ff1f20040200",
    "000000f80300fe1f00880000",
    "000000f80700fc0f00e40000",
    "000000fc0f00f80700681000",
    "000000fc7f00f80300006000",
    "000000f87f00f80700008000",
    "000000f03f00f80700000800",
    "000000f03f00f81700005e00",
    "000000e01f00f8110000ff00",
    "000000e00f00f01100c0ff00",
    "000000e00700f00100c0ff01",
    "000000e00700e0000080ff01",
    "000000e0030020000080e000",
    "000000f0010000000000e080",
    "000000700000000000008000",
    "000000700000000000000020",
    "000000300000000000000000",
    "000000300100000000000000",
    "000000200000000000000000",
]

COUNTRY_PTS = {
    "AE": (54.55, 23.47),
    "AF": (66.5, 34.16),
    "AL": (20.11, 40.65),
    "AM": (44.8, 40.46),
    "AO": (17.98, -12.18),
    "AQ": (35.89, -79.84),
    "AR": (-64.17, -33.5),
    "AT": (14.13, 47.52),
    "AU": (134.05, -24.13),
    "AZ": (47.21, 40.4),
    "BA": (18.07, 44.09),
    "BD": (89.68, 24.21),
    "BE": (4.8, 50.79),
    "BF": (-1.36, 12.67),
    "BG": (25.16, 42.51),
    "BI": (29.92, -3.33),
    "BJ": (2.35, 10.32),
    "BN": (114.55, 4.45),
    "BO": (-64.59, -16.67),
    "BR": (-49.56, -12.1),
    "BS": (-77.15, 26.4),
    "BT": (90.04, 27.54),
    "BW": (24.18, -22.1),
    "BY": (28.42, 53.82),
    "BZ": (-88.71, 17.2),
    "CA": (-101.91, 60.32),
    "CD": (23.46, -1.86),
    "CF": (20.91, 6.99),
    "CG": (15.9, 0.14),
    "CH": (7.46, 46.72),
    "CI": (-5.57, 7.49),
    "CL": (-72.32, -38.15),
    "CM": (12.47, 4.59),
    "CN": (106.34, 32.5),
    "CO": (-73.17, 3.37),
    "CR": (-84.08, 10.07),
    "CU": (-77.98, 21.33),
    "CY": (33.08, 34.91),
    "CZ": (15.38, 49.88),
    "DE": (9.68, 50.96),
    "DJ": (42.5, 11.98),
    "DK": (9.02, 55.97),
    "DO": (-70.65, 19.1),
    "DZ": (2.81, 27.4),
    "EC": (-78.19, -1.26),
    "EE": (25.87, 58.72),
    "EG": (29.45, 26.19),
    "EH": (-12.63, 23.97),
    "ER": (38.29, 15.79),
    "ES": (-3.46, 40.09),
    "ET": (39.09, 8.03),
    "FI": (27.28, 63.25),
    "FJ": (177.98, -17.83),
    "FK": (-58.74, -51.61),
    "FR": (2.55, 46.7),
    "GA": (11.84, -0.44),
    "GB": (-2.12, 54.4),
    "GE": (43.74, 41.87),
    "GH": (-1.04, 7.72),
    "GL": (-39.34, 74.32),
    "GM": (-15.0, 13.64),
    "GN": (-10.02, 10.62),
    "GQ": (8.99, 2.33),
    "GR": (21.73, 39.49),
    "GT": (-90.5, 14.98),
    "GW": (-14.52, 12.16),
    "GY": (-58.94, 5.12),
    "HN": (-86.89, 14.79),
    "HR": (16.37, 45.81),
    "HT": (-72.22, 19.26),
    "HU": (19.45, 47.09),
    "ID": (101.89, -0.95),
    "IE": (-7.8, 53.08),
    "IL": (34.85, 30.91),
    "IN": (79.36, 22.69),
    "IQ": (43.26, 33.09),
    "IR": (54.93, 32.17),
    "IS": (-18.67, 64.78),
    "IT": (11.08, 44.73),
    "JM": (-77.32, 18.14),
    "JO": (36.38, 30.81),
    "JP": (138.44, 36.14),
    "KE": (37.91, 0.55),
    "KG": (74.53, 41.67),
    "KH": (104.5, 12.65),
    "KP": (126.44, 39.89),
    "KR": (128.13, 36.38),
    "KV": (20.86, 42.59),
    "KW": (47.31, 29.41),
    "KZ": (68.69, 49.05),
    "LA": (102.53, 19.43),
    "LB": (35.99, 34.13),
    "LK": (80.7, 7.58),
    "LR": (-9.46, 6.45),
    "LS": (28.25, -29.48),
    "LT": (24.09, 55.1),
    "LU": (6.08, 49.73),
    "LV": (25.46, 57.07),
    "LY": (18.01, 26.64),
    "MA": (-7.19, 31.65),
    "MD": (28.49, 47.43),
    "ME": (19.14, 42.8),
    "MG": (46.7, -18.63),
    "MK": (21.56, 41.56),
    "ML": (-2.04, 18.69),
    "MM": (95.8, 21.57),
    "MN": (104.15, 46.0),
    "MR": (-9.74, 19.59),
    "MW": (33.61, -13.39),
    "MX": (-102.29, 23.92),
    "MY": (113.84, 2.53),
    "MZ": (37.84, -13.94),
    "NA": (17.11, -20.58),
    "NC": (165.08, -21.06),
    "NE": (9.5, 17.45),
    "NG": (7.5, 9.44),
    "NI": (-85.07, 12.67),
    "NL": (5.61, 52.42),
    "NO": (9.68, 61.36),
    "NP": (83.64, 28.3),
    "NZ": (172.79, -39.76),
    "OM": (57.34, 22.12),
    "PA": (-80.35, 8.72),
    "PE": (-72.9, -12.98),
    "PG": (143.91, -5.7),
    "PH": (122.47, 11.2),
    "PK": (68.55, 29.33),
    "PL": (19.49, 51.99),
    "PR": (-66.48, 18.23),
    "PS": (35.29, 32.05),
    "PT": (-8.27, 39.61),
    "PY": (-60.15, -21.67),
    "QA": (51.14, 25.24),
    "RO": (24.97, 45.73),
    "RS": (20.79, 44.19),
    "RU": (44.69, 58.25),
    "RW": (30.1, -1.9),
    "SA": (44.7, 23.81),
    "SB": (159.17, -8.03),
    "SD": (29.26, 16.33),
    "SE": (19.02, 65.86),
    "SI": (14.92, 46.06),
    "SK": (19.05, 48.73),
    "SL": (-11.76, 8.62),
    "SN": (-14.78, 15.14),
    "SO": (45.19, 3.57),
    "SR": (-55.91, 4.14),
    "SS": (30.39, 7.23),
    "SV": (-88.89, 13.69),
    "SY": (38.28, 35.01),
    "SZ": (31.47, -26.53),
    "TD": (18.65, 15.14),
    "TF": (69.12, -49.3),
    "TG": (1.06, 8.81),
    "TH": (101.07, 15.46),
    "TJ": (72.59, 38.2),
    "TL": (125.85, -8.8),
    "TM": (58.68, 39.86),
    "TN": (9.01, 33.69),
    "TR": (34.51, 39.35),
    "TT": (-60.92, 11.0),
    "TW": (120.87, 23.65),
    "TZ": (34.96, -6.05),
    "UA": (32.14, 49.72),
    "UG": (32.95, 1.97),
    "US": (-97.48, 39.54),
    "UY": (-55.97, -32.96),
    "UZ": (64.01, 41.69),
    "VE": (-64.6, 7.18),
    "VN": (105.39, 21.72),
    "VU": (166.91, -15.37),
    "YE": (45.87, 15.33),
    "ZA": (23.67, -29.71),
    "ZM": (26.4, -14.66),
    "ZW": (29.93, -18.91),
}


# ---------- grid helpers ----------
def row_bits(r):
    return int.from_bytes(bytes.fromhex(LAND_HEX[r]), "little")

def land_at(c, r):
    return (row_bits(r) >> c) & 1

def cell_of(lon, lat):
    c = int((lon - LON0) / (LON1 - LON0) * COLS)
    r = int((LAT1 - lat) / (LAT1 - LAT0) * ROWS)
    return c, r

def snap_to_land(lon, lat):
    c, r = cell_of(lon, lat)
    if land_at(c, r):
        return c, r
    for rad in range(1, 7):
        for dr in range(-rad, rad + 1):
            for dc in range(-rad, rad + 1):
                if max(abs(dr), abs(dc)) != rad:
                    continue
                if land_at(c + dc, r + dr):
                    return c + dc, r + dr
    return None

# ---------- data ----------
def fetch_locations():
    token = os.environ.get("GOATCOUNTER_TOKEN")
    if not token:
        print("no GOATCOUNTER_TOKEN -> empty state")
        return {}, {}
    start = (date.today() - timedelta(days=DAYS)).isoformat()
    url = f"https://{SITE}.goatcounter.com/api/v0/stats/locations?start={start}&limit=200"
    req = urllib.request.Request(url, headers={
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "User-Agent": "wffp-visitor-map",
    })
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read().decode("utf-8"))
        out, names = {}, {}
        for s in data.get("stats", []):
            code = (s.get("id") or "").upper()
            if len(code) == 2:
                out[code] = out.get(code, 0) + int(s.get("count") or 0)
                if s.get("name"):
                    names[code] = s["name"]
        print(f"fetched {len(out)} countries, {sum(out.values())} hits")
        return out, names
    except Exception as e:
        print(f"api error -> empty state: {e}")
        return {}, {}

def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

def render(counts):
    visited = set()
    for code, n in counts.items():
        pt = COUNTRY_PTS.get(code)
        if not pt or n <= 0:
            continue
        cell = snap_to_land(pt[0], pt[1])
        if cell:
            visited.add(cell)

    o = []
    o.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">')
    o.append(f'<rect width="{W}" height="{H}" fill="#FFFFFF"/>')
    for r in range(ROWS):
        y = OY + r * PITCH + PITCH / 2
        bits = row_bits(r)
        for c in range(COLS):
            if (bits >> c) & 1:
                x = OX + c * PITCH + PITCH / 2
                if (c, r) in visited:
                    o.append(f'<circle cx="{x}" cy="{y}" r="2.4" fill="{ACCENT}"/>')
                else:
                    o.append(f'<circle cx="{x}" cy="{y}" r="1.9" fill="{LINE}"/>')
    o.append("</svg>")
    return "\n".join(o) + "\n"

def main():
    counts, names = fetch_locations()
    svg = render(counts)
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(svg)
    print("wrote", OUT, len(svg), "bytes")

if __name__ == "__main__":
    main()
