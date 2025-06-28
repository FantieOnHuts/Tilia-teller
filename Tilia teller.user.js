// ==UserScript==
// @name         Tilia Teller
// @namespace    http://tampermonkey.net/
// @version      5.5
// @description  Telt totalen van items en geeft dat weer in simpel venster.
// @author       Troy Axel Groot
// @match        https://partner.tilia.app/*
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    let menuCommandIds = [];
    function showCustomAlert(title, content) {
        const existingModal = document.getElementById('tilia-teller-modal-container');
        if (existingModal) existingModal.remove();

        const modalHTML = `
            <div id="tilia-teller-overlay"></div><div id="tilia-teller-modal">
                <div id="tilia-teller-modal-header"><h2>${title}</h2></div>
                <div id="tilia-teller-modal-content"><pre>${content}</pre></div>
                <div id="tilia-teller-modal-footer"><button id="tilia-teller-close-btn">Sluiten</button></div>
            </div>`;
        const modalCSS = `
            #tilia-teller-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background-color: rgba(0,0,0,0.6); z-index: 9998; }
            #tilia-teller-modal { position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 90%; max-width: 500px; background-color: white; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 9999; display: flex; flex-direction: column; max-height: 80vh; }
            #tilia-teller-modal-header { padding: 16px; border-bottom: 1px solid #eee; }
            #tilia-teller-modal-header h2 { margin: 0; font-size: 1.2em; }
            #tilia-teller-modal-content { padding: 16px; overflow-y: auto; }
            #tilia-teller-modal-content pre { margin: 0; white-space: pre-wrap; word-wrap: break-word; font-family: monospace; font-size: 14px; }
            #tilia-teller-modal-footer { padding: 16px; border-top: 1px solid #eee; text-align: right; }
            #tilia-teller-close-btn { padding: 8px 16px; background-color: #007bff; color: white; border: none; border-radius: 5px; cursor: pointer; }
            #tilia-teller-close-btn:hover { background-color: #0056b3; }`;

        const container = document.createElement('div');
        container.id = 'tilia-teller-modal-container';
        container.innerHTML = `<style>${modalCSS}</style>${modalHTML}`;
        document.body.appendChild(container);

        const closeModal = () => container.remove();
        document.getElementById('tilia-teller-close-btn').onclick = closeModal;
        document.getElementById('tilia-teller-overlay').onclick = closeModal;
    }

    function countReturnedItems() {
        let lastUsedGlobalDate = GM_getValue("tiliaLastReturnDateGlobal", "DD-MM-YYYY");
        const targetDateStr = prompt("Voer de retourdatum in (DD-MM-YYYY):", lastUsedGlobalDate);
        if (!targetDateStr || !/^\d{2}-\d{2}-\d{4}$/.test(targetDateStr)) return;

        GM_setValue("tiliaLastReturnDateGlobal", targetDateStr);
        const sessionTotalsKey = `tiliaSessionTotals_${targetDateStr.replace(/-/g, "")}`;
        let sessionCounts = GM_getValue(sessionTotalsKey, {});

        const dataTable = document.querySelector('table');
        if (!dataTable) {
            showCustomAlert("Fout", "Kon geen tabel vinden op deze pagina.");
            return;
        }

        const rows = dataTable.querySelectorAll('tbody tr');
        const currentCategoryCounts = {};
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length < 3) return;
            const statusText = (cells[1]?.textContent || '').trim().toLowerCase();
            const dateRangeText = (cells[2]?.textContent || '').trim();
            if (statusText === 'verhuurd' && dateRangeText.split(' - ')[1]?.trim() === targetDateStr) {
                const itemIdText = (cells[0]?.textContent || '').trim();
                const match = itemIdText.match(/^[A-Za-z]+/);
                const itemType = (match && match[0]) ? match[0].toUpperCase() : "ONBEKEND";
                currentCategoryCounts[itemType] = (currentCategoryCounts[itemType] || 0) + 1;
            }
        });

        for (const type in currentCategoryCounts) {
            sessionCounts[type] = (sessionCounts[type] || 0) + currentCategoryCounts[type];
        }
        GM_setValue(sessionTotalsKey, sessionCounts);
        displayCountResults(currentCategoryCounts, sessionCounts, targetDateStr, rows.length === 0);
    }

    function bekijkHuidigeTotalen() {
        let lastUsedGlobalDate = GM_getValue("tiliaLastReturnDateGlobal", "DD-MM-YYYY");
        const targetDateStr = prompt("Bekijk totalen voor datum (DD-MM-YYYY):", lastUsedGlobalDate);
        if (!targetDateStr || !/^\d{2}-\d{2}-\d{4}$/.test(targetDateStr)) return;

        GM_setValue("tiliaLastReturnDateGlobal", targetDateStr);
        const sessionTotalsKey = `tiliaSessionTotals_${targetDateStr.replace(/-/g, "")}`;
        const sessionCounts = GM_getValue(sessionTotalsKey, {});

        displayOnlyTotals(sessionCounts, targetDateStr);
    }


    function resetSessionTotals() {
        let lastUsedGlobalDate = GM_getValue("tiliaLastReturnDateGlobal", "DD-MM-YYYY");
        const dateToReset = prompt("Reset totalen voor datum (DD-MM-YYYY):", lastUsedGlobalDate);
        if (!dateToReset || !/^\d{2}-\d{2}-\d{4}$/.test(dateToReset)) return;
        GM_setValue(`tiliaSessionTotals_${dateToReset.replace(/-/g, "")}`, {});
        GM_setValue("tiliaLastReturnDateGlobal", dateToReset);
        showCustomAlert("Reset Voltooid", `Totalen voor ${dateToReset} zijn gereset.`);
    }


    function displayCountResults(current, total, date, noRows) {
        let content = "Deze categorie:\n--------------------\n";
        if (Object.keys(current).length > 0) {
            const grandTotalCurrent = Object.values(current).reduce((s, c) => s + c, 0);
            Object.keys(current).sort().forEach(type => {
                content += `- Type ${type}: ${current[type]} item(s)\n`;
            });
            content += `\n  Totaal deze pagina: ${grandTotalCurrent} item(s)\n`;
        } else {
            content += noRows ? `  Geen items gevonden in tabel.\n` : `  Geen items met deze retourdatum gevonden.\n`;
        }

        content += `\nCumulatief Totaal (voor ${date}):\n--------------------------------------\n`;
        if (Object.keys(total).length > 0) {
            const grandTotalSession = Object.values(total).reduce((s, c) => s + c, 0);
            Object.keys(total).sort().forEach(type => {
                content += `- Type ${type}: ${total[type]} item(s)\n`;
            });
            content += `\n  Cumulatief eindtotaal: ${grandTotalSession} item(s)\n`;
        } else {
            content += `  Nog geen items geteld.\n`;
        }
        showCustomAlert(`Resultaten voor ${date}`, content);
    }


    function displayOnlyTotals(total, date) {
        let content = `Cumulatief Totaal (voor ${date}):\n--------------------------------------\n`;
        if (Object.keys(total).length > 0) {
            const grandTotalSession = Object.values(total).reduce((s, c) => s + c, 0);
            Object.keys(total).sort().forEach(type => {
                content += `- Type ${type}: ${total[type]} item(s)\n`;
            });
            content += `\n  Cumulatief eindtotaal: ${grandTotalSession} item(s)\n`;
        } else {
            content += `  Nog geen items geteld voor deze datum.\n`;
        }
        showCustomAlert(`Huidige Totaalstand voor ${date}`, content);
    }


    function setupMenusOnURLChange() {
        menuCommandIds.forEach(id => GM_unregisterMenuCommand(id));
        menuCommandIds = [];
        if (window.location.pathname.includes("/dashboard")) {
            menuCommandIds.push(GM_registerMenuCommand('Tel Tilia Retour Items', countReturnedItems, 't'));
            menuCommandIds.push(GM_registerMenuCommand('Bekijk Huidige Totalen', bekijkHuidigeTotalen, 'b')); // NIEUW
            menuCommandIds.push(GM_registerMenuCommand('Reset Totaal voor Datum', resetSessionTotals, 'r'));
        }
    }

    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    history.pushState = function () {
        originalPushState.apply(this, arguments);
        setTimeout(setupMenusOnURLChange, 100);
    };
    history.replaceState = function () {
        originalReplaceState.apply(this, arguments);
        setTimeout(setupMenusOnURLChange, 100);
    };
    window.addEventListener('popstate', () => setTimeout(setupMenusOnURLChange, 100));
    setupMenusOnURLChange();

})();