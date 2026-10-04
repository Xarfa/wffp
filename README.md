# wffp

Static portfolio of **RattryWu** — [xarfa.github.io/wffp](https://xarfa.github.io/wffp/)

Hand-built HTML + CSS, no framework, no build step. Deployed with GitHub Pages.

## Structure

| Path | What |
|---|---|
| `index.html` | Landing — projects + contact form |
| `wf672/index.html` | Project page — section gallery |
| `style.css` | All styles; exactly three font sizes (display / text / fine) |
| `favicon.svg` | The orange dot |
| `assets/` | Images used by the pages |

## Editing

- Pages reference images by path — drop a new file into `assets/` and point the `<img src>` at it, or overwrite an existing name.
- Figures live in `D:\工作室\wf672\2026.10.3 v1.0.0\` (figs.py + figs_wide.py generate them; `_wide` = landscape/transposed).
- The contact form posts to [formsubmit.co](https://formsubmit.co) and forwards to rattry4codex@163.com — no backend, no keys. First submission needs the activation link clicked in the 163 inbox.
