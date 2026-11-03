# Gallery Approach · free Cloudflare Worker

Use this when the app lives on a website (like GitHub Pages) instead of a Pi. The worker lets the site call the APIs that block browser requests (flight data, plane photos, calendars, Windows Spotlight, Bing). It also syncs your to-do board, events and calendar links between devices. It runs on Cloudflare's free plan.

```bash
cd worker
npx wrangler login
npx wrangler kv namespace create STATE      # copy the id it prints into wrangler.toml
npx wrangler secret put SYNC_KEY            # make up a passphrase; you'll type it on each device
npx wrangler deploy                         # prints https://gallery-approach-proxy.<you>.workers.dev
```

Then, on each device: **Settings → Sync & devices → Server or proxy URL**: paste the workers.dev address, and enter the same sync key.

Optional: set `ALLOW_ORIGIN` in `wrangler.toml` to your site (e.g. `https://osodoso1.github.io`) so only your site can use the proxy.
