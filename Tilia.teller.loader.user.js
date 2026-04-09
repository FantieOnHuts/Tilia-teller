// ==UserScript==
// @name         Tilia Teller [Loader]
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Laders de nieuwste versie van Tilia Teller vanaf GitHub.
// @author       FantieOnHuts
// @match        https://partner.tilia.app/*
// @grant        GM_setValue
// @grant        GM_getValue
// @run-at       document-end
// @require      https://raw.githubusercontent.com/FantieOnHuts/Tilia-teller/main/Tilia%20teller.user.js
// @updateURL    https://raw.githubusercontent.com/FantieOnHuts/Tilia-teller/main/Tilia.teller.loader.user.js
// @downloadURL  https://raw.githubusercontent.com/FantieOnHuts/Tilia-teller/main/Tilia.teller.loader.user.js
// ==/UserScript==

// Dit script zelf is een loader. Alle logica zit in het @require bestand hierboven.
// Zodra je dit installeert, haalt Tampermonkey de code van GitHub en voert deze uit.
// Voordeel: Mensen hoeven maar één keer dit kleine script te installeren.
