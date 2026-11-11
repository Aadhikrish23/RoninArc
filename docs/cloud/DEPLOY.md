# Deploying RoninArc Cloud

RoninArc Cloud is the same backend as the desktop app's, run with `CLOUD_MODE=true`. It serves:
- the phone app, directly
- PCs' sync ("Sync with my other devices" at sign-in, or Settings → RoninArc Cloud)
- phone link codes: a linked PC asks for a 6-digit code, and a phone trades it for a session

It needs five things:
- **MongoDB Atlas:** the database
- **Render:** the server
- **Resend:** "forgot password" emails
- **keygate:** game data, AI and Steam keys
- **the apps:** told where the cloud is

## 1. MongoDB Atlas (free)

1. Create an account at https://cloud.mongodb.com and a free **M0** cluster. A region near you is fine; Mumbai suits India.
2. **Database Access → Add user** with a password. Use read/write on any database.
3. **Network Access → Add IP → Allow access from anywhere (`0.0.0.0/0`).** Render's addresses change, and the database user's password is what protects it.
4. **Connect → Drivers:** copy the connection string, put your password in, and add the database name before `?`:
   `mongodb+srv://USER:PASS@cluster0.xxxxx.mongodb.net/roninarc?retryWrites=true&w=majority`

## 2. Resend (forgot password)

1. In Resend: **Domains → Add domain**, add the DNS records it shows, and wait for "Verified". Without a verified domain, Resend only delivers to your own account email, so friends would never get reset links.
2. **API Keys → Create** with "Sending access".
3. You'll set `MAIL_FROM` to something like `RoninArc <noreply@yourdomain.com>`.

## 3. A keygate token for the cloud

The cloud calls IGDB, NVIDIA and Steam through keygate, with one token of its own. Give it room, because the cloud enforces each person's AI limit itself (`AI_DAILY_LIMIT_PER_USER`):

```bash
cd keygate
npm run token -- create roninarc cloud-server nvidia=1500 igdb=20000 steam=2000
```

keygate's project-wide daily caps still bound the total cost.

## 4. Render

1. Push the repo to GitHub, then go to https://dashboard.render.com → **New → Blueprint** and pick the repo. It reads `render.yaml`.
2. Fill in the secrets it asks for. Every setting the backend reads is listed, with a description, in `backend/.env.example`:

| Key | Value |
|---|---|
| `MONGO_URI` | the Atlas string from step 1 |
| `RESEND_API_KEY` / `MAIL_FROM` | from step 2 |
| `IGDB_BASE_URL` | `https://keygate.<you>.workers.dev/roninarc/igdb` |
| `NVIDIA_BASE_URL` | `https://keygate.<you>.workers.dev/roninarc/nvidia` |
| `STEAM_API_BASE` | `https://keygate.<you>.workers.dev/roninarc/steam` |
| `IGDB_API_KEY`, `NVIDIA_API_KEY`, `STEAM_API_KEY` | the `kg_roninarc_…` token from step 3, in all three |

3. Deploy, then open `https://<service>.onrender.com/health`. It should say `RoninArc was healthy`.

**Plan:** the free plan sleeps after about 15 idle minutes. The next request then takes about a minute, and AI conversations in progress are forgotten. A PC's sync waits up to 90 seconds for a sleeping cloud, and the phone waits on `/health` (up to about 100 seconds, showing "Waking up the server…") before signing in. Switch the service to **Starter** before friends rely on it.

**Redeploy before releasing apps that need new cloud routes.** For example, 1.0.2's phone linking and 1.0.3's email-only sign-in only work once the cloud runs the same code.

## 5. Point the apps at it

- **Desktop:** in `desktop/release.json`, set `"cloudUrl": "https://<service>.onrender.com"`, then build (see `docs/beta/RELEASING.md`). Settings then shows **RoninArc Cloud**.
- **Phone:** the address is baked in at build time from `RONINARC_CLOUD_URL` (see `mobile/app.config.ts`). The simplest way is `node scripts/build-release.cjs https://<service>.onrender.com` in `mobile/`.
- **Landing page:** `render.yaml` also defines the static site (`landing/`). Its download buttons need no change, because they always point at the newest GitHub release.

## What's where

- **Your PC's library:** stays on the PC, and works offline. Once you turn on sync, a copy also goes to the cloud. A game's `.exe` path and Epic/Steam sign-ins never leave the PC.
- **The phone:** reads and writes the cloud copy.
- **Conflicts:** when the same thing changes on both, the later change wins. The same game added on two devices becomes one, with both devices' notes and reviews.
- **Passwords:** the cloud is the source of truth. A reset on the phone works on the PC at its next sign-in.
- **Link codes:** kept in the `linkcodes` collection only as an HMAC (keyed with `JWT_SECRET`), with a TTL index that deletes them once they expire (10 minutes). Each account has at most one; a phone's claim deletes it. Changing `JWT_SECRET` invalidates outstanding codes and all sessions.
- **Phone sign-ins:** the phone sends `X-RoninArc-Client: phone`, and the cloud records `phoneLinkedAt` on the account so the PC stops offering "Get your library on your phone".
