/* portfolio-2026 — app.js
   password gate -> PBKDF2 -> AES-GCM unlock -> render -> lazy image decrypt. */
(() => {
"use strict";

const $ = (id) => document.getElementById(id);
const b64toBytes = (b) => Uint8Array.from(atob(b), (c) => c.charCodeAt(0));
const enc = new TextEncoder();
const dec = new TextDecoder();

// cache-bust every fetch with the build stamp carried by app.js?v=…
const ASSET_V = (() => {
  const s = document.querySelector('script[src*="app.js"]');
  try { return new URL(s.src).searchParams.get("v") || "0"; } catch (_) { return "0"; }
})();
const bust = (url) => url + (url.includes("?") ? "&" : "?") + "v=" + ASSET_V;

let MANIFEST = null;
let CONTENT = null;
let contentKey = null;      // CryptoKey (AES-GCM)
let failed = 0, lockedUntil = 0;

/* ---------- crypto ---------- */
async function deriveMaster(pw, saltB64, iters) {
  const base = await crypto.subtle.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: b64toBytes(saltB64), iterations: iters, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
}
async function gcmDecrypt(key, ivB64, data) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64toBytes(ivB64) }, key, data);
  return new Uint8Array(pt);
}
const fetchBytes = (url) => fetch(bust(url)).then((r) => {
  if (!r.ok) throw new Error("fetch " + url + " -> " + r.status);
  return r.arrayBuffer();
});

/* ---------- gate ---------- */
async function unlock(pw) {
  const kdf = MANIFEST.kdf;
  const mk = await deriveMaster(pw, kdf.salt, kdf.iters);
  const check = await gcmDecrypt(mk, MANIFEST.verifier.iv, b64toBytes(MANIFEST.verifier.ct).buffer);
  if (dec.decode(check) !== "portfolio-2026-ok") throw new Error("bad password");
  const ckRaw = await gcmDecrypt(mk, MANIFEST.ck.iv, b64toBytes(MANIFEST.ck.ct).buffer);
  contentKey = await crypto.subtle.importKey("raw", ckRaw, "AES-GCM", true, ["decrypt"]);
  // keep the raw content key for reloads this session
  let bin = ""; ckRaw.forEach((b) => (bin += String.fromCharCode(b)));
  try { sessionStorage.setItem("p2026.ck", btoa(bin)); } catch (_) {}
}

async function bootFromSession() {
  let b64ck = null;
  try { b64ck = sessionStorage.getItem("p2026.ck"); } catch (_) {}
  if (!b64ck) return false;
  const raw = Uint8Array.from(atob(b64ck), (c) => c.charCodeAt(0));
  try {
    contentKey = await crypto.subtle.importKey("raw", raw, "AES-GCM", true, ["decrypt"]);
    await loadContent();
    return true;
  } catch (_) { return false; }
}

async function loadContent() {
  const info = MANIFEST.files["content.bin"];
  const ct = await fetchBytes("assets/content.bin");
  const pt = await gcmDecrypt(contentKey, info.iv, ct);
  CONTENT = JSON.parse(dec.decode(pt));
}

/* ---------- render ---------- */
const imgRegistry = [];   // {imgEl, file, iv, loaded}

function el(html) {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

function figHTML(f, cls) {
  const portrait = f.h > f.w ? "portrait" : "";
  const meta = f.meta ? `<span class="meta">${f.meta}</span>` : "";
  const cap = f.cap ? `<div class="figcap reveal">${meta}<span class="cap">${f.cap}</span></div>` : "";
  return `<figure class="fig ${portrait} ${cls || ""}">
    <div class="plate" style="aspect-ratio:${f.w} / ${f.h}"><img class="decoding" data-file="${f.src}" alt=""></div>
    ${cap}</figure>`;
}

function render() {
  // nav
  $("nav").innerHTML = CONTENT.sections
    .map((s) => `<a href="#${s.id}">${s.num} ${s.short || s.title.split("—")[0].trim()}</a>`).join("");

  // hero
  $("heroName").innerHTML = CONTENT.hero.lines
    .map((line) => `<span class="ln"><span>${line}</span></span>`).join("");

  // sections
  const host = $("sections");
  for (const s of CONTENT.sections) {
    const sec = el(`<section class="section section-${s.layout}" id="${s.id}"><div class="wrap">
      <div class="section-head reveal"><span class="section-num">${s.num}</span><h2 class="section-title">${s.title}</h2></div>
      ${s.lede ? `<p class="section-lede reveal">${s.lede}</p>` : ""}
      <div class="section-body"></div>
    </div></section>`);
    const body = sec.querySelector(".section-body");

    if (s.layout === "about") {
      const a = s.about;
      body.appendChild(el(`<p class="about-bio reveal">${a.bio}</p>`));
      body.appendChild(el(`<div class="about-block reveal"><h3>Volunteering</h3>
        <ul class="about-vol">${a.volunteering.map((v) =>
          `<li>${v.icon ? `<img class="vlogo decoding" data-file="${v.icon}" alt="">` : ""}<span>${v.text}</span></li>`).join("")}</ul></div>`));
      body.appendChild(el(`<div class="about-block reveal"><h3>Software</h3>
        <ul class="about-sw">${a.software.map((v) =>
          `<li><img class="sico decoding" data-file="${v.icon}" alt=""><span>${v.text}</span></li>`).join("")}</ul></div>`));
      body.appendChild(el(`<div class="about-block reveal"><h3>Selected awards</h3>
        <ul class="about-aw">${a.awards.map((v) => `<li>${v}</li>`).join("")}</ul>
        <a class="btn-awards" href="#awards">${a.cta} ↓</a></div>`));
      s.figures.forEach((f) => body.insertAdjacentHTML("beforeend", figHTML(f, "reveal")));
    } else if (s.layout === "grid") {
      body.className = "poster-grid";
      s.figures.forEach((f) => body.insertAdjacentHTML("beforeend", figHTML(f, (f.span || "span-3") + " reveal")));
    } else if (s.layout === "lead3") {
      body.className = "";
      const lead = el(`<div class="section-lead"></div>`);
      lead.innerHTML = figHTML(s.figures[0]);
      lead.querySelector(".fig").classList.add("reveal");
      body.appendChild(lead);
      const grid = el(`<div class="lead3"></div>`);
      s.figures.slice(1).forEach((f) => grid.insertAdjacentHTML("beforeend", figHTML(f, "reveal")));
      body.appendChild(grid);
    } else if (s.layout === "masonry") {
      body.className = "masonry";
      s.figures.forEach((f, i) => {
        const fig = el(figHTML(f, "reveal"));
        fig.querySelector(".figcap").style.transitionDelay = `${(i % 3) * 90}ms`;
        fig.querySelector(".plate").style.transitionDelay = `${(i % 3) * 90}ms`;
        body.appendChild(fig);
      });
    } else { // lead / stack — consecutive "half" figures pair up on one row
      body.className = "";
      let halfBuf = [];
      const flushHalf = () => {
        if (!halfBuf.length) return;
        const row = el(`<div class="half-row"></div>`);
        halfBuf.forEach((f) => row.insertAdjacentHTML("beforeend", figHTML(f, "reveal")));
        body.appendChild(row);
        halfBuf = [];
      };
      for (const f of s.figures) {
        if (f.size === "half") { halfBuf.push(f); continue; }
        flushHalf();
        body.insertAdjacentHTML("beforeend", figHTML(f, "reveal"));
      }
      flushHalf();
    }
    host.appendChild(sec);
  }

  // footer
  const f = CONTENT.footer;
  $("footLinks").innerHTML = `
    <a href="mailto:${f.email}"><span class="k">Email</span>${f.email}</a>
    <a href="${f.github}" target="_blank" rel="noopener"><span class="k">GitHub</span>@Xarfa</a>
    <a href="${f.rednote}" target="_blank" rel="noopener"><span class="k">RedNote</span>改造我们的学习</a>`;
  $("footNote").innerHTML = `${f.note} · <a class="to-top" href="#top">Back to top ↑</a>`;

  // collect images — observe the .plate box (has real size pre-decrypt);
  // small icons (no plate) are observed directly via their fixed CSS size
  document.querySelectorAll("img[data-file]").forEach((img) => {
    const file = img.dataset.file;                       // assets/<name>.bin
    const meta = MANIFEST.files[file.split("/").pop()];  // keyed by .bin name
    const reg = { img, plate: img.closest(".plate") || img, file, iv: meta.iv };
    if (reg.plate !== img) img.addEventListener("click", () => openLightbox(reg)); // figures only
    imgRegistry.push(reg);
  });
}

/* ---------- lightbox ---------- */
let lbEl = null, lbIndex = -1;
function figureRegs() { return imgRegistry.filter((r) => r.plate !== r.img); }
function buildLightbox() {
  const lb = el(`<div class="lightbox" role="dialog" aria-modal="true" aria-label="Image preview">
    <button class="lb-close" aria-label="Close">✕</button>
    <button class="lb-nav lb-prev" aria-label="Previous">←</button>
    <button class="lb-nav lb-next" aria-label="Next">→</button>
    <figure class="lb-fig"><div class="lb-plate"><img alt=""></div><figcaption class="lb-cap"></figcaption></figure>
  </div>`);
  document.body.appendChild(lb);
  lb.addEventListener("click", (e) => {
    if (e.target === lb || e.target.closest(".lb-close")) closeLightbox();
    else if (e.target.closest(".lb-prev")) stepLightbox(-1);
    else if (e.target.closest(".lb-next")) stepLightbox(1);
  });
  document.addEventListener("keydown", (e) => {
    if (!lbEl || !lbEl.classList.contains("open")) return;
    if (e.key === "Escape") closeLightbox();
    else if (e.key === "ArrowLeft") stepLightbox(-1);
    else if (e.key === "ArrowRight") stepLightbox(1);
  });
  return lb;
}
function showLightboxIndex(i) {
  const regs = figureRegs();
  if (!regs.length) return;
  lbIndex = ((i % regs.length) + regs.length) % regs.length;
  const reg = regs[lbIndex];
  if (!reg.img.src || !reg.img.src.startsWith("blob:")) decryptImage(reg); // ensure ready
  const img = lbEl.querySelector("img");
  img.src = reg.img.src;
  const fig = reg.img.closest(".fig");
  lbEl.querySelector(".lb-cap").textContent = fig ? (fig.querySelector(".cap")?.textContent || "") : "";
}
function openLightbox(reg) {
  if (!reg.img.src || !reg.img.src.startsWith("blob:")) return; // not decrypted yet
  if (!lbEl) lbEl = buildLightbox();
  showLightboxIndex(figureRegs().indexOf(reg));
  lbEl.classList.add("open");
  document.body.style.overflow = "hidden";
}
function stepLightbox(dir) { showLightboxIndex(lbIndex + dir); }
function closeLightbox() {
  if (!lbEl || !lbEl.classList.contains("open")) return;
  lbEl.classList.remove("open");
  document.body.style.overflow = "";
}

/* ---------- reveal + lazy decrypt (geometry-driven, no IntersectionObserver
   — observer callbacks starve when the tab is hidden) ---------- */
function watchReveals() {
  const nodes = Array.from(document.querySelectorAll(".reveal"));
  const navLinks = Array.from(document.querySelectorAll(".nav a"));
  const secs = navLinks.map((a) => document.getElementById(a.getAttribute("href").slice(1)));
  const topBar = document.querySelector(".top");
  const progress = $("progress");
  let last = 0;
  const check = (force) => {
    const now = Date.now();
    if (!force && now - last < 140) return;
    last = now;
    const vh = window.innerHeight;
    const y = window.scrollY;
    // progress bar + header state + scrollspy
    if (progress) progress.style.width = Math.min(100, (y / Math.max(1, document.body.scrollHeight - vh)) * 100) + "%";
    if (topBar) topBar.classList.toggle("scrolled", y > 40);
    let current = -1;
    secs.forEach((sec, i) => { if (sec && sec.offsetTop - 140 <= y) current = i; });
    navLinks.forEach((a, i) => a.classList.toggle("active", i === current));
    // reveals + lazy decrypt
    for (const n of nodes) {
      if (n.classList.contains("in")) continue;
      const r = n.getBoundingClientRect();
      if (r.top < vh + 320 && r.bottom > -320) n.classList.add("in");
    }
    for (const reg of imgRegistry) {
      if (reg.loading) continue;
      const r = reg.plate.getBoundingClientRect();
      if (r.top < vh + 700 && r.bottom > -700) decryptImage(reg);
    }
  };
  check(true);
  window.addEventListener("scroll", () => check(false), { passive: true });
  window.addEventListener("resize", () => check(false), { passive: true });
  setInterval(() => check(true), 900);
}

async function decryptImage(reg) {
  reg.loading = true;
  try {
    const ct = await fetchBytes(reg.file);
    const pt = await gcmDecrypt(contentKey, reg.iv, ct);
    const url = URL.createObjectURL(new Blob([pt], { type: "image/jpeg" }));
    reg.img.onload = () => { reg.img.classList.remove("decoding"); reg.img.classList.add("decoded"); };
    reg.img.src = url;
  } catch (err) {
    console.error("decrypt failed", reg.file, err);
  }
}

/* ---------- reveal on scroll ---------- */
// (handled by watchReveals below — geometry-driven)

/* ---------- gate wiring ---------- */
function gateFail(msg) {
  const card = $("gateCard");
  $("gateError").textContent = msg;
  card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake");
}

async function enterSite() {
  await loadContent();
  render();
  $("site").hidden = false;
  $("gate").classList.add("open");
  setTimeout(() => $("gate").remove(), 900);
  watchReveals();
}

async function onSubmit(ev) {
  ev.preventDefault();
  const now = Date.now();
  if (now < lockedUntil) {
    gateFail(`Too many attempts — wait ${Math.ceil((lockedUntil - now) / 1000)}s.`);
    return;
  }
  const pw = $("pw").value;
  if (!pw) return;
  const btn = $("pwBtn");
  btn.disabled = true; btn.textContent = "Unlocking";
  let unlocked = false;
  try {
    await unlock(pw);
    unlocked = true;
    await enterSite();
  } catch (err) {
    failed += 1;
    if (failed >= 5) { lockedUntil = Date.now() + 30_000; failed = 0; }
    gateFail(unlocked
      ? "Content mismatch — a cached old build was served. Hold Ctrl and press F5 once, then enter again."
      : (failed >= 4 ? "Wrong password." : "Wrong password — check the invite and try again."));
    $("pw").select();
  } finally {
    btn.disabled = false; btn.textContent = "Enter";
  }
}

/* ---------- init ---------- */
(async function init() {
  try {
    MANIFEST = await fetch(bust("manifest.json")).then((r) => r.json());
  } catch (err) {
    $("gateError").textContent = "Failed to load manifest.json — open this page over http(s).";
    return;
  }
  $("gateForm").addEventListener("submit", onSubmit);
  if (await bootFromSession()) await enterSite();
})();
})();
