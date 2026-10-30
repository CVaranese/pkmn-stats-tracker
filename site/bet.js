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
    // one the sheet no longer lists because it was traded away still counts as theirs (its games before the trade)
    return matchEntry(pool[1], pokemon) || matchEntry(tradedAway(draft, name), pokemon);
  }
  function matchEntry(entries, pokemon) {
    const id = toID(pokemon);
    const species = (s) => toID(s.split("-")[0]);
    const sameSpecies = entries.filter((d) => species(d.pokemon) === species(pokemon));
    return entries.find((d) => toID(d.pokemon) === id) ||
      entries.find((d) => toID(d.pokemon).replace(/mega[xy]?$/, "") === id) ||
      (sameSpecies.length === 1 ? sameSpecies[0] : null);
  }

  /** A player's trades (draft.trades, keyed by any of their names; "_note" skipped), in the order given. A trade's
      out / in may name several Pokémon ("A, B": a free-agent move); in may be empty (not known yet). Each:
      {out: [names], in: [names], after}. */
  function trades(draft, player) {
    const key = playerKey(draft, player);
    const list = Object.entries((draft && draft.trades) || {}).find(([p]) => p !== "_note" && playerKey(draft, p) === key);
    const names = (s) => String(s || "").split(",").map((x) => x.trim()).filter(Boolean);
    return list ? list[1].map((t) => ({ out: names(t.out), in: names(t.in), after: t.after })) : [];
  }
  // entries for the traded-away Pokémon the sheet no longer lists (tier and cost not known); the same objects each time
  const awayCache = new WeakMap();
  function tradedAway(draft, key) {
    if (!awayCache.has(draft)) awayCache.set(draft, new Map());
    const byKey = awayCache.get(draft);
    if (!byKey.has(key)) {
      const pool = (Object.entries(draft.players || {}).find(([p]) => toID(p) === key) || [, []])[1];
      const out = [...new Set(trades(draft, key).flatMap((t) => t.out))];
      byKey.set(key, out.filter((m) => !pool.some((d) => toID(d.pokemon) === toID(m))).map((pokemon) => ({ pokemon, tier: null })));
    }
    return byKey.get(key);
  }

  /** A player's draft with their trades: every Pokémon on the sheet, then each traded-away one the sheet no longer
      lists. Each: the sheet's entry ({pokemon, tier | cost}) with trade: null, or {label: "Traded away" | "Traded in",
      title, away (true when traded away)} from the last trade naming it (a Pokémon traded in and later out is away).
      Also the trades (as trades()) and the draft points spent on the Pokémon still held. null when the player has
      no pool. */
  function draftPool(draft, player) {
    const key = playerKey(draft, player);
    const entry = Object.entries((draft && draft.players) || {}).find(([p]) => toID(p) === key);
    if (!entry) return null;
    const ts = trades(draft, key);
    const list = (names) => (names.length ? names.join(", ") : "(not known yet)");
    // names as typed in the trades may differ from the sheet's in case and spacing
    const has = (names, mon) => names.some((x) => toID(x) === toID(mon));
    const tradeOf = (mon) => {
      let got = null;
      for (const t of ts) {
        if (has(t.out, mon)) got = { label: "Traded away", title: `Traded for ${list(t.in)} after ${t.after}`, away: true };
        else if (has(t.in, mon)) got = { label: "Traded in", title: `Came in for ${list(t.out)} after ${t.after}`, away: false };
      }
      return got;
    };
    const pool = [...entry[1], ...tradedAway(draft, key)].map((d) => ({ entry: d, trade: tradeOf(d.pokemon) }));
    const spent = pool.filter((p) => !(p.trade && p.trade.away)).reduce((t, p) => t + (pickCost(draft, p.entry) || 0), 0);
    return { name: entry[0], pool, trades: ts, spent };
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
      f.tier = (d && d.tier) || "";
      f.cost = d ? pickCost(draft, d) : null;
      f.perCost = f.cost ? Math.round(f.points / f.cost * 10) / 10 : null;
    }
    return [...by.values()].sort((a, b) => b.points - a.points || b.kills - a.kills || a.pokemon.localeCompare(b.pokemon));
  }

  // ---------- weekly bets (shown, not yet bettable; the pool and its plans: docs/BETTING_PROPS.md) ----------

  // the bets the site can settle by itself from game rows (gameRows, one game's rows each). An over / under ("ou")
  // adds up a number per game (count) and gets a line from other weeks; a yes / no ("yn") looks for one row or game
  // that makes it Yes (find: [the row or game it found, what it says] or null)
  const team = (rs, r) => rs.filter((x) => x.player === r.player);
  const anyRow = (test, say) => (games) => {
    for (const rs of games) for (const r of rs) if (test(r, rs)) return say(r, rs);
    return null;
  };
  const mon = (r) => `${r.pokemon} (${r.player})`;
  const winners = (rs) => rs.filter((r) => r.won);
  const PROPS = [
    { id: "crits", kind: "ou", text: "Critical hits", count: (rs) => sumOf(rs, "crits") },
    { id: "misses", kind: "ou", text: "Moves that missed", count: (rs) => sumOf(rs, "misses") },
    { id: "sleep", kind: "ou", text: "Turns spent asleep", count: (rs) => sumOf(rs, "sleep_turns") },
    { id: "procs", kind: "ou", text: "Secondary effects landed (burns, stat drops, flinches...)", count: (rs) => sumOf(rs, "procs") },
    { id: "kos", kind: "ou", text: "KOs", count: (rs) => sumOf(rs, "kills") },
    { id: "kobm", kind: "ou", text: "Pokémon KO'd before they moved", count: (rs) => sumOf(rs, "ko_before_moving") },
    { id: "hazards", kind: "ou", text: "Hazards set", count: (rs) => sumOf(rs, "hazards_set") },
    { id: "cleared", kind: "ou", text: "Hazards cleared", count: (rs) => sumOf(rs, "hazards_removed") },
    { id: "statuses", kind: "ou", text: "Statuses inflicted", count: (rs) => sumOf(rs, "statuses_inflicted") },
    { id: "switches", kind: "ou", text: "Switches", count: (rs) => sumOf(rs, "switches") },
    { id: "pivots", kind: "ou", text: "Pivots (U-turn, Volt Switch, Flip Turn...)", count: (rs) => sumOf(rs, "pivots") },
    { id: "megas", kind: "ou", text: "Mega Evolutions", count: (rs) => sumOf(rs, "mega") },
    { id: "turns", kind: "ou", text: "Turns played (all games added up)", count: (rs) => (rs[0] ? rs[0].turns : 0) },
    { id: "fourko", kind: "yn", text: "A Pokémon gets 4 or more KOs in one game",
      find: anyRow((r) => r.kills >= 4, (r) => `${mon(r)}, ${r.kills} KOs`) },
    { id: "kobm1", kind: "yn", text: "A Pokémon is KO'd before it ever moves",
      find: anyRow((r) => r.ko_before_moving > 0, (r) => mon(r)) },
    { id: "passive", kind: "yn", text: "A KO from burn, poison, hazards or weather",
      find: anyRow((r) => r.passive_kills > 0, (r) => mon(r)) },
    { id: "hazardko", kind: "yn", text: "A KO from hazards", find: anyRow((r) => r.hazard_kills > 0, (r) => mon(r)) },
    { id: "selfko", kind: "yn", text: "A Pokémon KOs itself (Explosion, Memento, recoil...)", find: anyRow((r) => r.self_kos > 0, (r) => mon(r)) },
    { id: "tank", kind: "yn", text: "A Pokémon takes over 300% damage and is still standing",
      find: anyRow((r) => r.survived && r.damage_taken_pct > 300, (r) => `${mon(r)}, ${Math.round(r.damage_taken_pct)}%`) },
    { id: "forced", kind: "yn", text: "A Pokémon is forced out (Roar, Whirlwind, Dragon Tail, Red Card)",
      find: anyRow((r) => r.forced_out > 0, (r) => mon(r)) },
    { id: "confused", kind: "yn", text: "A Pokémon hurts itself in its confusion", find: anyRow((r) => r.confusion_hits > 0, (r) => mon(r)) },
    { id: "parax2", kind: "yn", text: "A Pokémon is fully paralyzed twice in one game", find: anyRow((r) => r.full_paras >= 2, (r) => mon(r)) },
    { id: "zmove", kind: "yn", text: "A Z-move is used", find: anyRow((r) => !!r.z_move, (r) => `${r.z_move}, ${mon(r)}`) },
    { id: "benched", kind: "yn", text: "A Pokémon is brought and never comes in",
      find: anyRow((r) => r.brought && !r.mon_key, (r) => mon(r)) },
    { id: "forfeit", kind: "yn", text: "A game ends in a forfeit",
      find: anyRow((r) => r.end_reason === "forfeit" && r.won, (r) => `${r.opponent} forfeited to ${r.player}`) },
    { id: "timer", kind: "yn", text: "Someone turns the battle timer on", find: anyRow((r) => r.timer_on, (r) => r.player) },
    { id: "sixzero", kind: "yn", text: "A 6–0: the winner loses no Pokémon",
      find: anyRow((r, rs) => r.won && r.end_reason === "normal" && sumOf(team(rs, r), "deaths") === 0, (r) => `${r.player} over ${r.opponent}`) },
    // standing at the end, not brought minus faints: one Revival Blessing brought back counts as left
    { id: "lastmon", kind: "yn", text: "A win with only one Pokémon left",
      find: anyRow((r, rs) => r.won && r.end_reason === "normal" &&
        team(rs, r).filter((x) => x.brought && x.survived).length === 1, (r) => `${r.player} over ${r.opponent}`) },
    { id: "comeback", kind: "yn", text: "A comeback from 30% or more behind on team HP",
      find: anyRow((r) => r.won && comebackGap(r) >= 30, (r) => `${r.player}, from ${Math.round(comebackGap(r))}% behind`) },
  ];
  function sumOf(rs, f) { return rs.reduce((t, r) => t + (typeof r[f] === "number" ? r[f] : 0), 0); }
  /** How far behind on team HP share the winner was at its worst turn end (0 if never behind): League.comeback. */
  const comebackGap = (r) => (root.League || require("./league.js")).comeback(r).gap;
  /** A number from text (FNV-1a), then a small seeded random (mulberry32): the same draw for everyone. */
  function seeded(text) {
    let h = 2166136261;
    for (const c of String(text)) { h ^= c.codePointAt(0); h = Math.imul(h, 16777619); }
    let a = h >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  /** The week's bets: n drawn from PROPS by seed (league id + week), in the order drawn. weeks: { week: [game rows of
      each game] } for the whole league; lines from the earlier weeks (any other week when there are none: week 1),
      per game, times the games the week has (planned: { week: how many }, else the games in weeks), rounded to the
      half below (x.5: no push). Each: { id, kind, text, line, result: { value, outcome: "Over" | "Under" | "Yes" |
      "No" | null, detail, final } (null until the week has games) }. Before all the week's games are in, a bet
      settles only when no later game can change it (Over passed, a Yes found): else outcome null, final false. */
  function weeklyBets(seed, week, weeks, n = 6, planned = {}) {
    const rand = seeded(seed + "|" + week);
    const pool = PROPS.slice();
    const picked = [];
    while (picked.length < n && pool.length) picked.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
    const names = Object.keys(weeks);
    const at = names.indexOf(week);
    const earlier = names.slice(0, Math.max(0, at)).filter((w) => weeks[w].length);
    const base = earlier.length ? earlier : names.filter((w) => w !== week && weeks[w].length);
    const games = weeks[week] || [];
    const due = Math.max(games.length, planned[week] || 0);
    const complete = games.length >= due;
    return picked.map((p) => {
      const bet = { id: p.id, kind: p.kind, text: p.text, line: null, result: null };
      if (p.kind === "ou") {
        const past = base.flatMap((w) => weeks[w]);
        const perGame = past.length ? past.reduce((t, rs) => t + p.count(rs), 0) / past.length : 0;
        bet.line = Math.floor(perGame * Math.max(1, due)) + 0.5;
        if (games.length) {
          // counts only go up: Over is final at once, Under once every game is in
          const value = games.reduce((t, rs) => t + p.count(rs), 0);
          const outcome = value > bet.line ? "Over" : complete ? "Under" : null;
          bet.result = { value, outcome, detail: String(value), final: !!outcome };
        }
      } else if (games.length) {
        const hit = p.find(games);
        const outcome = hit ? "Yes" : complete ? "No" : null;
        bet.result = { value: hit ? 1 : 0, outcome, detail: hit || "", final: !!outcome };
      }
      return bet;
    });
  }

  // the formats whose bet lines are worked out (docs/BETTING_PROPS.md); a league of another format shows no bets
  const BET_FORMATS = ["gen9nationaldex"];

  const Bet = { SCORING, PROPS, BET_FORMATS, weeklyBets, playerKey, records, drafted, trades, draftPool, pickCost, hasTiers, megaName, fantasy };
  if (typeof module !== "undefined" && module.exports) module.exports = Bet;
  else root.Bet = Bet;
})(typeof globalThis !== "undefined" ? globalThis : this);
