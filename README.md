# patrickcowhill.com

Source for Patrick Cowhill's professional portfolio. The site is a lightweight
static site (plain HTML, CSS, and a small amount of dependency-free JavaScript)
deployed to GitHub Pages by GitHub Actions on every push to `main`.

## Layout

```
site/                       Everything under here is what gets deployed
  index.html                Homepage (all copy lives here, in clearly commented sections)
  resume/index.html         Placeholder page for the public résumé
  assets/css/styles.css     Design tokens (light + dark), layout, components
  assets/js/theme.js        Applies a saved theme before first paint
  assets/js/main.js         Theme toggle, mobile nav, current-section highlighting
  assets/js/polyhedron.js   Animated rhombic dodecahedron (2D canvas, no libraries)
  assets/img/               SVG icon, social image, case-study diagrams
  assets/docs/              Drop the sanitized résumé PDF and case-study documents here
  .nojekyll                 Tells Pages to serve files as-is
.github/workflows/pages.yml GitHub Pages deployment workflow
```

## Editing content

All visible copy is in `site/index.html`. Each section is marked with a banner
comment (`1. HERO`, `2. WHAT I BRING`, ...). Colors, spacing, and typography are
CSS custom properties at the top of `site/assets/css/styles.css`; the dark theme
overrides the same tokens.

Placeholders that still need real links or files are marked in the HTML with a
`data-todo="..."` attribute and render with a small "pending" tag. Search for
`data-todo` to find them all.

## Running locally

No build step and no dependencies. Serve the `site/` directory with any static
file server, for example:

```sh
python3 -m http.server 8000 --directory site
# then open http://localhost:8000
```

or, with Node installed:

```sh
npx serve site
```

## Deployment

Pushing to `main` runs `.github/workflows/pages.yml`, which uploads `site/` as
the Pages artifact and deploys it with `actions/deploy-pages`. The workflow can
also be started manually from the Actions tab (`workflow_dispatch`).

The repository's Pages source must be set to **GitHub Actions**
(Settings → Pages → Build and deployment → Source). The workflow attempts to
enable this automatically on first run.

## Custom domain

The site is currently served from the default GitHub Pages URL. When it is time
to move `patrickcowhill.com` over, add a `site/CNAME` file containing the domain
and configure DNS per GitHub's documentation. Do not do this until the draft
has been reviewed.
