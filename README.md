# Gallery Approach

A personal, just-for-fun screensaver. It shows open-access works of art, beautiful photography and your own photos, using the old-school PowerPoint slide transitions (Checkerboard, Dissolve, Newsflash, Blinds, Wheel, Cube, Fold, Curtains, Airplane and 30-some more). The art comes first: after a few seconds without a touch, everything but the art and the clock fades away. The next plane landing at SFO, which passes right over Foster City, waits behind a small tab in the corner. Under the clock you get weather, UV, air quality and a sneeze outlook. A side panel holds your calendar and a little to-do board. There's also a hidden air-traffic-control game.

Every picture says where it came from: source, title, artist, date and licence, plus a link to the original.

---

## Where should it live?

It's one web app, so all of these work. They differ in what they can reach and how they sync.

| Where | Art, photos, flights, weather, location | Syncs between your devices | Setup |
|---|---|---|---|
| **Website** (GitHub Pages) | Yes: museums, NASA, Wikimedia, weather, location. Add the free worker for flights, plane photos, calendars, Spotlight and Bing | With the worker: board, events, calendar links | Push this folder to a GitHub repo, then Settings → Pages → Source: **GitHub Actions** (workflow included) |
| **Raspberry Pi** + any screen at home | Everything, plus a photo folder | Yes, every screen that opens the Pi's address | `bash scripts/pi-setup.sh` |
| **claude.ai page** | Your photos, generative art, simulated flights only (claude.ai blocks outside sites and location) | Yes, automatically through your claude.ai account, photos included | Nothing: it's the link you already have |

The iPhone, iPad and Android all just open the website (or the Pi's address) and **Add to Home Screen**. On a Mac, [WebViewScreenSaver](https://github.com/liquidx/webviewscreensaver) (`brew install --cask webviewscreensaver`) turns it into a real screensaver.

### Website + free worker (no Pi needed)

1. Create a repo (e.g. `gallery-approach`), push this folder, and turn on **Settings → Pages → Source: GitHub Actions**. The site appears at `https://<you>.github.io/gallery-approach/`.
2. Optional, but it unlocks everything: deploy the Cloudflare Worker in `worker/` (free plan, 4 commands in `worker/README.md`). Then on each device go to ⚙ → Sync & devices, paste the worker URL and your sync key.

## Quick start (any computer with Node 18+)

```bash
node server/server.js
# → open http://localhost:8080
```

No `npm install` needed; the server has zero dependencies. Put photos in `photos/` (subfolders become album names).

## Raspberry Pi kiosk

Written for Raspberry Pi OS Bookworm (desktop). I couldn't test it on real Pi hardware, so if a step complains, the script prints what to do.

```bash
git clone <your copy> ~/gallery-approach   # or copy this folder over
cd ~/gallery-approach
bash scripts/pi-setup.sh
sudo reboot
```

The script installs Node if needed, runs the server as a `gallery-approach` service, turns off screen blanking, and launches Chromium full-screen at login. Afterwards:

- **Other screens:** open `http://<pi-ip>:8080` (the script prints the address)
- **Logs:** `journalctl -u gallery-approach -f`
- **Your photos:** copy them into `~/gallery-approach/photos/`. The server rescans every minute and reads the date each photo was taken.

## iPad / iPhone as a frame

1. Open `http://<pi-ip>:8080` (or your static host) in Safari.
2. Share → **Add to Home Screen**, then launch it from the home screen (full screen, no browser bars).
3. Settings → Display & Brightness → Auto-Lock → **Never** (keep it plugged in).
4. Optional: Settings → Accessibility → **Guided Access**, so it stays in the app.

Add photos from your library under ⚙ → My photos. They're resized and kept on that device only.

---

## Using it

- **Tap the art** and everything disappears (clock, weather, caption, flight tab, controls), leaving only the art. **Tap again** and it all comes back. **H** does the same on a keyboard.
- **Calm by default.** If everything is showing and you leave it alone, it fades on its own; a tap (or moving the mouse) brings it back: the control bar, weather, chips, caption and the flight tab. The control bar slides away after a few seconds; the rest fades after 20 s (⚙ → Slideshow → *Hide everything but the art after*: 10 s to 5 min, or never). Each new picture still shows its caption for a few seconds, so you always see where it came from.
- **The clock stays** when everything else fades. The 🕒 button in the control bar (or **K**) hides or shows it.
- **⏱ in the control bar** sets how often the picture changes: 30 sec up to 1 hr (default 2 min). Generative pieces stay at most 2 min.
- **Swipe** or **← →** for the previous / next picture · **space** pause · **I** about this picture · **K** clock · **H** art only / show all · **T** transitions · **P** photos · **C** calendar · **R** radar · **S** settings · **F** full screen
- **Tap a caption** (or ⓘ) for *About this picture*: the source, artist, date, medium, credit line, licence, which server the image file came from, and a link to the original.
- **Weather** sits under the clock as a drop-down: tap to open UV, air quality, the sneeze outlook and more, or hide it. **Day | Week** at the top switches between today (with an hour-by-hour strip) and the next 7 days; tap any day for its hours, rain amount, wind and gusts, UV, air quality and sneeze outlook. It's also the **Weather** tab in the side panel. Location comes from your device ("Use my location"), a place you search for, or your flight spot.
- **The flight tab** (bottom right, e.g. `✈ CX 1436 1:42`) brings up the flight strip; the ⌄ on the strip tucks it away again. Want the strip showing all the time, or not at all? ⚙ → Flights → *Flight strip*.
- **Tap the flight strip** for the full card. It shows a real photo: the exact plane from Planespotters when there is one, otherwise a free-licence photo of the same airline and type from Wikimedia Commons (for simulated flights too), labelled with what it shows and who took it. **Photo / Drawing** flips to the app's drawing of the type.
- **Big radar** (tap the little radar on the strip, or **R**): tap any plane to see it. On a phone, tap **Compass**: the radar turns to match the way you're facing, the cone shows where you're pointing, and it tells you which plane is in front of you, how far away it is and how high to look ("look up 9°"). Hold the phone flat like a map, or up like a camera. If it's a few degrees off, the ‹ › buttons line it up.
- **Easter egg:** long-press the flight strip, triple-tap the flight number, or type ↑↑↓↓←→←→BA. Your first plane is the one landing right now (or the last one the radar saw). Drag it to its runway, then keep the rest of the traffic apart.

**Generative art** is drawn by the app itself, in code, right on your screen (nebulas, auroras, dusk scenes, geometric compositions). It isn't a photo and it isn't AI. It mixes in now and then, and fills in when real art can't load. **Don't want it?** ⚙ → Slideshow → *Generative art* → **Off** (or tap *Don't show generative art* in a generative piece's About card). With it off, if nothing new can load, recent pieces of real art come round again.

## Sources & licences

| Source | What | Licence shown | Needs |
|---|---|---|---|
| The Met | Open Access works | CC0 | — |
| Art Institute of Chicago | Public-domain works | CC0 | — |
| Cleveland Museum of Art | Open Access works | CC0 | — |
| SMK (National Gallery of Denmark) | Public-domain works | Public domain | — |
| Rijksmuseum | Paintings via Linked Art (beta) | Public domain | — |
| V&A | Paintings, prints, design | © V&A, personal use | — |
| Harvard Art Museums | Open images | per museum | free API key |
| Wikimedia Commons | Featured pictures | per image (CC BY-SA etc.) | — |
| NASA Image Library | Space & Earth | NASA media guidelines | — |
| Windows Spotlight | Lock-screen photography | © credited photographer | Pi/computer server |
| Bing daily image | Daily photography | © credited photographer | Pi/computer server |
| Your photos | This device and/or `photos/` | yours | — |
| Generative studies | Made on the device | yours | can be turned off |

Each source keeps a few pictures lined up (just their details; the image downloads right before it shows) and tops up as it goes. Searches ask how many results there are, then jump to a random page anywhere in them (within the roughly 10,000-result limit these APIs allow), so over time the whole open collection comes round, not just the top hits. The Rijksmuseum is searched by famous names half the time and by random year (1500–1920) the other half. The app remembers the last 900 pictures so it doesn't repeat itself.

Google Arts & Culture has no public API, so it can't be included automatically. Spotlight and Bing use the same public endpoints as [Spotlight-Downloader](https://github.com/ORelio/Spotlight-Downloader) and [SpotlightGallery](https://github.com/Qzincs/SpotlightGallery). The server saves each image to `data/cache/` so your pool grows over time.

## Flights

- Positions: free community ADS-B feeds (adsb.lol, airplanes.live, adsb.fi), checked every 10 s, with automatic failover.
- Route (origin) and registration: [adsbdb](https://www.adsbdb.com), which is crowd-sourced and occasionally stale.
- Photo: [Planespotters.net](https://www.planespotters.net) for the exact plane, else [Wikimedia Commons](https://commons.wikimedia.org): that registration, then the same airline and type, then Wikipedia's lead photo of the type. Always credited with the photographer and licence; cached on the device.
- Compass mode uses the phone's compass (iPhone asks once for Motion & Orientation access) and your location if you're within 40 nm of your spot.
- **Passengers:** aircraft don't broadcast this, so the app shows the typical seat range for the aircraft type.
- The default spot is a point in Foster City, right under the 28L/28R approach. Set your exact spot in ⚙ → Flights ("Use my location" works over HTTPS or on the Pi itself).
- If live data can't be reached, the strip says **SIMULATED** and shows made-up flights on the real 28L/28R approach path. It never passes these off as live.

## Weather, UV, air quality, sneeze outlook

[Open-Meteo](https://open-meteo.com) provides weather, UV and US AQI with no key and no fee. There's no free pollen count for the US (Open-Meteo's pollen data only covers Europe), so instead of a count the app shows a **sneeze outlook**: an estimate that combines the typical pollen season for the month with today's wind (stirs pollen up), humidity, rain (washes it out) and air quality (smoke, smog and dust irritate noses too). It always says why, e.g. "grass pollen season · breezy, which stirs pollen up". It's a hint, not a measurement.

## Sync

- **claude.ai page:** settings, to-do board, events and (if you leave it on) photos sync automatically through your claude.ai account. API keys and calendar links stay on each device.
- **Pi:** everything that opens the Pi's address shares one board, events list, calendar links and photo folder.
- **Website:** add the Cloudflare Worker and a sync key (⚙ → Sync & devices) to sync the board, events and calendar links.

## Calendar & to-dos

⚙ → Calendar takes iCal links: Google ("Secret address in iCal format"), iCloud (public calendar link), or Outlook (published ICS). Most providers block browsers from reading these directly, so they load through the Pi server. Events you add by hand and the to-do board always work. With the server, the board, your events and calendar links sync across all your screens.

## Privacy

Personal photos stay in the browser (IndexedDB), in your Pi's `photos/` folder, or, on the claude.ai page with photo sync on, in your own claude.ai account (⚙ → Sync & devices to turn that off). They never go anywhere else. The Pi server and the worker only fetch from an allowlist of the public APIs above, plus the calendar links you add.

## Files

```
index.html, css/app.css     page + design system
js/fx.js                    the transitions (add your own with def(...))
js/sources.js               image sources + the mixer
js/flights.js, radar.js     SFO arrivals data, strip, radar
js/game.js                  the tower game
js/env.js                   weather / UV / AQI / sneeze outlook
js/planner.js               calendar (iCal + RRULE), to-do board, weather tab
js/cloud.js                 sync through your claude.ai account (claude.ai page only)
server/server.js            companion server for a Pi or computer (Node 18+, no dependencies)
worker/                     free Cloudflare Worker for the website version (proxy + sync)
.github/workflows/pages.yml publishes the website to GitHub Pages
scripts/pi-setup.sh         Raspberry Pi kiosk setup
photos/                     your photos (when using the server)
```

Personal, non-commercial project. Fonts: Fraunces, Inter, JetBrains Mono (SIL OFL).
