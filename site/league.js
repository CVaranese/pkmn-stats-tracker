/* Season maths and display text from game rows (ReplayStats.gameRows): HP-or-% amounts, season move totals, luck
   totals, best move, sprite file names. No DOM; loadable from Node. The page (app/*.js) renders with these. */
(function (root) {
  "use strict";
  const toID = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  // a % field and its HP twin (filled once max HP is known: ReplayStats.addDamageHp)
  const PCT_TO_HP = { damage_dealt_pct: "damage_dealt_hp", damage_taken_pct: "damage_taken_hp",
    hazard_damage_pct: "hazard_damage_hp", healing_pct: "healing_hp", healing_given_pct: "healing_given_hp" };

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

  /** Season luck: a luck field added up over the values that exist (an average always reads Fair), "" when none does. */
  function totalLuck(values) {
    const v = values.filter((x) => typeof x === "number");
    return v.length ? Math.round(v.reduce((t, x) => t + x, 0) * 100) / 100 : "";
  }

  /** Season luck as games: how many were lucky (score at least `cut`), unlucky (at most -cut) and fair, so playing
      more games doesn't inflate it the way a total does. Blank scores are left out. */
  function luckGames(values, cut) {
    const v = values.filter((x) => typeof x === "number");
    const lucky = v.filter((x) => x >= cut).length, unlucky = v.filter((x) => x <= -cut).length;
    return { lucky, unlucky, fair: v.length - lucky - unlucky, games: v.length };
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

  const League = { PCT_TO_HP, pct, sum, amount, moveDealt, totalLuck, luckGames, seasonMoves, dealtKey, bestMove, spriteId };
  if (typeof module !== "undefined" && module.exports) module.exports = League;
  else root.League = League;
})(typeof globalThis !== "undefined" ? globalThis : this);
