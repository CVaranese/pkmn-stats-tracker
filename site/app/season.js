/* Every saved league game's rows, loaded once for Players, Pokémon and Fantasy; the draft (aliases, Megas, costs). */
"use strict";

let draft = null;        // site/<league>/games/draft.json: each player's drafted Pokémon and tiers
/** The draft, loaded once ("no-cache": a new draft shows without waiting out the browser cache); null if missing. */
let draftLoad = null;
function loadDraft() {
  return draftLoad || (draftLoad = fetch(DIR + "games/draft.json", { cache: "no-cache" }).then((r) => r.json())
    .then((d) => { draft = d; }, () => { draft = null; draftLoad = null; }));  // failed: try again next time
}
/** Megas as their own Pokémon (Bet.megaName; the draft's Mega only for league games). Runs last: sheets, max HP
    and luck go by the base name (sheets list "Latios @ Latiosite"). */
function megaNames(rs) {
  const league = new Set(library.map((g) => g.id));
  for (const r of rs) r.pokemon = Bet.megaName(draft, r, league.has(r.replay_id));
}
/** Every library game's rows, loaded once for Fantasy and Players: saved sheets, else guessed max HP (same as
    Main viewer; stays in % if the Pokédex won't load), luck when the move data loads. Also loads the draft. */
let leagueRows = null;
function loadLeague() {
  return leagueRows || (leagueRows = (async () => {
    await libraryReady;
    await loadDraft();
    // all games at once instead of waiting on each request in turn
    const loaded = await Promise.all(library.map(async (g) => {
      try {
        if (!cache.has(g.id)) cache.set(g.id, await RS.fetchReplay(g.id));
        await prepareIllusion(cache.get(g.id));
        return RS.gameRows(cache.get(g.id));
      } catch (e) { return []; }  // a game that won't load just isn't counted
    }));
    let dex = null;
    try { dex = await TS.loadDex(); } catch (e) { /* % only */ }
    const [smogon, pool] = await Promise.all([TS.loadSmogonHp("data/smogon_hp.json"), loadMockPool()]);
    const all = [];
    for (const rows of loaded) {
      if (rows.length) TS.attachSheets(rows, mockSheets.filter((s) => s.gameId === rows[0].replay_id));
      fillMaxHp(rows, dex, smogon, pool);
      all.push(...rows);
    }
    let moves = null;
    try { moves = await LK.loadMoves(); } catch (e) { /* luck stays blank */ }
    if (moves) moveInfo = moves;
    LK.addLuck(all, moves && dex ? { moves, dex } : null);
    megaNames(all);
    return all;
  })());
}
/** Forget everything counted from the league games (a Zoroark pick changed one), so Fantasy, Players and
    Pokémon count again on their next visit. Every cache built from loadLeague goes here. */
function invalidateLeague() {
  leagueRows = null;
  fantasyRows = null;
  players = null;
  mons = null;
}
/** Damage dealt for some rows: in HP when every row has it (~ when a guessed max HP went in), else in %. */
const rowsDealt = (rs) => amount(rs, ["damage_dealt_pct"]).text;
/** One spelling per player (Showdown names differ in case, spaces, draft aliases like DEJIME17): the draft's,
    else the first one seen. */
const shownNames = new Map();
function shownName(p) {
  const key = playerKey(p);
  if (!shownNames.has(key)) shownNames.set(key, (draft && Object.keys(draft.players || {}).find((d) => TS.toID(d) === key)) || p);
  return shownNames.get(key);
}
function playerKey(name) { return Bet.playerKey(draft, name); }
