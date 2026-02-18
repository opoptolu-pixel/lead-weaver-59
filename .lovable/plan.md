
## The Issue

The problem is a **hardcoded string in the email preview modal UI** — not in the actual sending code.

In `src/pages/admin/AdminEmailSequences.tsx` at line 829, the preview dialog shows:

```
Cleanda <hello@cleanda.co.uk>
```

This was written as a static placeholder when the preview feature was built. The actual sending function (`process-email-sequences`) correctly uses `support@cleanda.co.uk` — so emails are being sent from the right address. The preview is just showing the wrong label.

## Fix

Change line 829 in `src/pages/admin/AdminEmailSequences.tsx` from:

```
Cleanda <hello@cleanda.co.uk>
```

to:

```
Cleanda <support@cleanda.co.uk>
```

That is the only change needed. One line, one file.

## Technical Detail

- `process-email-sequences/index.ts` line 9: `const FROM_EMAIL = "Cleanda <support@cleanda.co.uk>";` — already correct
- `send-email/index.ts` line 11: `const FROM_EMAIL = "Cleanda <hello@cleanda.co.uk>";` — this is for transactional emails (confirmations, receipts, verifications), which is correct per the architecture decision
- The email sequence preview UI just needs its display string updated to match what the sequence sender actually uses
