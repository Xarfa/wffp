/* visitor cities map — dot-matrix world, land grid from Natural Earth (96×40),
   same grid as the site's retired weekly-render map. Records unique visitor
   cities only; nothing on this page or in the store counts visits. */
(function () {
  "use strict";

  var API = "https://wffp-visitors.pages.dev";

  /* ---- land grid ---- */
  var COLS = 96, ROWS = 40, PITCH = 7, OX = 0, OY = 6;
  var LON0 = -180, LON1 = 180, LAT0 = -57, LAT1 = 84;
  var LAND_HEX = [
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
    "000000200000000000000000"
  ];

  var rowCache = null;
  function rowBits(r) {
    if (!rowCache) {
      rowCache = LAND_HEX.map(function (hex) {
        var v = 0n;
        for (var i = hex.length / 2 - 1; i >= 0; i--) {
          v = (v << 8n) | BigInt(parseInt(hex.substr(i * 2, 2), 16));
        }
        return v;
      });
    }
    return rowCache[r];
  }
  function landAt(c, r) {
    if (r < 0 || r >= ROWS) return 0n;
    c = ((c % COLS) + COLS) % COLS;
    return (rowBits(r) >> BigInt(c)) & 1n;
  }
  function cellOf(lon, lat) {
    var c = Math.floor(((lon - LON0) / (LON1 - LON0)) * COLS);
    var r = Math.floor(((LAT1 - lat) / (LAT1 - LAT0)) * ROWS);
    return [Math.max(0, Math.min(COLS - 1, c)), Math.max(0, Math.min(ROWS - 1, r))];
  }
  function snapToLand(c, r) {
    if (landAt(c, r)) return [c, r];
    for (var rad = 1; rad <= 6; rad++) {
      for (var dr = -rad; dr <= rad; dr++) {
        for (var dc = -rad; dc <= rad; dc++) {
          if (Math.max(Math.abs(dr), Math.abs(dc)) !== rad) continue;
          if (landAt(c + dc, r + dr)) return [c + dc, r + dr];
        }
      }
    }
    return null;
  }

  /* ---- render ---- */
  var SVGNS = "http://www.w3.org/2000/svg";
  var LINE = "#e7e6e1", ACCENT = "#e8571a";
  var W = COLS * PITCH, H = ROWS * PITCH + OY * 2;

  function el(name, attrs) {
    var n = document.createElementNS(SVGNS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function render(cities) {
    var host = document.getElementById("visitors");
    if (!host) return;
    host.textContent = "";

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": "Map of visitor cities" });

    var r, c, bits;
    for (r = 0; r < ROWS; r++) {
      bits = rowBits(r);
      for (c = 0; c < COLS; c++) {
        if ((bits >> BigInt(c)) & 1n) {
          svg.appendChild(el("circle", {
            cx: OX + c * PITCH + PITCH / 2,
            cy: OY + r * PITCH + PITCH / 2,
            r: 2.1, fill: LINE
          }));
        }
      }
    }

    var byCell = {};
    var named = [];
    cities.forEach(function (v) {
      if (typeof v.lon !== "number" || typeof v.lat !== "number") return;
      var cell = snapToLand.apply(null, cellOf(v.lon, v.lat));
      if (!cell) return;
      var k = cell[0] + "," + cell[1];
      if (!byCell[k]) byCell[k] = { c: cell[0], r: cell[1], names: [] };
      byCell[k].names.push(v.city + (v.country ? ", " + countryLabel(v.country) : ""));
      named.push(v.city);
    });
    Object.keys(byCell).forEach(function (k) {
      var g = byCell[k];
      var dot = el("circle", {
        cx: OX + g.c * PITCH + PITCH / 2,
        cy: OY + g.r * PITCH + PITCH / 2,
        r: 2.7, fill: ACCENT
      });
      var t = document.createElementNS(SVGNS, "title");
      t.textContent = g.names.join(" · ");
      dot.appendChild(t);
      svg.appendChild(dot);
    });

    host.appendChild(svg);

    if (named.length) {
      var line = document.createElement("p");
      line.className = "v-cities";
      line.textContent = named.join(" · ");
      host.appendChild(line);
    }
  }

  /* ---- data ---- */
  // 港澳台按中国口径显示，避免悬停提示里出现单列的国家代码
  var COUNTRY_FIX = { TW: "China", HK: "China", MO: "China" };
  function countryLabel(cc) {
    return COUNTRY_FIX[cc] || cc;
  }

  function getCities(tries) {
    var n = tries || 0;
    return fetch(API + "/cities")
      .then(function (r) { return r.json(); })
      .then(function (d) { return d.cities || []; })
      .catch(function (e) {
        if (n < 1) {
          return new Promise(function (res) { setTimeout(res, 1500); }).then(function () { return getCities(n + 1); });
        }
        throw e;
      });
  }

  function ping() {
    try {
      if (navigator.webdriver) return;
      fetch(API + "/ping", { method: "POST", keepalive: true })
        .then(function (r) { return r.json(); })
        .then(function (d) { if (d && d.cities) render(d.cities); })
        .catch(function () {});
    } catch (e) {}
  }

  function start() {
    if (location.protocol === "file:") return;
    render([]); // 灰色底图纯本地数据，先画出来；橙点等数据到了再补
    getCities().then(render).catch(function () {});
    ping();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();
