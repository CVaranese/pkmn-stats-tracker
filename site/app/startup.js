/* Runs last, when every file above is loaded: restores what the browser remembered, wires the controls, opens
   the tab or games in the address (?tab=, ?r=, ?t=) and starts loading the game library. */
"use strict";

RS.setLocalOnly(LOCAL);
// remember pasted links between visits (convenience only; the page works without it)
try { $("links").value = localStorage.getItem(STORAGE_KEY) || ""; } catch (e) { /* storage blocked */ }
$("links").addEventListener("input", () => {
  try { localStorage.setItem(STORAGE_KEY, $("links").value); } catch (e) { /* storage blocked */ }
});
try { savedSheets = JSON.parse(localStorage.getItem(SHEETS_KEY) || "[]"); } catch (e) { /* storage blocked */ }
for (const text of savedSheets) addSheetBox(text);
$("add-sheet").addEventListener("click", () => addSheetBox("").querySelector("textarea").focus());
$("run").addEventListener("click", run);
// "bet": the Fantasy tab's old name (saved tab, old ?tab=bet links)
const tabName = (t) => (t === "bet" ? "fantasy" : t);
try { mode = ["many", ...NO_INPUT_TABS].includes(tabName(localStorage.getItem(MODE_KEY))) ? tabName(localStorage.getItem(MODE_KEY)) : "one"; } catch (e) { /* storage blocked */ }
try { $("one-link").value = localStorage.getItem(ONE_KEY) || ""; } catch (e) { /* storage blocked */ }
$("one-link").addEventListener("input", () => {
  try { localStorage.setItem(ONE_KEY, $("one-link").value); } catch (e) { /* storage blocked */ }
});
$("one-link").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
for (const tab of document.querySelectorAll(".modes [data-mode]")) tab.addEventListener("click", () => { setMode(tab.dataset.mode); pushNav(); });
window.addEventListener("popstate", (e) => {
  const st = e.state;
  if (!st || !st.mode) return;
  if (st.r) { $("one-link").value = linkFor(st.r); $("one-link").dispatchEvent(new Event("input")); }
  if (st.mode !== mode || st.r) setMode(st.mode);
  if (st.pick && st.mode === "players") wantPlayer(st.pick);
  if (st.pick && st.mode === "mons") wantMon(st.pick);
  if (st.pick && st.mode === "draft") { draftPicked = st.pick; showDraft(); }
  const g = st.watch && library.find((x) => x.id === st.watch);
  if (g) watchHere(g, false); else closeWatch();
});
const libraryReady = fetch("games/index.json")
  .then((r) => (r.ok ? r.json() : { games: [] }))
  .catch(() => ({ games: [] }))
  .then((index) => {
    // by date (the order added when the same): games added late, e.g. rebuilt from stream videos, sit in their week
    library = (index.games || []).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    RS.setLibrary(library.map((g) => g.id));
    // Showdown names ignore case and spaces ("Nezergy" = "nezergy"): one entry per name, as first spelled
    const players = new Map();
    for (const p of library.flatMap((g) => g.players)) if (!players.has(TS.toID(p))) players.set(TS.toID(p), p);
    const weeks = [...new Set(library.map((g) => g.week))];
    $("lib-player").append(...[...players].sort((a, b) => a[1].localeCompare(b[1])).map(([id, p]) => new Option(p, id)));
    $("lib-week").append(...weeks.map((w) => new Option(w, w)));
    renderLibrary();
    // Main viewer's game list: latest week first, players only (no winner, like Games)
    $("one-game").append(...[...weeks].reverse().map((w) => {
      const group = Object.assign(document.createElement("optgroup"), { label: w });
      group.append(...library.filter((g) => g.week === w).reverse().map((g) => new Option(g.players.join(" vs "), g.id)));
      return group;
    }));
    syncGamePick();
  });
$("one-link").addEventListener("input", syncGamePick);
$("one-game").addEventListener("change", () => {
  if (!$("one-game").value) return;
  $("one-link").value = linkFor($("one-game").value);
  $("one-link").dispatchEvent(new Event("input"));
  run();
});
// Pokémon tab search: matches show as you type, Enter opens the first
$("mon-find").addEventListener("input", () => { if (mons) filterMons(); });
$("mon-find").addEventListener("keydown", (e) => {
  const first = $("mon-matches").querySelector("button");
  if (e.key === "Enter" && first) first.click();
});
$("lib-player").addEventListener("change", renderLibrary);
$("lib-week").addEventListener("change", renderLibrary);
try { showResults = localStorage.getItem(SPOILERS_KEY) === "1"; } catch (e) { /* storage blocked */ }
setShowResults(showResults);
$("lib-spoilers").addEventListener("click", () => {
  setShowResults(!showResults);
  try { localStorage.setItem(SPOILERS_KEY, showResults ? "1" : "0"); } catch (e) { /* storage blocked */ }
  renderLibrary();
});
// Close = Back when Watch added the history entry, so Back afterwards doesn't reopen it
$("lib-watch-close").addEventListener("click", () => {
  if (history.state && history.state.watch) history.back(); else closeWatch();
});
// the Challonge bracket: shows results, so it loads only when opened
$("bracket").addEventListener("toggle", () => {
  if (!$("bracket").open) return;
  if (!$("bracket-frame").src) $("bracket-frame").src = "https://challonge.com/peepeepeepeepiss/module";
  $("bracket-frame").hidden = false;
});
$("watch").addEventListener("toggle", () => {
  if (!$("watch").open || !watchId) return;
  if (LOCAL && !isVideo(watchId)) {
    $("watch-note").hidden = false;
    $("watch-note").textContent = "The replay player comes from Pokémon Showdown, so it isn't in the local version. Add ?online to the address to use it.";
    return;
  }
  $("watch-frame").allowFullscreen = true;
  if (!$("watch-frame").src) $("watch-frame").src = watchSrc(watchId);
  $("watch-frame").hidden = false;
});
$("collapse").addEventListener("click", () => setCollapsed($("collapse").getAttribute("aria-expanded") === "true"));
$("clear").addEventListener("click", () => {
  cancelRun();
  activeInput().value = "";
  activeInput().dispatchEvent(new Event("input"));
  rows = [];
  $("results").hidden = true;
  $("errors").hidden = true;
  $("warnings").hidden = true;
  $("status").textContent = "";
});
for (const tab of document.querySelectorAll("#results .tabs button")) {
  tab.addEventListener("click", () => {
    view = tab.dataset.view;
    sort = view === "summary" ? { field: "kills", dir: -1 } : { field: "", dir: 1 };  // Per game: the games' own order
    render();
  });
}
$("group").addEventListener("change", render);
$("player").addEventListener("change", render);
$("copy").addEventListener("click", copyTable);
$("download").addEventListener("click", downloadCsv);
$("share").addEventListener("click", copyShareLink);
try { detailed = localStorage.getItem(DETAIL_KEY) === "1"; } catch (e) { /* storage blocked */ }
if (TOUCH) {
  document.addEventListener("click", (e) => {
    const t = e.target.closest("[title]");
    if (t && t.matches("#table th, .sortable th")) return;  // its own handler decides: explain or sort
    // a game row opens the game
    if (!t || !t.title || t.matches(".lib-row")) { hideTip(); return; }
    showTip(t, t.title);
  }, true);  // capture: measure before the element's own click handler can re-render it
}
// ?r=id1,id2 opens with those replays filled in and loaded (shareable leaderboard link);
// &t=paste1,paste2 adds those Pokepaste team sheets
const params = new URLSearchParams(location.search);
const sharedPastes = (params.get("t") || "").split(",").map((t) => TS.pokepasteIdFrom(TS.PASTE_HOST + t.trim()))
  .filter((id) => id && !sheetInputs().some((s) => TS.pokepasteIdFrom(s) === id));
for (const id of sharedPastes) addSheetBox(TS.PASTE_HOST + id);
if (sharedPastes.length) { $("sheets-wrap").open = true; saveSheets(); }
// one replay in the link opens Main viewer, more open Playoffs
const shared = RS.replayIdsFromText(params.get("r") || "");
if (shared.length === 1) $("one-link").value = linkFor(shared[0]);
else if (shared.length) $("links").value = shared.map(linkFor).join("\n");
if (shared.length) activeInput().dispatchEvent(new Event("input"));
// ?tab=games (or many / bet) opens that tab, e.g. a link to the game list
const tabParam = tabName(params.get("tab"));
if (["one", "many", ...NO_INPUT_TABS].includes(tabParam) && !shared.length) mode = tabParam;
setMode(shared.length ? (shared.length === 1 ? "one" : "many") : mode, shared.length > 0);
// ?tab=players&player=<key> / ?tab=mons&mon=<name>: that player or Pokémon picked (links from the game viewer)
if (mode === "players" && params.get("player")) wantPlayer(params.get("player"));
if (mode === "mons" && params.get("mon")) wantMon(params.get("mon"));
// ?tab=draft&player=<key>: that player's draft
if (mode === "draft" && params.get("player")) { draftPicked = params.get("player"); showDraft(); }
try { history.replaceState(navState(), ""); } catch (e) { /* sandboxed frame: no history */ }
