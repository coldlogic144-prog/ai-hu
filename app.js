/* =========================================================================
   EXCEL DASHBOARD — APP LOGIC
   Vanilla JS (ES6). No frameworks. Reads data.xlsx via SheetJS at runtime.
   =========================================================================
   Sections:
   1. State
   2. DOM refs
   3. Init / data loading
   4. Sheet handling
   5. Search / filter / sort pipeline
   6. Rendering (table + pagination + stats)
   7. Column resize
   8. Export (CSV / XLSX / Print)
   9. Theme + font preferences
   10. Event wiring
   ========================================================================= */

(() => {
  'use strict';

  /* ---------------------- 1. STATE ---------------------- */
  const state = {
    workbook: null,
    sheetNames: [],
    currentSheet: null,
    headers: [],          // array of column header strings
    rows: [],             // array of row objects {colName: value}
    filteredRows: [],     // after search + column filters
    sortedRows: [],       // after sort applied to filteredRows
    columnFilters: {},    // { colName: filterText }
    globalSearchTerm: '',
    sortColumn: null,
    sortDirection: 'asc', // 'asc' | 'desc'
    rowsPerPage: 25,
    currentPage: 1,
    filtersVisible: false,
    lastLoadedAt: null,
  };

  /* ---------------------- 2. DOM REFS ---------------------- */
  const dom = {
    sheetSelector: document.getElementById('sheetSelector'),
    fontSelector: document.getElementById('fontSelector'),
    themeToggle: document.getElementById('themeToggle'),
    globalSearch: document.getElementById('globalSearch'),
    clearSearch: document.getElementById('clearSearch'),

    exportBtn: document.getElementById('exportBtn'),
    exportMenu: document.getElementById('exportMenu'),

    filterToggleBtn: document.getElementById('filterToggleBtn'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    rowsPerPage: document.getElementById('rowsPerPage'),

    loadingState: document.getElementById('loadingState'),
    errorState: document.getElementById('errorState'),
    errorMessage: document.getElementById('errorMessage'),
    emptyState: document.getElementById('emptyState'),
    tableWrapper: document.getElementById('tableWrapper'),
    tableHead: document.getElementById('tableHead'),
    tableBody: document.getElementById('tableBody'),

    paginationBar: document.getElementById('paginationBar'),
    paginationInfo: document.getElementById('paginationInfo'),
    pageIndicator: document.getElementById('pageIndicator'),
    firstPageBtn: document.getElementById('firstPageBtn'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    lastPageBtn: document.getElementById('lastPageBtn'),

    statTotalRows: document.getElementById('statTotalRows'),
    statTotalCols: document.getElementById('statTotalCols'),
    statSheetName: document.getElementById('statSheetName'),
    statFilteredRows: document.getElementById('statFilteredRows'),
    statLastLoaded: document.getElementById('statLastLoaded'),

    footerYear: document.getElementById('footerYear'),
  };

  /* ---------------------- 3. INIT / DATA LOADING ---------------------- */

  function init() {
    dom.footerYear.textContent = new Date().getFullYear();
    applyStoredTheme();
    applyStoredFont();
    wireEvents();
    loadWorkbook();
  }

  function loadWorkbook() {
    showState('loading');

    fetch('data.xlsx', { cache: 'no-store' })
      .then((res) => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.arrayBuffer();
      })
      .then((buffer) => {
        const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
        state.workbook = workbook;
        state.sheetNames = workbook.SheetNames || [];

        if (state.sheetNames.length === 0) {
          throw new Error('The workbook contains no worksheets.');
        }

        populateSheetSelector();
        state.lastLoadedAt = new Date();
        loadSheet(state.sheetNames[0]);
      })
      .catch((err) => {
        console.error('Failed to load workbook:', err);
        showState('error', friendlyErrorMessage(err));
      });
  }

  function friendlyErrorMessage(err) {
    const msg = (err && err.message) || String(err);
    if (msg.includes('HTTP 404')) {
      return 'data.xlsx was not found in the project root. Make sure the file is named exactly "data.xlsx" and sits next to index.html.';
    }
    return 'There was a problem reading data.xlsx (' + msg + '). Please verify the file is a valid .xlsx workbook.';
  }

  /* ---------------------- 4. SHEET HANDLING ---------------------- */

  function populateSheetSelector() {
    dom.sheetSelector.innerHTML = '';
    state.sheetNames.forEach((name) => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      dom.sheetSelector.appendChild(opt);
    });
  }

  function loadSheet(sheetName) {
    state.currentSheet = sheetName;
    dom.sheetSelector.value = sheetName;

    const sheet = state.workbook.Sheets[sheetName];
    const jsonRows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,        // array-of-arrays so we can control headers ourselves
      defval: '',        // keep empty cells as ''
      raw: false,         // format dates/numbers as SheetJS's default display strings
      dateNF: 'yyyy-mm-dd',
    });

    if (!jsonRows || jsonRows.length === 0) {
      state.headers = [];
      state.rows = [];
      finalizeDataChange();
      return;
    }

    // First non-empty row is treated as the header row.
    let headerRowIndex = 0;
    while (
      headerRowIndex < jsonRows.length &&
      jsonRows[headerRowIndex].every((c) => c === '' || c === null || c === undefined)
    ) {
      headerRowIndex++;
    }

    const rawHeaders = jsonRows[headerRowIndex] || [];
    const maxCols = jsonRows.reduce((max, r) => Math.max(max, r.length), rawHeaders.length);

    const headers = [];
    for (let i = 0; i < maxCols; i++) {
      const h = rawHeaders[i];
      headers.push(h !== undefined && h !== null && String(h).trim() !== '' ? String(h) : `Column ${i + 1}`);
    }

    const dataRows = jsonRows.slice(headerRowIndex + 1);

    const rows = dataRows
      .filter((r) => r.some((c) => c !== '' && c !== null && c !== undefined))
      .map((r) => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = r[i] !== undefined && r[i] !== null ? r[i] : '';
        });
        return obj;
      });

    state.headers = headers;
    state.rows = rows;

    finalizeDataChange();
  }

  function finalizeDataChange() {
    // Reset transient view state whenever the underlying sheet data changes.
    state.columnFilters = {};
    state.globalSearchTerm = '';
    dom.globalSearch.value = '';
    dom.clearSearch.classList.remove('visible');
    state.sortColumn = null;
    state.sortDirection = 'asc';
    state.currentPage = 1;

    applyPipeline();
  }

  /* ---------------------- 5. SEARCH / FILTER / SORT PIPELINE ---------------------- */

  function applyPipeline() {
    let result = state.rows;

    // Column filters
    const activeFilterCols = Object.keys(state.columnFilters).filter(
      (c) => state.columnFilters[c] && state.columnFilters[c].trim() !== ''
    );
    if (activeFilterCols.length > 0) {
      result = result.filter((row) =>
        activeFilterCols.every((col) => {
          const filterVal = state.columnFilters[col].toLowerCase();
          const cellVal = String(row[col] ?? '').toLowerCase();
          return cellVal.includes(filterVal);
        })
      );
    }

    // Global search
    if (state.globalSearchTerm.trim() !== '') {
      const term = state.globalSearchTerm.toLowerCase();
      result = result.filter((row) =>
        state.headers.some((h) => String(row[h] ?? '').toLowerCase().includes(term))
      );
    }

    state.filteredRows = result;

    // Sort
    if (state.sortColumn) {
      const col = state.sortColumn;
      const dir = state.sortDirection === 'asc' ? 1 : -1;
      result = [...result].sort((a, b) => {
        const av = a[col];
        const bv = b[col];
        const an = parseFloat(av);
        const bn = parseFloat(bv);
        const bothNumeric = !isNaN(an) && !isNaN(bn) && av !== '' && bv !== '';
        if (bothNumeric) return (an - bn) * dir;
        return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { sensitivity: 'base' }) * dir;
      });
    }

    state.sortedRows = result;

    // Clamp current page
    const totalPages = Math.max(1, Math.ceil(state.sortedRows.length / state.rowsPerPage));
    if (state.currentPage > totalPages) state.currentPage = totalPages;
    if (state.currentPage < 1) state.currentPage = 1;

    renderAll();
  }

  /* ---------------------- 6. RENDERING ---------------------- */

  function renderAll() {
    renderStats();

    if (state.headers.length === 0) {
      showState('empty');
      dom.paginationBar.classList.add('hidden');
      return;
    }

    if (state.sortedRows.length === 0) {
      showState('empty');
      dom.paginationBar.classList.add('hidden');
      renderTableHead(); // keep headers visible context isn't needed, table hidden anyway
      return;
    }

    showState('table');
    renderTableHead();
    renderTableBody();
    renderPagination();
  }

  function renderStats() {
    dom.statTotalRows.textContent = state.rows.length.toLocaleString();
    dom.statTotalCols.textContent = state.headers.length.toLocaleString();
    dom.statSheetName.textContent = state.currentSheet || '–';
    dom.statSheetName.title = state.currentSheet || '';
    dom.statFilteredRows.textContent = state.sortedRows.length.toLocaleString();
    dom.statLastLoaded.textContent = state.lastLoadedAt
      ? state.lastLoadedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '–';
  }

  function renderTableHead() {
    dom.tableHead.innerHTML = '';

    // Column header row
    const headRow = document.createElement('tr');
    state.headers.forEach((h) => {
      const th = document.createElement('th');
      th.dataset.col = h;

      const inner = document.createElement('div');
      inner.className = 'th-inner';
      if (state.sortColumn === h) inner.classList.add('sort-active');

      const label = document.createElement('span');
      label.textContent = h;

      const icon = document.createElement('i');
      icon.className =
        'fa-solid sort-icon ' +
        (state.sortColumn === h
          ? state.sortDirection === 'asc'
            ? 'fa-arrow-up-short-wide'
            : 'fa-arrow-down-wide-short'
          : 'fa-sort');

      inner.appendChild(label);
      inner.appendChild(icon);
      inner.addEventListener('click', () => toggleSort(h));

      const resizer = document.createElement('span');
      resizer.className = 'col-resizer';
      resizer.addEventListener('mousedown', (e) => startColumnResize(e, th));

      th.appendChild(inner);
      th.appendChild(resizer);
      headRow.appendChild(th);
    });
    dom.tableHead.appendChild(headRow);

    // Filter row (conditionally visible)
    if (state.filtersVisible) {
      const filterRow = document.createElement('tr');
      filterRow.className = 'filter-row';
      state.headers.forEach((h) => {
        const th = document.createElement('th');
        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'filter-input';
        input.placeholder = 'Filter...';
        input.value = state.columnFilters[h] || '';
        input.addEventListener('input', (e) => {
          state.columnFilters[h] = e.target.value;
          state.currentPage = 1;
          applyPipeline();
        });
        th.appendChild(input);
        filterRow.appendChild(th);
      });
      dom.tableHead.appendChild(filterRow);
    }
  }

  function renderTableBody() {
    dom.tableBody.innerHTML = '';

    const start = (state.currentPage - 1) * state.rowsPerPage;
    const end = start + state.rowsPerPage;
    const pageRows = state.sortedRows.slice(start, end);

    const fragment = document.createDocumentFragment();

    pageRows.forEach((row) => {
      const tr = document.createElement('tr');
      state.headers.forEach((h) => {
        const td = document.createElement('td');
        const val = row[h];
        if (val === '' || val === null || val === undefined) {
          td.textContent = '—';
          td.classList.add('cell-empty');
        } else {
          td.textContent = String(val);
          td.title = String(val);
        }
        tr.appendChild(td);
      });
      fragment.appendChild(tr);
    });

    dom.tableBody.appendChild(fragment);
  }

  function renderPagination() {
    const total = state.sortedRows.length;
    const totalPages = Math.max(1, Math.ceil(total / state.rowsPerPage));
    const start = total === 0 ? 0 : (state.currentPage - 1) * state.rowsPerPage + 1;
    const end = Math.min(total, state.currentPage * state.rowsPerPage);

    dom.paginationInfo.textContent = `Showing ${start.toLocaleString()}–${end.toLocaleString()} of ${total.toLocaleString()} rows`;
    dom.pageIndicator.textContent = `Page ${state.currentPage} of ${totalPages}`;

    dom.firstPageBtn.disabled = state.currentPage <= 1;
    dom.prevPageBtn.disabled = state.currentPage <= 1;
    dom.nextPageBtn.disabled = state.currentPage >= totalPages;
    dom.lastPageBtn.disabled = state.currentPage >= totalPages;

    dom.paginationBar.classList.remove('hidden');
  }

  function toggleSort(col) {
    if (state.sortColumn === col) {
      state.sortDirection = state.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      state.sortColumn = col;
      state.sortDirection = 'asc';
    }
    applyPipeline();
  }

  function showState(which, message) {
    dom.loadingState.classList.add('hidden');
    dom.errorState.classList.add('hidden');
    dom.emptyState.classList.add('hidden');
    dom.tableWrapper.classList.add('hidden');

    if (which === 'loading') {
      dom.loadingState.classList.remove('hidden');
    } else if (which === 'error') {
      dom.errorState.classList.remove('hidden');
      if (message) dom.errorMessage.textContent = message;
    } else if (which === 'empty') {
      dom.emptyState.classList.remove('hidden');
    } else if (which === 'table') {
      dom.tableWrapper.classList.remove('hidden');
    }
  }

  /* ---------------------- 7. COLUMN RESIZE ---------------------- */

  let resizeState = null;

  function startColumnResize(e, th) {
    e.preventDefault();
    e.stopPropagation();
    const resizer = e.target;
    resizer.classList.add('resizing');
    resizeState = {
      th,
      resizer,
      startX: e.clientX,
      startWidth: th.offsetWidth,
    };
    document.addEventListener('mousemove', onColumnResizing);
    document.addEventListener('mouseup', stopColumnResize);
  }

  function onColumnResizing(e) {
    if (!resizeState) return;
    const delta = e.clientX - resizeState.startX;
    const newWidth = Math.max(60, resizeState.startWidth + delta);
    resizeState.th.style.width = newWidth + 'px';
    resizeState.th.style.minWidth = newWidth + 'px';
  }

  function stopColumnResize() {
    if (resizeState) resizeState.resizer.classList.remove('resizing');
    resizeState = null;
    document.removeEventListener('mousemove', onColumnResizing);
    document.removeEventListener('mouseup', stopColumnResize);
  }

  /* ---------------------- 8. EXPORT ---------------------- */

  function exportCSV() {
    const rowsToExport = state.sortedRows;
    const csvData = [state.headers, ...rowsToExport.map((r) => state.headers.map((h) => r[h] ?? ''))];
    const ws = XLSX.utils.aoa_to_sheet(csvData);
    const csvString = XLSX.utils.sheet_to_csv(ws);
    downloadBlob(csvString, `${sanitizeFileName(state.currentSheet)}-export.csv`, 'text/csv;charset=utf-8;');
  }

  function exportXLSX() {
    const rowsToExport = state.sortedRows;
    const aoa = [state.headers, ...rowsToExport.map((r) => state.headers.map((h) => r[h] ?? ''))];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sanitizeSheetName(state.currentSheet));
    XLSX.writeFile(wb, `${sanitizeFileName(state.currentSheet)}-export.xlsx`);
  }

  function printView() {
    window.print();
  }

  function downloadBlob(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function sanitizeFileName(name) {
    return (name || 'sheet').replace(/[^a-z0-9\-_]+/gi, '_');
  }

  function sanitizeSheetName(name) {
    return (name || 'Sheet1').substring(0, 31);
  }

  /* ---------------------- 9. THEME + FONT PREFERENCES ---------------------- */

  function applyStoredTheme() {
    const stored = localStorage.getItem('dashboard-theme');
    const theme = stored || 'light';
    setTheme(theme, false);
  }

  function setTheme(theme, persist = true) {
    if (theme === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
      dom.themeToggle.innerHTML = '<i class="fa-solid fa-sun"></i>';
    } else {
      document.documentElement.removeAttribute('data-theme');
      dom.themeToggle.innerHTML = '<i class="fa-solid fa-moon"></i>';
    }
    if (persist) localStorage.setItem('dashboard-theme', theme);
  }

  function toggleTheme() {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    setTheme(isDark ? 'light' : 'dark');
  }

  function applyStoredFont() {
    const stored = localStorage.getItem('dashboard-font') || 'default';
    dom.fontSelector.value = stored;
    setFont(stored, false);
  }

  function setFont(fontKey, persist = true) {
    const root = document.documentElement;
    if (fontKey === 'krutidev') {
      root.style.setProperty('--font-active', "'Kruti Dev', var(--font-ui)");
    } else {
      root.style.setProperty('--font-active', 'var(--font-ui)');
    }
    if (persist) localStorage.setItem('dashboard-font', fontKey);
  }

  /* ---------------------- 10. EVENT WIRING ---------------------- */

  function wireEvents() {
    dom.sheetSelector.addEventListener('change', (e) => loadSheet(e.target.value));

    dom.fontSelector.addEventListener('change', (e) => setFont(e.target.value));

    dom.themeToggle.addEventListener('click', toggleTheme);

    dom.globalSearch.addEventListener('input', (e) => {
      state.globalSearchTerm = e.target.value;
      state.currentPage = 1;
      dom.clearSearch.classList.toggle('visible', e.target.value.length > 0);
      applyPipeline();
    });

    dom.clearSearch.addEventListener('click', () => {
      dom.globalSearch.value = '';
      state.globalSearchTerm = '';
      dom.clearSearch.classList.remove('visible');
      state.currentPage = 1;
      applyPipeline();
    });

    dom.filterToggleBtn.addEventListener('click', () => {
      state.filtersVisible = !state.filtersVisible;
      dom.filterToggleBtn.classList.toggle('toolbar-btn--ghost', !state.filtersVisible);
      renderTableHead();
    });

    dom.resetFiltersBtn.addEventListener('click', () => {
      state.columnFilters = {};
      state.globalSearchTerm = '';
      dom.globalSearch.value = '';
      dom.clearSearch.classList.remove('visible');
      state.sortColumn = null;
      state.sortDirection = 'asc';
      state.currentPage = 1;
      applyPipeline();
    });

    dom.rowsPerPage.addEventListener('change', (e) => {
      state.rowsPerPage = parseInt(e.target.value, 10);
      state.currentPage = 1;
      applyPipeline();
    });

    dom.firstPageBtn.addEventListener('click', () => { state.currentPage = 1; applyPipeline(); });
    dom.prevPageBtn.addEventListener('click', () => { state.currentPage = Math.max(1, state.currentPage - 1); applyPipeline(); });
    dom.nextPageBtn.addEventListener('click', () => {
      const totalPages = Math.max(1, Math.ceil(state.sortedRows.length / state.rowsPerPage));
      state.currentPage = Math.min(totalPages, state.currentPage + 1);
      applyPipeline();
    });
    dom.lastPageBtn.addEventListener('click', () => {
      state.currentPage = Math.max(1, Math.ceil(state.sortedRows.length / state.rowsPerPage));
      applyPipeline();
    });

    // Export dropdown
    dom.exportBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dom.exportMenu.classList.toggle('hidden');
    });
    document.addEventListener('click', () => dom.exportMenu.classList.add('hidden'));
    dom.exportMenu.addEventListener('click', (e) => e.stopPropagation());

    dom.exportMenu.querySelectorAll('[data-export]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.export;
        dom.exportMenu.classList.add('hidden');
        if (type === 'csv') exportCSV();
        else if (type === 'xlsx') exportXLSX();
        else if (type === 'print') printView();
      });
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
