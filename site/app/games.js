/* Games tab: the game library (site/games/, added with tools/add_game.py), spoiler-free list, Watch panel. */
"use strict";

let library = [];
/** The picker shows the game in the link box, or "Pick a game…" for a link that isn't a league game. */
function syncGamePick() {
  const id = RS.replayIdsFromText($("one-link").value)[0] || "";
  $("one-game").value = library.some((g) => g.id === id) ? id : "";
}
// spoiler-free by default: no winner, no turn count (a 3-turn game was a forfeit) until "Show results" is ticked
const SPOILERS_KEY = KEYS + "show-results";
let showResults = false;
function setShowResults(on) {
  showResults = on;
  $("lib-spoilers").setAttribute("aria-pressed", String(on));
  $("lib-spoilers").textContent = on ? "Hide results" : "Show results";
}
/** The library's sets (League.sets: games labelled with a set, else, in a league that plays sets, a week's games
    between the same two players), players matched through the draft's aliases. */
const librarySets = (games = library) => window.League.sets(games, playerKey, LEAGUE.best_of || 0);
/** The set a stored game belongs to (a set of one for a lone game). */
const setOf = (g) => librarySets().find((s) => s.games.includes(g));
/** "Fayz won 2–1" / "1–1" (set score, winner first). */
function setScore(s) {
  if (!s.winner) return `${s.wins[0]}–${s.wins[1]}`;
  const w = s.players.indexOf(s.winner);
  return `${s.winner} won ${s.wins[w]}–${s.wins[1 - w]}`;
}
/** Games grouped by week, the latest week first (weeks in the order they were added); a set of two or more games
    under its own line (score with "Show results", Set stats), its games in the order played. */
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
    table.append(head);
    for (const s of librarySets(shown.filter((g) => g.week === w)).reverse()) {
      if (s.games.length === 1) { table.append(libraryRow(s.games[0])); continue; }
      table.append(setRow(s), ...s.games.map((g, i) => libraryRow(g, i + 1)));
    }
  }
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  wrap.append(table);
  $("lib-list").replaceChildren(...(shown.length ? [wrap] : []));
}
/** A set's line above its games: who, how many games, the score with "Show results", and Set stats. */
function setRow(s) {
  const tr = el("tr", "lib-set");
  const td = Object.assign(el("td", ""), { colSpan: 3 });
  td.append(el("strong", "", "Set"), ` · ${s.players.join(" vs ")} · ${s.games.length} games` + (showResults ? ` · ${setScore(s)}` : ""));
  // grouped by guess (same week, same players) but it can't be one set: say so rather than count it wrong
  if (s.unclear) {
    td.append(" · ", Object.assign(el("span", "badge", "May be two sets"), {
      title: `Grouped by week and players, but ${s.games.length > LEAGUE.best_of ? `that's more than a best of ${LEAGUE.best_of}` : "a game was played after the set was won"}. The set score may be wrong until each game is labelled with its set.` }));
  }
  const stats = Object.assign(el("button", "small", "Set stats"), { type: "button", title: "All the set's games in Playoffs, added up (shows the results)" });
  stats.addEventListener("click", () => openSet(s.games.map((g) => g.id)));
  const actions = el("td", "lib-actions");
  actions.append(stats);
  tr.append(td, actions);
  return tr;
}
/** A library row: each player with their team-preview sprites; winner and turns only with "Show results". n: its
    game number in a set of two or more. */
function libraryRow(g, n = 0) {
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
  const note = el("td", "muted", [n ? "Game " + n : "", g.note].filter(Boolean).join(" · "));
  if (g.note_detail) note.title = g.note_detail;
  tr.append(cell, el("td", "num", results ? g.turns + " turns" : ""), note, actions);
  // the whole row opens the game, like Stats (its own buttons keep their action)
  tr.className = "lib-row";
  tr.addEventListener("click", (e) => { if (!e.target.closest("button")) openGame(g.id); });
  return tr;
}
/** The player for a game: Showdown's replay player, or the YouTube video for a game rebuilt from it. */
function watchSrc(id) {
  const g = library.find((x) => x.id === id);
  const yt = g && g.video && g.video.match(/(?:youtu\.be\/|[?&]v=)([\w-]{11})/);
  return yt ? "https://www.youtube-nocookie.com/embed/" + yt[1] : "watch.html?id=" + encodeURIComponent(id) + (LEAGUE.id ? "&league=" + LEAGUE.id : "");
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
