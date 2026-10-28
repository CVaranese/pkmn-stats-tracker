/* Players tab: each player's season, and one player's games and Pokémon. */
"use strict";

let players = null;   // [{ key, name, games: [library games], rows }], best record first
let playerPicked = "";
let playerWanted = "";  // asked for by a link (?player=, the game viewer) before the tab had loaded: a name or key
async function renderPlayers() {
  if (players) return;
  players = [];  // marks the tab as rendering
  $("pl-status").textContent = "Loading games…";
  const all = (await loadLeague()).filter((r) => r.brought);
  // a player's Showdown names (case, spaces, draft aliases like DEJIME17) count as one, named as in the draft
  const byKey = new Map();
  const get = (name) => {
    const key = playerKey(name);
    if (!byKey.has(key)) byKey.set(key, { key, name: shownName(name), games: [], rows: [], wins: 0, losses: 0 });
    return byKey.get(key);
  };
  for (const g of library) {
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
  const counted = new Set(all.map((r) => r.replay_id)).size;
  $("pl-status").textContent = counted < library.length ? `Counted ${counted} of ${library.length} games (the rest didn't load).` : "";
  simpleTable($("pl-table"), [["Player", ""],
    ["Won", "num", "Games won among the games saved here."], ["Lost", "num", "Games lost among the games saved here."],
    ["Kills", "num", DESCRIPTIONS.kills], ["Deaths", "num", DESCRIPTIONS.deaths],
    ["Dealt", "num", "Damage dealt in all their games: in HP (~ = a guessed max HP went in), or in % when a game has no HP figures."],
    ["Luck", "", "Their rolls against their opponents' over the season, against the spread those rolls could have given."],
    ["Most used", "", "The Pokémon they brought most often."],
    ["Top MVP", "", "The Pokémon that was Team MVP most often."]],
    players.map((pl) => {
      const mons = RS.summarize(pl.rows);
      const used = el("span", "pl-mons");
      used.append(...[...mons].sort((a, b) => b.games_brought - a.games_brought || b.kills - a.kills).slice(0, 3)
        .map((m) => Object.assign(sprite(m.pokemon, ["gen5/"], "tiny"), { title: `${m.pokemon}: ${m.games_brought} games` })));
      const mvp = [...mons].sort((a, b) => b.mvps - a.mvps || b.kills - a.kills)[0];
      const perGame = [...new Map(pl.rows.map((r) => [r.replay_id, r])).values()];
      return [[pl.name, ""], [String(pl.wins), "num"], [String(pl.losses), "num"],
        [String(sum(pl.rows, "kills")), "num"], [String(sum(pl.rows, "deaths")), "num"], [rowsDealt(pl.rows), "num"],
        [seasonLuckBadge(perGame, "player_luck", "player_luck_var"), ""], [used, ""],
        [mvp && mvp.mvps ? `${mvp.pokemon} ×${mvp.mvps}` : "–", ""]];
    }));
  [...$("pl-table").rows].slice(1).forEach((tr, i) => {
    tr.className = "pl-row";
    cellButton(tr.cells[0]);
    // no title on the row: a phone shows a title as a tip on tap, which got in the way of opening the player
    tr.addEventListener("click", () => { showPlayer(players[i].key); replaceNav(); $("pl-detail").scrollIntoView({ block: "start" }); });
  });
  if (!(playerWanted && showWantedPlayer())) showPlayer(playerPicked || (players[0] && players[0].key));
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
  [...$("pl-table").rows].slice(1).forEach((tr, i) => markCurrent(tr, players[i].key === key));
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
}
