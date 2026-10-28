/* Gambling tab (bet.js): records and Pokémon fantasy points with draft costs. */
"use strict";

let fantasyRows = null;  // every library game's rows, loaded the first time the tab opens
async function renderGambling() {
  await libraryReady;
  if (fantasyRows) return;
  fantasyRows = [];  // marks the tab as rendering, so a second click doesn't start it again
  await loadDraft();  // aliases: a player's other Showdown names (DEJIME17) count as them
  const saved = Bet.records(library, draft);
  // the bracket's records (tools/challonge_records.py); without them, the games saved here
  let bracket = null;
  // "no-cache": ask the server each time, so a new draft or record shows without waiting out the 10-minute browser cache
  try { bracket = await (await fetch("games/records.json", { cache: "no-cache" })).json(); } catch (e) { /* not there */ }
  const recs = bracket ? bracket.players : saved;
  simpleTable($("bet-ranks"), [["Player", ""], ["Won", "num"], ["Lost", "num"]],
    recs.map((p) => [[bracket ? p.name : shownName(p.name), ""], [String(p.wins), "num"], [String(p.losses), "num"]]));
  $("bet-records-note").textContent = bracket
    ? `From the bracket (Swiss rounds), ${bracket.updated}.`
    : `From the ${library.length} games saved here. The full bracket is under Games.`;
  const s = Bet.SCORING;
  const costs = draft && draft.costs ? Object.entries(draft.costs).map(([tier, c]) => `${tier} ${c}`).join(", ") : "the tier prices on the draft sheet";
  $("bet-scoring").textContent = `Each Pokémon on each player's team: ${s.kill} points a KO, ${s.damagePer100} per 100% damage dealt (a full health bar, shown in HP), ` +
    `${s.survived} for being alive at the end, ${s.won} when its team won. Cost is its draft price (${costs}, ` +
    `set by the tier on draft day); Per cost is points for each draft point spent. Top 20.`;
  $("bet-status").textContent = "Loading games…";
  fantasyRows = await loadLeague();
  const games = new Set(fantasyRows.map((r) => r.replay_id)).size;
  $("bet-status").textContent = (games < library.length ? `Counted ${games} of ${library.length} games (the rest didn't load). ` : "") +
    (draft ? "" : "Draft costs didn't load.");
  simpleTable($("bet-fantasy"), [["Pokémon", ""], ["Player", ""],
    ["Tier", "", "Its Nat Dex tier on draft day, from the draft sheet."],
    ["Cost", "num", `Draft points it cost: ${costs}.`],
    ["Games", "num", "Games it was brought to (not just shown at team preview)."],
    ["KOs", "num", DESCRIPTIONS.kills],
    ["Damage", "num", "Damage dealt in HP, from each target's max HP (team sheet, or a guess when marked ~). Points still count 1 per 100% of a Pokémon's health, so bulky targets don't count extra."],
    ["Points", "num", `${s.kill} a KO, ${s.damagePer100} per 100% damage, ${s.survived} for each game it was alive at the end, ${s.won} for each win.`],
    ["Per game", "num", "Points divided by games."], ["Per cost", "num", "Points for each draft point it cost."]],
    Bet.fantasy(fantasyRows, draft).slice(0, 20).map((f) => {
      const mon = el("span", "bet-mon");
      mon.append(sprite(f.pokemon, ["gen5/"], "tiny"), f.pokemon);
      return [[mon, ""], [shownName(f.player), ""], [f.tier || "–", ""], [f.cost ? String(f.cost) : "–", "num"], [String(f.games), "num"],
        [String(f.kills), "num"], [typeof f.damageHp === "number" ? (f.damageHpEst ? "~" : "") + f.damageHp + " HP" : pct(f.damage), "num"], [f.points.toFixed(1), "num"], [f.perGame.toFixed(1), "num"],
        [f.perCost ? f.perCost.toFixed(1) : "–", "num"]];
    }));
}
