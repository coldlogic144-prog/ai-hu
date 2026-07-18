/* ==========================================================================
   MANIFEST — app.js
   A GitHub-backed download portal. Everything below GITHUB_USERNAME /
   REPOSITORY / BRANCH is fully automatic: add a file to /files in the repo
   and it appears here on next page load. No other line needs to change.
   ========================================================================== */

// ---------------------------------------------------------------------------
// CONFIGURATION — the only three values you should ever need to edit.
// ---------------------------------------------------------------------------
const GITHUB_USERNAME = "";
const REPOSITORY = "";
const BRANCH = "main";

// ---------------------------------------------------------------------------
// Constants derived from the configuration above.
// ---------------------------------------------------------------------------
const FILES_FOLDER = "files";
const API_BASE = "https://api.github.com";
const REPO_API = `${API_BASE}/repos/${GITHUB_USERNAME}/${REPOSITORY}`;
const RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_USERNAME}/${REPOSITORY}/${BRANCH}`;
const REPO_HTML_URL = `https://github.com/${GITHUB_USERNAME}/${REPOSITORY}`;

// How many recent commits (touching the files folder) to scan for accurate
// per-file "last modified" dates. Kept small on purpose: GitHub's REST API
// is rate-limited to 60 unauthenticated requests/hour, and a repository with
// thousands of files cannot afford one commit lookup per file. Files whose
// most recent change falls outside this window fall back to the repository's
// own last-push date, labelled accordingly.
const COMMIT_HISTORY_SCAN = 100;

// Extension → category map. Categories drive icon choice and the type filter.
const CATEGORY_BY_EXT = {
  // Spreadsheets
  xlsx: "spreadsheet", xls: "spreadsheet", xlsm: "spreadsheet", csv: "spreadsheet", ods: "spreadsheet", tsv: "spreadsheet",
  // Documents
  doc: "document", docx: "document", rtf: "document", odt: "document", txt: "document", md: "document",
  // Presentations
  ppt: "presentation", pptx: "presentation", odp: "presentation", key: "presentation",
  // PDF
  pdf: "pdf",
  // Archives
  zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive", bz2: "archive", xz: "archive",
  // Images
  png: "image", jpg: "image", jpeg: "image", gif: "image", webp: "image", svg: "image", bmp: "image", ico: "image", tiff: "image", avif: "image",
  // Video
  mp4: "video", mov: "video", avi: "video", mkv: "video", webm: "video", wmv: "video", flv: "video", m4v: "video",
  // Audio
  mp3: "audio", wav: "audio", flac: "audio", aac: "audio", ogg: "audio", m4a: "audio", wma: "audio",
  // Executables / installers
  exe: "executable", msi: "executable", apk: "executable", dmg: "executable", appimage: "executable", deb: "executable", rpm: "executable", sh: "executable", bat: "executable",
  // Code
  js: "code", ts: "code", jsx: "code", tsx: "code", py: "code", java: "code", c: "code", cpp: "code", html: "code", css: "code", json: "code", xml: "code", yml: "code", yaml: "code", sql: "code",
  // Fonts
  ttf: "font", otf: "font", woff: "font", woff2: "font",
};

const CATEGORY_LABELS = {
  spreadsheet: "Spreadsheets",
  document: "Documents",
  presentation: "Presentations",
  pdf: "PDFs",
  archive: "Archives",
  image: "Images",
  video: "Video",
  audio: "Audio",
  executable: "Executables",
  code: "Code",
  font: "Fonts",
  other: "Other",
};

// Extensions the browser can reasonably display inline via "Open".
const OPENABLE_EXTS = new Set([
  "pdf","png","jpg","jpeg","gif","webp","svg","bmp","ico","avif",
  "mp4","webm","mov","m4v","mp3","wav","ogg","m4a","flac",
  "txt","md","json","csv","html","xml","log",
]);

// ---------------------------------------------------------------------------
// Icon set (inline SVG strings, one per category)
// ---------------------------------------------------------------------------
const ICONS = {
  spreadsheet: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M3 9H21M3 15H21M9 3V21M15 3V21" stroke="currentColor" stroke-width="1.4"/></svg>`,
  document: `<svg viewBox="0 0 24 24" fill="none"><path d="M6 2.5H14L18.5 7V21.5H6V2.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 2.5V7H18.5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M9 12.5H15.5M9 16.5H15.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>`,
  presentation: `<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="4" width="19" height="13" rx="1.6" stroke="currentColor" stroke-width="1.6"/><path d="M8.5 21L12 17L15.5 21" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 12L10.5 8.5L13 11L17 7" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  pdf: `<svg viewBox="0 0 24 24" fill="none"><path d="M6 2.5H14L18.5 7V21.5H6V2.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 2.5V7H18.5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><text x="7.3" y="16.5" font-size="6.4" font-family="IBM Plex Mono, monospace" fill="currentColor">PDF</text></svg>`,
  archive: `<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M11 3V5M13 6V8M11 9V11M13 12V14" stroke="currentColor" stroke-width="1.4"/><circle cx="12" cy="17" r="2" stroke="currentColor" stroke-width="1.4"/></svg>`,
  image: `<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="4" width="19" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><circle cx="8.5" cy="9.5" r="1.8" stroke="currentColor" stroke-width="1.4"/><path d="M4 17L9 12L13 15.5L16 12.5L20 17" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  video: `<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="5" width="14" height="14" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M16.5 10L21 7.5V16.5L16.5 14" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>`,
  audio: `<svg viewBox="0 0 24 24" fill="none"><path d="M9 17.5V5.5L20 3V15" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="6.5" cy="17.5" r="2.5" stroke="currentColor" stroke-width="1.6"/><circle cx="17.5" cy="15" r="2.5" stroke="currentColor" stroke-width="1.6"/></svg>`,
  executable: `<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><path d="M7 9L10 12L7 15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15H17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  code: `<svg viewBox="0 0 24 24" fill="none"><path d="M8.5 8L4 12L8.5 16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M15.5 8L20 12L15.5 16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M13.5 5.5L10.5 18.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>`,
  font: `<svg viewBox="0 0 24 24" fill="none"><path d="M5 19L10 5H12.5L17.5 19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 14H15.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>`,
  other: `<svg viewBox="0 0 24 24" fill="none"><path d="M6 2.5H14L18.5 7V21.5H6V2.5Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 2.5V7H18.5" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="15" r="0.9" fill="currentColor"/><path d="M12 12.3C12 10.9 13.4 11 13.4 9.6C13.4 8.6 12.7 8 12 8C11.3 8 10.7 8.4 10.5 9.1" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>`,
};

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
let allFiles = [];       // normalized file records
let activeType = "all";
let activeExt = "all";
let sortField = "name";
let sortDir = "asc";
let searchTerm = "";

// ---------------------------------------------------------------------------
// DOM refs
// ---------------------------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const els = {
  searchInput: $("#searchInput"),
  clearSearch: $("#clearSearch"),
  themeToggle: $("#themeToggle"),
  statFileCount: $("#statFileCount"),
  statStorage: $("#statStorage"),
  statUpdated: $("#statUpdated"),
  statRepoLink: $("#statRepoLink"),
  typeFilter: $("#typeFilter"),
  extFilter: $("#extFilter"),
  sortField: $("#sortField"),
  sortDirBtn: $("#sortDirBtn"),
  sortDirLabel: $("#sortDirLabel"),
  resultCount: $("#resultCount"),
  loadingState: $("#loadingState"),
  errorState: $("#errorState"),
  errorMessage: $("#errorMessage"),
  retryBtn: $("#retryBtn"),
  emptyState: $("#emptyState"),
  noResultsState: $("#noResultsState"),
  resetFiltersBtn: $("#resetFiltersBtn"),
  fileGrid: $("#fileGrid"),
  fileCardTemplate: $("#fileCardTemplate"),
  footerRepoName: $("#footerRepoName"),
};

// ---------------------------------------------------------------------------
// Theme (persisted via localStorage)
// ---------------------------------------------------------------------------
function initTheme() {
  const saved = localStorage.getItem("manifest-theme");
  const preferred = saved || (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  document.documentElement.setAttribute("data-theme", preferred);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute("data-theme");
  const next = current === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", next);
  localStorage.setItem("manifest-theme", next);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getExtension(filename) {
  const parts = filename.split(".");
  if (parts.length < 2) return "";
  return parts.pop().toLowerCase();
}

function getCategory(ext) {
  return CATEGORY_BY_EXT[ext] || "other";
}

function formatBytes(bytes) {
  if (bytes === 0) return "0 B";
  if (!bytes && bytes !== 0) return "—";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value >= 100 || i === 0 ? Math.round(value) : value.toFixed(1)} ${units[i]}`;
}

function formatDate(dateInput) {
  if (!dateInput) return "Unknown date";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "Unknown date";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function relativeTime(dateInput) {
  if (!dateInput) return "—";
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return "—";
  const diffMs = Date.now() - d.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return formatDate(d);
}

function encodePath(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

function rawUrlFor(path) {
  return `${RAW_BASE}/${encodePath(path)}`;
}

// ---------------------------------------------------------------------------
// Data fetching
// ---------------------------------------------------------------------------
async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
  if (!res.ok) {
    if (res.status === 403) {
      throw new Error("GitHub's public API rate limit was hit. Wait a few minutes and try again.");
    }
    if (res.status === 404) {
      throw new Error("Repository or /files folder not found. Check GITHUB_USERNAME, REPOSITORY and BRANCH at the top of app.js.");
    }
    throw new Error(`GitHub API responded with ${res.status}.`);
  }
  return res.json();
}

async function fetchRepoInfo() {
  return fetchJson(REPO_API);
}

// Recursive tree listing — one call, scales to thousands of files.
async function fetchFileTree() {
  const tree = await fetchJson(`${REPO_API}/git/trees/${encodeURIComponent(BRANCH)}?recursive=1`);
  if (tree.truncated) {
    console.warn("Manifest: the repository tree was truncated by the GitHub API (extremely large repo). Some files may be missing.");
  }
  return (tree.tree || []).filter((item) => {
    if (item.type !== "blob") return false;
    if (!item.path.startsWith(`${FILES_FOLDER}/`)) return false;
    const basename = item.path.split("/").pop();
    if (basename.startsWith(".")) return false; // hide dotfiles, e.g. .gitkeep
    return true;
  });
}

// Best-effort recent-commit scan to attach real "last modified" dates without
// making one API call per file (see COMMIT_HISTORY_SCAN comment above).
async function fetchRecentModifiedMap() {
  const map = new Map();
  try {
    const commits = await fetchJson(
      `${REPO_API}/commits?path=${encodeURIComponent(FILES_FOLDER)}&per_page=${COMMIT_HISTORY_SCAN}`
    );
    // Commits come back newest-first; only keep the first (newest) date seen per file.
    for (const commit of commits) {
      const date = commit?.commit?.committer?.date || commit?.commit?.author?.date;
      if (!date) continue;
      // We don't get per-file paths without an extra call per commit, so we
      // conservatively stamp this date as the repo-wide "recent activity"
      // fallback rather than guessing which file it touched.
      if (!map.has("__repo_recent__")) map.set("__repo_recent__", date);
    }
  } catch (err) {
    console.warn("Manifest: could not read recent commit history, falling back to repo push date.", err);
  }
  return map;
}

async function loadEverything() {
  showState("loading");
  try {
    const [repoInfo, treeFiles] = await Promise.all([fetchRepoInfo(), fetchFileTree()]);

    els.statRepoLink.textContent = `${GITHUB_USERNAME}/${REPOSITORY}`;
    els.statRepoLink.href = REPO_HTML_URL;
    els.footerRepoName.textContent = `${GITHUB_USERNAME}/${REPOSITORY}`;

    const repoUpdated = repoInfo.pushed_at;
    const recentMap = await fetchRecentModifiedMap();
    const fallbackDate = recentMap.get("__repo_recent__") || repoUpdated;

    allFiles = treeFiles.map((item) => {
      const relativePath = item.path.slice(FILES_FOLDER.length + 1); // strip "files/"
      const name = relativePath.split("/").pop();
      const ext = getExtension(name);
      return {
        name,
        path: item.path,
        size: typeof item.size === "number" ? item.size : 0,
        ext,
        category: getCategory(ext),
        modified: fallbackDate,
        downloadUrl: rawUrlFor(item.path),
      };
    });

    els.statUpdated.textContent = relativeTime(repoUpdated);
    els.statUpdated.title = repoUpdated ? new Date(repoUpdated).toLocaleString() : "";

    populateFilterOptions();
    renderAll();
  } catch (err) {
    console.error(err);
    showState("error", err.message);
  }
}

// ---------------------------------------------------------------------------
// Filter options (built from the actual file list — never hardcoded)
// ---------------------------------------------------------------------------
function populateFilterOptions() {
  const categories = new Set(allFiles.map((f) => f.category));
  els.typeFilter.innerHTML = `<option value="all">All types</option>` +
    [...categories].sort().map((c) => `<option value="${c}">${CATEGORY_LABELS[c] || c}</option>`).join("");

  const exts = new Set(allFiles.map((f) => f.ext).filter(Boolean));
  els.extFilter.innerHTML = `<option value="all">All extensions</option>` +
    [...exts].sort().map((e) => `<option value="${e}">.${e}</option>`).join("");
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------
function getFilteredSorted() {
  let list = allFiles.filter((f) => {
    if (activeType !== "all" && f.category !== activeType) return false;
    if (activeExt !== "all" && f.ext !== activeExt) return false;
    if (searchTerm && !f.name.toLowerCase().includes(searchTerm)) return false;
    return true;
  });

  list.sort((a, b) => {
    let cmp = 0;
    if (sortField === "name") cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
    else if (sortField === "size") cmp = a.size - b.size;
    else if (sortField === "date") cmp = new Date(a.modified || 0) - new Date(b.modified || 0);
    return sortDir === "asc" ? cmp : -cmp;
  });

  return list;
}

function buildCard(file) {
  const node = els.fileCardTemplate.content.cloneNode(true);
  const card = node.querySelector(".file-card");
  card.classList.add(`cat-${file.category}`);

  node.querySelector(".stamp-ext").textContent = file.ext ? `.${file.ext}` : "file";
  node.querySelector(".card-icon").innerHTML = ICONS[file.category] || ICONS.other;

  const nameEl = node.querySelector(".card-name");
  nameEl.textContent = file.name;
  nameEl.title = file.name;

  node.querySelector(".meta-size").textContent = formatBytes(file.size);
  node.querySelector(".meta-date").textContent = formatDate(file.modified);

  const downloadBtn = node.querySelector(".action-download");
  downloadBtn.href = file.downloadUrl;
  downloadBtn.setAttribute("download", file.name);

  const openBtn = node.querySelector(".action-open");
  const canOpen = OPENABLE_EXTS.has(file.ext);
  openBtn.href = file.downloadUrl;
  if (!canOpen) {
    openBtn.style.display = "none";
    downloadBtn.style.flex = "1 1 100%";
  }

  return node;
}

function renderAll() {
  if (allFiles.length === 0) {
    showState("empty");
    return;
  }

  const list = getFilteredSorted();
  els.resultCount.textContent = `${list.length} of ${allFiles.length} file${allFiles.length === 1 ? "" : "s"}`;

  if (list.length === 0) {
    showState("noResults");
    return;
  }

  showState("grid");
  els.fileGrid.innerHTML = "";
  const frag = document.createDocumentFragment();
  list.forEach((file) => frag.appendChild(buildCard(file)));
  els.fileGrid.appendChild(frag);

  const totalBytes = allFiles.reduce((sum, f) => sum + (f.size || 0), 0);
  els.statFileCount.textContent = allFiles.length.toLocaleString();
  els.statStorage.textContent = formatBytes(totalBytes);
}

function showState(name, errorMsg) {
  els.loadingState.hidden = name !== "loading";
  els.errorState.hidden = name !== "error";
  els.emptyState.hidden = name !== "empty";
  els.noResultsState.hidden = name !== "noResults";
  els.fileGrid.hidden = name !== "grid";
  if (name === "error" && errorMsg) els.errorMessage.textContent = errorMsg;
}

// ---------------------------------------------------------------------------
// Event wiring
// ---------------------------------------------------------------------------
function debounce(fn, wait) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

function wireEvents() {
  els.themeToggle.addEventListener("click", toggleTheme);

  const onSearch = debounce(() => {
    searchTerm = els.searchInput.value.trim().toLowerCase();
    els.clearSearch.hidden = searchTerm.length === 0;
    renderAll();
  }, 120);
  els.searchInput.addEventListener("input", onSearch);

  els.clearSearch.addEventListener("click", () => {
    els.searchInput.value = "";
    searchTerm = "";
    els.clearSearch.hidden = true;
    renderAll();
    els.searchInput.focus();
  });

  els.typeFilter.addEventListener("change", () => {
    activeType = els.typeFilter.value;
    renderAll();
  });

  els.extFilter.addEventListener("change", () => {
    activeExt = els.extFilter.value;
    renderAll();
  });

  els.sortField.addEventListener("change", () => {
    sortField = els.sortField.value;
    renderAll();
  });

  els.sortDirBtn.addEventListener("click", () => {
    sortDir = sortDir === "asc" ? "desc" : "asc";
    els.sortDirBtn.setAttribute("data-dir", sortDir);
    els.sortDirLabel.textContent = sortDir === "asc" ? "Asc" : "Desc";
    renderAll();
  });

  els.retryBtn.addEventListener("click", loadEverything);

  els.resetFiltersBtn.addEventListener("click", () => {
    activeType = "all";
    activeExt = "all";
    searchTerm = "";
    els.typeFilter.value = "all";
    els.extFilter.value = "all";
    els.searchInput.value = "";
    els.clearSearch.hidden = true;
    renderAll();
  });
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------
function boot() {
  initTheme();
  wireEvents();

  if (!GITHUB_USERNAME || !REPOSITORY) {
    showState("error", "Set GITHUB_USERNAME and REPOSITORY at the top of app.js before this page can load files.");
    return;
  }

  loadEverything();
}

document.addEventListener("DOMContentLoaded", boot);
