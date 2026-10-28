/* Players tab: each player's season, and one player's games and Pokémon. */
"use strict";

let players = null;   // [{ key, name, games: [library games], rows }], best record first
let playerPicked = "";
let playerWanted = "";  // asked for by a link (?player=, the game viewer) before the tab had loaded: a name or key
let plWeek = "";        // "" = every week, else only that week's games ("Week 3")
let h2hA = "";          // head-to-head: the first player's key (follows the player picked under Standings)
let h2hWith = "";       // head-to-head: the other player's key
let plView = "standings";  // sub-tab: standings, h2h, kos
const plSort = { col: 1, dir: -1 };
/** A player's Pokémon summaries, the three most brought and the top MVP. */
function playerMons(pl) {
  const mons = RS.summarize(pl.rows);
  return { mons, used: [...mons].sort((a, b) => b.games_brought - a.games_brought || b.kills - a.kills).slice(0, 3),
    mvp: [...mons].sort((a, b) => b.mvps - a.mvps || b.kills - a.kills)[0] };
}
/** One row per game (player luck is the same on every row of a game). */
const perGameRows = (rs) => [...new Map(rs.map((r) => [r.replay_id, r])).values()];
async function renderPlayers() {
  if (players) return;
  players = [];  // marks the tab as rendering
  $("pl-status").textContent = "Loading games…";
  const league = await loadLeague();
  fillWeeks();
  const games = library.filter((g) => !plWeek || g.week === plWeek);
  const ids = new Set(games.map((g) => g.id));
  const all = league.filter((r) => r.brought && ids.has(r.replay_id));
  // a player's Showdown names (case, spaces, draft aliases like DEJIME17) count as one, named as in the draft
  const byKey = new Map();
  const get = (name) => {
    const key = playerKey(name);
    if (!byKey.has(key)) byKey.set(key, { key, name: shownName(name), games: [], rows: [], wins: 0, losses: 0 });
    return byKey.get(key);
  };
  for (const g of games) {
    for (const p of g.players) {
      const pl = get(p);
      pl.games.push(g);
      if (g.winner) TS.toID(g.winner) === TS.toID(p) ? pl.wins++ : pl.losses++;
    }
  }
  // one spelling on the rows too, so RS.summarize keeps one line per Pokémon
  for (const r of all) { const pl = get(r.player); pl.rows.push({ ...r, player: pl.name }); }
  players = [...byKey.values()].sort((a, b) => b.wins - a.wins || a.losses - b.losses ||
    sum(b.rows, "kills") - sum(a.rows, "kills") || a.name.localeCompare(b.name));
  for (const pl of players) Object.assign(pl, playerMons(pl), { luck: seasonLuck(perGameRows(pl.rows), "player_luck", "player_luck_var") });
  const counted = new Set(all.map((r) => r.replay_id)).size;
  $("pl-status").textContent = counted < games.length ? `Counted ${counted} of ${games.length} games (the rest didn't load).` : "";
  const num = (label, title, key) => ({ label, cls: "num", title, key });
  sortableTable($("pl-table"), [
    { label: "Player", key: (pl) => pl.name.toLowerCase() },
    num("Won", "Games won among the games saved here.", (pl) => pl.wins),
    num("Lost", "Games lost among the games saved here.", (pl) => pl.losses),
    num("Kills", DESCRIPTIONS.kills, (pl) => sum(pl.rows, "kills")),
    num("Deaths", DESCRIPTIONS.deaths, (pl) => sum(pl.rows, "deaths")),
    num("Dealt", "Damage dealt in all their games: in HP (~ = a guessed max HP went in), or in % when a game has no HP figures.",
      (pl) => dealtKey(pl.rows, 300)),
    { label: "Luck", title: "Their rolls against their opponents' over the season, against the spread those rolls could have given.",
      key: (pl) => (pl.luck ? pl.luck.z : -Infinity) },
    { label: "Most used", title: "The Pokémon they brought most often.", key: (pl) => (pl.used[0] ? pl.used[0].pokemon : "") },
    { label: "Top MVP", title: "The Pokémon that was Team MVP most often.", key: (pl) => (pl.mvp && pl.mvp.mvps ? pl.mvp.pokemon : "") },
  ], players, plSort, (pl) => {
    const used = el("span", "pl-mons");
    used.append(...pl.used.map((m) => Object.assign(sprite(m.pokemon, ["gen5/"], "tiny"), { title: `${m.pokemon}: ${m.games_brought} games` })));
    return [[pl.name, ""], [String(pl.wins), "num"], [String(pl.losses), "num"],
      [String(sum(pl.rows, "kills")), "num"], [String(sum(pl.rows, "deaths")), "num"], [rowsDealt(pl.rows), "num"],
      [seasonLuckBadge(perGameRows(pl.rows), "player_luck", "player_luck_var"), ""], [used, ""],
      [pl.mvp && pl.mvp.mvps ? `${pl.mvp.pokemon} ×${pl.mvp.mvps}` : "–", ""]];
  }, (sorted) => {
    [...$("pl-table").rows].slice(1).forEach((tr, i) => {
      tr.className = "pl-row";
      tr.dataset.key = sorted[i].key;
      markCurrent(tr, sorted[i].key === playerPicked);
      cellButton(tr.cells[0]);
      // no title on the row: a phone shows a title as a tip on tap, which got in the way of opening the player
      tr.addEventListener("click", () => { showPlayer(sorted[i].key); replaceNav(); $("pl-detail").scrollIntoView({ block: "start" }); });
    });
  });
  renderKoMatrix(league.filter((r) => ids.has(r.replay_id)));
  if (!(playerWanted && showWantedPlayer())) showPlayer(players.some((p) => p.key === playerPicked) ? playerPicked : players[0] && players[0].key);
}
/** The week picker: every week in the library, once. */
function fillWeeks() {
  const sel = $("pl-week");
  if (sel.options.length > 1) return;
  for (const w of [...new Set(library.map((g) => g.week))]) sel.append(Object.assign(document.createElement("option"), { value: w, textContent: w }));
  sel.addEventListener("change", () => { plWeek = sel.value; players = null; renderPlayers(); });
}
/** Who KO'd whom between players: a cell is how many of the column player's Pokémon the row player's KO'd. */
function renderKoMatrix(rows) {
  const pairs = koPairs(rows);
  const order = players.map((p) => p.key);
  const short = (pl) => pl.name;
  const cells = new Map();  // "killerKey|victimKey" -> [pairs]
  for (const pr of pairs) {
    const k = playerKey(pr.killer.player) + "|" + playerKey(pr.victim.player);
    if (!cells.has(k)) cells.set(k, []);
    cells.get(k).push(pr);
  }
  const what = (prs) => {
    const by = new Map();
    for (const pr of prs) { const t = `${pr.killer.pokemon} KO'd ${pr.victim.pokemon}`; by.set(t, (by.get(t) || 0) + 1); }
    return [...by].map(([t, n]) => t + (n > 1 ? ` ×${n}` : "")).join("; ");
  };
  simpleTable($("pl-kos"), [["KO'd →", ""], ...players.map((pl) => [short(pl), "num"]), ["Total", "num", "All the KOs their Pokémon scored."]],
    players.map((pl) => {
      const mine = pairs.filter((pr) => playerKey(pr.killer.player) === pl.key);
      return [[pl.name, ""], ...order.map((k) => {
        if (k === pl.key) return ["–", "num muted"];
        const prs = cells.get(pl.key + "|" + k) || [];
        if (!prs.length) return ["", "num"];
        const c = el("span", "ko-cell", String(prs.length));
        c.title = what(prs) + ".";
        return [c, "num"];
      }), [String(mine.length), "num"]];
    }));
}
/** Pick a player from a link (name or key) and bring their games into view, now or once the tab has loaded. */
function wantPlayer(name) {
  playerWanted = name;
  if (players && players.length) showWantedPlayer();
}
function showWantedPlayer() {
  const key = playerKey(playerWanted);
  playerWanted = "";
  if (!players.some((p) => p.key === key)) return false;
  showPlView("standings");
  showPlayer(key);
  $("pl-detail").scrollIntoView({ block: "start" });
  return true;
}
/** One player's games (opponent, result, kills, MVP, luck) and Pokémon, under the players table. */
function showPlayer(key) {
  const pl = players.find((p) => p.key === key);
  $("pl-detail").hidden = !pl;
  if (!pl) return;
  playerPicked = key;
  [...$("pl-table").rows].slice(1).forEach((tr) => markCurrent(tr, tr.dataset.key === key));
  $("pl-name").textContent = pl.name;
  const nameOf = (p) => (players.find((x) => x.key === playerKey(p)) || { name: p }).name;
  simpleTable($("pl-games"), [["Week", ""], ["Opponent", ""], ["Result", ""], ["Kills", "num", DESCRIPTIONS.kills],
    ["Deaths", "num", DESCRIPTIONS.deaths], ["Team MVP", "", DESCRIPTIONS.mvp], ["Luck", "", DESCRIPTIONS.player_luck], ["", ""]],
    [...pl.games].reverse().map((g) => {
      const rs = pl.rows.filter((r) => r.replay_id === g.id);
      const me = g.players.find((p) => playerKey(p) === key);
      const opp = g.players.find((p) => p !== me) || "";
      const result = !g.winner ? "–" : el("span", TS.toID(g.winner) === TS.toID(me) ? "badge win" : "badge",
        TS.toID(g.winner) === TS.toID(me) ? "Won" : "Lost");
      const mvp = rs.find((r) => r.mvp);
      const stats = Object.assign(el("button", "small", "Stats"), { type: "button", title: "Open in Main viewer" });
      stats.addEventListener("click", () => openGame(g.id));
      return [[g.week, ""], [nameOf(opp), ""], [result, ""],
        [rs.length ? String(sum(rs, "kills")) : "–", "num"], [rs.length ? String(sum(rs, "deaths")) : "–", "num"],
        [mvp ? mvp.pokemon : "–", ""], [rs.length ? luckBadge(rs[0].player_luck, "player", rs[0].player_luck_top) : "–", ""], [stats, ""]];
    }));
  simpleTable($("pl-mons"), [["Pokémon", ""], ["Games", "num", DESCRIPTIONS.games_brought], ["Wins", "num", DESCRIPTIONS.wins_when_brought],
    ["Kills", "num", DESCRIPTIONS.kills], ["Deaths", "num", DESCRIPTIONS.deaths],
    ["Dealt", "num", "Damage dealt in all its games (HP, or % when a game has no HP figures)."],
    ["MVPs", "num", DESCRIPTIONS.mvps], ["Luck", "", "Its own rolls over its games, against the spread those rolls could have given."]],
    RS.summarize(pl.rows).sort((a, b) => b.games_brought - a.games_brought || b.kills - a.kills).map((m) => {
      const rs = pl.rows.filter((r) => r.pokemon === m.pokemon);
      const mon = el("span", "bet-mon");
      mon.append(sprite(m.pokemon, ["gen5/"], "tiny"), m.pokemon);
      return [[mon, ""], [String(m.games_brought), "num"], [String(m.wins_when_brought), "num"], [String(m.kills), "num"],
        [String(m.deaths), "num"], [rowsDealt(rs), "num"], [String(m.mvps), "num"], [seasonLuckBadge(rs, "luck", "luck_var"), ""]];
    }));
  h2hA = key;
  fillH2h();
}
/** Head-to-head sub-tab: the two pickers (the second starts on the first player's last opponent) and the result. */
function fillH2h() {
  if (!players || !players.length) return;
  if (!players.some((p) => p.key === h2hA)) h2hA = playerPicked || players[0].key;
  const a = players.find((p) => p.key === h2hA);
  const others = players.filter((p) => p.key !== h2hA);
  if (!others.some((p) => p.key === h2hWith)) {
    const last = [...a.games].reverse().map((g) => g.players.find((p) => playerKey(p) !== h2hA)).find(Boolean);
    h2hWith = last && others.some((p) => p.key === playerKey(last)) ? playerKey(last) : others[0] ? others[0].key : "";
  }
  const options = (sel, list, cur) => sel.replaceChildren(...list.map((p) =>
    Object.assign(document.createElement("option"), { value: p.key, textContent: p.name, selected: p.key === cur })));
  options($("h2h-a"), players, h2hA);
  options($("h2h-with"), others, h2hWith);
  $("h2h-a").onchange = () => { h2hA = $("h2h-a").value; fillH2h(); };
  $("h2h-with").onchange = () => { h2hWith = $("h2h-with").value; fillH2h(); };
  headToHead(a, players.find((p) => p.key === h2hWith));
}
/** Players sub-tabs: Standings (the table and one player's games), Head-to-head, KO matrix. */
function showPlView(v) {
  plView = v;
  for (const b of document.querySelectorAll("#pl-views button")) markCurrent(b, b.dataset.plview === v);
  $("pl-standings").hidden = v !== "standings";
  $("pl-h2h").hidden = v !== "h2h";
  $("pl-kos-view").hidden = v !== "kos";
}
for (const b of document.querySelectorAll("#pl-views button")) b.addEventListener("click", () => showPlView(b.dataset.plview));
/** Damage per game: in HP when every row has it (~ when guessed), else in %. */
function dealtPerGame(rs, games) {
  if (!games) return "–";
  const a = amount(rs, ["damage_dealt_pct"]);
  const total = a.hp ? sum(rs, "damage_dealt_hp") : sum(rs, "damage_dealt_pct");
  return (a.text.startsWith("~") ? "~" : "") + Math.round(total / games) + (a.hp ? " HP" : "%");
}
/** Two players side by side: their games against each other (and who KO'd whom in them), then their seasons. */
function headToHead(a, b) {
  const out = $("h2h-out");
  if (!a || !b) { out.replaceChildren(); return; }
  const met = a.games.filter((g) => g.players.some((p) => playerKey(p) === b.key));
  const aWins = met.filter((g) => g.winner && playerKey(g.winner) === a.key).length;
  const bWins = met.filter((g) => g.winner && playerKey(g.winner) === b.key).length;
  const nodes = [];
  nodes.push(el("p", "", !met.length ? `${a.name} and ${b.name} haven't played each other in a saved game.` :
    `Played ${met.length === 1 ? "once" : met.length + " times"}: ${a.name} ${aWins}, ${b.name} ${bWins}.`));
  if (met.length) {
    const wrap = el("div", "table-wrap"), t = document.createElement("table");
    wrap.append(t);
    const ids = new Set(met.map((g) => g.id));
    const kos = koPairs([...a.rows, ...b.rows].filter((r) => ids.has(r.replay_id)));
    simpleTable(t, [["Week", ""], ["Winner", ""], [a.name + " kills", "num"], [b.name + " kills", "num"], ["KOs", ""], ["", ""]],
      [...met].reverse().map((g) => {
        const rs = (pl) => pl.rows.filter((r) => r.replay_id === g.id);
        const list = kos.filter((k) => k.killer.replay_id === g.id).map((k) => `${k.killer.pokemon} → ${k.victim.pokemon}`).join(", ");
        const stats = Object.assign(el("button", "small", "Stats"), { type: "button", title: "Open in Main viewer" });
        stats.addEventListener("click", () => openGame(g.id));
        const winner = !g.winner ? "–" : playerKey(g.winner) === a.key ? a.name : b.name;
        return [[g.week, ""], [winner, ""], [String(sum(rs(a), "kills")), "num"], [String(sum(rs(b), "kills")), "num"],
          [list || "–", "ko-list"], [stats, ""]];
      }));
    nodes.push(wrap);
  }
  // their seasons side by side
  const n = (pl) => perGameRows(pl.rows).length;
  const per = (pl, f) => (n(pl) ? (sum(pl.rows, f) / n(pl)).toFixed(1) : "–");
  const mons = (pl) => {
    const s = el("span", "pl-mons");
    s.append(...pl.used.map((m) => Object.assign(sprite(m.pokemon, ["gen5/"], "tiny"), { title: `${m.pokemon}: ${m.games_brought} games` })));
    return s;
  };
  const top = (pl) => {
    const m = [...pl.mons].sort((x, y) => y.kills - x.kills || x.deaths - y.deaths)[0];
    return m && m.kills ? `${m.pokemon} (${m.kills} KOs)` : "–";
  };
  const wrap = el("div", "table-wrap h2h-table"), t = document.createElement("table");
  wrap.append(t);
  simpleTable(t, [["Season", ""], [a.name, ""], [b.name, ""]], [
    ["Won – lost", (pl) => `${pl.wins} – ${pl.losses}`],
    ["Kills a game", (pl) => per(pl, "kills"), DESCRIPTIONS.kills],
    ["Pokémon lost a game", (pl) => per(pl, "deaths"), DESCRIPTIONS.deaths],
    ["Damage a game", (pl) => dealtPerGame(pl.rows, n(pl))],
    ["Luck", (pl) => seasonLuckBadge(perGameRows(pl.rows), "player_luck", "player_luck_var")],
    ["Most used", mons],
    ["Top scorer", top],
  ].map(([label, f, title]) => [[label, "", title], [f(a), ""], [f(b), ""]]));
  nodes.push(el("h3", "h2h-sub", "Their seasons"), wrap);
  out.replaceChildren(...nodes);
}
