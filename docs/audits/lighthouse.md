# Lighthouse audit — 2026-05-09

Captured against the production build (`npm run build`) served via
`vite preview` on http://127.0.0.1:4173/ over headless Chromium.

## Scores

| Category | Score |
|---|---|
| Performance | **89 / 100** |
| Accessibility | **93 / 100** |
| Best Practices | **96 / 100** |
| SEO | **92 / 100** |

## Performance metrics

| Metric | Value |
|---|---|
| First Contentful Paint | 3.0 s |
| Largest Contentful Paint | 3.0 s |
| Speed Index | 3.0 s |
| Total Blocking Time | 0 ms |
| Cumulative Layout Shift | 0.051 |
| Time to Interactive | 3.0 s |

## Findings worth fixing

- **Reduce unused JavaScript** *(priority: medium)*  
  Reduce unused JavaScript and defer loading scripts until they are required to decrease bytes consumed by network activity.
- **Eliminate render-blocking resources** *(priority: low)*  
  Resources are blocking the first paint of your page.
- **Background and foreground colors do not have a sufficient contrast ratio.** *(priority: high)*  
  Low-contrast text is difficult or impossible for many users to read.
- **Browser errors were logged to the console** *(priority: low)*  
  Errors logged to the console indicate unresolved problems.
- **robots.txt is not valid** *(priority: low)*  
  If your robots.txt file is malformed, crawlers may not be able to understand how you want your website to be crawled or indexed.
- **Avoid serving legacy JavaScript to modern browsers** *(priority: medium)*  
  Polyfills and transforms enable legacy browsers to use new JavaScript features.

## Re-running

```bash
cd frontend && npm run build && npx vite preview --port 4173 &
cd e2e && node_modules/.bin/lighthouse http://127.0.0.1:4173/ \
  --chrome-flags='--headless --no-sandbox' \
  --output=html --output-path=../docs/audits/lighthouse.html
```
