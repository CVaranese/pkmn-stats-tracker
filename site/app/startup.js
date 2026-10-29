/* Runs last, when every file above is loaded: restores what the browser remembered, wires the controls, opens
   the tab or games in the address (?tab=, ?r=, ?t=) and starts loading the game library. */
"use strict";

RS.setLocalOnly(LOCAL);
// a league without its own theme: the viewer's palette (style.css; the page's first script already applied the saved one)
if ($("palette")) {
  const buttons = [...$("palette").querySelectorAll("button")];
  const mark = (p) => {
    const known = buttons.some((b) => b.dataset.palette === p) ? p : LEAGUE.palette;
    for (const b of buttons) b.setAttribute("aria-pressed", String(b.dataset.palette === known));
  };
  mark(document.documentElement.dataset.palette);
  for (const b of buttons) b.addEventListener("click", () => {
    document.documentElement.dataset.palette = b.dataset.palette;
    mark(b.dataset.palette);
    try { localStorage.setItem(KEYS + "palette", b.dataset.palette); } catch (e) { /* storage blocked */ }
  });
}
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
const tabName = League.tabName;
try { mode = [...NO_INPUT_TABS].includes(tabName(localStorage.getItem(MODE_KEY))) ? tabName(localStorage.getItem(MODE_KEY)) : "one"; } catch (e) { /* storage blocked */ }
try { $("one-link").value = localStorage.getItem(ONE_KEY) || ""; } catch (e) { /* storage blocked */ }
$("one-link").addEventListener("input", () => {
  try { localStorage.setItem(ONE_KEY, $("one-link").value); } catch (e) { /* storage blocked */ }
});
$("one-link").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
for (const tab of document.querySelectorAll(".modes [data-mode]")) tab.addEventListener("click", () => { setMode(tab.dataset.mode); pushNav(); });
window.addEventListener("popstate", (e) => {
  const st = e.state;
  if (!st || !st.mode) return;
  if (st.set) { openSet(st.set.split(","), false); return; }
  if (st.r) { $("one-link").value = linkFor(st.r); $("one-link").dispatchEvent(new Event("input")); }
  if (st.mode !== mode || st.r) setMode(st.mode);
  if (st.pick && st.mode === "players") wantPlayer(st.pick);
  if (st.pick && st.mode === "mons") wantMon(st.pick);
  if (st.pick && st.mode === "draft") { draftPicked = st.pick; showDraft(); }
  const g = st.watch && library.find((x) => x.id === st.watch);
  if (g) watchHere(g, false); else closeWatch();
});
// "no-cache" (as the draft and records): a new game shows without waiting out the 10-minute browser cache
const libraryReady = fetch(DIR + "games/index.json", { cache: "no-cache" })
  .then((r) => (r.ok ? r.json() : { games: [] }))
  .catch(() => ({ games: [] }))
  .then((index) => {
    // by date (the order added when the same): games added late, e.g. rebuilt from stream videos, sit in their week
    library = (index.games || []).sort((a, b) => (a.date || "").localeCompare(b.date || ""));
    missing = index.missing || [];
    RS.setLibrary(library.map((g) => g.id), DIR + "games/");
    // Showdown names ignore case and spaces ("Nezergy" = "nezergy"): one entry per name, as first spelled
    const players = new Map();
    for (const p of library.flatMap((g) => g.players)) if (!players.has(TS.toID(p))) players.set(TS.toID(p), p);
    const weeks = [...new Set(library.map((g) => g.week))];
    $("lib-player").append(...[...players].sort((a, b) => a[1].localeCompare(b[1])).map(([id, p]) => new Option(p, id)));
    fillStagePicks();
    fillWeekOptions($("lib-week"));
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
if (new URLSearchParams(location.search).has("results")) showResults = true;   // ?results: a link that opens with results shown
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
// the league's Challonge brackets (site/leagues.json, newest first: playoffs, then the Swiss rounds), one sub-tab
// each; they show results, so one loads only when the box is opened. No brackets: no box.
const brackets = LEAGUE.brackets || [];
let bracketPicked = brackets[0];
function showBracket() {
  for (const b of $("bracket-views").children) b.setAttribute("aria-current", String(b.dataset.slug === bracketPicked.slug));
  $("bracket-link").href = "https://challonge.com/" + bracketPicked.slug;
  if (!$("bracket").open) return;
  const src = "https://challonge.com/" + bracketPicked.slug + "/module";
  if ($("bracket-frame").src !== src) $("bracket-frame").src = src;
  $("bracket-frame").hidden = false;
}
$("bracket").hidden = !brackets.length;
$("bracket-views").hidden = brackets.length < 2;
for (const b of brackets) {
  const btn = Object.assign(el("button", "", b.name), { type: "button" });
  btn.dataset.slug = b.slug;
  btn.addEventListener("click", () => { bracketPicked = b; showBracket(); });
  $("bracket-views").append(btn);
}
if (brackets.length) showBracket();
$("bracket").addEventListener("toggle", () => { if (brackets.length) showBracket(); });
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
tableExport($("pl-copy"), $("pl-download"), $("pl-table"), "players.csv");
tableExport($("mon-copy"), $("mon-download"), $("mon-table"), "pokemon.csv");
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
// one replay in the link opens Main viewer, more open them added up ("many", no tab marked)
const nav = League.readNav(location.search);
const shared = RS.replayIdsFromText(nav.r);
if (shared.length === 1) $("one-link").value = linkFor(shared[0]);
else if (shared.length) $("links").value = shared.map(linkFor).join("\n");
if (shared.length) activeInput().dispatchEvent(new Event("input"));
// ?tab=games (or many / bet) opens that tab, e.g. a link to the game list
const tabParam = nav.tab;
if (["one", ...NO_INPUT_TABS].includes(tabParam) && !shared.length) mode = tabParam;
setMode(shared.length ? (shared.length === 1 ? "one" : "many") : mode, shared.length > 0);
// ?tab=players&player=<key> / ?tab=mons&mon=<name>: that player or Pokémon picked (links from the game viewer)
if (mode === "players" && nav.player) wantPlayer(nav.player);
if (mode === "mons" && nav.mon) wantMon(nav.mon);
// ?tab=draft&player=<key>: that player's draft
if (mode === "draft" && nav.player) { draftPicked = nav.player; showDraft(); }
try { history.replaceState(navState(), ""); } catch (e) { /* sandboxed frame: no history */ }
// ?set=id1,id2: a set opened with Set stats (naming it needs the league's games)
const setParam = RS.replayIdsFromText(nav.set);
if (setParam.length && !shared.length) libraryReady.then(() => { openSet(setParam, false); replaceNav(); });
