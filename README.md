# Htoo & May — The Gift Edit

Guest gift catalogue for Htoo & May's wedding, published on GitHub Pages:
https://msburberryy-web.github.io/HtooAndMay_GiftToYou/

- **Front end:** React + Vite (`app/`, `lib/`, `components/`). Built and deployed by GitHub Actions on every push to `main`.
- **Back end:** Google Apps Script web app (`setup/Code.gs`) reading and writing the RSVP and Gift Manager Google Sheets. The page calls it at the URL in `lib/api.ts`.
- **Guest codes, delivery details and secrets** are never stored in this repo.

Setup, sheet management and the pre-launch live test: [`setup/INSTALL.md`](setup/INSTALL.md).

```bash
npm install
npm run dev     # local preview
npm test        # Apps Script logic against a simulated sheet
npm run build   # type-check + production build into dist/
```

Product photos are still served from the old Sites domain. To host them here, add the files to `public/products/` and put the file names in the Catalogue tab's `Image` column.
