// ==UserScript==
// @name         Tilia Retour Item Teller (Open Categorie)
// @namespace    http://tampermonkey.net/
// @version      1.2
// @description  Telt items die op een specifieke datum terugkomen binnen de HUIDIG GEOPENDE categorie op Tilia.
// @author       Jouw Naam (of laat leeg)
// @match        https://partner.tilia.app/23/fietsverhuurtexel/dashboard/voorraad*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    function countReturnedItems() {
        let defaultDate = GM_getValue("tiliaLastReturnDate", "DD-MM-YYYY");
        const targetDateStr = prompt("Voer de retourdatum in (DD-MM-YYYY):", defaultDate);

        if (!targetDateStr) {

            return;
        }

        if (!/^\d{2}-\d{2}-\d{4}$/.test(targetDateStr)) {
            alert("Ongeldig datumformaat. Gebruik DD-MM-YYYY. Script gestopt.");
            return;
        }

        GM_setValue("tiliaLastReturnDate", targetDateStr);


        let dataTable = null;
        const allTables = document.querySelectorAll('table');
        let headerNames = ["product code", "status", "verhuurperiode"]; 

        allTables.forEach(table => {
            const headerCells = table.querySelectorAll('th');
            if (headerCells.length >= 3) { 
                let foundHeaders = 0;
                headerCells.forEach(th => {
                    const thText = th.textContent.trim().toLowerCase();
                    if (headerNames.some(name => thText.includes(name))) {
                        foundHeaders++;
                    }
                });
                if (foundHeaders >= headerNames.length) {
                    dataTable = table;
                    return; 
                }
            }
        });


        if (!dataTable) {
            alert("Kon de producttabel niet vinden. Zorg ervoor dat een categorie geopend is en de tabel met items zichtbaar is. Als het probleem aanhoudt, moet de tabelselector in het script mogelijk worden aangepast.");
            return;
        }

        const rows = dataTable.querySelectorAll('tbody tr');
        if (rows.length === 0) {
            alert("Geen items (rijen) gevonden in de tabel van de geopende categorie.");
            return;
        }

        const counts = {};
        let itemsFoundInTableAndProcessed = 0;

        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) { 
                itemsFoundInTableAndProcessed++;
                const itemIdText = cells[0].textContent.trim();
                const statusText = cells[1].textContent.trim();
                const dateRangeText = cells[2].textContent.trim(); 

                if (statusText.toLowerCase() === 'verhuurd') {
                    if (dateRangeText.includes(' - ')) { 
                        const dateParts = dateRangeText.split(' - ');
                        if (dateParts.length === 2) {
                            const returnDateStr = dateParts[1].trim(); 

                            if (returnDateStr === targetDateStr) {
                                let itemType = "ONBEKEND";
                                const match = itemIdText.match(/^[A-Za-z]+/);
                                if (match && match[0]) {
                                    itemType = match[0].toUpperCase();
                                } else if (itemIdText.length > 0) {
                                    itemType = itemIdText.substring(0, Math.min(3, itemIdText.length)).toUpperCase();
                                }
                                counts[itemType] = (counts[itemType] || 0) + 1;
                            }
                        }
                    }
                }
            }
        });

        if (itemsFoundInTableAndProcessed === 0 && rows.length > 0) {
            alert("Wel rijen gevonden, maar geen data cellen die voldeden aan de criteria (minimaal 3 cellen). Controleer de structuur van de tabel.");
            return;
        }

        let resultMessage = `--- Resultaten voor ${targetDateStr} ---\n(in huidige geopende categorie)\n\n`;
        if (Object.keys(counts).length > 0) {
            for (const type in counts) {
                resultMessage += `Type ${type}: ${counts[type]} item(s)\n`;
            }
        } else {
            resultMessage += "Geen 'Verhuurd' items gevonden die op deze datum terugkomen in de huidige categorie.";
        }
        alert(resultMessage);
    }
    GM_registerMenuCommand('Tel Tilia Retour Items (Open Categorie)', countReturnedItems, 't');

})();