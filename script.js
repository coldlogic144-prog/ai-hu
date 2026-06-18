/* ==================== AI TOOLS DIRECTORY - MAIN SCRIPT ==================== */

// Global state
const state = {
    tools: [],            // All tools from JSON
    filteredTools: [],    // Tools after filtering
    currentCategory: 'all',
    currentSearch: '',
    currentView: 'tools'
};

// Quick prompt templates
const PROMPT_TEMPLATES = {
    summary: "Summarize the following content in clear bullet points with key takeaways:",
    explain: "Explain the following concept in simple terms as if I'm 5 years old. Use analogies and everyday examples:",
    translate: "Translate the following text to [TARGET_LANGUAGE]. Preserve the original tone and meaning:",
    code: "Review the following code. Identify bugs, suggest improvements, and explain what the code does step by step:",
    email: "Write a professional email about the following subject. Keep it concise, polite, and action-oriented:",
    brainstorm: "Brainstorm 10 creative and unique ideas about the following topic. Think outside the box:"
};

/* ==================== INITIALIZATION ==================== */
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadTools();
    setupEventListeners();
});

/* ==================== THEME MANAGEMENT ==================== */
function initTheme() {
    // Load saved theme or detect system preference
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const theme = savedTheme || (prefersDark ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
}

function toggleTheme() {
    const current = document.documentElement.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

/* ==================== LOAD TOOLS FROM JSON ==================== */
async function loadTools() {
    try {
        const response = await fetch('tools.json');
        if (!response.ok) throw new Error('Failed to fetch tools.json');
        const data = await response.json();
        state.tools = data.tools || [];
        state.filteredTools = [...state.tools];
        renderCategories();
        renderTools();
        updateToolsCount();
    } catch (error) {
        console.error('Error loading tools:', error);
        // Fallback for local file:// protocol issues
        document.getElementById('toolsGrid').innerHTML = `
            <div style="grid-column: 1/-1; text-align: center; padding: 3rem;">
                <h3 style="margin-bottom: 1rem;">⚠️ Could not load tools.json</h3>
                <p style="color: var(--text-secondary);">
                    If opening directly via <code>file://</code>, please run a local server:<br><br>
                    <code style="background: var(--bg-tertiary); padding: 0.5rem 1rem; border-radius: 6px; display: inline-block; margin-top: 0.5rem;">
                        python -m http.server 8000
                    </code><br>
                    Then visit <code>http://localhost:8000</code>
                </p>
            </div>
        `;
    }
}

/* ==================== RENDER CATEGORIES SIDEBAR ==================== */
function renderCategories() {
    const categoriesList = document.getElementById('categoriesList');
    const categories = {};

    // Count tools per category
    state.tools.forEach(tool => {
        categories[tool.category] = (categories[tool.category] || 0) + 1;
    });

    // Build HTML — start with "All" option
    let html = `
        <button class="category-item active" data-category="all">
            <span class="nav-icon">📦</span>
            <span>All Tools</span>
            <span class="category-count">${state.tools.length}</span>
        </button>
    `;

    // Sort categories alphabetically and append each
    Object.keys(categories).sort().forEach(cat => {
        const icon = getCategoryIcon(cat);
        html += `
            <button class="category-item" data-category="${cat}">
                <span class="nav-icon">${icon}</span>
                <span>${cat}</span>
                <span class="category-count">${categories[cat]}</span>
            </button>
        `;
    });

    categoriesList.innerHTML = html;

    // Attach click handlers
    categoriesList.querySelectorAll('.category-item').forEach(btn => {
        btn.addEventListener('click', () => {
            categoriesList.querySelectorAll('.category-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.currentCategory = btn.dataset.category;
            applyFilters();
            closeSidebar();
        });
    });
}

// Map category name to emoji icon
function getCategoryIcon(category) {
    const map = {
        'Chatbot': '💬',
        'Writing': '✍️',
        'Image': '🎨',
        'Video': '🎬',
        'Audio': '🎵',
        'Coding': '💻',
        'Productivity': '⚡',
        'Research': '🔬',
        'Design': '🖌️',
        'Marketing': '📈',
        'Education': '🎓',
        'Business': '💼'
    };
    return map[category] || '🤖';
}

/* ==================== RENDER TOOL CARDS ==================== */
function renderTools() {
    const grid = document.getElementById('toolsGrid');
    const emptyState = document.getElementById('emptyState');

    if (state.filteredTools.length === 0) {
        grid.innerHTML = '';
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    // Build cards with staggered animation
    grid.innerHTML = state.filteredTools.map((tool, idx) => `
        <article class="tool-card" style="animation-delay: ${Math.min(idx * 0.05, 0.5)}s">
            <div class="tool-card-header">
                <div class="tool-icon">${tool.icon || '🤖'}</div>
                <div class="tool-info">
                    <h3 class="tool-name">${escapeHtml(tool.name)}</h3>
                    <span class="tool-category">${escapeHtml(tool.category)}</span>
                </div>
            </div>
            <p class="tool-description">${escapeHtml(tool.description)}</p>
            <a href="${escapeHtml(tool.url)}" target="_blank" rel="noopener noreferrer" class="tool-visit-btn">
                <span>Visit</span>
                <span>→</span>
            </a>
        </article>
    `).join('');
}

/* ==================== FILTERING ==================== */
function applyFilters() {
    const query = state.currentSearch.toLowerCase().trim();
    const category = state.currentCategory;

    state.filteredTools = state.tools.filter(tool => {
        // Category filter
        const matchesCategory = category === 'all' || tool.category === category;

        // Search filter — checks name, description, and category
        const matchesSearch = !query ||
            tool.name.toLowerCase().includes(query) ||
            tool.description.toLowerCase().includes(query) ||
            tool.category.toLowerCase().includes(query);

        return matchesCategory && matchesSearch;
    });

    renderTools();
    updateToolsCount();
}

function updateToolsCount() {
    const count = state.filteredTools.length;
    document.getElementById('toolsCount').textContent =
        `${count} ${count === 1 ? 'tool' : 'tools'}`;
}

/* ==================== EVENT LISTENERS ==================== */
function setupEventListeners() {
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', toggleTheme);

    // Search input
    const searchInput = document.getElementById('searchInput');
    const searchClear = document.getElementById('searchClear');

    searchInput.addEventListener('input', (e) => {
        state.currentSearch = e.target.value;
        searchClear.classList.toggle('visible', !!e.target.value);
        applyFilters();
    });

    searchClear.addEventListener('click', () => {
        searchInput.value = '';
        state.currentSearch = '';
        searchClear.classList.remove('visible');
        applyFilters();
        searchInput.focus();
    });

    // View switching (Tools vs Prompts)
    document.querySelectorAll('.nav-item[data-view]').forEach(item => {
        item.addEventListener('click', () => {
            const view = item.dataset.view;
            switchView(view);
            document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            closeSidebar();
        });
    });

    // Mobile sidebar
    document.getElementById('menuToggle').addEventListener('click', openSidebar);
    document.getElementById('sidebarClose').addEventListener('click', closeSidebar);
    document.getElementById('sidebarOverlay').addEventListener('click', closeSidebar);

    // Prompt template buttons
    document.querySelectorAll('.template-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const template = btn.dataset.template;
            setPromptOutput(PROMPT_TEMPLATES[template]);
        });
    });

    // Custom prompt builder
    document.getElementById('buildPromptBtn').addEventListener('click', buildCustomPrompt);

    // Copy to clipboard
    document.getElementById('copyBtn').addEventListener('click', copyPrompt);

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        // Ctrl/Cmd + K to focus search
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            if (state.currentView === 'tools') searchInput.focus();
        }
        // ESC closes sidebar
        if (e.key === 'Escape') closeSidebar();
    });
}

/* ==================== VIEW SWITCHING ==================== */
function switchView(view) {
    state.currentView = view;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(view === 'tools' ? 'toolsView' : 'promptsView').classList.add('active');
    document.getElementById('topbarTitle').textContent =
        view === 'tools' ? 'AI Tools' : 'Prompt Generator';
}

/* ==================== SIDEBAR (MOBILE) ==================== */
function openSidebar() {
    document.getElementById('sidebar').classList.add('open');
    document.getElementById('sidebarOverlay').classList.add('show');
}

function closeSidebar() {
    document.getElementById('sidebar').classList.remove('open');
    document.getElementById('sidebarOverlay').classList.remove('show');
}

/* ==================== PROMPT GENERATOR ==================== */
function setPromptOutput(text) {
    const output = document.getElementById('promptOutput');
    output.textContent = text;
    // Smooth scroll to the output area
    output.parentElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
    // Flash animation
    output.style.animation = 'none';
    setTimeout(() => { output.style.animation = 'fadeIn 0.4s ease'; }, 10);
}

function buildCustomPrompt() {
    const role = document.getElementById('promptRole').value.trim();
    const task = document.getElementById('promptTask').value.trim();
    const context = document.getElementById('promptContext').value.trim();
    const tone = document.getElementById('promptTone').value;

    if (!task) {
        showToast('⚠️ Please enter a task to generate a prompt', 'warning');
        return;
    }

    // Build a structured prompt from inputs
    let prompt = '';
    if (role) prompt += `Act as a ${role}.\n\n`;
    prompt += `Task: ${task}\n\n`;
    if (context) prompt += `Context:\n${context}\n\n`;
    prompt += `Tone: ${tone}\n\n`;
    prompt += `Please provide a detailed, well-structured response.`;

    setPromptOutput(prompt);
    showToast('✨ Prompt generated successfully!');
}

/* ==================== CLIPBOARD ==================== */
async function copyPrompt() {
    const output = document.getElementById('promptOutput');
    const text = output.textContent;
    const copyBtn = document.getElementById('copyBtn');

    if (!text || text.includes('Your generated prompt will appear here')) {
        showToast('⚠️ Nothing to copy yet');
        return;
    }

    try {
        // Modern clipboard API
        await navigator.clipboard.writeText(text);
    } catch (err) {
        // Fallback for older browsers / insecure contexts
        const textarea = document.createElement('textarea');
        textarea.value = text;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
    }

    // Visual feedback
    copyBtn.classList.add('copied');
    copyBtn.querySelector('.copy-text').textContent = 'Copied!';
    copyBtn.querySelector('.copy-icon').textContent = '✓';

    setTimeout(() => {
        copyBtn.classList.remove('copied');
        copyBtn.querySelector('.copy-text').textContent = 'Copy';
        copyBtn.querySelector('.copy-icon').textContent = '📋';
    }, 2000);

    showToast('📋 Copied to clipboard!');
}

/* ==================== TOAST NOTIFICATION ==================== */
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.querySelector('.toast-message').textContent = message;
    toast.classList.add('show');
    clearTimeout(toast._timer);
    toast._timer = setTimeout(() => toast.classList.remove('show'), 2800);
}

/* ==================== UTILITIES ==================== */
// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
