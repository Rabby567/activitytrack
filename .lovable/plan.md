
## Add Gmail-Only Signup with Email Verification

### What Will Change

Currently, anyone can sign up with any email and immediately access the dashboard — no verification required. This plan adds two security layers:

1. **Gmail-only restriction** — The signup form will validate that the email ends with `@gmail.com` before submitting. Non-Gmail addresses are rejected with a clear error message.
2. **Email verification gate** — After signing up, the user receives a verification email. They cannot log in until they click the link. If they try to log in without verifying, they'll see an informative message.

---

### How It Works (User Flow)

```text
Sign Up (Gmail only)
        ↓
Verification email sent to Gmail
        ↓
User clicks link in email → redirected back to app
        ↓
User logs in → Dashboard
```

If someone tries to log in without verifying → friendly error message shown.

---

### Implementation Steps

#### 1. `src/hooks/useAuth.tsx` — Add `email_confirmed_at` check to `signIn`

When a user tries to sign in, if the auth system returns a "Email not confirmed" error, surface a clear, user-friendly message. Also update `signUp` to pass the correct `emailRedirectTo` URL.

#### 2. `src/pages/Login.tsx` — Add Gmail validation + post-signup state

- **Signup form**: Before calling `signUp`, check that the email ends with `@gmail.com`. If not, show an inline error and block submission. No toast needed — show it right under the email field.
- **After successful signup**: Instead of saying "You can now access the dashboard" (which is wrong — they haven't verified yet), switch to a **success screen** that says:
  > "Check your Gmail inbox! We've sent a verification link to `[email]`. Click it to activate your account, then come back here to log in."
- **Login form**: If the error is "Email not confirmed", show a specific message: "Please check your Gmail and click the verification link before logging in."

#### 3. `src/App.tsx` — Add `/verify` route (email redirect landing page)

When the user clicks the verification link in their email, they are redirected back to the app at the root URL. The auth state listener in `useAuth` will automatically pick up the verified session. No separate page is strictly needed — but we'll make the redirect URL `/login` so users land on the login page with a clean prompt to sign in after verifying.

Update `emailRedirectTo` in `useAuth.tsx` to point to `/login` so after clicking the link in Gmail, users land on the login screen, ready to sign in.

---

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useAuth.tsx` | Update `emailRedirectTo` to `window.location.origin + '/login'` |
| `src/pages/Login.tsx` | Add Gmail-only validation, post-signup success screen, and unverified login error handling |

---

### Technical Details

**Gmail validation (client-side):**
```typescript
const isGmail = (email: string) => email.trim().toLowerCase().endsWith('@gmail.com');

if (!isGmail(signupEmail)) {
  setEmailError('Only Gmail addresses (@gmail.com) are allowed.');
  return;
}
```

**Post-signup success state:**
```typescript
const [signupSuccess, setSignupSuccess] = useState(false);
// After successful signUp():
setSignupSuccess(true);
// Render a card telling user to check their Gmail inbox
```

**Unverified login error:**
The auth backend already returns "Email not confirmed" when a user tries to sign in without verifying. We catch that string and show:
```
"Your email hasn't been verified yet. Please check your Gmail inbox and click the verification link."
```

**Email confirmation is already enabled** in the backend by default (auto-confirm is NOT set), so no backend configuration changes are needed — verification emails are already being sent. The only missing pieces are the Gmail restriction and the proper UI feedback.

---

### What Stays the Same

- Existing users who already have accounts are unaffected
- The login flow, dashboard, and all other pages remain unchanged
- Password requirements (minimum 6 characters) stay the same
