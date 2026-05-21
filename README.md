# pudding

Production admin URL: `https://pudding.urland.com.tw/admin.html`

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
wrangler secret put SENDER_NAME
wrangler secret put SENDER_TEL
wrangler secret put SENDER_MOBILE
wrangler secret put SENDER_ZIP
wrangler secret put SENDER_ADDRESS
wrangler secret put AMEGO_TAX_ID
wrangler secret put AMEGO_APP_KEY
```

The Worker requires a Firebase ID token from a signed-in admin before it will call LINE, TCAT, or Amego. By default it allows `admin@wd.tw` in the `whitedessert` Firebase project. Set these if that changes:

```sh
wrangler secret put ADMIN_EMAILS
wrangler secret put FIREBASE_PROJECT_ID
```

Optional service overrides:

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
  sender.name="..." \
  sender.tel="..." \
  sender.mobile="..." \
  sender.zip="..." \
  sender.address="..." \
  amego.tax_id="..." \
  amego.app_key="..." \
  admin.emails="admin@wd.tw"
```

Any token that was previously committed should be rotated in the provider dashboard.
