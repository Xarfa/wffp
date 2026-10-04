# wffp

Static portfolio of **rattry wu** — [xarfa.github.io/wffp](https://xarfa.github.io/wffp/)

Hand-built HTML + CSS, no framework, no build step. Deployed with GitHub Pages.

## Structure

| Path | What |
|---|---|
| `index.html` | Landing — projects + contact form |
| `wf672/index.html` | Project page — text framework + figure slots |
| `style.css` | All styles |
| `favicon.svg` | The orange dot |
| `assets/` | Images used by the pages |

## Editing

- Pages reference images by path — drop a new file into `assets/` and point the `<img src>` at it, or overwrite an existing name.
- Figure slots on the wf672 page are `<figure class="ph">` placeholders with the intended size in the label; swap each for an `<img>` when the render lands.
- The contact form posts to [formsubmit.co](https://formsubmit.co) and forwards to rattry4codex@163.com — no backend, no keys.
