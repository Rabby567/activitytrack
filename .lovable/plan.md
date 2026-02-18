
## Fix: Login Form Allows Any Email Address

### Root Cause

The `isGmail()` helper function exists in `Login.tsx` and is correctly applied to the **signup** form. However, the `handleLogin` function has **no Gmail check at all** — it immediately calls the auth backend with whatever email the user types, including non-Gmail addresses. The fix is to add the same Gmail validation to the login form.

Additionally, when login fails with wrong credentials (e.g. unregistered Gmail), the error goes to a toast popup instead of an inline message below the form — which is inconsistent with the verification error display.

### What Will Change

**`src/pages/Login.tsx`** — Two changes to `handleLogin`:

1. **Gmail gate before network call**: Before calling `signIn`, check if the entered email is a Gmail address. If not, set `loginError` with a clear message and return early — no network request is made.

2. **Inline error for wrong credentials**: Change the `else` branch (which currently shows a toast) to instead set `loginError` with "Incorrect email or password." This keeps all login errors consistent — shown inline below the form, not as a popup.

### Files to Modify

| File | Change |
|------|--------|
| `src/pages/Login.tsx` | Add Gmail validation + inline error to `handleLogin` |

### Technical Detail

**Before (`handleLogin`):**
```
1. Call signIn() directly — no Gmail check
2. If error is "email not confirmed" → inline error
3. Any other error → toast popup
```

**After (`handleLogin`):**
```
1. Check isGmail(loginEmail) → if not Gmail, show inline error, return early
2. Call signIn()
3. If error is "email not confirmed" → inline error  
4. Any other error (wrong password / unregistered email) → inline error "Incorrect email or password."
```

The existing `loginError` state and error display box (the red card below the password field) is already in place — we just need to populate it in more cases.

### Specific Code Change

In `handleLogin` (lines 44-61), add before `setLoading(true)`:
```typescript
if (!isGmail(loginEmail)) {
  setLoginError('Only Gmail addresses (@gmail.com) are allowed.');
  return;
}
```

And replace the `else` toast branch with:
```typescript
} else {
  setLoginError('Incorrect email or password.');
}
```

No other files need to change.
