// ==UserScript==
// @name         Tilia Retour Item Teller (met Totaal)
// @namespace    http://tampermonkey.net/
// @version      1.3
// @description  Telt items die op een specifieke datum terugkomen binnen de HUIDIG GEOPENDE categorie op Tilia en houdt een cumulatief totaal bij.
// @author       Jouw Naam (of laat leeg)
// @match        https://partner.tilia.app/23/fietsverhuurtexel/dashboard/voorraad*
// @grant        GM_registerMenuCommand
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-idle
// ==/UserScript==

(function() {
    'use strict';

    // Haal de laatst gebruikte datum op voor de prompt default
    let lastUsedGlobalDate = GM_getValue("tiliaLastReturnDateGlobal", "DD-MM-YYYY");

    // Functie om de items te tellen
    function countReturnedItems() {
        const targetDateStr = prompt("Voer de retourdatum in (DD-MM-YYYY):", lastUsedGlobalDate);

        if (!targetDateStr) { // Gebruiker heeft op Annuleren geklikt
            return;
        }

        if (!/^\d{2}-\d{2}-\d{4}$/.test(targetDateStr)) {
            alert("Ongeldig datumformaat. Gebruik DD-MM-YYYY. Script gestopt.");
            return;
        }

        // Sla de ingevoerde datum op als laatst gebruikte globale datum
        lastUsedGlobalDate = targetDateStr;
        GM_setValue("tiliaLastReturnDateGlobal", targetDateStr);

        // Key voor het opslaan van totalen voor DEZE specifieke datum
        const sessionTotalsKey = `tiliaSessionTotals_${targetDateStr.replace(/-/g, "")}`;
        let sessionCounts = GM_getValue(sessionTotalsKey, {}); // Object: { "TYPE1": count, "TYPE2": count }

        // --- SELECTEER DE DATA TABEL ---
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
            alert("Kon de producttabel niet vinden. Zorg ervoor dat een categorie geopend is en de tabel met items zichtbaar is.");
            return;
        }

        const rows = dataTable.querySelectorAll('tbody tr');
        if (rows.length === 0) {
            alert("Geen items (rijen) gevonden in de tabel van de geopende categorie.");
            // Update wel de totalen display als er al totalen waren voor deze datum
            displayResults({}, sessionCounts, targetDateStr, true);
            return;
        }

        const currentCategoryCounts = {}; // Tellingen voor de HUIDIGE categorie
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
                                currentCategoryCounts[itemType] = (currentCategoryCounts[itemType] || 0) + 1;
                            }
                        }
                    }
                }
            }
        });

        if (itemsFoundInTableAndProcessed === 0 && rows.length > 0) {
            alert("Wel rijen gevonden, maar geen data cellen die voldeden aan de criteria. Controleer de tabelstructuur.");
            // Update wel de totalen display als er al totalen waren voor deze datum
            displayResults({}, sessionCounts, targetDateStr, true);
            return;
        }

        // Update sessionCounts met currentCategoryCounts
        for (const type in currentCategoryCounts) {
            sessionCounts[type] = (sessionCounts[type] || 0) + currentCategoryCounts[type];
        }
        GM_setValue(sessionTotalsKey, sessionCounts); // Sla de bijgewerkte totalen op

        displayResults(currentCategoryCounts, sessionCounts, targetDateStr);
    }

    // Functie om resultaten te tonen
    function displayResults(currentCategoryCounts, sessionCounts, targetDateStr, isEmptyCategory = false) {
        let resultMessage = `--- Resultaten voor ${targetDateStr} ---\n\n`;
        resultMessage += `Deze categorie:\n`;
        if (isEmptyCategory && Object.keys(currentCategoryCounts).length === 0) {
            resultMessage += `  Geen items gevonden of verwerkt in deze categorie.\n`;
        } else if (Object.keys(currentCategoryCounts).length > 0) {
            for (const type in currentCategoryCounts) {
                resultMessage += `- Type ${type}: ${currentCategoryCounts[type]} item(s)\n`;
            }
        } else {
            resultMessage += `  Geen 'Verhuurd' items gevonden die op deze datum terugkomen in deze categorie.\n`;
        }

        resultMessage += `\nCumulatief Totaal (voor ${targetDateStr} over alle gescande categorieën):\n`;
        if (Object.keys(sessionCounts).length > 0) {
            for (const type in sessionCounts) {
                resultMessage += `- Type ${type}: ${sessionCounts[type]} item(s)\n`;
            }
        } else {
            resultMessage += `  Nog geen items geteld voor deze datum in deze sessie, of totalen zijn gereset.\n`;
        }
        alert(resultMessage);
    }

    // Nieuwe functie om cumulatieve totalen voor een specifieke datum te resetten
    function resetSessionTotals() {
        const dateToReset = prompt("Voor welke datum wilt u de cumulatieve totalen resetten? (DD-MM-YYYY)", lastUsedGlobalDate);
        if (!dateToReset) return; // Gebruiker geannuleerd

        if (!/^\d{2}-\d{2}-\d{4}$/.test(dateToReset)) {
            alert("Ongeldig datumformaat. Gebruik DD-MM-YYYY. Reset geannuleerd.");
            return;
        }

        const sessionTotalsKey = `tiliaSessionTotals_${dateToReset.replace(/-/g, "")}`;
        GM_setValue(sessionTotalsKey, {}); // Reset naar een leeg object
        // Update ook de laatst gebruikte globale datum als deze overeenkomt, zodat prompt schoon start
        if (lastUsedGlobalDate === dateToReset) {
            lastUsedGlobalDate = dateToReset; // Blijft gelijk, maar voor de duidelijkheid
        }
         // Of, als je wilt dat de prompt default naar "DD-MM-YYYY" gaat na een reset:
        // GM_setValue("tiliaLastReturnDateGlobal", "DD-MM-YYYY");
        // lastUsedGlobalDate = "DD-MM-YYYY";


        alert(`Cumulatieve totalen voor datum ${dateToReset} zijn gereset.`);
    }

    // Registreer menu commando's in Tampermonkey
    GM_registerMenuCommand('Tel Tilia Retour Items (met Totaal)', countReturnedItems, 't');
    GM_registerMenuCommand('Reset Cumulatief Totaal voor Datum', resetSessionTotals, 'r');

})();