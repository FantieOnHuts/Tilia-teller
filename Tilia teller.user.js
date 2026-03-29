// ==UserScript==
// @name         Tilia Teller
// @namespace    http://tampermonkey.net/
// @version      8.8
// @description  Combinaat van de betrouwbare 6.1 logica met het moderne F9 menu en F8 hotkey.
// @author       Troy Axel Groot (met aanpassing)
// @match        https://partner.tilia.app/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';
    if (window.top !== window) return;
    console.log("[Tilia Teller] Script v8.7 geladen.");

    // --- Utility Functions ---
    function getTodayDateStr() {
        const d = new Date();
        return `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}-${d.getFullYear()}`;
    }

    // --- Core Counting Logic (van 6.1) ---
    function countActiveTable() {
        const dateStr = getTodayDateStr();
        const key = `tiliaSessionTotals_${dateStr.replace(/-/g, "")}`;
        let sessionCounts = GM_getValue(key, {});

        // Pak de tabel (zoals in v6.1)
        const dataTable = document.querySelector('table');
        if (!dataTable) {
            console.warn("[Tilia Teller] Geen tabel gevonden op deze pagina.");
            alert("Kon geen tabel vinden op deze pagina.");
            return;
        }
        console.log("[Tilia Teller] Tabel gedetecteerd, start telling...");

        const rows = dataTable.querySelectorAll('tbody tr');
        const currentCategoryCounts = {};
        let foundAny = false;

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return;
            const statusText = (cells[1]?.textContent || '').trim().toLowerCase();
            const dateRangeText = (cells[2]?.textContent || '').trim();
            
            // Controleer op 'verhuurd' en de juiste retourdatum
            if (statusText === 'verhuurd' && dateRangeText.split(' - ')[1]?.trim() === dateStr) {
                const itemIdText = (cells[0]?.textContent || '').trim();
                const match = itemIdText.match(/^[A-Za-z]+/);
                const itemType = (match && match[0]) ? match[0].toUpperCase() : "ONBEKEND";
                
                currentCategoryCounts[itemType] = (currentCategoryCounts[itemType] || 0) + 1;
                foundAny = true;
            }
        });

        // Voeg toe aan de cumulatieve totalen
        for (const type in currentCategoryCounts) {
            sessionCounts[type] = (sessionCounts[type] || 0) + currentCategoryCounts[type];
        }

        if (foundAny) {
            GM_setValue(key, sessionCounts);
            updateWidgetView();
            // Visuele feedback op widget (Groen)
            const h = document.getElementById('t-header');
            if (h) { 
                h.style.background = '#10b981'; 
                const span = h.querySelector('span');
                const oldText = span.innerText;
                span.innerText = "Telling gelukt! ✅";
                setTimeout(() => { 
                    h.style.background = ''; 
                    span.innerText = oldText;
                }, 1000); 
            }
        } else {
            console.log("[Tilia Teller] Geen items gevonden voor " + dateStr);
            // Visuele feedback op widget (Oranje/Geel)
            const h = document.getElementById('t-header');
            if (h) { 
                h.style.background = '#f59e0b'; 
                const span = h.querySelector('span');
                const oldText = span.innerText;
                span.innerText = "0 gevonden vandaag ⚠️";
                setTimeout(() => { 
                    h.style.background = ''; 
                    span.innerText = oldText;
                }, 2000); 
            }
        }
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

    // --- UI Logic (Menu) ---
    function injectWidget() {
        if (document.getElementById('tilia-v8-widget')) return;

        const widget = document.createElement('div');
        widget.id = 'tilia-v8-widget';
        widget.style.display = 'flex'; // Zichtbaar bij start voor makkelijke debug

        widget.innerHTML = `
            <style>
                #tilia-v8-widget {
                    position: fixed; top: 60px; right: 20px; width: 220px;
                    background: #1e293b; color: white; border-radius: 12px;
                    z-index: 999999; border: 1px solid #334155;
                    font-family: 'Segoe UI', sans-serif; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    display: flex; flex-direction: column; overflow: hidden;
                    box-sizing: border-box;
                }
                #tilia-v8-widget * { box-sizing: border-box; }
                .t-header { background: #2563eb; padding: 10px; font-weight: bold; font-size: 13px; display: flex; justify-content: space-between; align-items: center; }
                .t-body { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
                .t-row { display: flex; justify-content: space-between; font-size: 12px; align-items: center; padding: 4px 0; border-bottom: 1px solid #334155; }
                .t-tag { background: #10b981; padding: 2px 6px; border-radius: 10px; font-weight: bold; font-size: 11px; }
                .t-btn-main { background: #3b82f6; border: none; color: white; padding: 10px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 11px; }
                .t-btn-res { background: #475569; border: none; color: white; padding: 6px; border-radius: 4px; cursor: pointer; font-size: 10px; margin-top: 5px; }
                .t-del-btn { color: #f87171; background: none; border: none; cursor: pointer; font-weight: bold; font-size: 16px; padding: 0 8px; }
            </style>
            <div class="t-header" id="t-header" title="F9 om te verbergen/tonen">
                <span>⚡ Tilia Teller</span>
                <span id="t-date-label" style="font-size:10px; opacity:0.8;"></span>
            </div>
            <div class="t-body" id="t-container">
                <div id="t-render-list" style="max-height: 250px; overflow-y: auto;"></div>
                <button type="button" class="t-btn-main" id="btn-count">🎯 Tel Open Tabel (F8)</button>
                <button type="button" class="t-btn-res" id="btn-reset">Reset Dag Totaal</button>
            </div>
        `;
        document.body.appendChild(widget);

        // Event Delegation voor alle knoppen (Reset, Min, Tel)
        widget.addEventListener('click', (e) => {
            const btn = e.target.closest('button');
            if (!btn) return;
            const id = btn.id;
            console.log("[Tilia Teller] Klik geregistreerd op:", id || "verwijder-knop");

            if (id === 'btn-count') {
                countActiveTable();
            }
            
            if (id === 'btn-reset') {
                if (btn.getAttribute('data-confirm') === 'true') {
                    // Tweede klik: Uitvoeren
                    console.log("[Tilia Teller] Reset bevestigd. Dagtotalen worden gewist...");
                    const key = `tiliaSessionTotals_${getTodayDateStr().replace(/-/g, "")}`;
                    GM_setValue(key, {});
                    updateWidgetView();
                    
                    btn.innerText = "Gewist! 🗑️";
                    btn.style.background = "#ef4444";
                    btn.setAttribute('data-confirm', 'false');
                    
                    setTimeout(() => {
                        btn.innerText = "Reset Dag Totaal";
                        btn.style.background = "";
                    }, 1500);
                } else {
                    // Eerste klik: Vraag om bevestiging
                    console.log("[Tilia Teller] Reset aangeklikt, wacht op bevestiging...");
                    btn.innerText = "Zeker weten? ❓";
                    btn.style.background = "#f59e0b";
                    btn.setAttribute('data-confirm', 'true');
                    
                    // Reset na 3 seconden als er niet nogmaals wordt geklikt
                    setTimeout(() => {
                        if (btn.getAttribute('data-confirm') === 'true') {
                            btn.innerText = "Reset Dag Totaal";
                            btn.style.background = "";
                            btn.setAttribute('data-confirm', 'false');
                        }
                    }, 4000);
                }
            }
            
            if (btn.classList.contains('t-del-btn')) {
                const type = btn.getAttribute('data-type');
                console.log("[Tilia Teller] Item verwijderen:", type);
                removeOneItem(type);
            }
        });

        updateWidgetView();
    }

    function updateWidgetView() {
        const renderList = document.getElementById('t-render-list');
        if (!renderList) return;
        const dateStr = getTodayDateStr();
        document.getElementById('t-date-label').innerText = dateStr;
        const key = `tiliaSessionTotals_${dateStr.replace(/-/g, "")}`;
        const counts = GM_getValue(key, {});
        const keys = Object.keys(counts).sort();
        
        renderList.innerHTML = '';
        let totalVal = 0;
        
        if (keys.length === 0) {
            renderList.innerHTML = '<div style="text-align:center; color:#94a3b8; font-size:11px; padding:10px;">Geen counts. Open categorie en druk F8.</div>';
            return;
        }

        keys.forEach(k => {
            totalVal += counts[k];
            const div = document.createElement('div');
            div.className = 't-row';
            div.innerHTML = `
                <div style="display:flex;align-items:center;">
                   <button type="button" class="t-del-btn" data-type="${k}">×</button>
                   <span>${k}</span>
                </div>
                <span class="t-tag">${counts[k]}</span>
            `;
            renderList.appendChild(div);
        });

        const totalRow = document.createElement('div');
        totalRow.className = 't-row';
        totalRow.style.border = 'none';
        totalRow.style.marginTop = '10px';
        totalRow.innerHTML = `<b>Totaal</b> <span class="t-tag" style="background:#2563eb;">${totalVal}</span>`;
        renderList.appendChild(totalRow);
    }

    // --- Hotkeys ---
    document.addEventListener('keydown', (e) => {
        // Gebruik event.code of event.key (beide voor de zekerheid)
        const isF8 = (e.key === 'F8' || e.keyCode === 119);
        const isF9 = (e.key === 'F9' || e.keyCode === 120);

        if (isF8) {
            e.preventDefault();
            console.log("[Tilia Teller] F8 Hotkey gedetecteerd.");
            countActiveTable();
        }
        if (isF9) {
            e.preventDefault();
            console.log("[Tilia Teller] F9 Hotkey gedetecteerd.");
            const w = document.getElementById('tilia-v8-widget');
            if (w) {
                w.style.display = (w.style.display === 'none') ? 'flex' : 'none';
            }
        }
    }, true); // Gebruik capture mode om andere listeners voor te zijn

    // Zorg dat het menu wordt ingeladen en de weergave up-to-date blijft
    setInterval(() => {
        injectWidget();
        updateWidgetView();
    }, 2000);

})();
