

## Fire Meta Pixel CompleteRegistration on Business Signup

### What changes
One file edit: `src/pages/Auth.tsx`

After the successful `signUp()` call (line 248, right after `trackCleanerSignup()`), add:

```typescript
if (window.fbq) {
  window.fbq('track', 'CompleteRegistration', {
    content_name: 'cleaner_signup',
    status: true,
    currency: 'GBP',
    value: 0,
  });
}
```

### Why this only fires on signup (not login)
The code is inside the `else` branch of the login/signup conditional (line 235: `} else {`), which only executes when `mode === "signup"`. Login goes through the `if (mode === "login")` branch above it. So the event will never fire on regular sign-ins.

### Technical details
- File: `src/pages/Auth.tsx` (around line 248)
- Event: `CompleteRegistration` (standard Meta event for signups)
- Parameters: `content_name: 'cleaner_signup'`, `status: true`, `currency: 'GBP'`, `value: 0`
- No database changes needed
- No new files needed

