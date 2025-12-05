# Javy’s Photography (Production-ready static site)

A fast, accessible, single-page portfolio built for GitHub Pages.  
No frameworks or build pipeline required to view the site — just open index.html.  
Optional Node-based script is included to (re)generate optimized images.

Key improvements for production
- Accessibility
  - Full keyboard support for gallery (Tab focus, Enter/Space opens modal)
  - Visible focus indicators on thumbnails and their parent figure cards
  - Modal: focus trap and Escape to close, returns focus to opener
  - Skip to main content link
  - ARIA fixes and labels (modal labeled as Image viewer)
- Performance and UX
  - Optimized responsive images generated in AVIF/WebP/JPEG with modern <picture> markup
  - Lazy loading and async decoding for gallery images
  - Hero image preloaded to reduce Largest Contentful Paint
  - Sticky header that gently appears after initial scroll threshold
- Code cleanup
  - Removed unused CSS and legacy code
  - Fixed selector mismatches and a small CSS variable bug
  - .gitignore tailored for this project and GitHub Pages

Repository layout
- index.html — the one-page site
- css/style.css — global styles
- scripts/navBar.js — navigation, reveal-on-scroll, gallery modal logic
- images/ — original assets
  - images/optimized/thumbs — 480px thumbnails (avif/webp/jpg)
  - images/optimized/large — ~1600px large images (avif/webp/jpg)
- scripts/optimize-images.mjs — optional Node script to (re)build optimized images
- CNAME — required for custom domain on GitHub Pages
- .gitignore — ignores OS/editor/tooling artifacts

Local development (no build step needed)
- Option A: Double-click index.html to open in your browser.
- Option B (recommended for routing and CORS correctness): run a simple local server:
  - Python 3: python3 -m http.server 8080
  - Node: npx http-server -p 8080
  - Then visit http://localhost:8080

Optional: regenerate optimized images
This repo already includes optimized images. If you change images or want to regenerate:

Prerequisites
- Node.js ≥ 18
- macOS users may need Xcode Command Line Tools for native deps (sharp), though prebuilt binaries are typically used.

Install dependencies
- npm install

Run optimization
- npm run optimize

What it does
- Scans images/ for originals
- Writes responsive outputs to:
  - images/optimized/thumbs/*@480.{avif,webp,jpg}
  - images/optimized/large/*@1600.{avif,webp,jpg}

How to add new gallery photos
1) Put your original image(s) in images/
2) Run npm run optimize
3) Add a new figure to the Gallery in index.html, following the pattern:
   <figure class="gallery-item">
     <picture>
       <source type="image/avif" srcset="images/optimized/thumbs/photo_X@480.avif">
       <source type="image/webp" srcset="images/optimized/thumbs/photo_X@480.webp">
       <img class="gallery-item__image"
            src="images/optimized/thumbs/photo_X@480.jpg"
            alt="descriptive alt text"
            loading="lazy"
            decoding="async"
            data-full="images/optimized/large/photo_X@1600.jpg">
     </picture>
   </figure>

Accessibility features to verify
- Tab into the gallery: a visible focus ring appears
- Press Enter/Space on a focused thumbnail: dialog opens
- Use Escape to close; focus returns to the previously focused thumbnail
- Try the “Skip to main content” link (Tab from top)

Performance notes
- The hero image is preloaded via <link rel="preload" as="image">
- Thumbnails are lazy loaded and async decoded
- Modern AVIF/WebP formats are used with JPEG fallbacks
- Keep images under reasonable sizes; the optimize script helps.

Deploying to GitHub Pages
- The project is already structured for Pages from the repository root
- Keep CNAME in the repo to retain the custom domain
- Commit and push changes to publish

  git add .
  git commit -m "Update site"
  git push origin main

Troubleshooting
- If node_modules/ or other ignored files were committed earlier:
  git rm -r --cached node_modules
  git commit -m "Remove node_modules from repo"
  git push
- If sharp fails to install, ensure Node ≥ 18. If needed, reinstall with npm rebuild sharp.

License
- All photos © their respective owner. Site code is provided for this project deployment.
