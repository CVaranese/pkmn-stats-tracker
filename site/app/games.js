/* Games tab: the game library (site/games/, added with tools/add_game.py), spoiler-free list, Watch panel. */
"use strict";

let library = [];
// games played with no saved replay (index.json "missing": week, players, game number or null when not known, winner
// or null): they fill their set's slots in Games
let missing = [];
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
const pairKey = (players) => players.map(playerKey).sort().join("|");
/** A set's game slots in a league that plays sets (best_of): its saved games, its missing ones at their game number,
    and "not played" up to best_of, so a 2–0 shows as many rows as a 2–1 until "Show results". Each slot: {n, game}
    (a saved game) or {n, kind: "missing" | "unplayed", winner}. Also the set score with the missing games' winners
    and how many missing games have no known winner. */
function setSlots(s) {
  const bestOf = LEAGUE.best_of || 0;
  const lost = s.missing || [];
  const total = Math.max(bestOf, s.games.length + lost.length);
  const slots = [];
  for (const m of lost) if (m.game) slots[m.game - 1] = { n: m.game, kind: "missing", winner: m.winner };
  const unknownSet = lost.some((m) => !m.game);   // a set with no replay at all: how many games isn't known
  let next = 0;
  for (const g of s.games) {
    while (slots[next]) next++;
    slots[next] = { n: next + 1, game: g };
  }
  for (let i = 0; i < total; i++) if (!slots[i]) slots[i] = { n: i + 1, kind: unknownSet ? "missing" : "unplayed", winner: null };
  const wins = s.players.map((p) => slots.filter((sl) => (sl.game ? sl.game.winner : sl.winner) &&
    playerKey(sl.game ? sl.game.winner : sl.winner) === playerKey(p)).length);
  const w = wins.findIndex((n) => n > bestOf / 2);
  const unknown = slots.filter((sl) => sl.kind === "missing" && !sl.winner).length;
  return { slots, score: { ...s, wins, winner: w >= 0 ? s.players[w] : "" }, unknown, unknownSet,
    played: slots.filter((sl) => sl.game || sl.kind === "missing").length };
}
/** Games grouped by week, the latest week first (weeks in the order they were added); a set of two or more games
    under its own line (score with "Show results", Set stats), its games in the order played. */
function renderLibrary() {
  const player = $("lib-player").value, week = $("lib-week").value;
  const pick = (g) => (!player || g.players.some((p) => TS.toID(p) === player)) && (!week || g.week === week);
  const shown = library.filter(pick), lostShown = missing.filter(pick);
  $("lib-count").textContent = library.length ? `${shown.length} of ${library.length} games` : "";
  let setCount = 0;   // a league that plays sets counts sets until "Show results": a game count would give a 2–0 away
  $("lib-empty").hidden = shown.length + lostShown.length > 0;
  $("lib-empty").textContent = library.length ? "No games match." : "No games saved yet.";
  // one table, a heading row per week, so the columns line up across weeks
  const weeks = [...new Set([...shown, ...lostShown].map((g) => g.week))].reverse();
  const bestOf = LEAGUE.best_of || 0;
  const table = document.createElement("table");
  table.className = "lib-table";
  for (const w of weeks) {
    const head = document.createElement("tr");
    head.className = "lib-week";
    head.append(Object.assign(document.createElement("th"), { colSpan: 5, scope: "colgroup", textContent: w }));
    table.append(head);
    const sets = librarySets(shown.filter((g) => g.week === w));
    // missing games join their set; a set with none saved goes first, so it ends up last (latest set on top)
    for (const m of lostShown.filter((x) => x.week === w)) {
      let s = sets.find((x) => pairKey(x.players) === pairKey(m.players));
      if (!s) sets.unshift(s = { week: w, players: m.players, games: [], wins: [0, 0], winner: "" });
      (s.missing = s.missing || []).push(m);
    }
    for (const s of sets.reverse()) {
      if (bestOf) {
        const info = setSlots(s);
        setCount++;
        table.append(setRow(s, info), ...info.slots.map((sl) => (sl.game ? libraryRow(sl.game, sl.n) : slotRow(s, sl))));
        continue;
      }
      if (s.games.length === 1) { table.append(libraryRow(s.games[0])); continue; }
      table.append(setRow(s), ...s.games.map((g, i) => libraryRow(g, i + 1)));
    }
  }
  const wrap = document.createElement("div");
  wrap.className = "table-wrap";
  wrap.append(table);
  $("lib-list").replaceChildren(...(weeks.length ? [wrap] : []));
  if (bestOf && !showResults && library.length) $("lib-count").textContent = `${setCount} set${setCount === 1 ? "" : "s"}`;
}
/** A set's line above its games: who, how many games (with "Show results"; before that "best of 3", so a 2–0 doesn't
    show), the score with "Show results", and Set stats. info: setSlots, in a league that plays sets. */
function setRow(s, info = null) {
  const tr = el("tr", "lib-set");
  const td = Object.assign(el("td", ""), { colSpan: 3 });
  let count = info ? `best of ${LEAGUE.best_of}` : `${s.games.length} games`, result = "";
  if (showResults && info && info.unknownSet) count = "no replays saved";
  else if (showResults) {
    if (info) count = `${info.played} games`;
    result = ` · ${setScore(info ? info.score : s)}` + (info && info.unknown ? ` · ${info.unknown} with no replay, winner not known` : "");
  }
  td.append(el("strong", "", "Set"), ` · ${s.players.join(" vs ")} · ${count}${result}`);
  // grouped by guess (same week, same players) but it can't be one set: say so rather than count it wrong
  if (s.unclear) {
    td.append(" · ", Object.assign(el("span", "badge", "May be two sets"), {
      title: `Grouped by week and players, but ${s.games.length > LEAGUE.best_of ? `that's more than a best of ${LEAGUE.best_of}` : "a game was played after the set was won"}. The set score may be wrong until each game is labelled with its set.` }));
  }
  const actions = el("td", "lib-actions");
  if (s.games.length) {
    const stats = Object.assign(el("button", "small", "Set stats"), { type: "button", title: "All the set's games in Playoffs, added up (shows the results)" });
    stats.addEventListener("click", () => openSet(s.games.map((g) => g.id)));
    actions.append(stats);
  }
  tr.append(td, actions);
  return tr;
}
/** A set's slot with no saved game: a game played without a replay, or one never played (the set was already won).
    Until "Show results" it looks like a played game (the set's team, Watch and Stats, which say what happened), so
    the number of rows gives nothing away; after, it says "No replay" / "Not played". */
function slotRow(s, sl) {
  const tr = el("tr", "lib-row lib-slot" + (showResults ? " done" : ""));
  const cell = el("td", "lib-match");
  const match = el("div", "lib-pair");
  cell.append(match);
  const first = s.games[0];   // a set keeps one team per player (VGC: the same six all set)
  s.players.forEach((p, i) => {
    if (i) match.append(el("span", "lib-vs", "vs"));
    const side = el("div", "lib-side");
    const name = el("div", "lib-name", p);
    if (showResults && sl.winner && playerKey(sl.winner) === playerKey(p)) name.append(" ", el("span", "badge win", "Won"));
    const team = el("div", "lib-team");
    const ti = first ? first.players.findIndex((x) => playerKey(x) === playerKey(p)) : -1;
    if (ti >= 0 && (!showResults || sl.kind === "missing")) {
      team.append(...((first.teams || [])[ti] || []).map((mon) => sprite(mon, ["gen5/"], "tiny", true)));
    }
    side.append(name, team);
    match.append(side);
  });
  const note = el("td", "muted", ["Game " + sl.n, showResults ? (sl.kind === "missing" ? "No replay" : "Not played") : ""].filter(Boolean).join(" · "));
  const actions = el("td", "lib-actions");
  if (!showResults) {
    const tell = () => slotNote(s, sl);
    for (const [label, title] of [["Watch", "Play the battle here, without the result"], ["Stats", "Open in Main viewer (shows the result)"]]) {
      const b = Object.assign(el("button", "small", label), { type: "button", title });
      b.addEventListener("click", tell);
      actions.append(b);
    }
    tr.addEventListener("click", (e) => { if (!e.target.closest("button")) tell(); });
  }
  tr.append(cell, el("td", "num", ""), note, actions);
  return tr;
}
/** The Watch panel for a slot with no saved game: what happened to it (this is where it stops being a secret). */
function slotNote(s, sl) {
  watching = "";
  $("lib-watch").hidden = false;
  $("lib-watch-title").textContent = `${s.week}: ${s.players.join(" vs ")}, game ${sl.n}`;
  $("lib-watch-frame").hidden = true;
  $("lib-watch-frame").removeAttribute("src");
  $("lib-watch-note").hidden = false;
  $("lib-watch-note").textContent = sl.kind === "missing" ? "This game was played, but its replay wasn't saved." :
    `There was no game ${sl.n}: the set was over after ${sl.n - 1}.`;
  $("lib-watch").scrollIntoView({ block: "start" });
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
