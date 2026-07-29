# pudding

## Security setup

This site is public, so do not put passwords, LINE tokens, shipping API tokens, or invoice API keys in HTML or committed JavaScript.

### Admin login

The admin page uses Firebase Authentication Email/Password login. Create the admin user in Firebase Console, and keep public sign-up disabled.

The Realtime Database and Storage rules only treat Email/Password users as admins. Anonymous visitors can create a new order, but they cannot read existing orders.

### Cloudflare Worker secrets

Set these secrets before deploying `cf-worker/worker.js`:

```sh
wrangler secret put LINE_CHANNEL_ACCESS_TOKEN
wrangler secret put TCAT_CUSTOMER_ID
wrangler secret put TCAT_CUSTOMER_TOKEN
wrangler secret put AMEGO_TAX_ID
wrangler secret put AMEGO_APP_KEY
```

Optional non-secret overrides:

```sh
wrangler secret put TCAT_ENDPOINT
wrangler secret put AMEGO_BASE
```

### Firebase Functions config

If using `functions/index.js`, set runtime config instead of committing secrets:

```sh
firebase functions:config:set \
  tcat.customer_id="..." \
  tcat.customer_token="..." \
  amego.tax_id="..." \
  amego.app_key="..."
```

Any token that was previously committed should be rotated in the provider dashboard.

### Email environment variables

Order confirmation, shipment, and new-order-owner-notification emails are sent using Resend. This exists in two independent implementations — make sure whichever platform is actually serving the production custom domain has these configured, or emails will silently fail:

- **Vercel**: `/api/send-email.js`, configured under the Vercel project's Environment Variables
- **Cloudflare Worker**: `_worker.js`, configured under the Worker's "變數與機密" (Variables and Secrets) settings

```sh
RESEND_API_KEY="re_..."
RESEND_FROM_EMAIL="white dessert <notice@your-verified-domain.example>"
OWNER_EMAIL="owner@example.com"
```

`RESEND_FROM_EMAIL` must use a domain verified in Resend. The frontend and admin pages should not use EmailJS keys or templates. `OWNER_EMAIL` supports multiple recipients separated by commas or semicolons (e.g. `a@example.com, b@example.com`).

### Vercel TCAT / Amego / LINE environment variables

`api/getPDF.js`, `api/debugPDF.js`, `api/PrintOBT.js`, `api/QueryOBT.js`, `api/issueInvoice.js`, `api/voidInvoice.js`, `api/invoiceFile.js`, and `api/sendLine.js` are Vercel ports of the equivalent routes in `cf-worker/worker.js`, for deployments that run entirely on Vercel instead of a separate Cloudflare Worker. Configure the same values listed above under "Cloudflare Worker secrets" as Vercel project Environment Variables instead:

```sh
LINE_CHANNEL_ACCESS_TOKEN="..."
TCAT_CUSTOMER_ID="..."
TCAT_CUSTOMER_TOKEN="..."
AMEGO_TAX_ID="..."
AMEGO_APP_KEY="..."
```

Only set these up on whichever platform (Vercel or Cloudflare) is actually handling that traffic for a given deployment — running both against the same LINE/TCAT/Amego accounts at once is unnecessary and makes it easy to lose track of which copy of the code is live.
