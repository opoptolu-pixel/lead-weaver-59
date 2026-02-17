

## Update Marketing Email Sender to support@cleanda.co.uk

### What Changes

Change the "from" address for **marketing/bulk emails only** to `support@cleanda.co.uk`, while keeping `hello@cleanda.co.uk` for all transactional emails (confirmations, receipts, verification, password resets).

### Which Functions Change

| Function | Current From | New From | Type |
|---|---|---|---|
| `send-campaign` | hello@cleanda.co.uk | **support@cleanda.co.uk** | Marketing |
| `process-email-sequences` | hello@cleanda.co.uk | **support@cleanda.co.uk** | Marketing |
| `process-scheduled-emails` | hello@cleanda.co.uk | No change | Transactional |
| `send-email` | hello@cleanda.co.uk | No change | Transactional |
| `submit-cleaning-request` | hello@cleanda.co.uk | No change | Transactional |
| `insurance-expiry-reminder` | hello@cleanda.co.uk | No change | Transactional |

### Technical Details

**send-campaign/index.ts**
- Change `FROM_EMAIL` from `"hello@cleanda.co.uk"` to `"support@cleanda.co.uk"`
- Display name stays `Cleanda`

**process-email-sequences/index.ts**
- Change `FROM_EMAIL` from `"Cleanda <hello@cleanda.co.uk>"` to `"Cleanda <support@cleanda.co.uk>"`

### Pre-requisite (Your Action Needed)

Before these changes take effect, you need to **verify `support@cleanda.co.uk` in Resend**:
1. Go to your Resend dashboard
2. The domain `cleanda.co.uk` is already verified, so `support@` should work immediately -- but confirm there are no sender restrictions set up

No database changes required. Only two edge function files are modified.

