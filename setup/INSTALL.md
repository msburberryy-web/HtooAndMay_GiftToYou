# Gift page setup — GitHub Pages + Apps Script + Google Sheets

The guest page (this repo) is published on GitHub Pages and talks directly to the gift Apps Script web app (`setup/Code.gs`).
No ChatGPT Sites backend is used for orders. Guest codes, delivery details and secrets live only in your Google Sheets.

## 1. Update Apps Script (do this first)

1. Open the gift Apps Script project whose deployment URL is in `lib/api.ts`. Leave the separate RSVP form script untouched.
2. **Project Settings (⚙) › Script properties › Add script property** — add these once (they are kept out of this public repo):
   - `GIFT_SHEET_ID` — the ID of the Gift Manager spreadsheet (the long part of its URL between `/d/` and `/edit`)
   - `RSVP_SHEET_ID` — the ID of the RSVP spreadsheet
   - optional `NOTIFY_EMAIL` — where new-request notifications go (comma-separated). Without it they go to the Google account that owns the script.
   Keep `GIFT_TOKEN` as it is.
3. Replace **all** of `Code.gs` with `setup/Code.gs` from this repo. Save.
4. In the function menu choose **setupGiftStandalone** and press **Run**. Approve the Google permissions.
   It adds the gift columns to RSVPs, the email/First-submitted columns (Q:T) and activity columns (U:Z) to Couples, and creates the **Catalogue** and **Gift settings** tabs in Gift Manager. It does not issue codes, send emails or open orders.
5. **Deploy › Manage deployments ›** the existing web-app deployment **› ✏️ Edit › Version: New version › Deploy**.
   Execute as: **Me**. Who has access: **Anyone**. This keeps the same `/exec` URL.
   (Choosing *New deployment* instead creates a new URL — then update `GIFT_API_URL` in `lib/api.ts`.)
6. Run **checkGiftSetup**: every line should start with ✅ (it only reads, never changes anything).
7. Check it: open the `/exec` URL in a private/incognito window (Google shows "unable to open the file" when several Google accounts are signed in). You should see `{"ok":true,"data":{"service":"htoo-may-gift","version":2}}`.

`GIFT_TOKEN` (Project Settings › Script properties) protects the organiser-only actions. Never put it in the website.

## 2. GitHub

Every push to `main` makes GitHub Actions test, build and publish the site. Nothing needs to be built locally or committed in `dist/`.
Check progress under the repo's **Actions** tab.

Local development: `npm install`, then `npm run dev`. `npm test` checks the Apps Script logic against a simulated sheet; `npm run build` type-checks and builds.

## 3. Managing the sheet

- **RSVPs** — one code per couple/allowance. Only rows with `Attending` = yes and `Gift enabled` ≠ No can use a code. Use `Gift display name` for incomplete or ambiguous names. A code that appears on two rows is blocked until fixed. Anyone holding a code can view/change that couple's record.
- **Personal message** — write a note for each couple in the RSVPs › `Gift message` column (added by setupGiftStandalone, or add the header yourself). Their page shows a gift box at the top; tapping it opens the note. Line breaks are kept, up to 1,500 characters; leave it empty for no box. Edits show on their next visit.
- **Issuing codes** — run **issueGiftCodesForAllGuests**. Every RSVP row with a name gets a 20-character code and a `Gift QR link`; rows that already have a code keep it, so run it again whenever new RSVPs arrive. Codes only work for rows with `Attending` = yes (and `Gift enabled` ≠ No). To replace a code (e.g. a short test code), clear that cell and run it again. (`issueGiftCodesForConfiguredRows` with `GIFT_ROWS_TO_ISSUE` still works for issuing to specific rows only.)
- **Catalogue** — one row per gift: stable unique `ID`, product text, `Image`, `Price`, `Enabled` (tick box). `Category` must be *Everyday*, *For the table* or *At home*. `Image` can be a full HTTPS URL, or a file name (e.g. `hario-mug.jpg`) after adding that file to `public/products/` in this repo.
- **Product photos** — upload the original photos to the repo's `product-photos/` folder on GitHub (Add file › Upload files), named after the gift ID, e.g. `hario-mug.jpg`. Each publish turns them into small WebP images (400 and 800 px). Then put that name (`hario-mug.jpg` or `hario-mug`) in the Catalogue tab's `Image` column. A missing photo shows the monogram instead of a broken image.
- **Gift settings** — `Open` (tick to allow confirmations; keep unticked until the live test/launch), `Deadline` (YYYY-MM-DD, Japan time, last day included), `Message`.
  Sheet changes show on the site within about a minute; run **refreshCatalogueNow** to show them immediately. No GitHub rebuild is needed.
- **On guests' phones** — the gift list and each guest's own page (name, partly hidden order, saved gifts) are remembered for 30 days so return visits show instantly, then refresh from the sheet in the background. The code itself is never stored in plain text; "Use another code" forgets it.
- **Speed / cache** — code checks, the gift list and order status are answered from Google's cache (up to 6 hours) instead of reopening the spreadsheets each time. Every manual edit to the Gift Manager or RSVP spreadsheet (Status, Tracking, Catalogue, Gift settings, names, Gift enabled…) clears that cache automatically through the edit triggers, so guests see changes on their next page load. Changes made another way (another script, a form adding rows) apply within the cache time — run **refreshCatalogueNow** to apply them at once.
- **Emails** are sent by a background job that runs every minute, so confirming an order does not wait for Gmail. Guests see "Your confirmation email is on its way"; Couples › Email status shows `Queued`, then `Sent …`. If the background trigger is missing (setup not re-run), emails are sent during the request as before.
- **Couples** — selections and delivery details. Set `Status` to Ordered/Shipped/Delivered and fill `Tracking`; guests see it with *Refresh status*. Ordered/Shipped/Delivered lock changes; otherwise guests can change their choice for 48 hours after their first confirmation.
- **Activity (Couples U:Z)** — filled automatically, Japan time:
  `First visited at`, `Last visited at`, `Visits` (once per browser session), `Cart gift` (current cart item, blank if removed), `Cart updated at`, `Saved gifts` (the couple's hearted gift IDs, max 5).
  Filter these with `Status` to find couples who never visited, or have a gift in the cart but have not confirmed.
- **Order history** — every confirmation is added as its own line with an order ID (`HM-0001`, `HM-0002`, …): Type NEW or CHANGED, the gift, all delivery details, language, time, and `Replaces` (the previous order ID when a couple changed their choice). Lines are never edited, so earlier gifts and addresses are always kept. Pressing confirm again with nothing changed does not add a line. Couples column AA (`Current order ID`) shows which order is current — order from the retailer using that one. Guests see their order ID in the email and on "My selection". Orders made before this existed get an ID when you run setupGiftStandalone (Replaces = `imported`).
- **Avoiding ordering the wrong version** (a guest may change within 48 hours of their first confirmation):
  - Couples **AB `Changes close at`** — after this Japan time the guest can no longer change. Order from the retailer after it, or set Status to **Ordered** *before* buying (that locks changes immediately).
  - Couples **AC `Ordered order ID`** — filled automatically when you set Status to Ordered/Shipped/Delivered (cleared if you set it back to Requested). It turns **red** if it differs from `Current order ID` (AA): the guest changed after you ordered — contact them.
  - **Status** has a dropdown with only the allowed values (Awaiting choice, Requested, Ordered, Shipped, Delivered).
  - **Order history › `Superseded by`** — filled automatically on the older line when a couple changes; work only from lines where it is empty.
  - `[Gift CHANGED]` notifications include a reminder to contact the guest if you already started ordering the previous order.
  - setupGiftStandalone installs a small edit trigger on the Gift Manager sheet for AC (Google asks for permission once). checkGiftSetup confirms all three helpers (Gift Manager edits, RSVP edits, background email sender) are installed.
- **New-request notifications** — every confirmation emails the organiser (`[Gift NEW]` or `[Gift CHANGED]`, with the previous gift/address when changed) and a link to the sheet.
- **Privacy** — "My selection" shows email, phone, postcode, address and note partly hidden; the sheet keeps the full details. Guests re-enter delivery details when changing a gift. Both spreadsheets should stay shared only with the people who manage them (never "Anyone with the link"). `checkGiftSetup` warns about codes shorter than 12 characters, which could be guessed.
- **Emails** — wedding-style confirmation in English or Burmese with the gift, delivery details and a **View my gift** button that opens the guest's order progress. Each guest email counts as one email, plus one for your notification. A normal Gmail account sends about 100 emails/day. A failed email never cancels an order: run **retryGiftEmails** later. Rows marked *Sending — check sent mail* need a manual check of Sent mail before retrying, to avoid duplicates. Gmail cannot send true no-reply mail; Workspace accounts may set `GIFT_NO_REPLY = true`.

## 4. Before printing QR cards — live test

1. Issue a code for a test RSVP row, tick `Open`.
2. Open its `Gift QR link` on a phone: your name should appear, the gifts should load.
3. Choose a gift, enter real delivery details, confirm. Check the Couples row and the confirmation email.
4. Change the gift once (within 48 h), then set Status to Ordered and confirm the page shows it as locked.
5. Untick `Open` again (or keep it open if launching) and clear the test row.

## 5. Faster first visits (optional, free)

**Pre-loading (automatic).** The every-minute background helper also keeps the gift list, the guest list and every couple's partly hidden details ready in Apps Script's cache. A guest's code check then rarely has to open a spreadsheet. Editing either spreadsheet clears the cache, and it is refilled within a minute. Nothing to set up: paste the latest `Code.gs` and deploy a **New version**.

**Keep the script awake.** Google lets an unused script fall asleep, and the next guest waits 1–2 seconds for it to start. A free monitoring service can visit the script every 5 minutes so it stays awake:

1. Create a free account at [uptimerobot.com](https://uptimerobot.com).
2. **New monitor** → type **HTTP(s)** → paste your Apps Script `/exec` URL → interval **5 minutes** → create.

The visit only gets back `{"ok":true,"data":{"service":"htoo-may-gift","version":2}}`. It doesn't open any spreadsheet, doesn't see guest data, and isn't counted as a guest visit. The service only knows the `/exec` address, which is already public in the website. As a bonus, it emails you if the gift site stops responding. Delete the monitor after the event.
