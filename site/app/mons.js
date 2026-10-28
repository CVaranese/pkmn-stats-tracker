/* Pokémon tab: each Pokémon's season, and one Pokémon's moves and games. */
"use strict";

let mons = null;  // [summary fields + { rows, players, moves, best }], most games first
let monPicked = "";
// search text: letters and digits only, no accents or case ("Iron-Valiant" and "ironval" match)
const findKey = (s) => s.normalize("NFD").replace(/[^a-z0-9]/gi, "").toLowerCase();
const monSort = { col: 2, dir: -1 };
async function renderMons() {
  if (mons) return;
  mons = [];  // marks the tab as rendering
  $("mon-status").textContent = "Loading games…";
  const all = (await loadLeague()).filter((r) => r.brought);
  const nameOf = shownName;
  mons = RS.summarize(all, false).map((m) => {
    const rows = all.filter((r) => r.pokemon === m.pokemon);
    const moves = seasonMoves(rows);
    return { ...m, rows, players: [...new Set(rows.map((r) => nameOf(r.player)))], moves, nameOf,
      best: bestMove({ move_stats: moves }) };
  }).sort((a, b) => b.games_brought - a.games_brought || b.kills - a.kills || a.pokemon.localeCompare(b.pokemon));
  const counted = new Set(all.map((r) => r.replay_id)).size;
  $("mon-status").textContent = counted < library.length ? `Counted ${counted} of ${library.length} games (the rest didn't load).` : "";
  const num = (label, title, key) => ({ label, cls: "num", title, key });
  const hps = all.map((r) => r.max_hp).filter((h) => typeof h === "number" && h > 0);
  // no max HP anywhere (the Pokedex didn't load): about an 80-base-HP Pokemon's, only so % games still sort
  const avgHp = hps.length ? hps.reduce((t, h) => t + h, 0) / hps.length : 300;
  sortableTable($("mon-table"), [
    { label: "Pokémon", key: (m) => m.pokemon },
    { label: "Player", title: "Who brought it.", key: (m) => m.players.join(", ") },
    num("Games", DESCRIPTIONS.games_brought, (m) => m.games_brought),
    num("Won", DESCRIPTIONS.wins_when_brought, (m) => m.wins_when_brought),
    num("Win rate", "Games won when it was brought, out of the games it was brought to.", (m) => m.wins_when_brought / m.games_brought),
    num("Kills", DESCRIPTIONS.kills, (m) => m.kills),
    num("Deaths", DESCRIPTIONS.deaths, (m) => m.deaths),
    num("Dealt", "Damage dealt in all its games: in HP (~ = a guessed max HP went in), or in % when a game has no HP figures.", (m) => dealtKey(m.rows, avgHp)),
    num("Survived", "Games it was still standing at the end.", (m) => m.survived),
    num("MVPs", DESCRIPTIONS.mvps, (m) => m.mvps),
    { label: "Best move", title: "The move that did the most damage over the season (ties: more KOs).", key: (m) => (m.best ? m.best.move : "") },
    { label: "Luck", title: "Its own rolls over its games, against the spread those rolls could have given.", key: (m) => { const l = seasonLuck(m.rows, "luck", "luck_var"); return l ? l.z : -Infinity; } },
  ], mons, monSort, (m) => {
    const mon = el("span", "bet-mon");
    mon.append(sprite(m.pokemon, ["gen5/"], "tiny"), m.pokemon);
    return [[mon, ""], [m.players.join(", "), ""], [String(m.games_brought), "num"], [String(m.wins_when_brought), "num"],
      [Math.round((100 * m.wins_when_brought) / m.games_brought) + "%", "num"], [String(m.kills), "num"], [String(m.deaths), "num"],
      [rowsDealt(m.rows), "num"], [String(m.survived), "num"], [String(m.mvps), "num"],
      [m.best ? m.best.move : "–", ""],
      [seasonLuckBadge(m.rows, "luck", "luck_var"), ""]];
  }, (sorted) => {
    [...$("mon-table").rows].slice(1).forEach((tr, i) => {
      tr.className = "pl-row";
      cellButton(tr.cells[0]);
      tr.dataset.mon = sorted[i].pokemon;
      markCurrent(tr, sorted[i].pokemon === monPicked);
      tr.dataset.find = findKey(sorted[i].pokemon + " " + sorted[i].players.join(" "));
      tr.addEventListener("click", () => pickMon(sorted[i].pokemon));
    });
    filterMons();
  });
  showMon(monPicked || (mons[0] && mons[0].pokemon));
}
/** The search box: up to 8 matches as buttons under it (name or player), the table cut to the matches. */
function filterMons() {
  const q = findKey($("mon-find").value);
  const hits = q ? mons.filter((m) => findKey(m.pokemon + " " + m.players.join(" ")).includes(q)) : [];
  [...$("mon-table").rows].slice(1).forEach((tr) => { tr.hidden = Boolean(q) && !tr.dataset.find.includes(q); });
  $("mon-matches").replaceChildren(...hits.slice(0, 8).map((m) => {
    const b = Object.assign(el("button", "small mon-match"), { type: "button" });
    b.append(sprite(m.pokemon, ["gen5/"], "tiny"), el("span", "", m.pokemon), el("span", "muted", m.players.join(", ")));
    b.addEventListener("click", () => pickMon(m.pokemon));
    return b;
  }));
  $("mon-find-count").textContent = !q ? "" : !hits.length ? "No Pokémon matches." :
    hits.length > 8 ? `${hits.length} match: the first 8 are above, all of them in the list below.` : "";
}
function pickMon(name) {
  showMon(name);
  $("mon-detail").scrollIntoView({ block: "start" });
}
/** One Pokémon's season moves and its games (player, opponent, result, kills, damage), under the Pokémon table. */
function showMon(name) {
  const m = mons.find((x) => x.pokemon === name);
  $("mon-detail").hidden = !m;
  if (!m) return;
  monPicked = name;
  [...$("mon-table").rows].slice(1).forEach((tr) => markCurrent(tr, tr.dataset.mon === name));
  const head = el("span", "bet-mon");
  head.append(sprite(m.pokemon, ["gen5/"], "small"), m.pokemon);
  $("mon-name").replaceChildren(head);
  $("mon-moves").replaceChildren(moveList({ move_stats: m.moves }, m.best));
  simpleTable($("mon-games"), [["Week", ""], ["Player", ""], ["Opponent", ""], ["Result", ""], ["Kills", "num", DESCRIPTIONS.kills],
    ["Dealt", "num", DESCRIPTIONS.damage_dealt_hp], ["Taken", "num", DESCRIPTIONS.damage_taken_hp], ["Survived", "", "Still standing at the end."],
    ["Best move", "", "The move that did the most damage that game (ties: more KOs)."], ["", ""]],
    library.filter((g) => m.rows.some((r) => r.replay_id === g.id)).reverse().flatMap((g) => m.rows.filter((r) => r.replay_id === g.id).map((r) => {
      const result = !g.winner ? "–" : el("span", r.won ? "badge win" : "badge", r.won ? "Won" : "Lost");
      const best = bestMove(r);
      const stats = Object.assign(el("button", "small", "Stats"), { type: "button", title: "Open in Main viewer" });
      stats.addEventListener("click", () => openGame(g.id));
      const hp = (f) => amount([r], [f + "_pct"]).text;
      const name = r.mvp ? el("span", "", m.nameOf(r.player) + " ") : m.nameOf(r.player);
      if (r.mvp) name.append(Object.assign(el("span", "badge win", "MVP"), { title: DESCRIPTIONS.mvp }));
      return [[g.week, ""], [name, ""], [m.nameOf(r.opponent), ""], [result, ""], [String(r.kills), "num"],
        [hp("damage_dealt"), "num"], [hp("damage_taken"), "num"], [r.survived ? "Yes" : "No", ""],
        [best ? best.move : "–", ""], [stats, ""]];
    })));
}
