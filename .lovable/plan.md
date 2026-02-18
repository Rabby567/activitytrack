
## Fix: Email Verification Not Being Enforced

### Root Cause

The auth logs reveal the exact problem:

```
"immediate_login_after_signup": true
```

This means the backend is set to **auto-confirm** accounts and log users in right after signup — so the verification email is sent, but the user is already authenticated and can log in without ever clicking it. The frontend code is correct (it shows a "check your Gmail" screen and catches the "email not confirmed" error), but it never triggers because the backend never blocks login.

The fix requires **disabling auto-confirm** in the Supabase auth configuration so that the backend actually requires email verification before allowing login.

---

### What Will Change

#### 1. Backend Auth Settings — Disable Auto-Confirm

Turn off `autoconfirm` in the auth configuration. Once disabled:
- Signup will send a verification email but NOT log the user in
- Any login attempt before verification will return an "Email not confirmed" error
- The existing frontend error handling will then correctly block login and show the message

#### 2. `src/hooks/useAuth.tsx` — Handle Unverified Session

Currently, after signup, the `onAuthStateChange` listener may set `user` to the auto-confirmed session. Once auto-confirm is off, signup returns no active session. We need to make sure the `signUp` function does **not** redirect the user to the dashboard after signup — it should stay on the login page and show the "check your Gmail" screen.

We'll also add a check: if a user object exists but `email_confirmed_at` is null/empty, treat them as **not logged in** and redirect to login. This adds a second layer of protection even if the session somehow slips through.

#### 3. `src/pages/Login.tsx` — Guard the redirect after signup

The `if (user)` redirect at the top of the Login page currently sends any authenticated user to `/dashboard`. After the fix, a newly signed-up unverified user will no longer have a session, so this guard is fine. But we should also ensure that on the login tab, if someone somehow has an unverified session, they are not redirected to dashboard.

---

### Files to Modify

| File | Change |
|------|--------|
| `src/hooks/useAuth.tsx` | Add `email_confirmed_at` guard — only set `user` if email is confirmed |
| `supabase/config.toml` | This is auto-managed, so we use the `configure-auth` tool to disable auto-confirm |

---

### Technical Detail

**In `useAuth.tsx`**, change the `onAuthStateChange` callback to check email confirmation:

```typescript
supabase.auth.onAuthStateChange((_event, session) => {
  const confirmedUser = session?.user?.email_confirmed_at ? session.user : null;
  setSession(confirmedUser ? session : null);
  setUser(confirmedUser);
  setLoading(false);
});
```

This ensures that even if the backend returns a session for an unverified user, the frontend treats them as logged out and keeps them on the login page.

**Backend**: Disable `autoconfirm` via the auth configuration tool so signup does not auto-login the user and forces real email verification.

---

### End Result Flow

```
User signs up with Gmail
        ↓
Backend sends verification email (no auto-login)
        ↓
Frontend shows "Check your Gmail!" screen
        ↓
User clicks link in Gmail → redirected to /login
        ↓
User enters credentials → login succeeds
        ↓
Dashboard access granted
```

Without verification:
```
User tries to log in → "Email not confirmed" inline error
```
