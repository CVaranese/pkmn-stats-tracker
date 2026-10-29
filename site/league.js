/* Season maths and display text from game rows (ReplayStats.gameRows): HP-or-% amounts, season move totals, luck
   totals, best move, sprite file names, sets and standings, share links. No DOM; loadable from Node. The page (app/*.js) renders with these. */
(function (root) {
  "use strict";
  const toID = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  // a % field and its HP twin (filled once max HP is known: ReplayStats.addDamageHp)
  const PCT_TO_HP = { damage_dealt_pct: "damage_dealt_hp", damage_taken_pct: "damage_taken_hp",
    hazard_damage_pct: "hazard_damage_hp", healing_pct: "healing_hp", healing_given_pct: "healing_given_hp",
    status_damage_pct: "status_damage_hp" };

  const pct = (v) => (typeof v === "number" ? Math.round(v) + "%" : "–");
  const sum = (rs, f) => rs.reduce((t, r) => t + (typeof r[f] === "number" ? r[f] : 0), 0);

  /** Some rows' amount of one or more % fields added up (damage dealt; healing + healing given...): in HP when every
      row has the HP figure of every field, "~" in front when a guessed max HP went in; else in %. Both side by side
      was clutter (user 2026-10-27). { text, hp }: hp true when the text is in HP. */
  function amount(rs, pctFields) {
    const hp = rs.length > 0 && rs.every((r) => pctFields.every((f) => typeof r[PCT_TO_HP[f]] === "number"));
    if (!hp) return { text: pct(pctFields.reduce((t, f) => t + sum(rs, f), 0)), hp: false };
    const guess = rs.some((r) => pctFields.some((f) => r.hp_est && r.hp_est[PCT_TO_HP[f]]));
    return { text: (guess ? "~" : "") + Math.round(pctFields.reduce((t, f) => t + sum(rs, PCT_TO_HP[f]), 0)) + " HP", hp: true };
  }
  /** One move's damage (a move_stats entry): HP when known, else %. */
  const moveDealt = (m) => (typeof m.dealt_hp === "number" ? (m.dealt_hp_est ? "~" : "") + m.dealt_hp + " HP" : pct(m.dealt_pct));

  /** Season luck on one scale whatever the games and rolls: the total over the spread those rolls could have given
      (each roll with chance p adds variance p(1 - p); luck.js puts it on rows next to the score), so z is a normal
      z: within +-0.67 is the middle half of seasons. rows: one per game; luckField / varField name the score and its
      variance (player_luck / player_luck_var, or a Pokémon's luck / luck_var). { z, total, sd, games }, or "" when no
      game has a score. */
  function seasonLuck(rows, luckField, varField) {
    const v = rows.filter((r) => typeof r[luckField] === "number");
    if (!v.length) return "";
    const total = v.reduce((t, r) => t + r[luckField], 0);
    const sd = Math.sqrt(v.reduce((t, r) => t + (typeof r[varField] === "number" ? r[varField] : 0), 0));
    const round2 = (x) => Math.round(x * 100) / 100;
    return { z: sd > 0 ? round2(total / sd) : 0, total: round2(total), sd: round2(sd), games: v.length };
  }

  /** Who KO'd whom: [{ killer, victim }] game rows, from each row's kos_dealt (the victims' mon keys in that game). */
  function koPairs(rows) {
    const byKey = new Map(rows.filter((r) => r.mon_key).map((r) => [r.replay_id + "|" + r.mon_key, r]));
    const out = [];
    for (const r of rows) {
      for (const v of r.kos_dealt || []) {
        const victim = byKey.get(r.replay_id + "|" + v);
        if (victim) out.push({ killer: r, victim });
      }
    }
    return out;
  }

  /** Share of a normal at or below z (Abramowitz-Stegun 7.1.26, error under 2e-7): how often luck comes out this
      low or lower. */
  function normalCdf(z) {
    const x = Math.abs(z) / Math.SQRT2, t = 1 / (1 + 0.3275911 * x);
    const erf = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return z >= 0 ? (1 + erf) / 2 : (1 - erf) / 2;
  }

  /** Its moves added up over some games, in the shape of a row's move_stats: HP only when every game with that
      move has it. Moves first (most damage), then damage sources, then unnamed damage. */
  function seasonMoves(rs) {
    const by = new Map();
    for (const r of rs) {
      for (const m of r.move_stats || []) {
        if (!by.has(m.move)) by.set(m.move, { move: m.move, source: m.source, z: false, uses: 0, dealt_pct: 0, kos: 0, dealt_hp: 0, dealt_hp_est: false });
        const s = by.get(m.move);
        s.z = s.z || m.z;
        s.uses += m.uses;
        s.dealt_pct += m.dealt_pct;
        s.kos += m.kos;
        s.dealt_hp = s.dealt_hp === "" || typeof m.dealt_hp !== "number" ? "" : s.dealt_hp + m.dealt_hp;
        s.dealt_hp_est = s.dealt_hp_est || !!m.dealt_hp_est;
      }
    }
    return [...by.values()].sort((a, b) => (a.move === "") - (b.move === "") || a.source - b.source ||
      b.dealt_pct - a.dealt_pct || b.kos - a.kos || b.uses - a.uses);
  }

  /** Damage dealt in HP for sorting: a game with no HP figure counts its % at avgHp (the league's average max HP),
      so a Pokémon with one such game still sorts among the others (it shows in %). */
  const dealtKey = (rs, avgHp) => rs.reduce((t, r) => t + (typeof r.damage_dealt_hp === "number" ? r.damage_dealt_hp : (r.damage_dealt_pct * avgHp) / 100), 0);

  /** The move that did the most damage (ties: more KOs); null when no move did damage. */
  function bestMove(r) {
    const used = (r.move_stats || []).filter((m) => m.move && !m.source && (m.dealt_pct > 0 || m.kos > 0));
    return used.sort((a, b) => b.dealt_pct - a.dealt_pct || b.kos - a.kos)[0] || null;
  }

  // names whose hyphen is part of the species, not a form ("Ho-Oh" is hooh, "Urshifu-Rapid-Strike" is urshifu-rapidstrike)
  const HYPHEN_NAMES = new Set(["hooh", "porygonz", "jangmoo", "hakamoo", "kommoo", "wochien", "chienpao", "tinglu", "chiyu",
    "nidoranf", "nidoranm"]);
  /** Showdown's sprite file name for a species: "Charizard-Mega-X" -> "charizard-megax". */
  function spriteId(species) {
    const parts = species.replace(/-\*$/, "").split("-");  // team preview's "Zamazenta-*": form not shown yet
    let base = parts.shift();
    if (parts.length && HYPHEN_NAMES.has(toID(base + parts[0]))) base += parts.shift();
    return toID(base) + (parts.length ? "-" + toID(parts.join("")) : "");
  }

  /** Sets (a best of three, a playoff series), each set's games in the order given (the library's: as played).
      A game labelled with a set (index.json `set`, from tools/add_game.py --set) goes with the other games of that
      label. Unlabelled games in a league that plays sets (bestOf, e.g. 3) are grouped by guess: a week's games
      between the same two players; the guess is marked unclear when it can't be one set (more games than bestOf, or
      a game after someone had already won). Otherwise (bestOf 0) every unlabelled game is a set of one. keyOf gives
      one id per player (case, spaces, draft aliases). Each set: {key, week, players, games, wins (per player, in
      players' order), winner ("" while level), labelled, unclear}. */
  function sets(games, keyOf = toID, bestOf = 0) {
    const by = new Map();
    for (const g of games) {
      const pair = g.players.map(keyOf).sort().join("|");
      const key = g.set ? "set|" + g.set : bestOf ? g.week + "|" + pair : "game|" + g.id;
      if (!by.has(key)) by.set(key, { key, week: g.week, players: g.players.slice(), games: [], labelled: !!g.set });
      by.get(key).games.push(g);
    }
    for (const s of by.values()) {
      s.wins = s.players.map((p) => s.games.filter((g) => g.winner && keyOf(g.winner) === keyOf(p)).length);
      s.winner = s.wins[0] === s.wins[1] ? "" : s.players[s.wins[0] > s.wins[1] ? 0 : 1];
      // a guessed set that can't be one: too many games, or played on after someone reached the wins needed
      const need = Math.floor(bestOf / 2) + 1, tally = [0, 0];
      let playedOn = false;
      for (const g of s.games) {
        if (Math.max(...tally) >= need) playedOn = true;
        const w = g.winner ? s.players.findIndex((p) => keyOf(p) === keyOf(g.winner)) : -1;
        if (w >= 0) tally[w]++;
      }
      s.unclear = !s.labelled && s.games.length > 1 && (s.games.length > bestOf || playedOn);
    }
    return [...by.values()];
  }

  /** A set's game slots in a league that plays sets (bestOf): its saved games, its missing ones (s.missing, from
      index.json `missing`: {game (its number, or null), winner}) at their game number, and "not played" up to bestOf,
      so a 2–0 shows as many rows as a 2–1. Each slot: {n, game} (a saved game) or {n, kind: "missing" | "unplayed",
      winner}. Also the set score with the missing games' winners ({...s, wins, winner}), how many missing games have
      no known winner, whether the set has no game number at all (unknownSet), and how many games were played. */
  function setSlots(s, bestOf, keyOf = toID) {
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
    const winnerOf = (sl) => (sl.game ? sl.game.winner : sl.winner);
    const wins = s.players.map((p) => slots.filter((sl) => winnerOf(sl) && keyOf(winnerOf(sl)) === keyOf(p)).length);
    const w = wins.findIndex((n) => n > bestOf / 2);
    const unknown = slots.filter((sl) => sl.kind === "missing" && !sl.winner).length;
    return { slots, score: { ...s, wins, winner: w >= 0 ? s.players[w] : "" }, unknown, unknownSet,
      played: slots.filter((sl) => sl.game || sl.kind === "missing").length };
  }

  /** Each player's points for a decided set (score: setSlots' score, players' order), from the league's scale
      [won without dropping a game, won, lost taking a game, lost without one] (Super Champions: [3, 2, 1, 0]). [0, 0]
      while the set has no winner. */
  function setPoints(score, scale) {
    if (!score.winner || !scale) return [0, 0];
    const w = score.players.indexOf(score.winner), l = 1 - w;
    const out = [0, 0];
    out[w] = score.wins[l] ? scale[1] : scale[0];
    out[l] = score.wins[l] ? scale[2] : scale[3];
    return out;
  }

  /** Standings. players: [{key (keyOf of their name), name, wins, losses, setWins, setLosses, points (with byPoints),
      rows (their game rows, for KOs and Pokémon lost)}]; sets: with winners (sets / setSlots' score). A league that
      plays sets (bestOf > 0, a round robin): set points first when the league scores them (byPoints), then sets won,
      then fewer sets lost, then game difference, then games won, then head to head (sets won among the players still
      tied, counted again for each group of tied players), then KOs minus Pokémon lost, then name. Otherwise: games
      won, then fewer lost, then KOs, then name. A new array, best first. */
  function standings(players, sets, keyOf = toID, bestOf = 0, byPoints = false) {
    const kills = (pl) => sum(pl.rows || [], "kills"), kd = (pl) => kills(pl) - sum(pl.rows || [], "deaths");
    if (!bestOf) return [...players].sort((a, b) => b.wins - a.wins || a.losses - b.losses || kills(b) - kills(a) || a.name.localeCompare(b.name));
    const base = (a, b) => (byPoints ? (b.points || 0) - (a.points || 0) : 0) || b.setWins - a.setWins ||
      a.setLosses - b.setLosses || (b.wins - b.losses) - (a.wins - a.losses) || b.wins - a.wins;
    const sorted = [...players].sort(base);
    const out = [];
    for (let i = 0; i < sorted.length;) {
      let j = i + 1;
      while (j < sorted.length && !base(sorted[i], sorted[j])) j++;
      const tied = sorted.slice(i, j), keys = new Set(tied.map((pl) => pl.key));
      const h2h = new Map(tied.map((pl) => [pl.key, 0]));
      for (const s of sets) {
        if (s.winner && s.players.every((p) => keys.has(keyOf(p)))) h2h.set(keyOf(s.winner), h2h.get(keyOf(s.winner)) + 1);
      }
      out.push(...tied.sort((a, b) => h2h.get(b.key) - h2h.get(a.key) || kd(b) - kd(a) || a.name.localeCompare(b.name)));
      i = j;
    }
    return out;
  }

  const STAT_SHORT = [["hp", "HP"], ["atk", "Atk"], ["def", "Def"], ["spa", "SpA"], ["spd", "SpD"], ["spe", "Spe"]];
  /** A sheet set's nature and EVs as the export writes them ("Timid, 4 HP / 252 SpA / 252 Spe"); "" when neither is
      known (a set pieced together from a game has no EVs line). */
  function spreadText(set) {
    const evs = set.evsListed === false ? "" : STAT_SHORT.filter(([k]) => set.evs[k]).map(([k, s]) => `${set.evs[k]} ${s}`).join(" / ");
    return [set.nature, evs].filter(Boolean).join(", ");
  }
  /** A sheet set as Showdown's teambuilder imports it (species, no nickname; level, EVs, IVs only when given / not
      the default). What teams.js doesn't keep (Tera Type, Shiny, Happiness) isn't in it. */
  function setText(set) {
    const stats = (o, skip) => STAT_SHORT.filter(([k]) => k in o && o[k] !== skip).map(([k, s]) => `${o[k]} ${s}`).join(" / ");
    const evs = set.evsListed === false ? "" : stats(set.evs || {}, 0);
    const ivs = stats(set.ivs || {}, 31);
    return [
      set.species + (set.gender ? ` (${set.gender})` : "") + (set.item ? ` @ ${set.item}` : ""),
      set.ability && `Ability: ${set.ability}`,
      set.level && set.level !== 100 && `Level: ${set.level}`,
      evs && `EVs: ${evs}`,
      set.nature && `${set.nature} Nature`,
      ivs && `IVs: ${ivs}`,
      ...(set.moves || []).map((mv) => `- ${mv}`),
    ].filter(Boolean).join("\n");
  }

  /** The sets a Pokémon was used with: rows (one Pokémon's games, in the order played) that have a sheet set
      (row.set, from teams.js), grouped by player (keyOf) and set (item, ability, nature, EVs, the same moves in any
      order). Each: {player (the first row's), set (the first game's), from ("sheet", or "pieced" when any game's came
      from a hand-made set), games, weeks (weekOf(row), each once, in order)}, most games first. Rows with no set
      aren't counted. */
  function monSets(rows, keyOf = toID, weekOf = (r) => r.replay_id) {
    const by = new Map();
    for (const r of rows) {
      const s = r.set;
      if (!s) continue;
      const key = [keyOf(r.player), toID(s.item), toID(s.ability), spreadText(s), s.moves.map(toID).sort().join(",")].join("|");
      if (!by.has(key)) by.set(key, { player: r.player, set: s, from: "sheet", games: 0, weeks: [] });
      const g = by.get(key);
      g.games++;
      if (r.set_from === "pieced") g.from = "pieced";
      const w = weekOf(r);
      if (w && !g.weeks.includes(w)) g.weeks.push(w);
    }
    return [...by.values()].sort((a, b) => b.games - a.games);
  }

  /** Awards over some games (a week, or the season so far). rows: those games' rows, every Pokémon (brought or not);
      keyOf: one key per player (draft aliases). Each award: { id, title, how, winners: [{ player, pokemon (none for
      player awards), value (text), game (replay id; none for a player's whole week) }] }, ties all listed; an award no
      game qualifies for is left out. In this order: Top Pokémon (best Performance in a game), Most KOs, Most damage,
      Wall (most damage taken by one that was still standing at the end), Biggest comeback (the winner furthest behind on HP share at a turn's end),
      Quickest win (fewest turns, forfeits and timeouts left out). */
  function awards(rows, keyOf = toID) {
    const brought = rows.filter((r) => r.brought);
    const out = [];
    const best = (list, score) => {
      const vals = list.map(score).filter((v) => typeof v === "number" && isFinite(v));
      if (!vals.length) return [];
      const top = Math.max(...vals);
      return list.filter((x) => score(x) === top);
    };
    const mon = (r, value) => ({ player: r.player, pokemon: r.pokemon, value, game: r.replay_id });
    const add = (id, title, how, winners) => { if (winners.length) out.push({ id, title, how, winners }); };
    add("top", "Top Pokémon", "Best Performance in one game (the MVP score: damage, KOs, healing, staying alive).",
      best(brought, (r) => r.mvp_score).map((r) => mon(r, `Performance ${r.mvp_score}`)));
    add("kos", "Most KOs", "Most KOs in one game.",
      best(brought.filter((r) => r.kills > 0), (r) => r.kills).map((r) => mon(r, `${r.kills} KO${r.kills > 1 ? "s" : ""}`)));
    add("damage", "Most damage", "Most damage dealt in one game (% of a full health bar, so bulky and frail targets count the same).",
      best(brought.filter((r) => r.damage_dealt_pct > 0), (r) => r.damage_dealt_pct).map((r) => mon(r, amount([r], ["damage_dealt_pct"]).text)));
    add("wall", "Wall", "Most damage taken in one game by a Pokémon still standing at the end.",
      best(brought.filter((r) => r.survived && r.damage_taken_pct > 0), (r) => r.damage_taken_pct)
        .map((r) => mon(r, amount([r], ["damage_taken_pct"]).text + " taken")));
    // (Luckiest / Unluckiest player were here: a player's luck is theirs minus their opponent's, so the two were
    // always the two sides of one game; user 2026-10-29. Luckiest / Unluckiest Pokémon are among awardIdeas.)
    // comeback: per game, the winner's lowest HP share minus the loser's at a turn's end
    const games = new Map();
    for (const r of rows) if (r.won && !games.has(r.replay_id)) games.set(r.replay_id, r);
    const comebacks = [...games.values()].map((r) => {
      const other = r.side === "p1" ? "p2" : "p1";
      let worst = 0, turn = null;
      for (const pt of r.momentum || []) {
        const gap = pt[r.side].hp - pt[other].hp;
        if (gap < worst) { worst = gap; turn = pt.turn; }
      }
      return { r, worst, turn };
    }).filter((c) => c.worst < 0);
    add("comeback", "Biggest comeback", "The winner furthest behind: their team's HP share minus the other team's, at the end of a turn.",
      best(comebacks, (c) => -c.worst).map((c) => ({ player: c.r.player, value: `won from ${Math.round(-c.worst)}% behind (turn ${c.turn})`,
        game: c.r.replay_id })));
    const wins = [...games.values()].filter((r) => r.end_reason === "normal" && r.turns > 0);
    add("quick", "Quickest win", "Fewest turns to win a game that was played out (no forfeit or timeout).",
      best(wins, (r) => -r.turns).map((r) => ({ player: r.player, value: `${r.turns} turns`, game: r.replay_id })));
    return out;
  }

  /** Award ideas on trial (user 2026-10-29: picks the good ones from the page), numbered n as brainstormed; the same
      shape as awards(). Pokémon ones are the best single game; player ones a player's whole team in one game; game
      ones the game. Ties all listed; an idea no game qualifies for is left out. */
  function awardIdeas(rows, keyOf = toID) {
    const brought = rows.filter((r) => r.brought);
    const out = [];
    const best = (list, score) => {
      const vals = list.map(score).filter((v) => typeof v === "number" && isFinite(v));
      if (!vals.length) return [];
      const top = Math.max(...vals);
      return list.filter((x) => score(x) === top);
    };
    const add = (n, id, title, how, winners) => { if (winners.length) out.push({ n, id, title, how, winners }); };
    const plural = (k, one, many = one + "s") => `${k} ${k === 1 ? one : many}`;
    // a Pokémon idea: the most of score (above 0) in one game
    const mons = (n, id, title, how, score, text) => add(n, id, title, how,
      best(brought.filter((r) => score(r) > 0), score).map((r) => ({ player: r.player, pokemon: r.pokemon, value: text(r), game: r.replay_id })));
    const z = (r) => (typeof r.luck === "number" && r.luck_var > 0 ? r.luck / Math.sqrt(r.luck_var) : null);
    const zText = (r) => `${z(r) > 0 ? "+" : "−"}${Math.abs(z(r)).toFixed(1)} on the luck scale`;
    mons(1, "mon-lucky", "Luckiest Pokémon", "Its own rolls in one game (crits, misses, paralysis, effects...) against what they could have given.", z, zText);
    mons(2, "mon-unlucky", "Unluckiest Pokémon", "The other end of the same scale, one Pokémon's own rolls.", (r) => (z(r) === null ? null : -z(r)), zText);
    mons(3, "crits", "Crit machine", "Most critical hits landed in one game.", (r) => r.crits, (r) => plural(r.crits, "crit"));
    mons(4, "misses", "Butterfingers", "Most moves missed in one game.", (r) => r.misses, (r) => plural(r.misses, "miss", "misses"));
    mons(5, "dodges", "Untouchable", "Most moves aimed at it that missed, in one game.", (r) => r.dodges, (r) => plural(r.dodges, "dodge"));
    mons(6, "sleep", "Sleepyhead", "Most turns asleep in one game.", (r) => r.sleep_turns, (r) => plural(r.sleep_turns, "turn") + " asleep");
    mons(7, "para", "Stuck in place", "Most turns fully paralyzed in one game.", (r) => r.full_paras, (r) => plural(r.full_paras, "full para"));
    mons(8, "confused", "Hurt itself in its confusion", "Most hits on itself from confusion in one game.", (r) => r.confusion_hits, (r) => plural(r.confusion_hits, "time"));
    mons(9, "flinch", "Flinch magnet", "Most flinches in one game.", (r) => r.flinched, (r) => plural(r.flinched, "flinch", "flinches"));
    mons(10, "hazard", "Hazard king", "Most damage from the hazards it set, in one game.", (r) => r.hazard_damage_pct, (r) => amount([r], ["hazard_damage_pct"]).text);
    mons(11, "janitor", "Janitor", "Most hazards cleared off its side in one game (Defog, Rapid Spin...).", (r) => r.hazards_removed, (r) => plural(r.hazards_removed, "clear"));
    mons(12, "medic", "Medic", "Most healing in one game, its own and given to teammates.", (r) => (r.healing_pct || 0) + (r.healing_given_pct || 0),
      (r) => amount([r], ["healing_pct", "healing_given_pct"]).text + " healed");
    mons(13, "status", "Plague doctor", "Most statuses put on the other team in one game.", (r) => r.statuses_inflicted, (r) => plural(r.statuses_inflicted, "status", "statuses"));
    mons(14, "pivot", "Pivot master", "Most exits by U-turn, Volt Switch, Flip Turn, Parting Shot... in one game.", (r) => r.pivots, (r) => plural(r.pivots, "pivot"));
    mons(15, "ironman", "Iron man", "Most turns on the field in one game.", (r) => r.turns_on_field, (r) => plural(r.turns_on_field, "turn") + " on the field");
    mons(16, "oneanddone", "One and done", "Knocked out before it got to move, most times in one game.", (r) => r.ko_before_moving, (r) => "KO'd before moving" + (r.ko_before_moving > 1 ? ` ×${r.ko_before_moving}` : ""));
    mons(17, "passive", "Passive aggressive", "Most KOs from burn, poison, hazards and the like in one game.", (r) => r.passive_kills, (r) => plural(r.passive_kills, "passive KO"));
    // player ideas: a player's team in one game
    const teams = new Map();
    for (const r of rows) {
      const k = r.replay_id + "|" + keyOf(r.player);
      if (!teams.has(k)) teams.set(k, { player: r.player, game: r.replay_id, won: r.won, end: r.end_reason, info: r.info_revealed_pct, rows: [] });
      teams.get(k).rows.push(r);
    }
    const ts = [...teams.values()];
    const team = (n, id, title, how, list, score, text) => add(n, id, title, how,
      best(list, score).map((t) => ({ player: t.player, value: text(t), game: t.game })));
    team(18, "switches", "Revolving door", "Most switches by one player's team in one game.", ts.filter((t) => sum(t.rows, "switches") > 0),
      (t) => sum(t.rows, "switches"), (t) => plural(sum(t.rows, "switches"), "switch", "switches"));
    team(19, "pokerface", "Poker face", "Least of their team shown in one game (Pokémon sent out, moves, items, abilities).",
      ts.filter((t) => typeof t.info === "number"), (t) => -t.info, (t) => `${t.info}% of the team shown`);
    team(20, "openbook", "Open book", "Most of their team shown in one game.", ts.filter((t) => typeof t.info === "number"), (t) => t.info,
      (t) => `${t.info}% of the team shown`);
    team(21, "cleansweep", "Clean sweep", "Won a game losing the fewest Pokémon.", ts.filter((t) => t.won && t.end === "normal"),
      (t) => -sum(t.rows, "deaths"), (t) => `won losing ${plural(sum(t.rows, "deaths"), "Pokémon", "Pokémon")}`);
    // game ideas
    const games = [...new Map(rows.filter((r) => r.won).map((r) => [r.replay_id, r])).values()];
    const left = (r) => { const m = r.momentum || []; return m.length ? m[m.length - 1][r.side].hp : null; };
    team(22, "nailbiter", "Nail-biter", "Won a played-out game with the least team HP left (share of the whole team).",
      games.filter((r) => r.end_reason === "normal" && left(r) !== null).map((r) => ({ player: r.player, game: r.replay_id, r })),
      (t) => -left(t.r), (t) => `won with ${Math.round(left(t.r))}% of the team's HP left`);
    team(23, "marathon", "Marathon", "The longest game in turns.", games.filter((r) => r.turns > 0).map((r) => ({ player: r.player, game: r.replay_id, r })),
      (t) => t.r.turns, (t) => `${t.r.turns} turns, won`);
    return out;
  }

  // why a Pokémon couldn't move (|cant| reasons), as the turn strip says it
  const CANT = { par: "fully paralyzed", slp: "asleep", frz: "frozen", flinch: "flinched", recharge: "recharging",
    nopp: "out of PP", Disable: "its move was disabled", Taunt: "taunted", Imprison: "imprisoned", "move: Taunt": "taunted",
    "move: Disable": "its move was disabled", "move: Imprison": "imprisoned", "move: Gravity": "stopped by Gravity",
    "move: Heal Block": "stopped by Heal Block", Truant: "loafing around (Truant)", "ability: Truant": "loafing around (Truant)" };
  /** The turn strip: one cell per turn (1..turns) for a Pokémon's timeline (row.timeline: [turn, kind, move or reason],
      kind in / out / move / cant / faint, from parser.js), each { kind, text }. kind: "faint" (it fainted that turn),
      "move" (it moved), "cant" (it tried and couldn't), "on" (on the field, didn't act: e.g. it came in that turn),
      "off" (on the bench, switched out before acting, or fainted earlier). text: "Turn 3: Thunderbolt". */
  function turnCells(timeline, turns) {
    const cells = [];
    let on = false, i = 0;
    const evs = timeline || [];
    while (i < evs.length && evs[i][0] < 1) { if (evs[i][1] === "in") on = true; i++; }  // the lead, before turn 1
    for (let t = 1; t <= turns; t++) {
      const now = [];
      while (i < evs.length && evs[i][0] <= t) now.push(evs[i++]);
      const moves = now.filter((e) => e[1] === "move").map((e) => e[2]);
      const cant = now.find((e) => e[1] === "cant");
      const fainted = now.some((e) => e[1] === "faint");
      const cameIn = now.some((e) => e[1] === "in");
      const wasOn = on;
      for (const e of now) { if (e[1] === "in") on = true; if (e[1] === "out" || e[1] === "faint") on = false; }
      const why = cant && (CANT[cant[2]] || String(cant[2] || "couldn't move"));
      let kind, text;
      if (fainted) { kind = "faint"; text = (moves.length ? moves.join(", ") + ", then fainted" : "fainted"); }
      else if (moves.length) { kind = "move"; text = moves.join(", ") + (cameIn && !wasOn ? " (switched in)" : ""); }
      else if (cant) { kind = "cant"; text = why; }
      else if (cameIn) { kind = "on"; text = "switched in"; }
      else if (wasOn && on) { kind = "on"; text = "on the field"; }
      else { kind = "off"; text = wasOn ? "switched out" : "on the bench"; }
      cells.push({ kind, text: `Turn ${t}: ${text}` });
    }
    return cells;
  }

  /** A playoff week: any week label not "Week <n>" ("Quarterfinals", "Finals"), for the stage picker. */
  const isPlayoffWeek = (w) => !/^Week [0-9]/.test(w);

  // share links (posted on Discord: they must keep opening the same view). The address holds one of ?r=<id>,
  // ?set=<id>,<id> or ?tab=<tab>, plus the pick on Players / Pokémon / Draft (?player=<key>, ?mon=<name>); other
  // params (?online, ?results, ?t=) stay as they are
  const PICK_PARAM = { players: "player", mons: "mon", draft: "player" };
  /** "bet" was the Fantasy tab's old name: old links still open it. */
  const tabName = (t) => (t === "bet" ? "fantasy" : t);
  /** The query ("?..." or "") for a view st = { mode, r, pick, set } over the page's current one (location.search). */
  function navQuery(search, st) {
    const q = new URLSearchParams(search);
    for (const k of ["r", "tab", "player", "mon", "set"]) q.delete(k);
    if (st.set) q.set("set", st.set);
    else if (st.r) q.set("r", st.r);
    else if (st.mode !== "one") q.set("tab", st.mode);
    if (!st.r && st.pick && PICK_PARAM[st.mode]) q.set(PICK_PARAM[st.mode], st.pick);
    const s = q.toString().replace(/%2C/g, ",");
    return s ? "?" + s : "";
  }
  /** What a link asks for, read back: { r, set, tab, player, mon } ("" when not there). */
  function readNav(search) {
    const q = new URLSearchParams(search);
    const get = (k) => q.get(k) || "";
    return { r: get("r"), set: get("set"), tab: tabName(get("tab")), player: get("player"), mon: get("mon") };
  }

  const League = { PCT_TO_HP, pct, sum, amount, moveDealt, seasonLuck, normalCdf, koPairs, seasonMoves, dealtKey, bestMove, spriteId, sets,
    setSlots, setPoints, standings, spreadText, setText, monSets, awards, awardIdeas, turnCells, isPlayoffWeek, tabName, navQuery, readNav };
  if (typeof module !== "undefined" && module.exports) module.exports = League;
  else root.League = League;
})(typeof globalThis !== "undefined" ? globalThis : this);
