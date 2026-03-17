# Push notification setup checklist

Use this to verify everything is in place. Your **codebase** is already configured correctly; confirm the items below.

---

## In code (already verified)

| Item | Status |
|------|--------|
| **app.config.js** | `expo-notifications` plugin, `extra.eas.projectId`: `2e4e657f-20f5-468b-87ee-ebf78ca2a0cc`, updates URL same project |
| **NotificationService** | projectId from `expoConfig.extra.eas.projectId`, Device.isDevice check, token validation, retry, stores to `user_push_tokens` / logs to `push_registration_log` |
| **useAuth** | Push registration only when user has profile (checkSession); also after createMusicLoverProfile / createOrganizerProfile; AppState re-runs on foreground |
| **Migrations** | RLS for `user_push_tokens` (SELECT/INSERT/UPDATE/DELETE own row), `push_registration_log` table + RLS (INSERT/SELECT own row) |
| **Edge functions** | `send-push-notifications`, `check-push-receipts`, `process-notification-queue` exist in repo |

---

## You must verify (outside code)

### 1. Supabase

- [ ] **Table `user_push_tokens`** exists with columns: `id`, `user_id`, `push_token`, `platform`, `created_at`, `updated_at`.  
  - If not: create it (the RLS migration assumes it exists). Unique constraint on `(user_id, platform)`.
- [ ] **Table `push_registration_log`** exists (migration creates it).
- [ ] **RLS** on both tables is applied (run migrations if needed: `supabase db push` or apply the two migration files).
- [ ] **Edge function `send-push-notifications`** is deployed and callable: Supabase Dashboard → Edge Functions → `send-push-notifications` present and no deployment errors.

### 2. Expo / EAS

- [ ] **Project** at [expo.dev](https://expo.dev) has project ID `2e4e657f-20f5-468b-87ee-ebf78ca2a0cc` (matches `app.config.js`).
- [ ] **iOS:** Credentials → Push Notifications → APNs key (or certificate) uploaded for the app.
- [ ] **Android (if you use it):** FCM v1 credentials configured for the app.
- [ ] **TestFlight build** was produced with EAS Build for this project (so it has the same projectId and push credentials).

### 3. Apple (iOS)

- [ ] App ID has **Push Notifications** capability.
- [ ] No expired or revoked APNs key; if you use a key, it’s the one linked in EAS.

### 4. Quick end-to-end test

- [ ] Install TestFlight build on a **physical** device.
- [ ] Sign up or log in and complete profile so you enter main app.
- [ ] Allow notifications when the system prompt appears.
- [ ] In Supabase → `user_push_tokens`: one row for your user with `ExponentPushToken[...]`.
- [ ] Send a test from [expo.dev/notifications](https://expo.dev/notifications) with that token → notification received on device.

---

## If there’s no row in `user_push_tokens`

1. Check **Supabase** → `push_registration_log` for your `user_id`: the `error_message` will say why (e.g. permission denied, projectId missing, or Supabase error).
2. Confirm the **build** is from this project (same `projectId`) and push credentials are set in EAS.
3. Confirm you’re on a **physical device** and have completed profile so the registration path runs.

---

## Build source of truth

Your app is built from **app.config.js** (Expo uses it when present). That file has the correct `expo-notifications` plugin and `extra.eas.projectId`. **app.json** is missing the notifications plugin and some fields; for EAS/TestFlight builds, ensure the build uses **app.config.js** (default when both exist).
