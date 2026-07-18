# Excel Dashboard

A premium, static, single-page dashboard that reads an `.xlsx` workbook directly in the browser and renders it as a searchable, sortable, filterable, paginated data table — no backend, no build step, no server-side code. Built to be hosted on **GitHub Pages**.

---

## 1. Project Structure

```
excel-dashboard/
│
├── index.html          Page markup (header, stat cards, table, pagination)
├── style.css           All styling (glassmorphism UI, dark/light theme, responsive)
├── app.js              All application logic (loading, search, sort, filter, export)
├── data.xlsx           <-- YOUR DATA. Replace this file to update the dashboard.
├── README.md           This file
│
├── assets/             (reserved for any extra images/icons you add)
└── fonts/
    └── KrutiDev010.ttf Add this file yourself (see "Fonts" section below)
```

Only **`data.xlsx`** is meant to be replaced regularly. The HTML/CSS/JS never need to change when your data changes — the table adapts automatically to any number of sheets, rows, and columns.

---

## 2. How the Website Works

1. The browser loads `index.html`, which pulls in `style.css`, `app.js`, and the [SheetJS](https://sheetjs.com/) library from a CDN.
2. On page load, `app.js` fetches `data.xlsx` from the same folder using the browser's `fetch()` API.
3. SheetJS (`XLSX.read`) parses the binary workbook **entirely in JavaScript, in the browser** — there is no server, no Python, no Node.js, and no conversion step involved.
4. The first row of each worksheet is treated as the header row. Every row after that becomes a row of data.
5. The dashboard automatically builds:
   - A worksheet selector (dropdown) for every sheet in the workbook
   - A dynamic table with a column for every header found
   - Statistics (row/column counts, current sheet, filtered count, last-loaded time)
6. All searching, sorting, filtering, and pagination happens client-side, instantly, without reloading the page.

Because everything happens in the browser, GitHub Pages (which only serves static files) is all you need to host it.

---

## 3. How to Replace `data.xlsx`

This is the **only** file you need to touch for day-to-day updates.

1. Prepare your Excel workbook. Any number of sheets, rows, and columns is fine (tested comfortably up to ~300 rows × 40 columns).
2. Make sure the **first row of each sheet contains your column headers**.
3. Save your file, name it exactly **`data.xlsx`**, and place it in the project's root folder (replacing the old one).
4. Deploy (see next section).

That's it — no HTML edits, no code changes, no rebuilding anything.

---

## 4. How GitHub Pages Deployment Works

Once your repository is connected to GitHub Pages (Settings → Pages → set source to your main branch), every push updates the live site automatically.

Your day-to-day workflow is just:

```bash
# 1. Replace data.xlsx with your new file (same filename)

# 2. Stage the change
git add .

# 3. Commit it
git commit -m "Update data"

# 4. Push to GitHub
git push
```

GitHub Pages will rebuild and publish the site automatically — usually within a minute or two. No manual build step, no server restart, nothing else to run.

**First-time setup**, if you haven't enabled Pages yet:
1. Push this project to a GitHub repository.
2. Go to your repo's **Settings → Pages**.
3. Under "Build and deployment", set **Source** to "Deploy from a branch", pick your default branch (e.g. `main`) and the `/ (root)` folder.
4. Save. GitHub will give you a URL like `https://yourusername.github.io/your-repo/`.

---

## 5. How to Change Fonts

The dashboard ships with two font options, switchable from the header dropdown and remembered via `localStorage`:

- **Default** — a clean, modern UI font ([Inter](https://fonts.google.com/specimen/Inter), loaded from Google Fonts)
- **Kruti Dev** — a legacy Hindi typeface, useful for workbooks containing Kruti Dev–encoded text

### Adding the Kruti Dev font file
Because of font licensing, the `.ttf` file itself is **not bundled** in this project. To enable it:

1. Obtain `KrutiDev010.ttf` from a source you're licensed to use.
2. Place it at `fonts/KrutiDev010.ttf` (the exact path already referenced in `style.css`).
3. No code changes needed — the `@font-face` rule in `style.css` already points at this path, and the font selector in the header will start working immediately.

### Changing the default UI font
Open `style.css` and edit the `--font-ui` variable near the top:

```css
:root {
  --font-ui: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}
```

Replace `'Inter'` with any other font (make sure to also update the Google Fonts `<link>` tags in `index.html` if you swap in a different web font).

### Adding more font options
1. Add a new `@font-face` block in `style.css` (section 1, "FONT FACES").
2. Add a new `<option>` inside `#fontSelector` in `index.html`.
3. In `app.js`, extend the `setFont()` function with an `else if` branch that sets `--font-active` to your new font.

---

## 6. How to Customize Colors

All colors live as CSS variables at the top of `style.css`, inside `:root` (light theme) and `[data-theme="dark"]` (dark theme):

```css
:root {
  --accent-1: #6366f1;   /* primary accent (indigo) */
  --accent-2: #8b5cf6;   /* secondary accent (purple) */
  --accent-3: #ec4899;   /* tertiary accent (pink) */
  --accent-gradient: linear-gradient(135deg, #6366f1 0%, #8b5cf6 55%, #ec4899 100%);
  ...
}
```

To rebrand the dashboard:
1. Change `--accent-1`, `--accent-2`, `--accent-3`, and `--accent-gradient` to your brand colors.
2. Stat card icon colors are set individually via `.stat-icon--blue`, `.stat-icon--purple`, etc. — update those gradients too if you want full consistency.
3. Dark mode colors are defined separately under `[data-theme="dark"]` so you can tune light and dark independently.

No other file needs to change — every color in the UI is driven from these variables.

---

## 7. Feature Summary

- **Any `.xlsx` workbook** — unlimited worksheets, dynamic columns/rows, dates, numbers, empty cells, Unicode, Hindi, and Kruti Dev–encoded text
- **Worksheet selector** to switch between sheets
- **Global search** across all columns
- **Per-column filters** (toggleable) and **column sorting** (click any header)
- **Resizable columns** (drag the right edge of any header)
- **Sticky table header** and **alternating row colors** with hover highlighting
- **Pagination** with selectable rows-per-page (10/25/50/100)
- **Live statistics**: total rows, total columns, current sheet, filtered row count, last-loaded time
- **Export**: CSV, Excel (.xlsx), and Print
- **Dark/light theme** toggle, remembered via `localStorage`
- **Kruti Dev font switch**, remembered via `localStorage`
- **Loading, error, and empty states** with clear messaging
- Fully **responsive** across desktop, tablet, and mobile

---

## 8. Technical Notes

- No build tools, bundlers, or package managers are required to run this project — just open `index.html` via a static server (or GitHub Pages).
- The only external dependencies are loaded via CDN: [SheetJS](https://cdn.sheetjs.com/) for Excel parsing and [Font Awesome](https://cdnjs.com/) for icons.
- Data is treated as read-only in the browser — editing happens in your original Excel file, not in the dashboard.
- Expected data size is around 300 rows × 20–40 columns; the table is not virtualized (by design, for simplicity), which is comfortable well beyond this size on any modern browser.

Enjoy your dashboard!
