# GitHub + Apps Script + Sheets — no Sites

## Google update FIRST

1. Open the SAME gift Apps Script project associated with the deployed URL. Keep the separate RSVP form script untouched.
2. Replace all of Code.gs with setup/Code.gs from this package. Save.
3. Select setupGiftStandalone_ (final underscore) and Run. Approve Google permissions. Do not run doPost or guestRpc manually.
4. This preserves Couples and adds Catalogue and Gift settings tabs to Gift Manager. It also prepares email tracking Q:S and first-submission timestamp T. It does not issue codes, send emails, or open orders.
5. Deploy > Manage deployments > existing gift deployment > pencil > New version > Deploy. Execute as Me; access Anyone. KEEP THE EXISTING /exec URL. If Google gives a different URL, send it so the GitHub build can be updated.

GIFT_TOKEN stays in Script properties and is used internally only. No token needs to be copied anywhere. No Sites settings are necessary.

## GitHub update SECOND

Upload the extracted package contents into the ROOT of msburberryy-web/HtooAndMay_GiftToYou, overwriting matching files. Keep the existing .github/workflows/static.yml; it publishes ./dist. Commit and wait for Actions to succeed. This package is already built. Later source edits require npm run build.

## Sheet management

- RSVPs: one random code per allowance/couple. Use Gift display name for incomplete/ambiguous names. Gift enabled = No revokes access. Only Attending = yes rows qualify. Possession of a code permits viewing/changing that couple's record.
- Catalogue: stable unique ID, product details, image filename or HTTPS URL, price, Enabled TRUE/FALSE. Seven previous enabled gifts are copied; this is not a fresh stock or shipping-policy verification. Recheck availability and gift wrapping/delivery before launch.
- Gift settings: Open defaults FALSE. Set TRUE for the live test/launch only when ready. Deadline uses YYYY-MM-DD. No GitHub rebuild is needed for Sheet catalogue/settings edits.
- Couples: selections and delivery information. Q:S track emails, T is the first submission timestamp. Ordered/Shipped/Delivered lock revisions. Otherwise changes are allowed for 48 hours after the first submission.
- Code generation: edit GIFT_ROWS_TO_ISSUE to reviewed RSVP row numbers, then run issueGiftCodesForConfiguredRows_. Never infer couples just from party size.
- Emails: full submitted delivery details, English/Burmese. Regular Gmail cannot send true no-reply mail; Workspace may set GIFT_NO_REPLY=true. Failed emails do not erase orders. retryGiftEmails_ retries quota failures; ambiguous Sending states need a manual Sent-mail check first.

## Verification / limitations

Build and mocked tests pass for code validation, 60 saved requests/emails, revision/ordered locks, email deduplication and failure, bilingual content, guest-admin rejection, and server-side product validation. The 60-request fixture is NOT a live concurrency/load test.

Live Google saving and inbox delivery need the owner deployment update. Browser QA was blocked by a missing Chromium executable. The nested Google iframe handshake must be checked live before printing reception QR cards. Privacy settings may block the embedded bridge; it must fail visibly rather than falsely confirming an order.

The new app, products and monogram no longer depend on Sites. The old Sites project has not been deleted or disabled.
