# MyAnimeList tracking setup

Akamaru uses MyAnimeList OAuth and the official list API. No separate server is required; the existing Vercel Express function handles it. Tracking is saved only when the user presses **Save to MyAnimeList**. The local Library and History remain independent.

1. Sign in at https://myanimelist.net/apiconfig and register a web application for Akamaru.
2. Set the callback URL to `https://YOUR-DOMAIN/api/mal/callback` (for example, `https://akamaru-one.vercel.app/api/mal/callback`). It must match exactly.
3. In Vercel → Project → Settings → Environment Variables, add these **server-only** variables:
   - `MAL_CLIENT_ID`: the application's client ID.
   - `MAL_CLIENT_SECRET`: its client secret.
   - `MAL_REDIRECT_URI`: the callback URL from step 2.
   - `MAL_COOKIE_KEY`: 64 hexadecimal characters generated with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
4. Redeploy. Do not prefix credentials with `VITE_` or commit them to Git.
5. Open an anime detail page, click **MAL** next to the bookmark, and connect your account. Approve access on MyAnimeList yourself.
6. Open the tracker, select a status, enter episodes watched and an optional score, then save. Verify the change on MyAnimeList.

Use a separately registered `http://localhost:4000/api/mal/callback` callback for local testing. Set the four variables in the server process environment before starting it; this project does not automatically load an `.env` file. Preview domains also need matching callback configuration. Cookies are encrypted, HttpOnly, SameSite=Lax, and Secure on HTTPS; changing the cookie key signs everyone out. Do not share the key or tokens.

The app uses OAuth state and PKCE, refreshes access tokens when needed, and checks the request origin before list updates/disconnection. Tokens are never returned to frontend JavaScript. Disconnect removes the session on this browser; revoke application access on MyAnimeList if needed.

Official references: https://myanimelist.net/apiconfig/references/authorization and https://myanimelist.net/apiconfig/references/api/v2

Live login/sync must be verified after credentials are configured. Automated tests use a simulated MyAnimeList server response and do not modify a real account.
