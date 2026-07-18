# Manifest — a GitHub-backed file portal

Manifest is a static download portal that reads the contents of a `/files`
folder in a GitHub repository and turns it into a searchable, filterable,
sortable dashboard of downloadable files — no backend, no database, no build
step. It's plain HTML, CSS, and JavaScript, deployable straight to GitHub
Pages.

Add a file to the repository's `files/` folder, push, and it shows up on the
site automatically. Remove a file, and it disappears automatically. The
three lines at the top of `app.js` are the only code you should ever need to
touch.

---

## 1. How it works, in short

The page never stores a file list. On every visit it calls the GitHub REST
API, live:

1. **`GET /repos/{owner}/{repo}/git/trees/{branch}?recursive=1`**
   Returns every file in the repository in one call, including each file's
   size. Manifest keeps only the entries whose path starts with `files/`.
   This single-call approach is what lets the site handle thousands of files
   without hitting GitHub's rate limits.

2. **`GET /repos/{owner}/{repo}`**
   Used for the "Last updated" stat in the header (the repository's
   `pushed_at` timestamp) and for the "Source" link.

3. **`GET /repos/{owner}/{repo}/commits?path=files`**
   A light best-effort scan of recent commit history, used to keep the
   "updated" timestamp fresh without making one API call per file (see
   the note on per-file dates below).

4. Each file's actual bytes are served straight from
   **`raw.githubusercontent.com/{owner}/{repo}/{branch}/files/...`** — that's
   what the Download and Open buttons link to. GitHub hosts the bytes;
   Manifest just points at them.

Nothing is hardcoded, nothing is cached in the repository, and there is no
server: it's all public, unauthenticated GitHub API calls made from the
visitor's own browser.

### A note on "last modified" dates

GitHub's API doesn't have a single endpoint that returns an accurate,
per-file "last changed" date for an entire folder in one call — getting an
exact date for every file would mean one API call *per file*, which breaks
down fast under GitHub's 60-requests-per-hour limit for unauthenticated
traffic once a folder holds more than a handful of files. Manifest instead
shows the file's size and extension precisely (from the single tree call)
and uses the repository's own last-push date as the date shown on each card.
If you need exact per-file commit dates for a small folder, you can extend
`fetchRecentModifiedMap()` in `app.js` to call
`/repos/{owner}/{repo}/commits?path=files/yourfile.xlsx&per_page=1` per file
— just know it will not scale past a few dozen files without a GitHub token.

---

## 2. Changing the repository the site points to

Open `app.js` and edit the three constants at the top:

```js
const GITHUB_USERNAME = "your-github-username";
const REPOSITORY = "your-repo-name";
const BRANCH = "main";
```

That's the entire configuration surface. Everything else — icons, filters,
sorting, dark mode, stats — works automatically off whatever it finds in
that repository's `files/` folder.

If the repository is private, the public GitHub API calls in this project
will fail with a 404/403 — Manifest is built for **public** repositories
(or public GitHub Pages sites), since it makes unauthenticated requests
directly from the browser.

---

## 3. Uploading files

Files just need to live inside the `files/` folder of the repository, on
the branch set in `BRANCH`. Three ways to add them:

- **On GitHub.com:** open the `files/` folder → **Add file → Upload files**
  → drag files in → commit.
- **Git command line:**
  ```bash
  cp /path/to/your-file.pdf files/
  git add files/your-file.pdf
  git commit -m "Add your-file.pdf"
  git push
  ```
- **GitHub Desktop / any Git client:** drop the file into the local `files/`
  folder, then commit and push as usual.

Once GitHub finishes processing the push (usually a few seconds), reload
the site — the new file appears with no code changes, no redeploy step
beyond the normal GitHub Pages publish, and no manual list to update.

Subfolders inside `files/` are supported too — Manifest lists every file in
the tree beneath `files/`, at any depth.

There's a `.gitkeep` placeholder in `files/` so Git tracks the empty folder
out of the box. It's ignored by the site (dotfiles are filtered out) and
safe to delete once you've added real files.

---

## 4. How the GitHub API pieces fit together

| Purpose | Endpoint | Notes |
|---|---|---|
| List every file | `GET /repos/:owner/:repo/git/trees/:branch?recursive=1` | One call, includes file size, scales to large repos |
| Repo metadata | `GET /repos/:owner/:repo` | Powers "Last updated" and the source link |
| Recent activity | `GET /repos/:owner/:repo/commits?path=files` | Best-effort freshness signal, capped at 100 commits |
| File bytes | `raw.githubusercontent.com/:owner/:repo/:branch/:path` | What Download/Open actually link to |

All requests are unauthenticated and public, which means:

- **Rate limit:** 60 requests/hour per IP address from GitHub. Manifest only
  makes 2–3 requests per page load, so this comfortably supports normal
  traffic; a very high-traffic public page might eventually want to proxy
  requests through a small authenticated backend, which is outside the
  scope of this static site.
- **No secrets involved:** there is no API key to configure or leak, because
  every call here is a public, read-only GitHub API request.

---

## 5. Deploying to GitHub Pages

1. Push this project (`index.html`, `style.css`, `app.js`, `README.md`,
   `assets/`, `files/`) to a GitHub repository.
2. In that repository, go to **Settings → Pages**.
3. Under **Build and deployment → Source**, choose **Deploy from a branch**.
4. Pick the branch (e.g. `main`) and the root folder (`/`), then **Save**.
5. GitHub gives you a URL shaped like
   `https://your-username.github.io/your-repo-name/` — that's the live site.
6. Make sure `GITHUB_USERNAME`, `REPOSITORY`, and `BRANCH` in `app.js` match
   *this* repository (they're what the site reads its own file list from —
   they don't have to match the repo hosting the Pages site if you want the
   portal to display files living in a different public repo).

Pages usually goes live within a minute or two of enabling it, and updates
automatically on every push after that.

---

## 6. Local preview

No build step is required. Any static file server works, for example:

```bash
python3 -m http.server 8080
# then open http://localhost:8080
```

Opening `index.html` directly via `file://` also works for layout checks,
but the GitHub API fetches require a real `http(s)://` origin in some
browsers — use the local server above if the file list doesn't load.

---

## 7. Project structure

```
project/
│ index.html      — page structure, header, toolbar, states, file card template
│ style.css       — full design system (light + dark), responsive layout
│ app.js          — the only file with configuration; all GitHub API logic
│ README.md       — this file
│
├── assets/       — optional static assets (empty by default)
│
└── files/        — put every file you want distributed here
```

---

## 8. Customizing further

- **Icons / extension categories:** edit `CATEGORY_BY_EXT` and `ICONS` in
  `app.js` to add new extensions or change how they're grouped.
- **Colors and type:** all design tokens are CSS custom properties at the
  top of `style.css` (`:root`, `[data-theme="light"]`, `[data-theme="dark"]`)
  — change the palette there without touching layout rules.
- **What counts as "openable":** the `OPENABLE_EXTS` set in `app.js`
  controls which file types get an "Open" button in addition to "Download"
  (types a browser can typically render inline, like images, PDFs, audio,
  and video).
