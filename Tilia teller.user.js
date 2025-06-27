// ==UserScript==
// @name         Tilia Teller
// @namespace    http://tampermonkey.net/
// @version      5.1
// @description  Blijft kijken ook op subpagina
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

    function countReturnedItems() {
        let lastUsedGlobalDate = GM_getValue("tiliaLastReturnDateGlobal", "DD-MM-YYYY");
        const targetDateStr = prompt("Voer de retourdatum in (DD-MM-YYYY):", lastUsedGlobalDate);
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
        displayResults(currentCategoryCounts, sessionCounts, targetDateStr, rows.length === 0);
    }

    function resetSessionTotals() {
        let lastUsedGlobalDate = GM_getValue("tiliaLastReturnDateGlobal", "DD-MM-YYYY");
        const dateToReset = prompt("Reset totalen voor datum (DD-MM-YYYY):", lastUsedGlobalDate);
        if (!dateToReset || !/^\d{2}-\d{2}-\d{4}$/.test(dateToReset)) return;
        GM_setValue(`tiliaSessionTotals_${dateToReset.replace(/-/g, "")}`, {});
        GM_setValue("tiliaLastReturnDateGlobal", dateToReset);
        alert(`Totalen voor ${dateToReset} zijn gereset.`);
    }

    function displayResults(current, total, date, noRows) {
        let msg = `--- Resultaten voor ${date} ---\n\nDeze categorie:\n`;
        if (Object.keys(current).length > 0) {
            for (const type in current) msg += `- Type ${type}: ${current[type]} item(s)\n`;
        } else {
            msg += noRows ? `  Geen items gevonden in tabel.\n` : `  Geen items met deze retourdatum gevonden.\n`;
        }
        msg += `\nCumulatief Totaal (voor ${date}):\n`;
        if (Object.keys(total).length > 0) {
            for (const type in total) msg += `- Type ${type}: ${total[type]} item(s)\n`;
        } else {
            msg += `  Nog geen items geteld.\n`;
        }
        alert(msg);
    }

    function setupMenusOnURLChange() {
        menuCommandIds.forEach(id => GM_unregisterMenuCommand(id));
        menuCommandIds = [];
        if (window.location.pathname.includes("/dashboard")) {
            console.log("Tilia Watcher: Dashboard gedetecteerd. Menu-items worden AANGEMAAKT.");
            menuCommandIds.push(GM_registerMenuCommand('Tel Tilia Retour Items', countReturnedItems, 't'));
            menuCommandIds.push(GM_registerMenuCommand('Reset Totaal voor Datum', resetSessionTotals, 'r'));
        } else {
            console.log("Tilia Watcher: NIET op dashboard. Menu-items worden NIET aangemaakt.");
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

    window.addEventListener('popstate', () => {
        setTimeout(setupMenusOnURLChange, 100);
    });

    setupMenusOnURLChange();

})();
