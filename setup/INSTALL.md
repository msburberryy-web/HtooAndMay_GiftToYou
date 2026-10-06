# Gift page setup — GitHub Pages + Apps Script + Google Sheets

The guest page (this repo) is published on GitHub Pages and talks directly to the gift Apps Script web app (`setup/Code.gs`).
No ChatGPT Sites backend is used for orders. Guest codes, delivery details and secrets live only in your Google Sheets.

## 1. Update Apps Script (do this first)

1. Open the gift Apps Script project whose deployment URL is in `lib/api.ts`. Leave the separate RSVP form script untouched.
2. Replace **all** of `Code.gs` with `setup/Code.gs` from this repo. Save.
3. In the function menu choose **setupGiftStandalone** and press **Run**. Approve the Google permissions.
   It adds the gift columns to RSVPs, the email/First-submitted columns (Q:T) and activity columns (U:Z) to Couples, and creates the **Catalogue** and **Gift settings** tabs in Gift Manager. It does not issue codes, send emails or open orders.
4. **Deploy › Manage deployments ›** the existing web-app deployment **› ✏️ Edit › Version: New version › Deploy**.
   Execute as: **Me**. Who has access: **Anyone**. This keeps the same `/exec` URL.
   (Choosing *New deployment* instead creates a new URL — then update `GIFT_API_URL` in `lib/api.ts`.)
5. Run **checkGiftSetup**: every line should start with ✅ (it only reads, never changes anything).
6. Check it: open the `/exec` URL in a private/incognito window (Google shows "unable to open the file" when several Google accounts are signed in). You should see `{"ok":true,"data":{"service":"htoo-may-gift","version":2}}`.

`GIFT_TOKEN` (Project Settings › Script properties) protects the organiser-only actions. Never put it in the website.

## 2. GitHub

Every push to `main` makes GitHub Actions test, build and publish the site. Nothing needs to be built locally or committed in `dist/`.
Check progress under the repo's **Actions** tab.

Local development: `npm install`, then `npm run dev`. `npm test` checks the Apps Script logic against a simulated sheet; `npm run build` type-checks and builds.

## 3. Managing the sheet

- **RSVPs** — one code per couple/allowance. Only rows with `Attending` = yes and `Gift enabled` ≠ No can use a code. Use `Gift display name` for incomplete or ambiguous names. A code that appears on two rows is blocked until fixed. Anyone holding a code can view/change that couple's record.
- **Issuing codes** — set `GIFT_ROWS_TO_ISSUE` in Code.gs to the reviewed RSVP row numbers (e.g. `[12,13,14]`), save, run **issueGiftCodesForConfiguredRows**. Each row gets a code and a `Gift QR link`. Never infer couples from party size.
- **Catalogue** — one row per gift: stable unique `ID`, product text, `Image`, `Price`, `Enabled` (tick box). `Category` must be *Everyday*, *For the table* or *At home*. `Image` can be a full HTTPS URL, or a file name (e.g. `hario-mug.jpg`) after adding that file to `public/products/` in this repo.
- **Gift settings** — `Open` (tick to allow confirmations; keep unticked until the live test/launch), `Deadline` (YYYY-MM-DD, Japan time, last day included), `Message`.
  Sheet changes show on the site within about a minute; run **refreshCatalogueNow** to show them immediately. No GitHub rebuild is needed.
- **Speed / cache** — the guest list from RSVPs is cached for 1 hour so code checks are fast. Newly issued codes work immediately. Other RSVP edits (names, `Gift enabled` = No) apply within an hour, or immediately after running **refreshCatalogueNow**.
- **Couples** — selections and delivery details. Set `Status` to Ordered/Shipped/Delivered and fill `Tracking`; guests see it with *Refresh status*. Ordered/Shipped/Delivered lock changes; otherwise guests can change their choice for 48 hours after their first confirmation.
- **Activity (Couples U:Z)** — filled automatically, Japan time:
  `First visited at`, `Last visited at`, `Visits` (once per browser session), `Cart gift` (current cart item, blank if removed), `Cart updated at`, `Saved gifts` (the couple's hearted gift IDs, max 5).
  Filter these with `Status` to find couples who never visited, or have a gift in the cart but have not confirmed.
- **Emails** — confirmation in English or Burmese with the submitted delivery details. A normal Gmail account sends about 100 emails/day. A failed email never cancels an order: run **retryGiftEmails** later. Rows marked *Sending — check sent mail* need a manual check of Sent mail before retrying, to avoid duplicates. Gmail cannot send true no-reply mail; Workspace accounts may set `GIFT_NO_REPLY = true`.

## 4. Before printing QR cards — live test

1. Issue a code for a test RSVP row, tick `Open`.
2. Open its `Gift QR link` on a phone: your name should appear, the gifts should load.
3. Choose a gift, enter real delivery details, confirm. Check the Couples row and the confirmation email.
4. Change the gift once (within 48 h), then set Status to Ordered and confirm the page shows it as locked.
5. Untick `Open` again (or keep it open if launching) and clear the test row.
