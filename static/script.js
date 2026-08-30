document.addEventListener("DOMContentLoaded", () => {
    // DOM Elements
    const dropZone = document.getElementById("drop-zone");
    const fileUpload = document.getElementById("file-upload");
    const folderUpload = document.getElementById("folder-upload");
    const resultsSection = document.getElementById("results-section");
    const resultsGrid = document.getElementById("results-grid");
    const resultsCountBadge = document.getElementById("results-count-badge");
    const clearBtn = document.getElementById("clear-btn");
    const loadingSpinner = document.getElementById("loading-spinner");
    const activeSessionNameEl = document.getElementById("active-session-name");
    
    const sidebar = document.getElementById("sidebar");
    const navSidebarToggle = document.getElementById("nav-sidebar-toggle");
    const newAnalysisBtn = document.getElementById("new-analysis-btn");
    const historyList = document.getElementById("history-list");
    const historyEmpty = document.getElementById("history-empty");
    
    const exportHtmlBtn = document.getElementById("export-html-btn");
    const exportPdfBtn = document.getElementById("export-pdf-btn");
    const saveSessionBtn = document.getElementById("save-session-btn");
    const autosaveCheckbox = document.getElementById("autosave-checkbox");

    // State
    let currentResults = [];
    let currentSessionId = null;
    let currentSessionTitle = "Nuova Sessione";

    // --- 1. IndexedDB Helper for History ---
    const DB_NAME = "Dinov3TesiDB";
    const DB_VERSION = 1;
    const STORE_NAME = "sessions";
    let db = null;

    function openDatabase() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open(DB_NAME, DB_VERSION);
            req.onupgradeneeded = (e) => {
                const dbInst = e.target.result;
                if (!dbInst.objectStoreNames.contains(STORE_NAME)) {
                    dbInst.createObjectStore(STORE_NAME, { keyPath: "id" });
                }
            };
            req.onsuccess = (e) => {
                db = e.target.result;
                resolve(db);
            };
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function dbSaveSession(session) {
        if (!db) await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            store.put(session);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    async function dbGetAllSessions() {
        if (!db) await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readonly");
            const store = tx.objectStore(STORE_NAME);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = (e) => reject(e.target.error);
        });
    }

    async function dbDeleteSession(id) {
        if (!db) await openDatabase();
        return new Promise((resolve, reject) => {
            const tx = db.transaction(STORE_NAME, "readwrite");
            const store = tx.objectStore(STORE_NAME);
            store.delete(id);
            tx.oncomplete = () => resolve();
            tx.onerror = (e) => reject(e.target.error);
        });
    }

    // Helper: convert image File to Base64 (resized thumbnail if needed)
    function fileToBase64(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => resolve("");
            reader.readAsDataURL(file);
        });
    }

    // --- 2. History Sidebar Rendering ---
    async function loadHistorySidebar() {
        try {
            const sessions = await dbGetAllSessions();
            // Sort by timestamp descending
            sessions.sort((a, b) => b.timestamp - a.timestamp);

            historyList.innerHTML = "";
            if (sessions.length === 0) {
                historyList.appendChild(historyEmpty);
                return;
            }

            sessions.forEach(sess => {
                const item = document.createElement("div");
                item.className = `history-item ${sess.id === currentSessionId ? "active" : ""}`;
                item.dataset.id = sess.id;

                const dateStr = new Date(sess.timestamp).toLocaleDateString("it-IT", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit"
                });

                item.innerHTML = `
                    <div class="history-item-left">
                        <span class="history-item-title" title="${escapeHtml(sess.title)}">${escapeHtml(sess.title)}</span>
                        <span class="history-item-meta">${dateStr} • ${sess.results.length} predizioni</span>
                    </div>
                    <button class="history-item-delete" title="Elimina sessione">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="14" height="14">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                `;

                // Click on item to load
                item.addEventListener("click", (e) => {
                    if (e.target.closest(".history-item-delete")) return;
                    loadSession(sess);
                });

                // Delete button
                const delBtn = item.querySelector(".history-item-delete");
                delBtn.addEventListener("click", async (e) => {
                    e.stopPropagation();
                    if (confirm(`Vuoi eliminare la sessione "${sess.title}"?`)) {
                        await dbDeleteSession(sess.id);
                        if (currentSessionId === sess.id) {
                            startNewSession();
                        } else {
                            loadHistorySidebar();
                        }
                    }
                });

                historyList.appendChild(item);
            });
        } catch (err) {
            console.error("Errore caricamento cronologia:", err);
        }
    }

    function loadSession(sess) {
        currentSessionId = sess.id;
        currentSessionTitle = sess.title;
        currentResults = sess.results;
        activeSessionNameEl.textContent = sess.title;

        renderResults(currentResults);
        loadHistorySidebar();

        // Mobile: close sidebar on selection
        if (window.innerWidth <= 768) {
            sidebar.classList.remove("open");
        }
    }

    function startNewSession() {
        currentSessionId = null;
        currentSessionTitle = "Nuova Sessione";
        currentResults = [];
        activeSessionNameEl.textContent = "Nuova Sessione";
        resultsGrid.innerHTML = "";
        resultsSection.classList.add("hidden");
        fileUpload.value = "";
        folderUpload.value = "";
        loadHistorySidebar();
    }

    newAnalysisBtn.addEventListener("click", () => {
        startNewSession();
    });

    // --- 3. Sidebar Collapse / Toggle (Desktop & Mobile) ---
    function toggleSidebar() {
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle("open");
        } else {
            sidebar.classList.toggle("collapsed");
            localStorage.setItem("sidebarCollapsed", sidebar.classList.contains("collapsed"));
        }
    }
    
    if (navSidebarToggle) {
        navSidebarToggle.addEventListener("click", toggleSidebar);
    }

    if (localStorage.getItem("sidebarCollapsed") === "true" && window.innerWidth > 768) {
        sidebar.classList.add("collapsed");
    }

    // --- 4. Theme Management ---
    const themeCheckbox = document.getElementById("theme-checkbox");
    const moonIcon = document.getElementById("moon-icon");
    const sunIcon = document.getElementById("sun-icon");
    const prefersDarkScheme = window.matchMedia("(prefers-color-scheme: dark)");

    function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        if (theme === "light") {
            themeCheckbox.checked = true;
            moonIcon.classList.add("hidden");
            sunIcon.classList.remove("hidden");
        } else {
            themeCheckbox.checked = false;
            sunIcon.classList.add("hidden");
            moonIcon.classList.remove("hidden");
        }
    }

    const currentTheme = localStorage.getItem("theme");
    if (currentTheme) {
        applyTheme(currentTheme);
    } else if (!prefersDarkScheme.matches) {
        applyTheme("light");
    } else {
        applyTheme("dark");
    }

    themeCheckbox.addEventListener("change", (e) => {
        const newTheme = e.target.checked ? "light" : "dark";
        applyTheme(newTheme);
        localStorage.setItem("theme", newTheme);
    });

    // --- Autosave Preference ---
    if (autosaveCheckbox) {
        const savedAutosave = localStorage.getItem("autosaveHistory");
        if (savedAutosave !== null) {
            autosaveCheckbox.checked = (savedAutosave === "true");
        } else {
            autosaveCheckbox.checked = true; // default attivo
        }

        autosaveCheckbox.addEventListener("change", (e) => {
            localStorage.setItem("autosaveHistory", e.target.checked);
        });
    }

    // --- 5. Drag & Drop and Uploads ---
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropZone.addEventListener(eventName, () => dropZone.classList.remove('dragover'), false);
    });

    dropZone.addEventListener('drop', (e) => {
        const dt = e.dataTransfer;
        const files = dt.files;
        handleFiles(files);
    });

    fileUpload.addEventListener('change', function() {
        handleFiles(this.files);
    });

    folderUpload.addEventListener('change', function() {
        handleFiles(this.files);
    });

    clearBtn.addEventListener('click', () => {
        currentResults = [];
        resultsGrid.innerHTML = '';
        resultsSection.classList.add('hidden');
    });

    function handleFiles(files) {
        const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
        if (imageFiles.length === 0) {
            alert("Per favore, carica solo file di immagini valide (JPG, PNG).");
            return;
        }
        uploadFiles(imageFiles);
    }

    async function uploadFiles(files) {
        resultsSection.classList.remove('hidden');
        loadingSpinner.classList.remove('hidden');

        const formData = new FormData();
        files.forEach(file => {
            formData.append('images', file);
        });

        try {
            const response = await fetch('/predict', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();

            if (response.ok) {
                // Convert files to base64 for persistent preview and session saving
                const enrichedResults = await Promise.all(data.results.map(async (res) => {
                    const originalFile = files.find(f => f.name === res.filename || (f.webkitRelativePath && f.webkitRelativePath.endsWith(res.filename)));
                    let imgData = "";
                    if (originalFile) {
                        imgData = await fileToBase64(originalFile);
                    }
                    return {
                        ...res,
                        imageData: imgData
                    };
                }));

                currentResults = enrichedResults;
                renderResults(currentResults);

                // Title & Session info
                const now = new Date();
                const defaultTitle = `Analisi ${now.toLocaleDateString("it-IT")} ${now.toLocaleTimeString("it-IT", {hour: '2-digit', minute:'2-digit'})} (${currentResults.length} foto)`;
                currentSessionTitle = defaultTitle;

                // Check if autosave is enabled
                if (autosaveCheckbox && autosaveCheckbox.checked) {
                    currentSessionId = `session_${Date.now()}`;
                    activeSessionNameEl.textContent = defaultTitle;
                    await dbSaveSession({
                        id: currentSessionId,
                        title: currentSessionTitle,
                        timestamp: Date.now(),
                        results: currentResults
                    });
                    await loadHistorySidebar();
                } else {
                    currentSessionId = null;
                    activeSessionNameEl.textContent = `${defaultTitle} • Non salvata`;
                }
            } else {
                alert("Errore dal server: " + (data.error || "Sconosciuto"));
            }
        } catch (error) {
            console.error("Fetch error:", error);
            alert("Errore di rete durante la predizione.");
        } finally {
            loadingSpinner.classList.add('hidden');
            fileUpload.value = "";
            folderUpload.value = "";
        }
    }

    function renderResults(results) {
        resultsGrid.innerHTML = "";
        resultsSection.classList.remove("hidden");
        resultsCountBadge.textContent = `${results.length} ${results.length === 1 ? 'predizione' : 'predizioni'}`;

        results.forEach(res => {
            if (res.error) {
                console.error(`Errore su ${res.filename}: ${res.error}`);
                return;
            }

            const card = document.createElement('div');
            card.className = 'result-card';

            let colorVar = "var(--primary-color)";
            if (res.confidence >= 90) colorVar = "var(--success-text)";
            else if (res.confidence < 50) colorVar = "var(--warning-text)";

            const imgSrc = res.imageData || "";

            card.innerHTML = `
                <img src="${imgSrc}" alt="${escapeHtml(res.filename)}" class="result-img" />
                <div class="result-info">
                    <div class="result-name" title="${escapeHtml(res.filename)}">${escapeHtml(res.filename)}</div>
                    <div class="result-class" style="color: ${colorVar}">${escapeHtml(res.predicted_class)}</div>
                    <div class="result-conf">
                        <div class="conf-bar-bg">
                            <div class="conf-bar" style="width: ${res.confidence}%; background: ${colorVar}"></div>
                        </div>
                        <span>${res.confidence}%</span>
                    </div>
                </div>
            `;
            resultsGrid.appendChild(card);
        });

        // Scroll smoothly to results
        resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // --- 6. Save Session Button ---
    saveSessionBtn.addEventListener("click", async () => {
        if (currentResults.length === 0) {
            alert("Nessun risultato da salvare.");
            return;
        }

        const newTitle = prompt("Inserisci un titolo per questa sessione:", currentSessionTitle);
        if (newTitle !== null && newTitle.trim() !== "") {
            currentSessionTitle = newTitle.trim();
            activeSessionNameEl.textContent = currentSessionTitle;

            if (!currentSessionId) {
                currentSessionId = `session_${Date.now()}`;
            }

            await dbSaveSession({
                id: currentSessionId,
                title: currentSessionTitle,
                timestamp: Date.now(),
                results: currentResults
            });

            await loadHistorySidebar();
            
            // Visual feedback
            const originalText = saveSessionBtn.innerHTML;
            saveSessionBtn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="16" height="16">
                    <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
                <span>Salvato!</span>
            `;
            setTimeout(() => {
                saveSessionBtn.innerHTML = originalText;
            }, 1800);
        }
    });

    // --- 7. Export to HTML Report ---
    exportHtmlBtn.addEventListener("click", () => {
        if (currentResults.length === 0) {
            alert("Nessun risultato da esportare.");
            return;
        }

        const reportDate = new Date().toLocaleString("it-IT");
        const avgConfidence = (currentResults.reduce((acc, r) => acc + (r.confidence || 0), 0) / currentResults.length).toFixed(1);

        // Generate class summary stats
        const classCounts = {};
        currentResults.forEach(r => {
            const cls = r.predicted_class || "unknown";
            classCounts[cls] = (classCounts[cls] || 0) + 1;
        });

        const classSummaryHtml = Object.entries(classCounts)
            .map(([cls, count]) => `<span class="tag"><strong>${escapeHtml(cls)}</strong>: ${count}</span>`)
            .join(" ");

        const cardsHtml = currentResults.map(res => {
            let color = "#f97316";
            if (res.confidence >= 90) color = "#10b981";
            else if (res.confidence < 50) color = "#f59e0b";

            return `
                <div class="card">
                    <img src="${res.imageData || ''}" alt="${escapeHtml(res.filename)}" class="card-img" />
                    <div class="card-body">
                        <div class="card-title" title="${escapeHtml(res.filename)}">${escapeHtml(res.filename)}</div>
                        <div class="card-class" style="color: ${color}">${escapeHtml(res.predicted_class)}</div>
                        <div class="conf-row">
                            <div class="conf-bar-bg"><div class="conf-bar" style="width:${res.confidence}%; background:${color}"></div></div>
                            <span class="conf-val">${res.confidence}%</span>
                        </div>
                    </div>
                </div>
            `;
        }).join("\n");

        const fullHtml = `<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <title>Report Predizione DINOv3 - ${escapeHtml(currentSessionTitle)}</title>
    <style>
        :root {
            --bg: #121316;
            --card-bg: #1a1c24;
            --text: #f1f5f9;
            --text-muted: #8e96a5;
            --border: rgba(255,255,255,0.08);
            --primary: #f97316;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
        body { background: var(--bg); color: var(--text); padding: 2.5rem 1.5rem; }
        .report-header { max-width: 1100px; margin: 0 auto 2rem auto; border-bottom: 1px solid var(--border); padding-bottom: 1.5rem; }
        .report-title { font-size: 1.8rem; font-weight: 700; margin-bottom: 0.5rem; color: #ffffff; }
        .report-meta { color: var(--text-muted); font-size: 0.9rem; display: flex; flex-wrap: wrap; gap: 1.5rem; margin-top: 0.75rem; }
        .summary-box { max-width: 1100px; margin: 0 auto 2rem auto; background: var(--card-bg); border: 1px solid var(--border); border-radius: 12px; padding: 1.25rem; display: flex; flex-wrap: wrap; gap: 0.75rem; align-items: center; }
        .tag { background: rgba(255,255,255,0.05); border: 1px solid var(--border); padding: 0.35rem 0.75rem; border-radius: 6px; font-size: 0.85rem; }
        .grid { max-width: 1100px; margin: 0 auto; display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1.25rem; }
        .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 10px; overflow: hidden; }
        .card-img { width: 100%; height: 180px; object-fit: cover; background: #0c0d10; border-bottom: 1px solid var(--border); }
        .card-body { padding: 1rem; }
        .card-title { font-size: 0.825rem; color: var(--text-muted); font-family: monospace; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-bottom: 0.35rem; }
        .card-class { font-size: 1.05rem; font-weight: 600; text-transform: capitalize; margin-bottom: 0.5rem; }
        .conf-row { display: flex; align-items: center; justify-content: space-between; font-size: 0.825rem; }
        .conf-bar-bg { flex: 1; height: 5px; background: rgba(255,255,255,0.1); border-radius: 3px; margin-right: 10px; overflow: hidden; }
        .conf-bar { height: 100%; }
        .conf-val { font-weight: 500; color: var(--text-muted); }
        @media print {
            body { background: #fff !important; color: #000 !important; }
            .card { border: 1px solid #ddd !important; }
        }
    </style>
</head>
<body>
    <div class="report-header">
        <h1 class="report-title">Report Predizioni - ${escapeHtml(currentSessionTitle)}</h1>
        <div class="report-meta">
            <span>📅 Data Report: <strong>${reportDate}</strong></span>
            <span>🖼️ Totale Immagini: <strong>${currentResults.length}</strong></span>
            <span>🎯 Confidenza Media: <strong>${avgConfidence}%</strong></span>
            <span>🤖 Modello: <strong>DINOv3 ConvNeXt Ensemble (5 Folds)</strong></span>
        </div>
    </div>

    <div class="summary-box">
        <span style="font-weight:600; margin-right:0.5rem; font-size:0.9rem;">Distribuzione Rilevazioni:</span>
        ${classSummaryHtml}
    </div>

    <div class="grid">
        ${cardsHtml}
    </div>
</body>
</html>`;

        const blob = new Blob([fullHtml], { type: "text/html;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        const cleanName = currentSessionTitle.replace(/[^a-zA-Z0-9_-]/g, "_");
        a.download = `Report_DINOv3_${cleanName}.html`;
        a.href = url;
        a.click();
        URL.revokeObjectURL(url);
    });

    // --- 8. Export to PDF / Stampa ---
    exportPdfBtn.addEventListener("click", () => {
        if (currentResults.length === 0) {
            alert("Nessun risultato da stampare/esportare in PDF.");
            return;
        }
        window.print();
    });

    function escapeHtml(str) {
        if (!str) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Initialize Database and load history on startup
    openDatabase().then(() => {
        loadHistorySidebar();
    }).catch(err => {
        console.error("Errore inizializzazione IndexedDB:", err);
    });
});
