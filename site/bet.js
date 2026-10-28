/* Gambling tab maths: records from league results, Pokémon fantasy points from game rows, draft costs.
   No DOM; loadable from Node. Play money only: nothing here takes or pays out anything. */
(function (root) {
  "use strict";
  const toID = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  /** A player's ID: their draft name's when the name is one of their other Showdown names (draft.aliases,
      {"DEJIME17": "DEJIME"}), else the name's own. Case and spaces never matter. */
  function playerKey(draft, name) {
    const alias = draft && Object.entries(draft.aliases || {}).find(([a]) => toID(a) === toID(name));
    return toID(alias ? alias[1] : name);
  }

  /** Win-loss records from library games ({players, winner}): [{id, name, wins, losses}], most wins first.
      Names ignore case and spaces, spelled as first seen; with a draft, a player's other Showdown names count as them. */
  function records(games, draft = null) {
    const byId = new Map();
    const get = (name) => {
      const id = playerKey(draft, name);
      if (!byId.has(id)) byId.set(id, { id, name, wins: 0, losses: 0 });
      return byId.get(id);
    };
    for (const g of games) {
      if (!g.winner) continue;
      for (const p of g.players) toID(p) === toID(g.winner) ? get(p).wins++ : get(p).losses++;
    }
    return [...byId.values()].sort((x, y) => y.wins - x.wins || x.losses - y.losses || x.name.localeCompare(y.name));
  }

  /** What a drafted entry cost: its own price ({pokemon, cost}: a league priced per Pokémon), else its tier's
      (draft.costs, {pokemon, tier}); null when neither is known. */
  function pickCost(draft, d) {
    if (typeof d.cost === "number") return d.cost;
    return (draft.costs && draft.costs[d.tier]) ?? null;
  }
  /** Whether the draft prices by tier (Nat Dex tiers on draft day) rather than per Pokémon. */
  const hasTiers = (draft) => !!draft && Object.keys(draft.costs || {}).length > 0;

  /** The drafted entry for a Pokémon seen in a game: same name, or the Mega that was drafted ("Swampert" -> "Swampert-Mega"),
      or the pool's only entry of that species in another form ("Enamorus" -> "Enamorus-Therian", "Sinistcha-Masterpiece" -> "Sinistcha").
      A player's other Showdown names map to their draft name through draft.aliases ({"DEJIME17": "DEJIME"}). */
  function drafted(draft, player, pokemon) {
    if (!draft || !draft.players) return null;
    const name = playerKey(draft, player);
    const pool = Object.entries(draft.players).find(([p]) => toID(p) === name);
    if (!pool) return null;
    const id = toID(pokemon);
    const species = (s) => toID(s.split("-")[0]);
    const sameSpecies = pool[1].filter((d) => species(d.pokemon) === species(pokemon));
    return pool[1].find((d) => toID(d.pokemon) === id) ||
      pool[1].find((d) => toID(d.pokemon).replace(/mega[xy]?$/, "") === id) ||
      (sameSpecies.length === 1 ? sameSpecies[0] : null);
  }

  /** The name a row counts under: a Mega is its own Pokémon, as in the draft (Latios is Zololab's, Latios-Mega
      weedinmyhonda's). In a league game, the Mega its player drafted, even in a game it didn't Mega Evolve; in any
      other game (or a Pokémon not drafted as a Mega), the Mega it turned into (row.mega_form), else its own name. */
  function megaName(draft, row, league) {
    const d = league ? drafted(draft, row.player, row.pokemon) : null;
    if (d && /-Mega/.test(d.pokemon) && toID(d.pokemon).startsWith(toID(row.pokemon))) return d.pokemon;
    return row.mega_form || row.pokemon;
  }

  const SCORING = { kill: 3, damagePer100: 1, survived: 1, won: 1 };

  /** Fantasy points per Pokémon per player, from RS.gameRows rows (brought Pokémon only), most points first.
      With a draft ({costs, players}), each gets its tier, cost and points per draft point. */
  function fantasy(rows, draft) {
    const by = new Map();
    for (const r of rows) {
      if (!r.brought) continue;
      const key = playerKey(draft, r.player) + "|" + r.pokemon;
      if (!by.has(key)) by.set(key, { pokemon: r.pokemon, player: r.player, games: 0, kills: 0, damage: 0, damageHp: 0, damageHpEst: false, survived: 0, wins: 0 });
      const f = by.get(key);
      f.games++;
      f.kills += r.kills;
      f.damage += Number(r.damage_dealt_pct) || 0;
      // in HP once every game has it (rows with max HP, ReplayStats.addDamageHp); "" otherwise
      f.damageHp = f.damageHp === "" || typeof r.damage_dealt_hp !== "number" ? "" : f.damageHp + r.damage_dealt_hp;
      if (r.hp_est && r.hp_est.damage_dealt_hp) f.damageHpEst = true;
      f.survived += r.survived;
      f.wins += r.won;
    }
    for (const f of by.values()) {
      f.points = Math.round((f.kills * SCORING.kill + f.damage / 100 * SCORING.damagePer100 +
        f.survived * SCORING.survived + f.wins * SCORING.won) * 10) / 10;
      f.perGame = Math.round(f.points / f.games * 10) / 10;
      const d = drafted(draft, f.player, f.pokemon);
      f.tier = d ? d.tier : "";
      f.cost = d ? pickCost(draft, d) : null;
      f.perCost = f.cost ? Math.round(f.points / f.cost * 10) / 10 : null;
    }
    return [...by.values()].sort((a, b) => b.points - a.points || b.kills - a.kills || a.pokemon.localeCompare(b.pokemon));
  }

  const Bet = { SCORING, playerKey, records, drafted, pickCost, hasTiers, megaName, fantasy };
  if (typeof module !== "undefined" && module.exports) module.exports = Bet;
  else root.Bet = Bet;
})(typeof globalThis !== "undefined" ? globalThis : this);
