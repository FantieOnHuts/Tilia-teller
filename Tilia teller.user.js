// ==UserScript==
// @name         Tilia Teller
// @namespace    http://tampermonkey.net/
// @version      10.0
// @description  Top ding.
// @author       Troy Axel Groot 
// @match        https://partner.tilia.app/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// @updateURL    https://raw.githubusercontent.com/FantieOnHuts/Tilia-teller/main/Tilia%20teller.user.js
// @downloadURL  https://raw.githubusercontent.com/FantieOnHuts/Tilia-teller/main/Tilia%20teller.user.js
// ==/UserScript==

(function () {
    'use strict';
    if (window.top !== window) return;
    console.log("[Tilia Teller] Script v12.0 geladen. Automatisch aftrekken geactiveerd.");

    // --- Instellingen & Status ---
    let autoCountActive = GM_getValue("tilia_auto_count", false);
    let widgetPos = GM_getValue("tilia_widget_pos", { top: "90px", right: "20px" });
    let observer = null;

    // --- Utility Functions ---
    function getTodayDateStr() {
        const d = new Date();
        return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    }

    // --- Core Counting Logic ---
    function countActiveTable(silent = false) {
        if (!autoCountActive && silent) return;

        const dateStr = getTodayDateStr();
        const dateKey = dateStr.replace(/-/g, "");
        const keyTotals = `tiliaSessionTotals_${dateKey}`;
        const keyIds = `tiliaCountedIds_${dateKey}`;

        let sessionCounts = GM_getValue(keyTotals, {});
        let countedIds = GM_getValue(keyIds, []);

        const dataTable = document.querySelector('table');
        if (!dataTable) return;
        
        const rows = dataTable.querySelectorAll('tbody tr');
        let newCountThisBatch = 0;
        let foundAny = false;

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return;
            
            const itemIdText = (cells[0]?.textContent || '').trim();
            const statusText = (cells[1]?.textContent || '').trim().toLowerCase();
            const dateRangeText = (cells[2]?.textContent || '').trim();
            
            // Check if it's currently considered 'verhuurd' for today
            const isCurrentlyVerhuurd = (statusText === 'verhuurd' && dateRangeText.split(' - ')[1]?.trim() === dateStr);
            
            if (itemIdText) {
                const match = itemIdText.match(/^[A-Za-z]+/);
                const itemType = (match && match[0]) ? match[0].toUpperCase() : "ONBEKEND";

                if (isCurrentlyVerhuurd && !countedIds.includes(itemIdText)) {
                    // New bike found!
                    sessionCounts[itemType] = (sessionCounts[itemType] || 0) + 1;
                    countedIds.push(itemIdText);
                    newCountThisBatch++;
                    foundAny = true;
                } else if (!isCurrentlyVerhuurd && countedIds.includes(itemIdText)) {
                    // Bike was counted but is now NO LONGER 'verhuurd' (cancelled/status changed)
                    if (sessionCounts[itemType] > 0) {
                        sessionCounts[itemType]--;
                        if (sessionCounts[itemType] <= 0) delete sessionCounts[itemType];
                    }
                    countedIds = countedIds.filter(id => id !== itemIdText);
                    newCountThisBatch--;
                    foundAny = true;
                }
            }
        });

        if (foundAny) {
            GM_setValue(keyTotals, sessionCounts);
            GM_setValue(keyIds, countedIds);
            updateWidgetView();
            
            const h = document.getElementById('t-header');
            const span = h ? h.querySelector('span') : null;
            if (h && span) { 
                if (newCountThisBatch > 0) {
                    h.style.background = '#10b981'; // Green
                    span.innerText = `+${newCountThisBatch} gevonden ✨`;
                } else if (newCountThisBatch < 0) {
                    h.style.background = '#f43f5e'; // Rose/Red
                    span.innerText = `${newCountThisBatch} verwijderd 🗑️`;
                } else {
                    h.style.background = '#3b82f6'; // Blue
                    span.innerText = "Lijst bijgewerkt 🔄";
                }
                
                setTimeout(() => { 
                    h.style.background = ''; 
                    span.innerText = "⚡ Tilia Teller";
                }, 1500); 
            }
        }
    }

    // --- Mutation Observer ---
    function setupObserver() {
        if (observer) observer.disconnect();
        observer = new MutationObserver(() => {
            if (!autoCountActive) return;
            clearTimeout(window.tiliaDebounce);
            window.tiliaDebounce = setTimeout(() => countActiveTable(true), 1200);
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
    }

    // --- Draggable Logic ---
    function makeDraggable(el, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
            handle.style.cursor = 'grabbing';
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;
            
            const newTop = (el.offsetTop - pos2);
            const newLeft = (el.offsetLeft - pos1);
            
            el.style.top = newTop + "px";
            el.style.left = newLeft + "px";
            el.style.right = 'auto'; // Overschrijf 'right' als we gaan slepen
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
            handle.style.cursor = 'grab';
            
            // Sla positie op
            GM_setValue("tilia_widget_pos", { 
                top: el.style.top, 
                left: el.style.left,
                right: 'auto'
            });
        }
    }

    // --- UI Logic ---
    function injectWidget() {
        if (document.getElementById('tilia-v11-widget')) return;

        const widget = document.createElement('div');
        widget.id = 'tilia-v11-widget';
        widget.style.display = 'none'; 
        widget.style.top = widgetPos.top;
        widget.style.right = widgetPos.right;
        if (widgetPos.left) widget.style.left = widgetPos.left;

        widget.innerHTML = `
            <style>
                #tilia-v11-widget {
                    position: fixed; width: 250px;
                    background: #1e293b; color: white; border-radius: 12px;
                    z-index: 999999; border: 1px solid #334155;
                    font-family: 'Segoe UI', sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    display: flex; flex-direction: column; overflow: hidden;
                    user-select: none;
                }
                .t-header { 
                    background: #2563eb; padding: 10px; font-weight: bold; font-size: 13px; 
                    display: flex; justify-content: space-between; align-items: center; 
                    transition: background 0.3s; cursor: grab;
                }
                .t-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
                .t-row { display: flex; justify-content: space-between; font-size: 12px; align-items: center; padding: 4px 0; border-bottom: 1px solid #334155; }
                .t-tag { background: #10b981; padding: 2px 6px; border-radius: 10px; font-weight: bold; font-size: 11px; }
                .t-btn-main { background: #3b82f6; border: none; color: white; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 11px; margin-top: 5px; }
                .t-btn-auto { background: ${autoCountActive ? '#10b981' : '#475569'}; border: none; color: white; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 10px; display: flex; align-items: center; justify-content: center; gap: 5px; }
                .t-btn-res { background: none; border: 1px solid #475569; color: #94a3b8; padding: 5px; border-radius: 4px; cursor: pointer; font-size: 9px; margin-top: 5px; }
                .t-del-btn { color: #f87171; background: none; border: none; cursor: pointer; font-weight: bold; font-size: 16px; padding: 0 8px; }
                .status-dot { width: 8px; height: 8px; background: ${autoCountActive ? '#10b981' : '#ef4444'}; border-radius: 50%; display: inline-block; }
            </style>
            <div class="t-header" id="t-header">
                <span>⚡ Tilia Teller</span>
                <span id="t-date-label" style="font-size:10px; opacity:0.8;"></span>
            </div>
            <div class="t-body" id="t-body-container">
                <button class="t-btn-auto" id="btn-toggle-auto">
                    <span class="status-dot" id="auto-status-dot"></span>
                    Auto-Count: <span id="auto-status-text">${autoCountActive ? 'AAN' : 'UIT'}</span>
                </button>
                <div id="t-render-list"></div>
                <button class="t-btn-main" id="btn-count">🎯 Handmatig Tellen (F8)</button>
                <button class="t-btn-res" id="btn-reset">Reset Dag Totaal</button>
            </div>
        `;
        document.body.appendChild(widget);

        // Maak draggable
        const header = widget.querySelector('#t-header');
        makeDraggable(widget, header);

        widget.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            
            if (btn.id === 'btn-toggle-auto') {
                autoCountActive = !autoCountActive;
                GM_setValue("tilia_auto_count", autoCountActive);
                btn.style.background = autoCountActive ? '#10b981' : '#475569';
                document.getElementById('auto-status-dot').style.background = autoCountActive ? '#10b981' : '#ef4444';
                document.getElementById('auto-status-text').innerText = autoCountActive ? 'AAN' : 'UIT';
            }

            if (btn.id === 'btn-count') countActiveTable();
            
            if (btn.id === 'btn-reset') {
                if (btn.getAttribute('data-confirm') === 'true') {
                    const dateKey = getTodayDateStr().replace(/-/g, "");
                    GM_setValue(`tiliaSessionTotals_${dateKey}`, {});
                    GM_setValue(`tiliaCountedIds_${dateKey}`, []);
                    updateWidgetView();
                    btn.innerText = "Gereset!";
                    setTimeout(() => { btn.innerText = "Reset Dag Totaal"; btn.setAttribute('data-confirm', 'false'); }, 1500);
                } else {
                    btn.innerText = "Zeker weten?";
                    btn.setAttribute('data-confirm', 'true');
                }
            }

            if (btn.classList.contains('t-del-btn')) {
                const type = btn.getAttribute('data-type');
                removeOneItem(type);
            }
        });

        updateWidgetView();
    }

    function removeOneItem(type) {
        const key = `tiliaSessionTotals_${getTodayDateStr().replace(/-/g, "")}`;
        let counts = GM_getValue(key, {});
        if (counts[type]) {
            counts[type]--;
            if (counts[type] <= 0) delete counts[type];
            GM_setValue(key, counts);
            updateWidgetView();
        }
    }

    function updateWidgetView() {
        const renderList = document.getElementById('t-render-list');
        if (!renderList) return;
        const dateStr = getTodayDateStr();
        const dateLabel = document.getElementById('t-date-label');
        if (dateLabel) dateLabel.innerText = dateStr;
        
        const key = `tiliaSessionTotals_${dateStr.replace(/-/g, "")}`;
        const counts = GM_getValue(key, {});
        const keys = Object.keys(counts).sort();
        
        renderList.innerHTML = '';
        let totalVal = 0;
        
        if (keys.length === 0) {
            renderList.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:11px; padding:10px;">Geen items geteld vandaag.</div>';
            return;
        }

        keys.forEach(k => {
            totalVal += counts[k];
            const div = document.createElement('div');
            div.className = 't-row';
            div.innerHTML = `
                <div style="display:flex;align-items:center;">
                   <button class="t-del-btn" data-type="${k}">×</button>
                   <span>${k}</span>
                </div>
                <span class="t-tag">${counts[k]}</span>
            `;
            renderList.appendChild(div);
        });

        const totalRow = document.createElement('div');
        totalRow.className = 't-row';
        totalRow.style.border = 'none';
        totalRow.style.marginTop = '8px';
        totalRow.innerHTML = `<b>Totaal</b> <span class="t-tag" style="background:#2563eb;">${totalVal}</span>`;
        renderList.appendChild(totalRow);
    }

    // --- Hotkeys ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F8') { e.preventDefault(); countActiveTable(); }
        if (e.key === 'F9') {
            e.preventDefault();
            const w = document.getElementById('tilia-v11-widget');
            if (w) w.style.display = (w.style.display === 'none') ? 'flex' : 'none';
        }
    });

    injectWidget();
    setupObserver();

    setInterval(() => {
        if (!document.getElementById('tilia-v11-widget')) injectWidget();
        updateWidgetView();
        if (autoCountActive) countActiveTable(true);
    }, 3000);
})();
