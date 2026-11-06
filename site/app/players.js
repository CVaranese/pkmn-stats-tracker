/* Players tab: each player's season, and one player's games and Pokémon. */
"use strict";

let players = null;   // [{ key, name, games: [library games], rows }], best record first
onLeagueChange(() => { players = null; });
let playerPicked = "";
let playerWanted = "";  // asked for by a link (?player=, the game viewer) before the tab had loaded: a name or key
let plWeek = "";        // "" = every week, else only that week's games ("Week 3")
const plSort = { col: 1, dir: -1 };
/** A player's Pokémon summaries, the three most brought and the top MVP. */
function playerMons(pl) {
  const mons = RS.summarize(pl.rows);
  return { mons, used: [...mons].sort((a, b) => b.games_brought - a.games_brought || b.kills - a.kills).slice(0, 3),
    mvp: [...mons].sort((a, b) => b.mvps - a.mvps || b.kills - a.kills)[0] };
}
/** One row per game (player luck is the same on every row of a game). */
const perGameRows = (rs) => [...new Map(rs.map((r) => [r.replay_id, r])).values()];
/** Seconds a turn over their games with timestamps (both players' time: replays don't split it), or null. */
function paceOf(rs) {
  const timed = perGameRows(rs).filter((r) => r.game_seconds && r.turns);
  return timed.length ? Math.round(sum(timed, "game_seconds") / sum(timed, "turns")) : null;
}
const PACE_TITLE = "Seconds a turn in their games (both players' thinking time together; games rebuilt from video have no times).";
const TIMER_TITLE = "Games where they turned on the battle timer (the replay says who asked for it; video games don't show it).";
const FORFEIT_TITLE = "Games they forfeited (the log says who; games with no saved replay can't show it).";
/** Games a player forfeited: lost, ended by forfeit. */
const forfeits = (pl) => perGameRows(pl.rows).filter((r) => r.end_reason === "forfeit" && !r.won).length;
// a loss on the timer ("X lost due to inactivity."): its own column (user 2026-10-28), shown once any game ended that way
const TIMEOUT_TITLE = "Games they lost on the battle timer (ran out of time).";
const timeouts = (pl) => perGameRows(pl.rows).filter((r) => r.end_reason === "timer" && !r.won).length;
async function renderPlayers() {
  if (players) return;
  players = [];  // marks the tab as rendering
  $("pl-status").textContent = "Loading games…";
  const league = await loadLeague();
  fillWeeks("pl-week", (w) => { plWeek = w; players = null; renderPlayers(); });
  const games = library.filter((g) => (!plWeek || g.week === plWeek) && inStage(g.week));
  const ids = new Set(games.map((g) => g.id));
  const all = league.filter((r) => r.brought && ids.has(r.replay_id));
  // a player's Showdown names (case, spaces, draft aliases like DEJIME17) count as one, named as in the draft
  const byKey = new Map();
  const get = (name) => {
    const key = playerKey(name);
    if (!byKey.has(key)) byKey.set(key, { key, name: shownName(name), games: [], rows: [], wins: 0, losses: 0, setWins: 0, setLosses: 0, points: 0 });
    return byKey.get(key);
  };
  // a league that plays sets: its records (sets, games) come from the sets below, missing games included
  const bestOf = LEAGUE.best_of || 0;
  const scale = bestOf && LEAGUE.set_points;  // set points (Super Champions: 2–0 = 3, 2–1 = 2, 1–2 = 1, 0–2 = 0)
  for (const g of games) {
    for (const p of g.players) {
      const pl = get(p);
      pl.games.push(g);
      if (g.winner && !bestOf) TS.toID(g.winner) === TS.toID(p) ? pl.wins++ : pl.losses++;
    }
  }
  // sets (a week's games between the same two players): a set record when the league plays them (Bo3)
  const leagueSets = bestOf ? setsWithMissing(games, missing.filter((m) => (!plWeek || m.week === plWeek) && inStage(m.week))) :
    librarySets(games);
  const hasSets = bestOf > 0 || leagueSets.some((s) => s.games.length > 1);
  if (bestOf) $("pl-intro").textContent = "Every league game added up per player, so this tab gives results away. " +
    (scale ? `Standings: points (${scale[0]} for a 2–0 win, ${scale[1]} for 2–1, ${scale[2]} for a 1–2 loss, ${scale[3]} for 0–2), then sets won, ` : "Standings: sets won, ") +
    "then game difference, then games won, then the sets between the tied players. Games " +
    "played without a saved replay count in the records when the winner is known.";
  for (const s of leagueSets) {
    // a league that plays sets: every game slot, the sheet's games with no replay too (winner from index.json missing)
    if (bestOf) {
      const info = setSlots(s);
      Object.assign(s, info.score);
      for (const sl of info.slots) {
        const winner = sl.game ? sl.game.winner : sl.winner;
        if (winner) for (const p of s.players) playerKey(p) === playerKey(winner) ? get(p).wins++ : get(p).losses++;
      }
    }
    if (s.winner) for (const p of s.players) playerKey(p) === playerKey(s.winner) ? get(p).setWins++ : get(p).setLosses++;
    if (scale) window.League.setPoints(s, scale).forEach((n, i) => { get(s.players[i]).points += n; });
  }
  // one spelling on the rows too, so RS.summarize keeps one line per Pokémon
  for (const r of all) { const pl = get(r.player); pl.rows.push({ ...r, player: pl.name }); }
  players = window.League.standings([...byKey.values()], leagueSets, playerKey, bestOf, !!scale);
  players.forEach((pl, i) => { pl.place = i + 1; });
  for (const pl of players) Object.assign(pl, playerMons(pl), { luck: seasonLuck(perGameRows(pl.rows), "player_luck", "player_luck_var") });
  const counted = new Set(all.map((r) => r.replay_id)).size;
  $("pl-status").textContent = counted < games.length ? `Counted ${counted} of ${games.length} games (the rest didn't load).` : "";
  const num = (label, title, key) => ({ label, cls: "num", title, key });
  const anyTimeout = players.some((pl) => timeouts(pl) > 0);
  // a league that plays sets: the set record first (sorting by it gives the standings), then games won – lost
  const setCols = bestOf ? [
    ...(scale ? [num("Points", `Set points: ${scale[0]} for a 2–0 win, ${scale[1]} for 2–1, ${scale[2]} for a 1–2 loss, ` +
      `${scale[3]} for 0–2. Standings: points, then sets won, ` +
      "then game difference, then games won, then the sets between the tied players, then KOs minus Pokémon lost.", (pl) => -pl.place)] : []),
    num("Sets", `Sets won – lost (best of ${bestOf}). Standings: ${scale ? "points, then " : ""}sets won, then game difference, ` +
      "then games won, then the sets between the tied players, then KOs minus Pokémon lost.", (pl) => (scale ? pl.setWins - pl.setLosses : -pl.place)),
    num("Games", "Games won – lost, games with no saved replay included when the winner is known.", (pl) => pl.wins),
    num("Diff", "Games won minus games lost.", (pl) => pl.wins - pl.losses),
  ] : [
    num("Won", "Games won among the games saved here.", (pl) => pl.wins),
    num("Lost", "Games lost among the games saved here.", (pl) => pl.losses),
    ...(hasSets ? [num("Sets", "Sets won – lost: a set is a week's games between the same two players (a best of three); a level set isn't counted.",
      (pl) => pl.setWins - pl.setLosses)] : []),
  ];
  sortableTable($("pl-table"), [
    { label: "Player", key: (pl) => pl.name.toLowerCase() },
    ...setCols,
    num("Kills", DESCRIPTIONS.kills, (pl) => sum(pl.rows, "kills")),
    num("Deaths", DESCRIPTIONS.deaths, (pl) => sum(pl.rows, "deaths")),
    num("Dealt", "Damage dealt in all their games: in HP (~ = a guessed max HP went in), or in % when a game has no HP figures.",
      (pl) => dealtKey(pl.rows, 300)),
    { label: "Luck", title: "Their rolls against their opponents' over the season, against the spread those rolls could have given.",
      key: (pl) => (pl.luck ? pl.luck.z : -Infinity) },
    num("Pace", PACE_TITLE, (pl) => paceOf(pl.rows) ?? Infinity),
    num("Timer on", TIMER_TITLE, (pl) => sum(perGameRows(pl.rows), "timer_on")),
    num("Forfeits", FORFEIT_TITLE, forfeits),
    ...(anyTimeout ? [num("Timed out", TIMEOUT_TITLE, timeouts)] : []),
    { label: "Most used", title: "The Pokémon they brought most often.", key: (pl) => (pl.used[0] ? pl.used[0].pokemon : "") },
    { label: "Top MVP", title: "The Pokémon that was Team MVP most often.", key: (pl) => (pl.mvp && pl.mvp.mvps ? pl.mvp.pokemon : "") },
  ], players, plSort, (pl) => {
    const used = el("span", "pl-mons");
    used.append(...pl.used.map((m) => Object.assign(sprite(m.pokemon, ["gen5/"], "tiny"), { title: `${m.pokemon}: ${m.games_brought} games` })));
    const diff = pl.wins - pl.losses;
    return [[pl.name, ""], ...(bestOf ? [...(scale ? [[String(pl.points), "num"]] : []), [`${pl.setWins}–${pl.setLosses}`, "num"], [`${pl.wins}–${pl.losses}`, "num"],
      [diff > 0 ? `+${diff}` : diff < 0 ? `−${-diff}` : "0", "num"]] :
      [[String(pl.wins), "num"], [String(pl.losses), "num"], ...(hasSets ? [[`${pl.setWins}–${pl.setLosses}`, "num"]] : [])]),
      [String(sum(pl.rows, "kills")), "num"], [String(sum(pl.rows, "deaths")), "num"], [rowsDealt(pl.rows), "num"],
      [seasonLuckBadge(perGameRows(pl.rows), "player_luck", "player_luck_var"), ""],
      [paceOf(pl.rows) === null ? "–" : paceOf(pl.rows) + " s", "num"], [String(sum(perGameRows(pl.rows), "timer_on")), "num"], [String(forfeits(pl)), "num"],
      ...(anyTimeout ? [[String(timeouts(pl)), "num"]] : []), [used, ""],
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
  if (!(playerWanted && showWantedPlayer())) showPlayer(players.some((p) => p.key === playerPicked) ? playerPicked : players[0] && players[0].key);
}
/** A week picker (Players, Pokémon): the weeks of the picked stage (fillWeekOptions); picked(week or "") on a change. */
function fillWeeks(id, picked) {
  const sel = $(id);
  fillWeekOptions(sel);
  if (sel.dataset.ready) return;
  sel.dataset.ready = "1";
  sel.addEventListener("change", () => picked(sel.value));
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
  [...$("pl-table").rows].slice(1).forEach((tr) => markCurrent(tr, tr.dataset.key === key));
  $("pl-name").textContent = pl.name;
  const nameOf = (p) => (players.find((x) => x.key === playerKey(p)) || { name: p }).name;
  simpleTable($("pl-games"), [["Week", ""], ["Opponent", ""], ["Result", ""], ["Kills", "num", DESCRIPTIONS.kills],
    ["Deaths", "num", DESCRIPTIONS.deaths], ["Team MVP", "", DESCRIPTIONS.mvp], ["Luck", "", DESCRIPTIONS.player_luck],
    ["Length", "num", "How long the game took, and seconds a turn (not for games rebuilt from video)."], ["Timer", "", DESCRIPTIONS.timer_on], ["", ""]],
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
        [mvp ? mvp.pokemon : "–", ""], [rs.length ? luckBadge(rs[0].player_luck, "player", rs[0].player_luck_top) : "–", ""],
        [rs.length && rs[0].game_seconds ? `${Math.round(rs[0].game_seconds / 60)} min, ${rs[0].seconds_per_turn} s a turn` : "–", "num"],
        [rs.length && rs[0].timer_on ? "turned on" : "", ""], [stats, ""]];
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
