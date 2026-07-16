# TreeMap — Scroll Into Order

The marketing landing page for [TreeMap](https://github.com/Prithvi-Web/TreeMap-Disk-Visualizer),
the open-source disk-space visualizer.

One long scroll tells the product's story in 3D: a chaotic cloud of wireframe
cubes (your un-scanned disk) snaps onto scan tracks, a scan-line sweeps
through them flashing files as they're hashed, and everything lands as a real
**squarified treemap** — the same layout algorithm the app itself uses —
colored teal → amber → rose by size. Then the download buttons appear.

Built with Vite + React + TypeScript, three.js (react-three-fiber), GSAP
ScrollTrigger, and Tailwind CSS. No paid tools anywhere.

---

## Run it on your computer

Open Terminal, then copy-paste these two lines and press Enter:

```bash
cd "$HOME/Desktop/Claude Code/TreeMap Landing Page"
npm install && npm run dev
```

Then open **http://localhost:5199** in your browser. That's it.

To check that everything compiles cleanly (it does):

```bash
npm run build
```

---

## Put it on the internet (free, ~10 minutes)

The site deploys to **Vercel** (free Hobby plan, no credit card).
Vercel needs the code on GitHub first — use GitHub Desktop like you do for
your other projects:

1. **Push to GitHub**
   - Open **GitHub Desktop** → File → **Add Local Repository** → choose the
     `TreeMap Landing Page` folder.
   - It will say the folder is already a git repository with one commit.
     Click **Publish repository**, name it `treemap-landing`, and publish
     (public or private both work).

2. **Deploy on Vercel**
   - Go to [vercel.com](https://vercel.com) and log in (the "Hobby" plan is
     free).
   - Click **Add New → Project**, pick `treemap-landing` from the list, and
     click **Deploy**. Vercel auto-detects Vite — don't change any settings.
   - Two minutes later you get a live URL like
     `https://treemap-landing.vercel.app`.

3. **After your first deploy** (optional, 1 minute)
   - If your URL is different from `treemap-landing.vercel.app`, tell me the
     real one next session and I'll update the three places that mention it
     (social-preview tags, `robots.txt`, `sitemap.xml`). The site works fine
     either way — this only affects link previews and search engines.

**About custom domains, honestly:** a root domain like `treemap.app` always
costs money to register — that's the one thing no free tier gives you. The
free `something.vercel.app` address works perfectly, and if you ever buy a
domain, Vercel lets you attach it at no extra cost.

---

## The "Notify me" email form (optional)

The form is hidden until Firebase is connected. Everything else works
without it. To turn it on (free Spark plan, no credit card):

1. Go to [console.firebase.google.com](https://console.firebase.google.com)
   → **Add project** (name it anything, e.g. `treemap-landing`). Google
   Analytics can stay off.
2. In the project: **Build → Firestore Database → Create database** →
   choose **production mode** → pick any region → Enable.
3. Still in Firestore, open the **Rules** tab, replace everything with the
   block below, and click **Publish**:

   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /waitlist/{docId} {
         allow create: if request.resource.data.keys().hasOnly(['email', 'createdAt'])
                       && request.resource.data.email is string
                       && request.resource.data.email.matches('^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$')
                       && request.resource.data.createdAt == request.time;
         allow read, update, delete: if false;
       }
       match /downloadClicks/{docId} {
         allow create: if request.resource.data.keys().hasOnly(['platform', 'createdAt']);
         allow read, update, delete: if false;
       }
     }
   }
   ```

4. Click the gear icon → **Project settings** → under "Your apps" click the
   **</>** (web) icon → register the app → copy the six values from the
   `firebaseConfig` block it shows you.
5. In this folder, duplicate `.env.example`, rename the copy to
   `.env.local`, and paste each value after its `=` sign.
6. On Vercel: project **Settings → Environment Variables** → add the same
   six `VITE_FIREBASE_*` values → redeploy.

Emails people submit appear in Firestore under the `waitlist` collection.
Download-button clicks are counted in `downloadClicks`. Nobody can read,
edit, or delete either collection from the website — the rules above only
allow adding.

---

## Useful commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Run the site locally at http://localhost:5199 |
| `npm run build` | Type-check + production build into `dist/` |
| `npm run preview` | Serve the production build at http://localhost:5198 |
| `npm run check:squarify` | Prove the treemap layout tiles perfectly (no gaps/overlaps) |
| `npm run assets` | Regenerate favicon.ico / apple-touch-icon from the app icon |

Add `?rm` to the local URL (http://localhost:5199/?rm) to preview the
calm reduced-motion version without changing any system settings.

---

## How it's built (the short version)

- **One pinned scroll section** drives a shared progress value `t` (0→1).
  The 3D cubes, the camera, the scan sweep, and every text overlay read the
  same `t`, so nothing can drift out of sync.
- **Two instanced meshes** (a wireframe and a solid, 90–320 cubes depending
  on screen size) share identical per-cube transforms and cross-fade —
  sketchy chaos becomes clean tiles. One cube = one file = one treemap rect,
  so cube identity is stable from first pixel to last.
- **The final grid is a real squarified treemap** (`src/lib/squarify.ts`)
  over a hand-authored fake "scanned disk" of realistic clutter
  (`src/lib/demoData.ts`).
- **Accessibility & fallbacks:** users with "reduce motion" enabled — or
  machines without hardware graphics — get a calm, static, fully readable
  version with an SVG mosaic instead of WebGL. All copy lives in real DOM,
  never inside the canvas.
- **Performance:** three.js loads lazily after first paint, Firebase loads
  only if the form is used, device-pixel-ratio is capped, and the whole
  frame loop allocates zero objects. Lighthouse (mobile, throttled):
  Performance 78 · Accessibility 100 · Best Practices 100 · SEO 100.

Brand palette, copy, and assets come from the real TreeMap repo — including
`divider.svg` and the app icon. MIT, same as the app.
