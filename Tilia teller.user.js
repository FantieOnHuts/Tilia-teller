// ==UserScript==
// @name         Tilia Teller
// @namespace    http://tampermonkey.net/
// @version      7.4
// @description  Compacte zwevende teller, met automatische tab-opening en tel-functies.
// @author       Troy Axel Groot (met aanpassing)
// @match        https://partner.tilia.app/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    // --- Utility Functions ---
    function getTodayDateStr() {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        return `${day}-${month}-${year}`;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // --- Core Counting Logic ---
    async function countAllRelevantTabs() {
        const targetDateStr = getTodayDateStr();
        const accordions = document.querySelectorAll('.MuiAccordion-root, [class*="MuiAccordion-root"]');
        
        if (accordions.length === 0) {
            alert("Geen tabellen gevonden om te tellers. Staan er wel fietsen op deze pagina?");
            return;
        }

        const sessionTotalsKey = `tiliaSessionTotals_${targetDateStr.replace(/-/g, "")}`;
        let sessionCounts = GM_getValue(sessionTotalsKey, {});

        // Voor lichte visuele feedback op de knop
        const btn = document.getElementById('tilia-btn-auto-all');
        if (btn) btn.innerText = "⏳ Bezig met tellen...";

        for (const accordion of accordions) {
            const summary = accordion.querySelector('.MuiAccordionSummary-root, [class*="MuiAccordionSummary-root"]');
            if (!summary) continue;

            const label = summary.textContent.trim().toLowerCase();
            // Filter op relevante tabellen (bijv. geen laders of accessoires als dat gewenst is, 
            // maar voor nu doen we alles wat de gebruiker openzet).
            
            // Check of hij al open is
            const isExpanded = summary.getAttribute('aria-expanded') === 'true';
            
            if (!isExpanded) {
                summary.click();
                await sleep(800); // Wacht op animatie en data-load
            }

            const table = accordion.querySelector('table');
            if (table) {
                performCountInElement(table, targetDateStr, sessionCounts);
            }
        }

        GM_setValue(sessionTotalsKey, sessionCounts);
        updateWidgetTotals(targetDateStr);
        
        if (btn) btn.innerText = "🚀 Tel ALLE Tabellen";
        
        const widgetHeader = document.getElementById('tilia-widget-header');
        if (widgetHeader) {
            widgetHeader.style.background = '#10b981';
            setTimeout(() => { widgetHeader.style.background = ''; }, 1000);
        }
    }

    async function countSingleTab(accordion) {
        const targetDateStr = getTodayDateStr();
        const summary = accordion.querySelector('.MuiAccordionSummary-root, [class*="MuiAccordionSummary-root"]');
        if (!summary) return;

        const sessionTotalsKey = `tiliaSessionTotals_${targetDateStr.replace(/-/g, "")}`;
        let sessionCounts = GM_getValue(sessionTotalsKey, {});

        const isExpanded = summary.getAttribute('aria-expanded') === 'true';
        if (!isExpanded) {
            summary.click();
            await sleep(600);
        }

        const table = accordion.querySelector('table');
        if (table) {
            performCountInElement(table, targetDateStr, sessionCounts);
            GM_setValue(sessionTotalsKey, sessionCounts);
            updateWidgetTotals(targetDateStr);
        }
    }

    function performCountInElement(element, targetDateStr, countsObject) {
        const rows = element.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return;
            const statusText = (cells[1]?.textContent || '').trim().toLowerCase();
            const dateRangeText = (cells[2]?.textContent || '').trim();
            
            // Controleer op 'verhuurd' en de juiste datum
            if (statusText === 'verhuurd' && dateRangeText.split(' - ')[1]?.trim() === targetDateStr) {
                const itemIdText = (cells[0]?.textContent || '').trim();
                const match = itemIdText.match(/^[A-Za-z]+/);
                const itemType = (match && match[0]) ? match[0].toUpperCase() : "ONBEKEND";
                
                // We voegen ze toe aan het object
                countsObject[itemType] = (countsObject[itemType] || 0) + 1;
            }
        });
    }

    function manualCountRemove(type) {
        const targetDateStr = getTodayDateStr();
        const sessionTotalsKey = `tiliaSessionTotals_${targetDateStr.replace(/-/g, "")}`;
        let sessionCounts = GM_getValue(sessionTotalsKey, {});
        
        if (sessionCounts[type] && sessionCounts[type] > 0) {
            sessionCounts[type]--;
            if (sessionCounts[type] === 0) delete sessionCounts[type];
            GM_setValue(sessionTotalsKey, sessionCounts);
            updateWidgetTotals(targetDateStr);
        }
    }

    function resetSessionTotals() {
        const targetDateStr = getTodayDateStr();
        if (confirm(`Weet je zeker dat je alle tellingen voor VANDAAG (${targetDateStr}) wilt resetten?`)) {
            GM_setValue(`tiliaSessionTotals_${targetDateStr.replace(/-/g, "")}`, {});
            updateWidgetTotals(targetDateStr);
        }
    }


    // --- UI Injections ---
    function injectInlineTabButtons() {
        if (!window.location.pathname.endsWith("/voorraad")) return;

        const accordions = document.querySelectorAll('.MuiAccordion-root, [class*="MuiAccordion-root"]');
        accordions.forEach(accordion => {
            const summary = accordion.querySelector('.MuiAccordionSummary-content, [class*="MuiAccordionSummary-content"]');
            if (summary && !summary.querySelector('.tilia-inline-count-btn')) {
                const btn = document.createElement('button');
                btn.className = 'tilia-inline-count-btn';
                btn.innerText = 'TEL DEZE';
                btn.style.cssText = `
                    margin-left: 20px;
                    padding: 2px 8px;
                    background: #3b82f6;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    font-size: 11px;
                    font-weight: bold;
                    cursor: pointer;
                    z-index: 10;
                `;
                btn.onclick = (e) => {
                    e.stopPropagation();
                    countSingleTab(accordion);
                };
                summary.appendChild(btn);
            }
        });
    }

    function injectFloatingWidget() {
        if (document.getElementById('tilia-teller-widget')) return;

        const widget = document.createElement('div');
        widget.id = 'tilia-teller-widget';

        let isMinimized = GM_getValue("tiliaWidgetMinimized", false);
        if(isMinimized) widget.classList.add('minimized');

        widget.innerHTML = `
            <style>
                #tilia-teller-widget {
                    position: fixed;
                    top: 60px;
                    right: 20px;
                    width: 250px;
                    background: rgba(30, 41, 59, 0.95);
                    backdrop-filter: blur(10px);
                    color: #fff;
                    border-radius: 8px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    font-family: 'Segoe UI', system-ui, sans-serif;
                    z-index: 10000;
                    border: 1px solid rgba(255,255,255,0.1);
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                }
                #tilia-teller-widget.minimized .tilia-content {
                    display: none;
                }
                .tilia-header {
                    background: linear-gradient(135deg, #3b82f6, #2563eb);
                    padding: 8px 12px;
                    font-weight: bold;
                    font-size: 13px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    cursor: pointer;
                }
                .tilia-minimize-btn {
                    background: rgba(255,255,255,0.2);
                    border: none;
                    color: white;
                    border-radius: 4px;
                    width: 20px;
                    height: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                }
                .tilia-total-list {
                    padding: 10px;
                    background: rgba(15, 23, 42, 0.8);
                    max-height: 250px;
                    overflow-y: auto;
                    font-size: 12px;
                }
                .tilia-total-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 4px;
                    padding-bottom: 4px;
                    border-bottom: 1px solid rgba(255,255,255,0.05);
                }
                .tilia-btn-min-small {
                    background: #475569;
                    color: white;
                    border: none;
                    width: 18px;
                    height: 18px;
                    border-radius: 4px;
                    cursor: pointer;
                    margin-right: 6px;
                }
                .tilia-btn-min-small:hover { background: #ef4444; }
                .tilia-total-count {
                    background: #10b981;
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-weight: bold;
                }
                .tilia-section-title {
                    margin: 10px 10px 6px;
                    font-size: 10px;
                    text-transform: uppercase;
                    color: #94a3b8;
                    font-weight: bold;
                }
                .tilia-btn {
                    background: #334155;
                    color: white;
                    border: 1px solid rgba(255,255,255,0.1);
                    padding: 8px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    font-size: 12px;
                    margin: 0 10px 10px;
                }
                .tilia-btn:hover { background: #475569; }
                .tilia-total-empty {
                    text-align: center;
                    color: #64748b;
                    font-style: italic;
                }
            </style>
            
            <div class="tilia-header" id="tilia-widget-header">
                <div>⚡ Teller - <span id="tilia-header-date"></span></div>
                <button class="tilia-minimize-btn" id="tilia-btn-minimize">${isMinimized ? '+' : '−'}</button>
            </div>
            
            <div class="tilia-content">
                <div class="tilia-section-title">Huidige Totalen</div>
                <div class="tilia-total-list" id="tilia-totals-render"></div>

                <div class="tilia-section-title">Automatisering</div>
                <button class="tilia-btn" id="tilia-btn-auto-all" style="background:#1e3a8a; font-weight:bold;">
                    🚀 Tel ALLE Tabellen
                </button>
                <div style="display:flex; gap:5px; padding:0 10px;">
                    <button class="tilia-btn" id="tilia-btn-reset" style="flex:1; margin:0; background:rgba(220, 38, 38, 0.2); color:#fca5a5;">
                        Reset
                    </button>
                </div>
                <div style="height:10px;"></div>
            </div>
        `;

        document.body.appendChild(widget);
        
        document.getElementById('tilia-widget-header').onclick = () => {
            const isMin = widget.classList.toggle('minimized');
            document.getElementById('tilia-btn-minimize').innerText = isMin ? '+' : '−';
            GM_setValue("tiliaWidgetMinimized", isMin);
        };

        document.getElementById('tilia-btn-auto-all').onclick = countAllRelevantTabs;
        document.getElementById('tilia-btn-reset').onclick = resetSessionTotals;
        
        updateWidgetTotals(getTodayDateStr());
    }

    function updateWidgetTotals(dateStr) {
        if(!dateStr) dateStr = getTodayDateStr();
        const renderEl = document.getElementById('tilia-totals-render');
        const headerDate = document.getElementById('tilia-header-date');
        if (!renderEl) return;
        
        headerDate.innerText = dateStr;
        const sessionTotalsKey = `tiliaSessionTotals_${dateStr.replace(/-/g, "")}`;
        const sessionCounts = GM_getValue(sessionTotalsKey, {});
        
        renderEl.innerHTML = '';
        const keys = Object.keys(sessionCounts).sort();
        let totalSum = 0;
        
        if (keys.length === 0) {
            renderEl.innerHTML = '<div class="tilia-total-empty">Niets geteld vandaag.</div>';
            return;
        }

        keys.forEach(type => {
            const count = sessionCounts[type];
            totalSum += count;
            const itemDiv = document.createElement('div');
            itemDiv.className = 'tilia-total-item';
            itemDiv.innerHTML = `
                <div style="display:flex; align-items:center;">
                    <button class="tilia-btn-min-small" onclick="window.tiliaManualRemove('${type}')">−</button>
                    <span>${type}</span>
                </div>
                <span class="tilia-total-count">${count}</span>
            `;
            renderEl.appendChild(itemDiv);
        });
        
        const grandTotalDiv = document.createElement('div');
        grandTotalDiv.className = 'tilia-total-item';
        grandTotalDiv.style.borderTop = '1px solid rgba(255,255,255,0.2)';
        grandTotalDiv.style.paddingTop = '6px';
        grandTotalDiv.style.color = '#60a5fa';
        grandTotalDiv.innerHTML = `<span><b>Eindtotaal</b></span><span class="tilia-total-count" style="background:#3b82f6;">${totalSum}</span>`;
        renderEl.appendChild(grandTotalDiv);
    }

    // Expose for inline buttons
    window.tiliaManualRemove = manualCountRemove;

    // --- Init ---
    function evaluateVisibility() {
        if (window.location.pathname.endsWith("/voorraad")) {
            injectFloatingWidget();
            // Periodiek injecteren voor het geval de tabel opnieuw wordt geladen door filters/tabs
            setInterval(injectInlineTabButtons, 2000);
        } else {
            const widget = document.getElementById('tilia-teller-widget');
            if (widget) widget.style.display = 'none';
        }
    }

    const originalPushState = history.pushState;
    history.pushState = function () { originalPushState.apply(this, arguments); setTimeout(evaluateVisibility, 500); };
    window.addEventListener('popstate', () => setTimeout(evaluateVisibility, 500));
    
    evaluateVisibility();
})();
