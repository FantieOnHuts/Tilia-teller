// ==UserScript==
// @name         Tilia Teller
// @namespace    http://tampermonkey.net/
// @version      7.3
// @description  Compacte zwevende teller, met een optie om resultaten uit de lijst te minnen als er iets verkeerd geteld is.
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

    // --- Core Counting Logic ---
    function countReturnedItemsToday() {
        const todayDateStr = getTodayDateStr();
        console.log(`Teller geactiveerd voor datum: ${todayDateStr}`);
        performCount(todayDateStr);
    }

    function performCount(targetDateStr) {
        if (!targetDateStr || !/^\d{2}-\d{2}-\d{4}$/.test(targetDateStr)) return;

        GM_setValue("tiliaLastReturnDateGlobal", targetDateStr);
        const sessionTotalsKey = `tiliaSessionTotals_${targetDateStr.replace(/-/g, "")}`;
        let sessionCounts = GM_getValue(sessionTotalsKey, {});

        const dataTable = document.querySelector('table');
        if (!dataTable) {
            alert("Kon geen tabel vinden op deze pagina.");
            return;
        }

        const rows = dataTable.querySelectorAll('tbody tr');
        let addedCount = 0;
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return;
            const statusText = (cells[1]?.textContent || '').trim().toLowerCase();
            const dateRangeText = (cells[2]?.textContent || '').trim();
            if (statusText === 'verhuurd' && dateRangeText.split(' - ')[1]?.trim() === targetDateStr) {
                const itemIdText = (cells[0]?.textContent || '').trim();
                const match = itemIdText.match(/^[A-Za-z]+/);
                const itemType = (match && match[0]) ? match[0].toUpperCase() : "ONBEKEND";
                sessionCounts[itemType] = (sessionCounts[itemType] || 0) + 1;
                addedCount++;
            }
        });

        GM_setValue(sessionTotalsKey, sessionCounts);
        updateWidgetTotals(targetDateStr);
        
        // Optional flash feedback
        const widgetHeader = document.getElementById('tilia-widget-header');
        if (widgetHeader) {
            const originalBg = widgetHeader.style.background;
            widgetHeader.style.background = '#10b981'; // green
            setTimeout(() => { widgetHeader.style.background = originalBg; }, 1000);
        }
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


    // --- UI Floating Widget ---
    function evaluateWidgetVisibility() {
        const widget = document.getElementById('tilia-teller-widget');
        const isVoorraadPage = window.location.pathname.endsWith("/voorraad");
        
        if (widget) {
            widget.style.display = isVoorraadPage ? 'flex' : 'none';
        } else if (isVoorraadPage) {
            injectFloatingWidget();
        }
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
                    transition: height 0.3s ease;
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
                    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    cursor: pointer;
                    user-select: none;
                }
                .tilia-header:hover {
                    background: linear-gradient(135deg, #4b8df6, #3573eb);
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
                    font-size: 14px;
                    line-height: 1;
                }
                .tilia-minimize-btn:hover { background: rgba(255,255,255,0.4); }
                .tilia-content {
                    display: flex;
                    flex-direction: column;
                }
                .tilia-total-list {
                    padding: 10px;
                    background: rgba(15, 23, 42, 0.8);
                    min-height: 40px;
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
                    font-weight: 500;
                }
                .tilia-total-item:last-child {
                    border-bottom: none;
                    margin-bottom: 0;
                    padding-bottom: 0;
                }
                .tilia-total-left {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }
                .tilia-btn-min-small {
                    background: #475569;
                    color: white;
                    border: none;
                    width: 18px;
                    height: 18px;
                    border-radius: 4px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 14px;
                    font-weight: bold;
                    cursor: pointer;
                    line-height: 1;
                }
                .tilia-btn-min-small:hover { background: #ef4444; }
                .tilia-total-count {
                    background: #10b981;
                    padding: 2px 6px;
                    border-radius: 10px;
                    font-size: 11px;
                    font-weight: bold;
                }
                .tilia-section-title {
                    margin: 10px 10px 6px;
                    font-size: 10px;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                    color: #94a3b8;
                    font-weight: bold;
                }
                .tilia-tabs-container {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 6px;
                    padding: 0 10px 10px;
                }
                .tilia-btn {
                    background: #334155;
                    color: white;
                    border: 1px solid rgba(255,255,255,0.1);
                    padding: 6px 10px;
                    border-radius: 4px;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    flex: 1;
                    font-size: 12px;
                }
                .tilia-btn:hover { background: #475569; }
                .tilia-btn:active { transform: scale(0.98); }
                .tilia-total-empty {
                    text-align: center;
                    color: #64748b;
                    font-style: italic;
                    font-size: 11px;
                }
            </style>
            
            <div class="tilia-header" id="tilia-widget-header" title="Klik om open/dicht te klappen">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span>⚡ Teller</span>
                    <span id="tilia-header-date" style="font-size:10px; font-weight:normal; opacity:0.9;"></span>
                </div>
                <button class="tilia-minimize-btn" id="tilia-btn-minimize" title="Minimaliseren">${isMinimized ? '+' : '−'}</button>
            </div>
            
            <div class="tilia-content" id="tilia-widget-content">
                <div class="tilia-section-title">Huidige Totalen</div>
                <div class="tilia-total-list" id="tilia-totals-render">
                    <!-- Totals injected here via JS -->
                </div>

                <div class="tilia-section-title">Acties</div>
                <div class="tilia-tabs-container" style="padding-bottom:10px;">
                     <button class="tilia-btn" id="tilia-btn-auto-page" style="background:#0f172a; justify-content:center; text-align:center;">
                         🔍 Tel pagina (F9)
                     </button>
                     <button class="tilia-btn" id="tilia-btn-reset" style="background:rgba(220, 38, 38, 0.2); color:#fca5a5; border-color:rgba(220,38,38,0.4); justify-content:center; text-align:center;">
                         Reset Vandaag
                     </button>
                </div>
            </div>
        `;

        document.body.appendChild(widget);
        
        // Minimize toggle
        const toggleMinimize = () => {
            const isMin = widget.classList.toggle('minimized');
            document.getElementById('tilia-btn-minimize').innerText = isMin ? '+' : '−';
            GM_setValue("tiliaWidgetMinimized", isMin);
        };
        document.getElementById('tilia-widget-header').addEventListener('click', toggleMinimize);

        // Binds
        document.getElementById('tilia-btn-auto-page').onclick = (e) => { e.stopPropagation(); countReturnedItemsToday(); };
        document.getElementById('tilia-btn-reset').onclick = (e) => { e.stopPropagation(); resetSessionTotals(); };
        
        // Initial load
        updateWidgetTotals(getTodayDateStr());
    }

    function updateWidgetTotals(dateStr) {
        if(!dateStr) dateStr = getTodayDateStr();
        const renderEl = document.getElementById('tilia-totals-render');
        const headerDate = document.getElementById('tilia-header-date');
        if (!renderEl) return;
        
        if (headerDate) headerDate.innerText = dateStr;

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
            
            const leftDiv = document.createElement('div');
            leftDiv.className = 'tilia-total-left';

            const minusBtn = document.createElement('button');
            minusBtn.className = 'tilia-btn-min-small';
            minusBtn.innerText = '−';
            minusBtn.title = 'Min 1 verwijderen';
            minusBtn.onclick = (e) => { e.stopPropagation(); manualCountRemove(type); };

            const nameSpan = document.createElement('span');
            nameSpan.innerText = type;

            leftDiv.appendChild(minusBtn);
            leftDiv.appendChild(nameSpan);
            
            const countSpan = document.createElement('span');
            countSpan.className = 'tilia-total-count';
            countSpan.innerText = count;
            
            itemDiv.appendChild(leftDiv);
            itemDiv.appendChild(countSpan);
            renderEl.appendChild(itemDiv);
        });
        
        // Add Grand Total
        const grandTotalDiv = document.createElement('div');
        grandTotalDiv.className = 'tilia-total-item';
        grandTotalDiv.style.marginTop = '4px';
        grandTotalDiv.style.borderTop = '1px solid rgba(255,255,255,0.2)';
        grandTotalDiv.style.paddingTop = '6px';
        grandTotalDiv.style.color = '#60a5fa';
        grandTotalDiv.innerHTML = `<span><b>Eindtotaal</b></span><span class="tilia-total-count" style="background:#3b82f6; color:white;">${totalSum}</span>`;
        renderEl.appendChild(grandTotalDiv);
    }

    // --- Init ---
    document.addEventListener('keydown', function(event) {
        if (event.key === 'F9') {
            event.preventDefault();
            countReturnedItemsToday();
        }
    });

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = function () { originalPushState.apply(this, arguments); setTimeout(evaluateWidgetVisibility, 100); };
    history.replaceState = function () { originalReplaceState.apply(this, arguments); setTimeout(evaluateWidgetVisibility, 100); };
    window.addEventListener('popstate', () => setTimeout(evaluateWidgetVisibility, 100));
    
    // Run on first load
    evaluateWidgetVisibility();

})();
