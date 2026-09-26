# nanohash.biz

Website for NanoHash: the company page and the product pages for TidyUp PC and NanoPDF.

Static HTML with no build step. Thai copy lives in the HTML; English copy lives in `nh-copy-*.js`, and `nh-i18n.js` switches between them.

| Page | File |
|---|---|
| Company | `nanohash.html` (served at `/`) |
| TidyUp PC | `tidyup.html` |
| NanoPDF | `nanopdf.html` |

Check the pages before pushing:

```
node tests/check-site.mjs
```
