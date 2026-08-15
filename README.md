# ARROW PWA — iPhone

A web app for a day's right-of-way asset capture. Runs offline from the iPhone
home screen, and at the end of the day produces one `.xlsx` with the photos
embedded, ready to send to the WhatsApp group.

It is **not** a port of the Android app. There is no backend, no upload, no
geofence, no match prompt and no coverage map. One day in, one spreadsheet out.

Nothing in `MyApplication` is used at runtime — the Android project was read
only to copy the report vocabulary and the photo overlay exactly.

---

## The Excel it produces

Fourteen columns, matching the existing report:

| A | B | C | D | E | F | G |
|---|---|---|---|---|---|---|
| Zone | Segment | Category | KP | Condition | Note | Timestamp |

| H | I | J | K | L | M | N |
|---|---|---|---|---|---|---|
| Latitude | Longitude | Street | Sub-District | District | Regency | Photo |

Photos are embedded in column N at exactly **5.56 cm wide × 2.81 cm high**, one
per row, anchored to the row they belong to.

Values use the old report vocabulary, converted on the way out, so the desktop
tools keep matching: `North` → `North Zone`, `7` → `Segment 7`,
`Pig Launcher` → `Launcher`, `Obvitnas Sign` → `Sign OBVITNAS`,
`12+500` → `12 + 500`, `Good` → `GOOD`.

Latitude and Longitude are written as **numbers** to seven decimals, so they
sort and calculate rather than sitting as text.

The file is named for when it was built and who built it, following the same
convention as the Android export:

```
ARROW_Assets_20260815_142530_Billy.xlsx
             └ date ┘└ time ┘└operator┘
```

The **time** is not decoration. Sending twice in a day is normal, and with only
the date both files carry the same name — two identical-looking attachments in
the group, and the second silently overwriting the first when the office saves
them into one folder.

---

## Publishing it to GitHub Pages

The camera, GPS and offline install all require HTTPS. GitHub Pages is free and
gives you a permanent address.

1. Create a repository on GitHub — call it `arrow-pwa`. Public is fine; nothing
   secret is in here.
2. Upload every file and folder from `D:\Users\reeko\arrow-pwa` to it, keeping
   the structure (`index.html` must sit at the top, not inside a folder).
3. In the repository: **Settings → Pages**.
4. Under *Build and deployment*, set **Source** to `Deploy from a branch`, then
   **Branch** to `main` and folder to `/ (root)`. Press **Save**.
5. Wait a minute or two, then open
   `https://<your-username>.github.io/arrow-pwa/`

### Pushing an update

1. Upload the changed files, replacing the old ones.
2. **Bump `CACHE_VERSION`** — line 7 of `sw.js`, e.g. `arrow-v4` → `arrow-v5`.
   Without a bump the phones keep serving the copy they already cached and the
   change never appears.
3. Wait for Pages to rebuild. **Settings → Pages** shows *"Your site is live
   at…"* with the time of the last deploy; the **Actions** tab shows a green
   tick when it has finished. Until then the old files are still being served.

The bottom of the main screen shows which version that phone is running —
`arrow-v4`, or `not cached` if no service worker has taken over. It is read
from the live cache, not from a constant, so it cannot claim to be newer than
it is. Ask an operator to read that line before debugging anything else.

Two entries (`arrow-v3, arrow-v4`) means an update is installing and the next
launch will complete it.

### If a phone will not take the update

iOS only checks for a new service worker on a real navigation, and resuming a
home-screen app from the app switcher is not one. The app now calls
`registration.update()` on every launch, but a phone already stuck on an old
version has to be pushed once, in this order:

1. Close the app **completely** — app switcher, swipe it up. Not just Home.
2. Reopen it. Check the version line at the bottom.
3. Still old? Open the same URL in **Safari** and pull down to reload. That is a
   real navigation, so the new worker is fetched.
4. Last resort: delete the home-screen icon, reopen the URL in Safari, and Add
   to Home Screen again. Recorded assets survive this — they live in the
   database, not the cache — but **export anything unsent first**, just in case.

### Installing on an iPhone

iOS has no install prompt — it has to be done by hand, once per phone:

1. Open the address **in Safari** (not Chrome).
2. Tap the **Share** button (the square with the arrow).
3. Scroll down, tap **Add to Home Screen**, then **Add**.
4. Launch it from the home-screen icon from then on.

Step 4 matters. Opened from the home screen it runs full screen, keeps its
storage, and works with no signal. Left as a Safari tab it is far more likely
to have its data cleared.

The first capture asks for camera and location permission. Allow both, and
choose **While Using the App** for location.

---

## Language

`EN | ID` in the header, the same place the Android app puts it. The choice is
remembered per phone; before anyone picks, it follows the phone's own language,
so an Indonesian iPhone opens in Indonesian.

Wording is taken from `docs/TRANSLATION.md` in the Android project — the table
Billy approved on 2026-08-09 — reused verbatim wherever the two apps say the
same thing, so they don't drift into two vocabularies.

**The same scope rules apply, and they matter more than the translation.** These
stay English in both languages:

| Stays English | Why |
|---|---|
| Asset types — all 11 | Data. They go into the spreadsheet and the signed report. |
| Good / Damaged / Missing | Same. |
| North / South | Same. Only the field label becomes "Zona". |
| Segment numbers | Identifiers. |
| The word "Segment" | Stays "Segment", not "Ruas" — the term the crew uses. |
| The photo overlay | Burned into images that go into the signed report. |
| **The 14 Excel column headers** | The office reads those. |

So an operator working entirely in Indonesian still produces a spreadsheet
identical to one produced in English. Verified.

Adding a language means adding one block to `js/i18n.js` and nothing else.

---

## A day's work

1. Enter your name, once — it goes on the filename.
2. Wait for the GPS panel to turn green. **Take Photo stays disabled until
   there is a fix**, so a record can never be saved without coordinates.
3. Fill Zone, Segment, Asset Type, Condition, KP, and a note if useful.
4. **Take Photo** opens the iPhone camera. Shoot, then review.
5. **Save Asset**. Zone, Segment and KP stay for the next one; type, condition
   and note clear.
6. Any time you want: **Export Excel & Send** → **Build Excel File** →
   **Send to WhatsApp**.
7. Once you can see the file arrived in the group, **Clear sent records** frees
   the storage.

### Sending more than once a day

Normal, and safe. Assets that have already gone to WhatsApp are **left out of
the next file**, so sending 20 before lunch and 20 after gives the office two
files of 20 — not 20 and then 40. The export screen states how many are going,
and the button on the form counts only what has not been sent.

The photos are not deleted when you send. They stay on the phone, marked, until
you press **Clear sent records** — a WhatsApp share is not proof of delivery,
and the same rule is why the Android app never deletes a photo it has no
acknowledgement for.

If a file genuinely did not arrive and you need to send those assets again, use
**Also include the N already sent** on the export screen.

**Clear sent records cannot touch anything unsent.** Reach for it mid-shift by
mistake and the work still on the phone is safe; it only removes what has
already been handed over.

Sharing is deliberately a second tap. iOS withdraws a page's permission to open
the share sheet if the button waits on anything first, so the file is built on
one tap and handed over on the next.

The share passes **the file and nothing else** — no title, no text. Adding
either alongside a file is a documented way to make Safari reject the share, and
the filename already travels with the file, so the title bought nothing.

### If "Send to WhatsApp" fails

The message now names what iOS reported, and a line underneath shows whether the
app is running from the home screen or a Safari tab, the iOS version, and
whether sharing is supported at all. Report those two lines — they are the whole
diagnosis.

**Save to Files** is the fallback. If *that* also does nothing, the cause is
almost certainly iOS: saving a file from a home-screen web app needs **iOS 16.4
or newer**, and below that the tap fails silently with no error to catch. The
way round it is to open the same URL in **Safari itself** rather than from the
home-screen icon — downloads work normally there — then attach the file in
WhatsApp by hand.

---

## What works offline, and what doesn't

Works with **no signal at all**: capture, GPS, the photo overlay, saving,
building the Excel, and handing it to WhatsApp. GPS is satellite, not network,
so coordinates are unaffected. WhatsApp accepts the file offline and queues it,
sending by itself once you are back in coverage.

Needs signal: only the four address columns. OpenStreetMap has no offline
equivalent. With no signal the record still saves with its coordinates and is
marked pending; the addresses fill in automatically when a connection returns,
and again when you press **Build Excel File**.

**Bad signal is handled differently from no signal, on purpose.** With no
signal the app skips the address lookups instantly. With a weak one it cannot:
iOS reports "online" whenever there is any network interface at all, even when
nothing gets through, so every lookup would run to its 12 second timeout — forty
of them is about nine minutes of waiting before the workbook even starts.

So the lookups get a **45 second budget** at export (worst case around a minute,
if a request is already in flight when the budget runs out). Whatever came back
is used, the file is built, and the rest stay pending for the next attempt.
Getting the spreadsheet out matters more than four columns.

**Street and Sub-District are often blank on this route.** OpenStreetMap simply
has no road or village mapped along most of the Riau corridor — measured
against real coordinates from the survey, only District and Regency come back
(`Kecamatan Bathin Solapan`, `Kabupaten Bengkalis`). The coordinates are always
right; if those two columns matter, they are quickest to fill in Excel
afterwards.

---

## Storage

A day is about 40 assets at roughly 250 KB each — around 10 MB, which is
comfortable. The app asks iOS for persistent storage on first run to reduce the
chance of eviction.

Sent photos stay on the phone until cleared, so storage grows across a week of
not clearing — about 50 MB over five days. That is still fine, but **Clear sent
records** once a file has arrived keeps it tidy, and is safe because it cannot
remove anything unsent.

An export never silently re-sends: it covers only what has not gone yet. If
records span more than one day the export screen lists the dates, so a forgotten
morning's work is visible rather than a surprise.

---

## Files

```
index.html              all five screens
styles.css              light, high-contrast, large targets for direct sun
manifest.webmanifest    home-screen name, icon, colours
sw.js                   offline cache — bump CACHE_VERSION to push updates
icons/                  180/192/512 px launcher icons
js/legacy.js            vocabulary + KP formatting, ported from the Android app
js/i18n.js              English and Indonesian interface strings
js/db.js                IndexedDB — records and photos
js/geo.js               GPS, reverse geocoding, address backfill
js/photo.js             orient, resize, burn the overlay, compress
js/xlsx.js              writes the .xlsx (zip + OOXML) with no dependencies
js/app.js               screen wiring
```

No build step, no dependencies, no CDN. What is in the folder is what runs.

---

## Verified

- The generated workbook passes zip CRC, XML well-formedness, and part-integrity
  checks; every picture resolves to a real JPEG in the package and measures
  5.56 × 2.81 cm in column N.
- KP entry produces `00+100` from `0,0,1,0,0` — the caret bug the Android app
  hit.
- Reverse geocoding returns correct kecamatan and kabupaten for real survey
  coordinates.
- Take Photo stays disabled without a GPS fix.
- 20 assets sent, then 20 more recorded: the second file carries 20 rows, and
  they are the correct 20. The toggle puts the earlier ones back to make 40.
- **Clear sent records** with 20 sent and 20 unsent removes exactly the 20 sent.
- With a dead network, the address backfill gives up on its budget instead of
  running every lookup to timeout.
- Switching `EN | ID` redraws every screen live, including content built at
  runtime, with no reload.
- With the interface in Indonesian, the asset types, conditions, zone values,
  photo overlay and all 14 Excel headers are still English, and the workbook is
  byte-for-byte the same shape as one built in English.

**Not yet verified on a real iPhone**: the camera, the GPS permission prompt,
Add to Home Screen, offline launch, and the WhatsApp share sheet. These need
hardware and cannot be exercised in a desktop test browser. Test them on one
phone before handing the link to fifteen operators.
