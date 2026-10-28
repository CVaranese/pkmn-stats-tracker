/* Games tab: the game library (site/games/, added with tools/add_game.py), spoiler-free list, Watch panel. */
"use strict";

let library = [];
/** The picker shows the game in the link box, or "Pick a game…" for a link that isn't a league game. */
function syncGamePick() {
  const id = RS.replayIdsFromText($("one-link").value)[0] || "";
  $("one-game").value = library.some((g) => g.id === id) ? id : "";
}
// spoiler-free by default: no winner, no turn count (a 3-turn game was a forfeit) until "Show results" is ticked
const SPOILERS_KEY = "replay-kill-tracker.show-results";
let showResults = false;
function setShowResults(on) {
  showResults = on;
  $("lib-spoilers").setAttribute("aria-pressed", String(on));
  $("lib-spoilers").textContent = on ? "Hide results" : "Show results";
}
/** Games grouped by week, the latest week first (weeks in the order they were added). */
function renderLibrary() {
  const player = $("lib-player").value, week = $("lib-week").value;
  const shown = library.filter((g) => (!player || g.players.some((p) => TS.toID(p) === player)) && (!week || g.week === week));
  $("lib-count").textContent = library.length ? `${shown.length} of ${library.length} games` : "";
  $("lib-empty").hidden = shown.length > 0;
  $("lib-empty").textContent = library.length ? "No games match." : "No games saved yet.";
  // one table, a heading row per week, so the columns line up across weeks
  const weeks = [...new Set(shown.map((g) => g.week))].reverse();
  const table = document.createElement("table");
  table.className = "lib-table";
  for (const w of weeks) {
    const head = document.createElement("tr");
    head.className = "lib-week";
    head.append(Object.assign(document.createElement("th"), { colSpan: 5, scope: "colgroup", textContent: w }));
    table.append(head, ...shown.filter((g) => g.week === w).reverse().map(libraryRow));
  }
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  wrap.append(table);
  $("lib-list").replaceChildren(...(shown.length ? [wrap] : []));
}
/** A library row: each player with their team-preview sprites; winner and turns only with "Show results". */
function libraryRow(g) {
  const results = showResults;
  const tr = document.createElement("tr");
  const cell = el("td", "lib-match");   // a plain table cell (a flex <td> drops out of the row: lines broke)
  const match = el("div", "lib-pair");
  cell.append(match);
  g.players.forEach((p, i) => {
    if (i) match.append(el("span", "lib-vs", "vs"));
    const side = el("div", "lib-side");
    const name = el("div", "lib-name", p);
    if (results && p === g.winner) name.append(" ", el("span", "badge win", "Won"));
    const team = el("div", "lib-team");
    team.append(...((g.teams || [])[i] || []).map((mon) => sprite(mon, ["gen5/"], "tiny", true)));
    side.append(name, team);
    match.append(side);
  });
  const open = (label, title, onClick) => {
    const b = Object.assign(el("button", "small", label), { type: "button", title });
    b.addEventListener("click", onClick);
    return b;
  };
  const actions = el("td", "lib-actions");
  actions.append(open("Watch", "Play the battle here, without the result", () => watchHere(g)),
    open("Stats", "Open in Main viewer (shows the result)", () => openGame(g.id)));
  // a short note keeps rows one height; the details (where the last KO came from...) go in its tooltip
  const note = el("td", "muted", g.note);
  if (g.note_detail) note.title = g.note_detail;
  tr.append(cell, el("td", "num", results ? g.turns + " turns" : ""), el("td", "", g.date), note, actions);
  // the whole row opens the game, like Stats (its own buttons keep their action)
  tr.className = "lib-row";
  tr.title = "Open in Main viewer (shows the result)";
  tr.addEventListener("click", (e) => { if (!e.target.closest("button")) openGame(g.id); });
  return tr;
}
/** The player for a game: Showdown's replay player, or the YouTube video for a game rebuilt from it. */
function watchSrc(id) {
  const g = library.find((x) => x.id === id);
  const yt = g && g.video && g.video.match(/(?:youtu\.be\/|[?&]v=)([\w-]{11})/);
  return yt ? "https://www.youtube-nocookie.com/embed/" + yt[1] : "watch.html?id=" + encodeURIComponent(id);
}
const isVideo = (id) => library.some((x) => x.id === id && x.video);
/** Play a stored game at the top of the Games tab, with no stats around it. */
let watching = "";  // id of the game in the Watch panel
function watchHere(g, push = true) {
  watching = g.id;
  $("lib-watch").hidden = false;
  $("lib-watch-title").textContent = `${g.week}: ${g.players.join(" vs ")}`;
  if (LOCAL && !g.video) {
    $("lib-watch-note").hidden = false;
    $("lib-watch-note").textContent = "The replay player comes from Pokémon Showdown, so it isn't in the local version. Add ?online to the address to use it.";
  } else {
    $("lib-watch-note").hidden = true;
    $("lib-watch-frame").allowFullscreen = true;
    $("lib-watch-frame").src = watchSrc(g.id);
    $("lib-watch-frame").hidden = false;
  }
  $("lib-watch").scrollIntoView({ block: "start" });
  if (push) pushNav();
}
function closeWatch() {
  $("lib-watch").hidden = true;
  $("lib-watch-frame").hidden = true;
  $("lib-watch-frame").removeAttribute("src");
}
