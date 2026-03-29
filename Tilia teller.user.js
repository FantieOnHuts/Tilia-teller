// ==UserScript==
// @name         Tilia Teller
// @namespace    http://tampermonkey.net/
// @version      7.7
// @description  Verbeterde versie: F9 toggle menu, overal actief, knoppen gerepareerd.
// @author       Troy Axel Groot (met aanpassing)
// @match        https://partner.tilia.app/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// ==/UserScript==

(function () {
    'use strict';

    let isBusyCounting = false;

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

    // --- Core Logic ---
    function findAccordions() {
        // Robuuste zoektocht naar alles wat de summary van een uitklapbalk kan zijn
        return Array.from(document.querySelectorAll('[class*="MuiAccordionSummary-root"], div[role="button"]'))
            .filter(s => s.textContent.includes('/') || s.querySelector('svg'));
    }

    async function waitForTableData(root) {
        for (let i = 0; i < 30; i++) {
            const table = root.querySelector('table');
            if (table) {
                const rows = table.querySelectorAll('tbody tr');
                if (rows.length > 0) {
                    const txt = rows[0].textContent.toLowerCase();
                    if (!txt.includes('laden') && !txt.includes('bezig')) return true;
                }
            }
            await sleep(200);
        }
        return false;
    }

    async function countAllRelevant() {
        if (isBusyCounting) return;
        isBusyCounting = true;
        const summaries = findAccordions();
        const dateStr = getTodayDateStr();
        const key = `tiliaSessionTotals_${dateStr.replace(/-/g, "")}`;
        let counts = GM_getValue(key, {});
        const btn = document.getElementById('t-auto');

        try {
            for (let i = 0; i < summaries.length; i++) {
                const s = summaries[i];
                if (btn) btn.innerText = `⏳ Tellen... (${i+1}/${summaries.length})`;
                
                s.scrollIntoView({ behavior: 'smooth', block: 'center' });
                await sleep(400);

                const isExpanded = s.getAttribute('aria-expanded') === 'true' || s.classList.contains('Mui-expanded');
                if (!isExpanded) {
                    s.click();
                    await waitForTableData(s.closest('[class*="MuiAccordion-root"]') || s.parentElement.parentElement);
                }

                const table = (s.closest('[class*="MuiAccordion-root"]') || s.parentElement.parentElement).querySelector('table');
                if (table) {
                    table.querySelectorAll('tbody tr').forEach(row => {
                        const cells = row.querySelectorAll('td');
                        if (cells.length < 3) return;
                        if (cells[1].textContent.toLowerCase().includes('verhuurd') && 
                            cells[2].textContent.split(' - ')[1]?.trim() === dateStr) {
                            const prefix = (cells[0].textContent.trim().match(/^[A-Za-z]+/) || ["ONBEKEND"])[0].toUpperCase();
                            counts[prefix] = (counts[prefix] || 0) + 1;
                        }
                    });
                }
                GM_setValue(key, counts);
                updateList();
                await sleep(500);
            }
        } finally {
            isBusyCounting = false;
            if (btn) btn.innerText = "🚀 Tel ALLE Tabellen";
        }
    }

    function removeOne(type) {
        const dateStr = getTodayDateStr();
        const key = `tiliaSessionTotals_${dateStr.replace(/-/g, "")}`;
        let counts = GM_getValue(key, {});
        if (counts[type] && counts[type] > 0) {
            counts[type]--;
            if (counts[type] === 0) delete counts[type];
            GM_setValue(key, counts);
            updateList();
        }
    }

    // --- UI UI UI ---
    function injectWidget() {
        if (document.getElementById('t-widget')) return;

        const widget = document.createElement('div');
        widget.id = 't-widget';
        // Standaard ONZICHTBAAR zoals gevraagd
        widget.style.display = 'none';

        widget.innerHTML = `
            <style>
                #t-widget {
                    position: fixed; top: 60px; right: 20px; width: 230px;
                    background: #0f172a; color: white; border-radius: 12px;
                    z-index: 999999; border: 1px solid #334155;
                    font-family: inherit; box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                    display: flex; flex-direction: column; overflow: hidden;
                }
                .t-h { background: linear-gradient(135deg, #3b82f6, #1d4ed8); padding: 10px; font-weight: bold; font-size: 14px; display: flex; justify-content: space-between; align-items: center; }
                .t-b { padding: 12px; display: flex; flex-direction: column; gap: 8px; }
                .t-r { display: flex; justify-content: space-between; font-size: 12px; align-items: center; padding: 4px 0; border-bottom: 1px solid #1e293b; }
                .t-cnt { background: #10b981; padding: 2px 6px; border-radius: 10px; font-weight: bold; font-size: 11px; }
                .t-btn { background: #3b82f6; border: none; color: white; padding: 8px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 12px; transition: 0.2s; }
                .t-btn:hover { background: #2563eb; }
                .t-btn-s { background: #475569; border: none; color: white; padding: 6px; border-radius: 4px; cursor: pointer; font-size: 11px; margin-top: 5px; }
                .t-del { background: none; border: none; color: #ef4444; cursor: pointer; font-size: 16px; padding: 0 8px; font-weight: bold; }
                .t-del:hover { color: #f87171; }
            </style>
            <div class="t-h">
                <span>⚡ Tilia Teller</span>
                <span style="font-size:11px; font-weight:normal; opacity:0.8;">[F9 Toggle]</span>
            </div>
            <div class="t-b">
                <div id="t-list-inner" style="max-height: 250px; overflow-y: auto;"></div>
                <button class="t-btn" id="t-auto">🚀 Tel ALLE Tabellen</button>
                <button class="t-btn-s" id="t-reset-btn">Reset Alles</button>
            </div>
        `;
        document.body.appendChild(widget);

        // Bindings (met addEventListener ipv onclick voor extra robusheid)
        document.getElementById('t-auto').addEventListener('click', countAllRelevant);
        document.getElementById('t-reset-btn').addEventListener('click', () => {
            if(confirm("Telling van vandaag resetten?")) {
                GM_setValue(`tiliaSessionTotals_${getTodayDateStr().replace(/-/g, "")}`, {});
                updateList();
            }
        });

        // Event delegation voor de Min-knopjes (X) - dit werkt altijd!
        document.getElementById('t-list-inner').addEventListener('click', (e) => {
            if (e.target.classList.contains('t-del')) {
                const type = e.target.getAttribute('data-type');
                removeOne(type);
            }
        });

        updateList();
    }

    function updateList() {
        const list = document.getElementById('t-list-inner');
        if (!list) return;
        const dateStr = getTodayDateStr();
        const counts = GM_getValue(`tiliaSessionTotals_${dateStr.replace(/-/g, "")}`, {});
        const keys = Object.keys(counts).sort();
        
        list.innerHTML = '';
        let total = 0;
        
        if (keys.length === 0) {
            list.innerHTML = '<div style="text-align:center; color:#64748b; font-style:italic; font-size:12px; padding:10px;">Druk op F9 en start met tellen.</div>';
            return;
        }

        keys.forEach(k => {
            total += counts[k];
            const div = document.createElement('div');
            div.className = 't-r';
            div.innerHTML = `
                <div style="display:flex; align-items:center;">
                   <button class="t-del" data-type="${k}">×</button>
                   <span>${k}</span>
                </div>
                <span class="t-cnt">${counts[k]}</span>
            `;
            list.appendChild(div);
        });

        const sumDiv = document.createElement('div');
        sumDiv.className = 't-r';
        sumDiv.style.border = 'none';
        sumDiv.style.marginTop = '8px';
        sumDiv.innerHTML = `<b>Totaal</b> <span class="t-cnt" style="background:#3b82f6;">${total}</span>`;
        list.appendChild(sumDiv);
    }

    function injectTabButtons() {
        findAccordions().forEach(s => {
            let area = s.querySelector('[class*="MuiAccordionSummary-content"]') || s;
            if (area && !area.querySelector('.t-idx')) {
                const btn = document.createElement('button');
                btn.className = 't-idx';
                btn.innerText = 'TEL DEZE';
                btn.style.cssText = "margin-left: 10px; padding: 2px 5px; background: #3b82f6; color: white; border: none; border-radius: 4px; font-size: 9px; cursor: pointer;";
                btn.onclick = (e) => {
                    e.stopPropagation();
                    // Custom single count logic
                    countSingle(s);
                };
                area.appendChild(btn);
            }
        });
    }

    async function countSingle(summary) {
        if (isBusyCounting) return;
        const dateStr = getTodayDateStr();
        const root = summary.closest('[class*="MuiAccordion-root"]') || summary.parentElement.parentElement;
        const key = `tiliaSessionTotals_${dateStr.replace(/-/g, "")}`;
        let counts = GM_getValue(key, {});

        const isExpanded = summary.getAttribute('aria-expanded') === 'true' || summary.classList.contains('Mui-expanded');
        if (!isExpanded) {
            summary.click();
            await waitForTableData(root);
        }

        const table = root.querySelector('table');
        if (table) {
            table.querySelectorAll('tbody tr').forEach(row => {
                const cells = row.querySelectorAll('td');
                if (cells.length < 3) return;
                if (cells[1].textContent.toLowerCase().includes('verhuurd') && 
                    cells[2].textContent.split(' - ')[1]?.trim() === dateStr) {
                    const prefix = (cells[0].textContent.trim().match(/^[A-Za-z]+/) || ["ONBEKEND"])[0].toUpperCase();
                    counts[prefix] = (counts[prefix] || 0) + 1;
                }
            });
            GM_setValue(key, counts);
            updateList();
        }
    }

    // --- Events & Setup ---
    document.addEventListener('keydown', (e) => {
        if (e.key === 'F9') {
            e.preventDefault();
            const w = document.getElementById('t-widget');
            if (w) {
                const isHidden = w.style.display === 'none';
                w.style.display = isHidden ? 'flex' : 'none';
            }
        }
    });

    // Check overal (restriction weg)
    setInterval(() => {
        injectWidget();
        injectTabButtons();
    }, 2000);

})();
