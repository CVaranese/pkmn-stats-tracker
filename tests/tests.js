/* Parser tests. Open tests/index.html through a local server (see CLAUDE.md); results render on the page. */
(async function () {
  "use strict";
  const RS = window.ReplayStats;
  const results = [];
  const check = (name, ok, detail = "") => results.push({ name, ok, detail });
  // compare plain objects regardless of key order
  const canon = (v) => (v && typeof v === "object" && !Array.isArray(v))
    ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])])) : v;
  const same = (a, b) => JSON.stringify(canon(a)) === JSON.stringify(canon(b));

  // ---- real replays: kills hand-counted from each log (direct, passive, deaths per brought Pokemon) ----
  const REAL = {
    "gen9championsvgc2026regmb-2691886643": { rows: 12, winner: "Fayz Sharpie", mons: {
      "Fayz Sharpie|Charizard": [3, 0, 0], "Fayz Sharpie|Scrafty": [0, 0, 0],
      "Fayz Sharpie|Cofagrigus": [1, 0, 1], "Fayz Sharpie|Mamoswine": [0, 0, 1],
      "Ryan Regirocks|Dragonite": [0, 0, 1], "Ryan Regirocks|Archaludon": [1, 0, 1],
      "Ryan Regirocks|Scizor": [1, 0, 1], "Ryan Regirocks|Overqwil": [0, 0, 1] } },
    "gen9championsvgc2026regmb-2691890620": { rows: 12, winner: "Fayz Sharpie", mons: {
      "Fayz Sharpie|Charizard": [0, 0, 1], "Fayz Sharpie|Raichu": [0, 0, 0],
      "Fayz Sharpie|Scrafty": [3, 0, 0], "Fayz Sharpie|Cofagrigus": [1, 0, 1],
      "Ryan Regirocks|Dragonite": [1, 0, 1], "Ryan Regirocks|Archaludon": [1, 0, 1],
      "Ryan Regirocks|Scizor": [0, 0, 1], "Ryan Regirocks|Rhyperior": [0, 0, 1] } },
    "gen9championsvgc2026regmb-2688661099": { rows: 12, winner: "soupy36", mons: {
      "soupy36|Gyarados": [2, 0, 0], "soupy36|Liepard": [0, 0, 1],
      "soupy36|Basculegion": [1, 0, 0], "soupy36|Rotom-Fan": [1, 0, 0],
      "kirbyhat5|Lycanroc-Dusk": [1, 0, 1], "kirbyhat5|Gardevoir": [0, 0, 1],
      "kirbyhat5|Garchomp": [0, 0, 1], "kirbyhat5|Empoleon": [0, 0, 1] } },
    // Spicy Spray burn KOs Mawile after Scovillain has fainted -> passive kill for Scovillain
    "gen9championsvgc2026regmbbo3-2685575238": { rows: 12, winner: "Tijerben000", mons: {
      "Tijerben000|Mawile": [3, 0, 1], "Tijerben000|Rotom-Wash": [1, 0, 0],
      "Tijerben000|Starmie": [0, 0, 0], "Tijerben000|Typhlosion-Hisui": [0, 0, 1],
      "Liebynight01|Milotic": [1, 0, 1], "Liebynight01|Scovillain": [0, 1, 1],
      "Liebynight01|Farigiraf": [0, 0, 1], "Liebynight01|Hatterene": [0, 0, 1] } },
    // singles, no team preview; Dondozo's Wave Crash recoil -> passive kill for Galvantula
    "gen9randombattle-2704944065": { rows: 10, winner: "Stolemyusername", mons: {
      "Stolemyusername|Pelipper": [4, 0, 0], "Stolemyusername|Dunsparce": [1, 0, 0],
      // Dondozo's recoil KO: no kill since 2026-10-27 (was Galvantula's passive kill as the last attacker)
      "Stolemyusername|Galvantula": [0, 0, 1], "Stolemyusername|Blissey": [0, 0, 0],
      "Blattur|Dondozo": [1, 0, 1], "Blattur|Glimmora": [0, 0, 1], "Blattur|Gouging Fire": [0, 0, 1],
      "Blattur|Iron Jugulis": [0, 0, 1], "Blattur|Moltres-Galar": [0, 0, 1], "Blattur|Zekrom": [0, 0, 1] } },
    // Nat Dex (the league's format); 7-hit Population Bomb KOs, then p1 loses to the timer
    "gen9nationaldex-2705121899": { rows: 12, winner: "Ezclapperez132", mons: {
      "stringcheezus1710|Ninetales": [0, 0, 1], "stringcheezus1710|Venusaur": [0, 0, 1],
      "stringcheezus1710|Dragonite": [0, 0, 0], "Ezclapperez132|Maushold": [2, 0, 0] } },
    // Nat Dex with Illusion: Zoroark-Hisui leads disguised as Gardevoir and is KO'd by Primarina;
    // the real Gardevoir comes in later. Volcarona's Flame Body burn KOs Primarina (passive).
    "gen9nationaldex-2705111047": { rows: 12, winner: "jinrachi", mons: {
      "jinrachi|Zoroark-Hisui": [0, 0, 1], "jinrachi|Volcarona": [1, 1, 1], "jinrachi|Gardevoir": [0, 0, 1],
      "jinrachi|Garchomp": [0, 0, 1], "jinrachi|Mamoswine": [1, 0, 1], "jinrachi|Kingambit": [3, 0, 0],
      "flomarV2|Primarina": [3, 0, 1], "flomarV2|Exeggutor": [1, 1, 1], "flomarV2|Amoonguss": [0, 0, 1],
      "flomarV2|Excadrill": [0, 0, 1], "flomarV2|Sableye": [0, 0, 1], "flomarV2|Weavile": [0, 0, 1] } },
  };

  for (const [id, exp] of Object.entries(REAL)) {
    let replay;
    try {
      replay = await (await fetch(`fixtures/${id}.json`)).json();
    } catch (e) {
      check(`${id}: load fixture`, false, String(e));
      continue;
    }
    const rows = RS.gameRows(replay);
    check(`${id}: row count`, rows.length === exp.rows, `got ${rows.length}, expected ${exp.rows}`);
    const got = {};
    for (const r of rows) if (r.brought) got[`${r.player}|${r.pokemon}`] = [r.direct_kills, r.passive_kills, r.deaths];
    check(`${id}: kills/deaths per Pokémon`, same(got, exp.mons),
      `expected ${JSON.stringify(exp.mons)}\ngot      ${JSON.stringify(got)}`);
    const winners = [...new Set(rows.filter((r) => r.won).map((r) => r.player))];
    check(`${id}: winner`, same(winners, [exp.winner]), `got ${winners}`);
  }

  // ---- damage in % of max HP, hand-counted from the logs: [dealt, taken] per brought Pokemon ----
  const DAMAGE = {
    // Population Bomb 7 hits: only the HP left counts (Ninetales 100, Venusaur 91); Venusaur's
    // Life Orb 9% is taken with no dealer
    "gen9nationaldex-2705121899": {
      "stringcheezus1710|Ninetales": [0, 100], "stringcheezus1710|Venusaur": [89, 100],
      "stringcheezus1710|Dragonite": [0, 0], "Ezclapperez132|Maushold": [191, 89] },
    // Illusion: Zoroark's Shadow Ball (40) and the 100 it took move to Zoroark-Hisui. Volcarona's
    // Flame Body burn on Primarina (6+6+2) and Garchomp's rocks/spikes count as theirs; Exeggutor's
    // Toxic on Mamoswine (6+12+18). Healing (Sitrus, Regenerator, Giga Drain) raises the baseline.
    "gen9nationaldex-2705111047": {
      "jinrachi|Zoroark-Hisui": [40, 100], "jinrachi|Gardevoir": [52, 100], "jinrachi|Volcarona": [148, 100],
      "jinrachi|Garchomp": [134, 100], "jinrachi|Mamoswine": [245, 100], "jinrachi|Kingambit": [98, 31],
      "flomarV2|Amoonguss": [64, 167], "flomarV2|Primarina": [300, 100], "flomarV2|Excadrill": [0, 100],
      "flomarV2|Exeggutor": [136, 150], "flomarV2|Sableye": [0, 100], "flomarV2|Weavile": [31, 100] },
  };
  for (const [id, exp] of Object.entries(DAMAGE)) {
    const rows = RS.gameRows(await (await fetch(`fixtures/${id}.json`)).json());
    const got = {};
    for (const r of rows) if (r.brought) got[`${r.player}|${r.pokemon}`] = [r.damage_dealt_pct, r.damage_taken_pct];
    check(`${id}: damage dealt/taken %`, same(got, exp), `expected ${JSON.stringify(exp)}\ngot      ${JSON.stringify(got)}`);
  }

  // Disguise bust (1/8 HP, '[from] pokemon: Mimikyu-Busted') goes to the attacker that broke it
  {
    const b = RS.parseBattle((await (await fetch("fixtures/gen9nationaldex-2705117998.json")).json()).log);
    const onMimi = b.hits.filter(([, t]) => t === "p1: Mimikyu");
    check("disguise bust: 12% credited to Dragonite", onMimi.some((h) => same(h.slice(0, 3), ["p2: Dragonite", "p1: Mimikyu", 12])),
      JSON.stringify(onMimi));
  }

  // per-move uses, damage, KOs (counted by hand from the log); the parts add up to Dealt %
  {
    const rows = RS.gameRows(await (await fetch("fixtures/gen9nationaldex-2705117998.json")).json());
    const moves = (sp) => Object.fromEntries(rows.find((r) => r.pokemon === sp).move_stats
      .map((m) => [m.move, [m.uses, m.kos, m.z ? "Z" : ""]]));
    check("moves: Volcarona Quiver Dance 1, Flamethrower 1 + KO, Bug Buzz 1 + KO", same(moves("Volcarona"),
      { Flamethrower: [1, 1, ""], "Bug Buzz": [1, 1, ""], "Quiver Dance": [1, 0, ""] }), JSON.stringify(moves("Volcarona")));
    const chomp = moves("Garchomp");
    check("moves: Garchomp Earthquake KO, Stealth Rock no damage, Rough Skin / Rocky Helmet as named sources",
      same(chomp.Earthquake, [1, 1, ""]) && same(chomp["Stealth Rock"], [1, 0, ""]) && same(chomp["Rough Skin (ability)"], [0, 0, ""]) &&
      same(chomp["Rocky Helmet (item)"], [0, 0, ""]) && !("" in chomp), JSON.stringify(chomp));
    check("moves: Kyurem's Tectonic Rage is a Z-move", same(moves("Kyurem")["Tectonic Rage"], [1, 0, "Z"]),
      JSON.stringify(moves("Kyurem")));
    const off = rows.filter((r) => r.brought && Math.abs(r.move_stats.reduce((t, m) => t + m.dealt_pct, 0) - r.damage_dealt_pct) > 0.05 ||
      r.move_stats.reduce((t, m) => t + m.kos, 0) !== r.kills).map((r) => r.pokemon);
    check("moves: per-move damage and KOs add up to Dealt % and Kills", off.length === 0, JSON.stringify(off));
    const koOff = rows.filter((r) => (r.kos_dealt || []).length !== r.kills).map((r) => r.pokemon);
    check("kos_dealt: one victim per kill", koOff.length === 0, JSON.stringify(koOff));
    const pairs = window.League.koPairs(rows);
    check("koPairs: every kill finds its victim, a Pokémon that fainted", pairs.length === rows.reduce((t, r) => t + r.kills, 0) &&
      pairs.length > 0 && pairs.every((p) => p.victim.deaths > 0), JSON.stringify(pairs.map((p) => [p.killer.pokemon, p.victim.pokemon])));
  }
  {
    const b = RS.parseBattle(`|player|p1|Alice|
|player|p2|Bob|
|switch|p1a: Burner|Sableye, L50|100/100
|switch|p2a: Victim|Garchomp, L50|100/100
|turn|1
|move|p1a: Burner|Leech Seed|p2a: Victim
|-start|p2a: Victim|move: Leech Seed
|turn|2
|-damage|p2a: Victim|88/100|[from] Leech Seed|[of] p1a: Burner
|move|p2a: Victim|Spikes|p1a: Burner
|-sidestart|p1: Alice|Spikes
|turn|3
|switch|p1a: Fresh|Garchomp, L50|100/100
|-damage|p1a: Fresh|88/100|[from] Spikes`);
    const seed = b.moves.get("p1: Burner").get("Leech Seed"), spikes = b.moves.get("p2: Victim").get("Spikes");
    check("moves: Leech Seed and Spikes damage go to the move", seed.dealt === 12 && seed.uses === 1 &&
      spikes.dealt === 12 && spikes.uses === 1, JSON.stringify([seed, spikes]));
  }

  // raw HP: % drop x the target's max HP. Only jinrachi has a sheet (max HP set by hand here).
  {
    const rows = RS.gameRows(await (await fetch("fixtures/gen9nationaldex-2705111047.json")).json());
    const MAX = { "Zoroark-Hisui": 314, Gardevoir: 340, Volcarona: 375, Garchomp: 357, Mamoswine: 361, Kingambit: 404 };
    for (const r of rows) r.max_hp = r.player === "jinrachi" ? MAX[r.pokemon] : "";
    RS.addDamageHp(rows);
    const got = {};
    for (const r of rows) if (r.brought) got[`${r.player}|${r.pokemon}`] = [r.damage_dealt_hp, r.damage_taken_hp];
    // taken: Kingambit 31% of 404 = 125.24. dealt: Primarina 100% of Zoroark + 100% of Volcarona +
    // 100% of Gardevoir = 1029; Exeggutor 100% of Garchomp + 36% of Mamoswine = 486.96
    const exp = {
      "jinrachi|Zoroark-Hisui": ["", 314], "jinrachi|Gardevoir": ["", 340], "jinrachi|Volcarona": ["", 375],
      "jinrachi|Garchomp": ["", 357], "jinrachi|Mamoswine": ["", 361], "jinrachi|Kingambit": ["", 125],
      "flomarV2|Amoonguss": [231, ""], "flomarV2|Primarina": [1029, ""], "flomarV2|Excadrill": [0, ""],
      "flomarV2|Exeggutor": [487, ""], "flomarV2|Sableye": [0, ""], "flomarV2|Weavile": [125, ""] };
    check("raw HP: dealt needs the target's sheet, taken needs its own", same(got, exp),
      `expected ${JSON.stringify(exp)}\ngot      ${JSON.stringify(got)}`);
    const sum = RS.summarize(rows);
    const prim = sum.find((a) => a.pokemon === "Primarina"), volc = sum.find((a) => a.pokemon === "Volcarona");
    check("summary: damage totals, HP blank when unknown", prim.damage_dealt_pct === 300 && prim.damage_dealt_hp === 1029 &&
      prim.damage_taken_hp === "" && volc.damage_dealt_pct === 148 && volc.damage_dealt_hp === "" &&
      volc.damage_taken_hp === 375, JSON.stringify([prim, volc]));
    // per-move HP adds up to Dealt HP (Primarina: all targets have a sheet)
    const primRow = rows.find((r) => r.pokemon === "Primarina");
    check("moves: per-move HP adds up to Dealt HP", Math.abs(primRow.move_stats.reduce((t, m) => t + m.dealt_hp, 0) - 1029) <= 2,
      JSON.stringify(primRow.move_stats));
  }
  // every real game: each Pokémon's per-move damage and KOs add up to its Dealt % and Kills
  for (const id of Object.keys(REAL)) {
    const rows = RS.gameRows(await (await fetch(`fixtures/${id}.json`)).json());
    const off = rows.filter((r) => Math.abs(r.move_stats.reduce((t, m) => t + m.dealt_pct, 0) - r.damage_dealt_pct) > 0.05 ||
      r.move_stats.reduce((t, m) => t + m.kos, 0) !== r.kills).map((r) => r.pokemon);
    check(`${id}: per-move damage and KOs add up`, off.length === 0, JSON.stringify(off));
  }

  // ---- summary across the three Fayz/Ryan + soupy games ----
  {
    const all = [];
    for (const id of ["gen9championsvgc2026regmb-2691886643", "gen9championsvgc2026regmb-2691890620"]) {
      all.push(...RS.gameRows(await (await fetch(`fixtures/${id}.json`)).json()));
    }
    const top = RS.summarize(all)[0];
    check("summary: Fayz Sharpie's Charizard and Scrafty lead with 3", top.kills === 3 &&
      top.player === "Fayz Sharpie" && ["Charizard", "Scrafty"].includes(top.pokemon), JSON.stringify(top));
    const cof = RS.summarize(all).find((a) => a.pokemon === "Cofagrigus");
    check("summary: Cofagrigus 2 games, 2 kills, 2 deaths, 2 wins", cof && cof.games_brought === 2 &&
      cof.kills === 2 && cof.deaths === 2 && cof.wins_when_brought === 2, JSON.stringify(cof));
    const byMon = RS.summarize(all, false);
    check("summary by Pokémon only merges players", byMon.every((a) => a.player === "") &&
      byMon.filter((a) => a.pokemon === "Scizor").length === 1, JSON.stringify(byMon.slice(0, 3)));
  }

  // ---- synthetic logs for rules no real fixture covers yet ----
  const HEAD = [
    "|player|p1|Alice|", "|player|p2|Bob|",
    "|switch|p1a: Burner|Sableye, L50|100/100", "|switch|p1b: Rocker|Hippowdon, L50|100/100",
    "|switch|p2a: Victim|Garchomp, L50|100/100", "|switch|p2b: Other|Amoonguss, L50|100/100", "|turn|1",
  ].join("\n") + "\n";
  const CASES = {
    "burn credited to Will-O-Wisp user": [`
|move|p1a: Burner|Will-O-Wisp|p2a: Victim
|-status|p2a: Victim|brn
|upkeep
|turn|2
|-damage|p2a: Victim|0 fnt|[from] brn
|faint|p2a: Victim`, [["p1: Burner", "passive", "p2: Victim"]]],
    "stealth rock credited to setter": [`
|move|p1b: Rocker|Stealth Rock|p2a: Victim
|-sidestart|p2: Bob|move: Stealth Rock
|turn|2
|switch|p2a: Third|Charizard, L50|10/100
|-damage|p2a: Third|0 fnt|[from] Stealth Rock
|faint|p2a: Third`, [["p1: Rocker", "passive", "p2: Third"]]],
    "sandstorm credited to Sand Stream user": [`
|-weather|Sandstorm|[from] ability: Sand Stream|[of] p1b: Rocker
|upkeep
|-damage|p2b: Other|0 fnt|[from] Sandstorm
|faint|p2b: Other`, [["p1: Rocker", "passive", "p2: Other"]]],
    "life orb recoil -> no kill, a self KO (user, 2026-10-27)": [`
|move|p1a: Burner|Foul Play|p2a: Victim
|-damage|p2a: Victim|5/100
|turn|2
|move|p2a: Victim|Earthquake|p1b: Rocker
|-damage|p1b: Rocker|50/100
|-damage|p2a: Victim|0 fnt|[from] item: Life Orb
|faint|p2a: Victim`, [[null, "self", "p2: Victim"]]],
    "recoil -> no kill, a self KO": [`
|move|p1a: Burner|Foul Play|p2a: Victim
|-damage|p2a: Victim|5/100
|turn|2
|move|p2a: Victim|Steel Beam|p1b: Rocker
|-damage|p1b: Rocker|50/100
|-damage|p2a: Victim|0 fnt|[from] Recoil
|faint|p2a: Victim`, [[null, "self", "p2: Victim"]]],
    "ally spread move -> last opposing attacker": [`
|move|p1b: Rocker|Earthquake|p2a: Victim|[spread] p2a,p2b
|-damage|p2b: Other|40/100
|turn|2
|move|p2a: Victim|Earthquake|p1a: Burner|[spread] p1a,p1b,p2b
|-damage|p2b: Other|0 fnt
|faint|p2b: Other`, [["p1: Rocker", "passive", "p2: Other"]]],
    "rocky helmet": [`
|move|p2a: Victim|Dragon Claw|p1b: Rocker
|-damage|p1b: Rocker|60/100
|-damage|p2a: Victim|0 fnt|[from] item: Rocky Helmet|[of] p1b: Rocker
|faint|p2a: Victim`, [["p1: Rocker", "passive", "p2: Victim"]]],
    "destiny bond is a direct kill": [`
|move|p1a: Burner|Destiny Bond|p1a: Burner
|-singlemove|p1a: Burner|Destiny Bond
|move|p2a: Victim|Dragon Claw|p1a: Burner
|-damage|p1a: Burner|0 fnt
|faint|p1a: Burner
|-activate|p1a: Burner|move: Destiny Bond
|faint|p2a: Victim`, [["p2: Victim", "direct", "p1: Burner"], ["p1: Burner", "direct", "p2: Victim"]]],
    "explosion: deaths, no kill for the user": [`
|move|p2b: Other|Explosion|p1a: Burner|[spread] p1a,p1b
|-damage|p1a: Burner|0 fnt
|-damage|p1b: Rocker|40/100
|faint|p1a: Burner
|faint|p2b: Other`, [["p2: Other", "direct", "p1: Burner"], [null, "self", "p2: Other"]]],
    "leech seed": [`
|move|p2b: Other|Leech Seed|p1b: Rocker
|-start|p1b: Rocker|move: Leech Seed
|upkeep
|-damage|p1b: Rocker|0 fnt|[from] Leech Seed|[of] p2b: Other
|faint|p1b: Rocker`, [["p2: Other", "passive", "p1: Rocker"]]],
    "toxic spikes poison on switch-in": [`
|move|p1a: Burner|Toxic Spikes|p2a: Victim
|-sidestart|p2: Bob|move: Toxic Spikes
|turn|2
|switch|p2a: Third|Charizard, L50|5/100
|-status|p2a: Third|psn
|upkeep
|-damage|p2a: Third|0 fnt|[from] psn
|faint|p2a: Third`, [["p1: Burner", "passive", "p2: Third"]]],
    "perish song credited to the singer": [`
|move|p1a: Burner|Perish Song|p1a: Burner
|-start|p1a: Burner|perish3|[silent]
|-start|p2a: Victim|perish3|[silent]
|turn|2
|turn|3
|turn|4
|-start|p2a: Victim|perish0
|faint|p2a: Victim`, [["p1: Burner", "passive", "p2: Victim"]]],
    "salt cure again later: the second user gets the KO": [`
|move|p1a: Burner|Salt Cure|p2a: Victim
|-damage|p2a: Victim|80/100
|-start|p2a: Victim|Salt Cure
|turn|2
|switch|p2a: Third|Charizard, L50|100/100
|turn|3
|switch|p2a: Victim|Garchomp, L50|80/100
|turn|4
|move|p1b: Rocker|Salt Cure|p2a: Victim
|-damage|p2a: Victim|10/100
|-start|p2a: Victim|Salt Cure
|upkeep
|-damage|p2a: Victim|0 fnt|[from] Salt Cure
|faint|p2a: Victim`, [["p1: Rocker", "passive", "p2: Victim"]]],
  };
  for (const [name, [body, expected]] of Object.entries(CASES)) {
    const got = RS.parseBattle(HEAD + body.replace(/^\n/, "")).kills;
    check(`rule: ${name}`, same(got, expected), `expected ${JSON.stringify(expected)}\ngot      ${JSON.stringify(got)}`);
  }

  // ---- damage credit: [dealer or null (self / own side), target, % lost] per hit ----
  const DAMAGE_CASES = {
    "burn tick -> Will-O-Wisp user": [`
|move|p1a: Burner|Will-O-Wisp|p2a: Victim
|-status|p2a: Victim|brn
|upkeep
|-damage|p2a: Victim|94/100 brn|[from] brn`, [["p1: Burner", "p2: Victim", 6]]],
    "hazard on switch-in -> setter": [`
|move|p1b: Rocker|Stealth Rock|p2a: Victim
|-sidestart|p2: Bob|move: Stealth Rock
|turn|2
|switch|p2a: Third|Charizard, L50|80/100
|-damage|p2a: Third|30/100|[from] Stealth Rock`, [["p1: Rocker", "p2: Third", 50]]],
    "sandstorm: setter's foes credited, own side self-damage": [`
|-weather|Sandstorm|[from] ability: Sand Stream|[of] p1b: Rocker
|upkeep
|-damage|p1a: Burner|94/100|[from] Sandstorm
|-damage|p2b: Other|94/100|[from] Sandstorm`, [[null, "p1: Burner", 6], ["p1: Rocker", "p2: Other", 6]]],
    "life orb, recoil, confusion: taken, no dealer": [`
|move|p2a: Victim|Brave Bird|p1a: Burner
|-damage|p1a: Burner|60/100
|-damage|p2a: Victim|87/100|[from] Recoil
|-damage|p2a: Victim|77/100|[from] item: Life Orb
|turn|2
|-damage|p2a: Victim|70/100|[from] confusion`,
      [["p2: Victim", "p1: Burner", 40], [null, "p2: Victim", 13], [null, "p2: Victim", 10], [null, "p2: Victim", 7]]],
    "leech seed, rocky helmet, salt cure -> their sources": [`
|move|p2b: Other|Leech Seed|p1b: Rocker
|-start|p1b: Rocker|move: Leech Seed
|move|p2a: Victim|Dragon Claw|p1b: Rocker
|-damage|p1b: Rocker|70/100
|-damage|p2a: Victim|84/100|[from] item: Rocky Helmet|[of] p1b: Rocker
|move|p1a: Burner|Salt Cure|p2a: Victim
|-damage|p2a: Victim|70/100
|-start|p2a: Victim|Salt Cure
|upkeep
|-damage|p1b: Rocker|58/100|[from] Leech Seed|[of] p2b: Other
|-damage|p2a: Victim|58/100|[from] Salt Cure`,
      [["p2: Victim", "p1: Rocker", 30], ["p1: Rocker", "p2: Victim", 16], ["p1: Burner", "p2: Victim", 14],
        ["p2: Other", "p1: Rocker", 12], ["p1: Burner", "p2: Victim", 12]]],
    "overkill capped, healing raises the baseline": [`
|move|p1a: Burner|Foul Play|p2a: Victim
|-damage|p2a: Victim|30/100
|-heal|p2a: Victim|55/100|[from] item: Sitrus Berry
|turn|2
|move|p1a: Burner|Foul Play|p2a: Victim
|-damage|p2a: Victim|0 fnt
|faint|p2a: Victim`, [["p1: Burner", "p2: Victim", 70], ["p1: Burner", "p2: Victim", 55]]],
    "substitute: its HP cost is self-damage, hits on it count 0": [`
|move|p1a: Burner|Substitute|p1a: Burner
|-start|p1a: Burner|Substitute
|-damage|p1a: Burner|75/100
|move|p2a: Victim|Dragon Claw|p1a: Burner
|-activate|p1a: Burner|Substitute|[damage]`, [[null, "p1: Burner", 25]]],
    "ally spread hit: taken, no dealer": [`
|move|p1b: Rocker|Earthquake|p2a: Victim|[spread] p1a,p2a
|-damage|p1a: Burner|80/100
|-damage|p2a: Victim|50/100`, [[null, "p1: Burner", 20], ["p1: Rocker", "p2: Victim", 50]]],
    "pain split lowering HP -> its user": [`
|move|p1a: Burner|Pain Split|p2a: Victim
|-sethp|p2a: Victim|60/100|[from] move: Pain Split|[silent]
|-sethp|p1a: Burner|100/100|[from] move: Pain Split`, [["p1: Burner", "p2: Victim", 40]]],
    "faint with HP left: Destiny Bond to its user, Explosion to nobody": [`
|move|p1a: Burner|Destiny Bond|p1a: Burner
|move|p2a: Victim|Dragon Claw|p1a: Burner
|-damage|p1a: Burner|0 fnt
|faint|p1a: Burner
|-activate|p1a: Burner|move: Destiny Bond
|faint|p2a: Victim
|turn|2
|move|p2b: Other|Explosion|p1b: Rocker
|-damage|p1b: Rocker|40/100
|faint|p2b: Other`, [["p2: Victim", "p1: Burner", 100], ["p1: Burner", "p2: Victim", 100],
      ["p2: Other", "p1: Rocker", 60], [null, "p2: Other", 100]]],
  };
  for (const [name, [body, expected]] of Object.entries(DAMAGE_CASES)) {
    const got = RS.parseBattle(HEAD + body.replace(/^\n/, "")).hits.map((h) => h.slice(0, 3)); // [dealer, target, %]
    check(`damage: ${name}`, same(got, expected), `expected ${JSON.stringify(expected)}\ngot      ${JSON.stringify(got)}`);
  }

  // ---- Illusion: a disguised stint moves to Zoroark, the real Pokemon keeps its own stints ----
  {
    const b = RS.parseBattle(`|player|p1|Alice|
|player|p2|Bob|
|switch|p1a: Gardy|Gardevoir, L50|100/100
|switch|p2a: Foe|Garchomp, L50|100/100
|turn|1
|move|p1a: Gardy|Moonblast|p2a: Foe
|-damage|p2a: Foe|0 fnt
|faint|p2a: Foe
|switch|p2a: Foe2|Dragonite, L50|100/100
|turn|2
|switch|p1a: Gardy|Gardevoir, L50|100/100
|move|p1a: Gardy|Will-O-Wisp|p2a: Foe2
|-status|p2a: Foe2|brn
|move|p2a: Foe2|Outrage|p1a: Gardy
|-damage|p1a: Gardy|0 fnt
|replace|p1a: Zoro|Zoroark-Hisui, L50
|-end|p1a: Zoro|Illusion
|faint|p1a: Zoro
|switch|p1a: Gardy|Gardevoir, L50|100/100
|turn|3
|-damage|p2a: Foe2|0 fnt|[from] brn
|faint|p2a: Foe2`);
    const expected = [["p1: Gardy", "direct", "p2: Foe"], ["p2: Foe2", "direct", "p1: Zoro"], ["p1: Zoro", "passive", "p2: Foe2"]];
    check("illusion: kills and the disguised burn go to Zoroark", same(b.kills, expected),
      `expected ${JSON.stringify(expected)}\ngot      ${JSON.stringify(b.kills)}`);
    const gardy = { direct: 1, passive: 0, deaths: 0, hazardKills: 0, hazardsSet: 0, hazardsRemoved: 0,
      switches: 1, pivots: 0, forcedOut: 0, faintSwitchIns: 1 };
    check("illusion: real Gardevoir keeps its own kill, no death", same(
      Object.fromEntries(Object.keys(gardy).map((k) => [k, b.stats.get("p1: Gardy")[k]])), gardy),
      JSON.stringify(b.stats.get("p1: Gardy")));
    check("illusion: damage moves with the stint", same(b.damage.get("p1: Zoro"), { dealt: 100, taken: 100, hazard: 0 }) &&
      same(b.damage.get("p1: Gardy"), { dealt: 100, taken: 0, hazard: 0 }), JSON.stringify([...b.damage]));
    check("illusion: species", b.species.get("p1: Zoro") === "Zoroark-Hisui" && b.species.get("p1: Gardy") === "Gardevoir",
      JSON.stringify([...b.species]));
  }

  {
    // gen9nationaldex-2693018008 (Week 5): the league admin's pick in index.json says nezergy's "Iron Valiant"
    // (stint 5, turns 14-15) was Zoroark-Hisui. Hand-counted: it KOs Cresselia (Space Lapras) with Shadow Ball
    // on turn 15; the real Iron Valiant never came in.
    const index = await (await fetch("../site/games/index.json")).json();
    const g = index.games.find((x) => x.id === "gen9nationaldex-2693018008");
    const replay = await (await fetch("../site/games/gen9nationaldex-2693018008.json")).json();
    const rows = RS.gameRows({ ...replay, illusion: g.illusion });
    const r = (sp) => rows.find((x) => x.player === "nezergy" && x.pokemon === sp) || {};
    check("2693018008: admin pick, Zoroark-Hisui KOs Cresselia, Iron Valiant not brought", same(g.illusion, { p2: [5] }) &&
      same([r("Zoroark-Hisui").kills, r("Zoroark-Hisui").deaths, r("Zoroark-Hisui").brought, r("Iron Valiant").brought], [1, 0, 1, 0]),
      JSON.stringify(rows.filter((x) => x.player === "nezergy").map((x) => [x.pokemon, x.kills, x.deaths, x.brought])));
    // Illusion.picks: the admin's pick beats the proven stays; with no pick, the proven ones (none here)
    const b = RS.parseBattle(replay.log);
    const withPick = Illusion.picks(b, g.illusion, null, null), without = Illusion.picks(b, {}, null, null);
    check("Illusion.picks: admin's pick, else the proven stays", same(Illusion.hiddenSides(b), ["p2"]) &&
      same(withPick.illusion, { p2: [5] }) && same(without.illusion, { p2: without.analyses.p2.proven }) &&
      same(without.analyses.p2.proven, []), JSON.stringify([withPick.illusion, without.illusion]));
  }
  // ---- league.js: season maths and HP-or-% text ----
  {
    const LG = window.League;
    const a = { damage_dealt_pct: 120, damage_dealt_hp: 400, hp_est: {}, healing_pct: 10, healing_hp: 30, healing_given_pct: 5, healing_given_hp: 12 };
    const b = { damage_dealt_pct: 30.4, damage_dealt_hp: 99.6, hp_est: { damage_dealt_hp: true } };
    const c = { damage_dealt_pct: 50, damage_dealt_hp: "" };
    check("league: amount in HP when every row has it, ~ when a guess went in, else in %",
      LG.amount([a], ["damage_dealt_pct"]).text === "400 HP" && LG.amount([a, b], ["damage_dealt_pct"]).text === "~500 HP" &&
      LG.amount([a, c], ["damage_dealt_pct"]).text === "170%" && LG.amount([a, c], ["damage_dealt_pct"]).hp === false &&
      LG.amount([a], ["healing_pct", "healing_given_pct"]).text === "42 HP" && LG.amount([], ["damage_dealt_pct"]).text === "0%",
      JSON.stringify([LG.amount([a, b], ["damage_dealt_pct"]), LG.amount([a, c], ["damage_dealt_pct"])]));
    check("league: moveDealt", LG.moveDealt({ dealt_hp: 120, dealt_hp_est: true, dealt_pct: 40 }) === "~120 HP" &&
      LG.moveDealt({ dealt_hp: "", dealt_pct: 40.4 }) === "40%");
    // 4 games totalling 2.88, variance 1 each: spread sqrt(4) = 2, so z 1.44
    const lg = (l, v) => ({ luck: l, luck_var: v });
    check("league: seasonLuck = total / sqrt(total variance), skipping blanks; blank when none; z 0 without rolls",
      JSON.stringify(LG.seasonLuck([lg(1, 1), lg(0.88, 1), lg("", 5), lg(2, 1), lg(-1, 1)], "luck", "luck_var")) ===
        JSON.stringify({ z: 1.44, total: 2.88, sd: 2, games: 4 }) && LG.seasonLuck([lg("", 1)], "luck", "luck_var") === "" &&
      LG.seasonLuck([lg(0, 0)], "luck", "luck_var").z === 0,
      JSON.stringify(LG.seasonLuck([lg(1, 1), lg(0.88, 1), lg("", 5), lg(2, 1), lg(-1, 1)], "luck", "luck_var")));
    const cdf = [0, 1.64, -0.67].map((z) => Math.round(LG.normalCdf(z) * 10000) / 10000);
    check("league: normalCdf", JSON.stringify(cdf) === "[0.5,0.9495,0.2514]", JSON.stringify(cdf));
    const g1 = { move_stats: [{ move: "Earthquake", source: 0, uses: 2, dealt_pct: 80, kos: 1, dealt_hp: 300 },
      { move: "Stealth Rock", source: 0, uses: 1, dealt_pct: 12, kos: 0, dealt_hp: 40 }] };
    const g2 = { move_stats: [{ move: "Earthquake", source: 0, uses: 1, dealt_pct: 50, kos: 1, dealt_hp: "" },
      { move: "Burn (status)", source: 1, uses: 0, dealt_pct: 6, kos: 0, dealt_hp: 20 }] };
    const sm = LG.seasonMoves([g1, g2]);
    check("league: seasonMoves adds up a move over games; HP blank once a game lacks it; damage sources last",
      sm.map((m) => `${m.move} ${m.uses} ${m.dealt_pct} ${m.kos} ${m.dealt_hp}`).join(", ") ===
      "Earthquake 3 130 2 , Stealth Rock 1 12 0 40, Burn (status) 0 6 0 20", JSON.stringify(sm));
    check("league: bestMove, most damage then KOs, not a damage source", LG.bestMove({ move_stats: sm }).move === "Earthquake" &&
      LG.bestMove({ move_stats: [{ move: "Protect", source: 0, dealt_pct: 0, kos: 0 }] }) === null);
    check("league: dealtKey counts a % game at the average max HP", LG.dealtKey([a, c], 300) === 550);
    check("league: spriteId", ["Ho-Oh", "Urshifu-Rapid-Strike", "Zamazenta-*", "Tapu Koko", "Charizard-Mega-X", "Iron Valiant", "Kommo-o"]
      .map(LG.spriteId).join(" ") === "hooh urshifu-rapidstrike zamazenta tapukoko charizard-megax ironvaliant kommoo",
      ["Ho-Oh", "Urshifu-Rapid-Strike", "Zamazenta-*", "Tapu Koko", "Charizard-Mega-X", "Iron Valiant", "Kommo-o"].map(LG.spriteId).join(" "));
  }
  // ---- team sheets ----
  const TS = window.TeamSheets;
  const EXPORT = `=== [gen9nationaldex] League ===

Chompy (Garchomp) (M) @ Rocky Helmet
Ability: Rough Skin
EVs: 252 HP / 4 Def / 252 Spe
Jolly Nature
- Stealth Rock
- Earthquake
- Dragon Tail
- Spikes

Blissey (F) @ Heavy-Duty Boots\r
Ability: Natural Cure\r
Level: 50\r
EVs: 252 HP / 252 Def / 4 SpD\r
IVs: 0 Atk\r
Bold Nature\r
- Soft-Boiled\r

Shedinja @ Focus Sash
Ability: Wonder Guard
EVs: 252 HP
- Shadow Sneak

Zamazenta-Crowned @ Rusted Shield
Ability: Dauntless Shield
IVs: 20 HP
- Body Press

Mr. Mime-Galar
Ability: Screen Cleaner
- Rapid Spin
`;
  const sets = TS.parseTeam(EXPORT);
  check("sheet: 5 sets", sets.length === 5, JSON.stringify(sets.map((s) => s.species)));
  check("sheet: nickname, gender, item, EVs, nature, moves", same(sets[0], {
    nickname: "Chompy", species: "Garchomp", gender: "M", item: "Rocky Helmet", ability: "Rough Skin",
    level: 100, nature: "Jolly", evs: { hp: 252, def: 4, spe: 252 }, ivs: {},
    moves: ["Stealth Rock", "Earthquake", "Dragon Tail", "Spikes"] }), JSON.stringify(sets[0]));
  check("sheet: level, IVs, CRLF lines", sets[1].species === "Blissey" && sets[1].nickname === "" &&
    sets[1].gender === "F" && sets[1].level === 50 && same(sets[1].ivs, { atk: 0 }) && sets[1].nature === "Bold",
    JSON.stringify(sets[1]));
  check("sheet: species with a dot, no item", sets[4].species === "Mr. Mime-Galar" && sets[4].item === "",
    JSON.stringify(sets[4]));
  // base HP from Showdown's pokedex.json: Garchomp 108, Blissey 255, Shedinja 1, Zamazenta-Crowned 92, Mr. Mime-Galar 50
  const DEX = { garchomp: { baseStats: { hp: 108 } }, blissey: { baseStats: { hp: 255 } },
    shedinja: { baseStats: { hp: 1 } }, zamazentacrowned: { baseStats: { hp: 92 } },
    mrmimegalar: { baseStats: { hp: 50 } } };
  const hp = sets.map((s) => TS.maxHp(s, DEX));
  check("max HP: 420, 362, 1, 314, 241", same(hp, [420, 362, 1, 314, 241]), JSON.stringify(hp));
  {
    const gap = TS.parseTeam("Azelf @ Life Orb\nTimid Nature\n\n- Psychic\n* Fire Blast\n\nBronzong\n\n- Stealth Rock");
    check("sheet: moves after a blank line (and '* ' bullets) stay with their set", same(gap.map((s) => [s.species, s.moves]),
      [["Azelf", ["Psychic", "Fire Blast"]], ["Bronzong", ["Stealth Rock"]]]), JSON.stringify(gap.map((s) => [s.species, s.moves])));
  }
  check("max HP: unknown species -> null", TS.maxHp({ species: "Missingno", evs: {}, ivs: {} }, DEX) === null);
  {
    // max HP guesses (no sheet): 0 or 252 HP EVs. Garchomp base 108: 357 / 420. Blissey 255: 651 / 714.
    const G = { garchomp: { baseStats: { hp: 108, atk: 130, def: 95, spa: 80, spd: 85, spe: 102 } },
      blissey: { baseStats: { hp: 255, atk: 10, def: 10, spa: 75, spd: 135, spe: 55 } } };
    const set = (sp, hp) => ({ set: { species: sp, evs: { hp }, ivs: {} }, label: "Week 1" });
    const SMOGON = { mons: { garchomp: { hp: 252, share: 0.6 } } };
    const g1 = TS.guessMaxHp("Garchomp", [set("Garchomp", 4), set("Garchomp", 0), set("Garchomp", 248)], SMOGON, G);
    check("max HP guess: Smogon first, over the player's other sheets (252 HP)", g1.max_hp === 420 && g1.from === "smogon", JSON.stringify(g1));
    const g1b = TS.guessMaxHp("Garchomp", [set("Garchomp", 4), set("Garchomp", 0), set("Garchomp", 248)], {}, G);
    check("max HP guess: no Smogon entry -> the player's other sheets, majority (0 HP)", g1b.max_hp === 357 && g1b.from === "player", JSON.stringify(g1b));
    const g2 = TS.guessMaxHp("Garchomp", [set("Garchomp", 0), set("Garchomp", 252)], {}, G);
    check("max HP guess: a tie on the sheets goes to base stats (offensive: 0 HP)", g2.max_hp === 357 && g2.from === "stats", JSON.stringify(g2));
    const g3 = TS.guessMaxHp("Blissey", [set("Garchomp", 0)], SMOGON, G);
    check("max HP guess: no sheet or Smogon entry -> base stats (bulky: 252)", g3.max_hp === 714 && g3.from === "stats", JSON.stringify(g3));
    check("max HP guess: unknown species -> null", TS.guessMaxHp("Missingno", [], SMOGON, G) === null);
    const rows = [
      { replay_id: "g", player: "A", opponent: "B", mon_key: "p1: X", max_hp: 400, max_hp_from: "sheet", damage_taken_pct: 10,
        healing_pct: 0, hits_dealt: [["p2: Y", 50, false, "Tackle"]], move_stats: [{ move: "Tackle" }] },
      { replay_id: "g", player: "B", opponent: "A", mon_key: "p2: Y", max_hp: 300, max_hp_from: "Smogon", damage_taken_pct: 50,
        healing_pct: 0, hits_dealt: [["p1: X", 0, false, "Tackle"]] },
    ];
    RS.addDamageHp(rows);
    check("raw HP: a guessed max HP marks every figure that used it", rows[0].damage_dealt_hp === 150 && rows[0].hp_est.damage_dealt_hp &&
      !rows[0].hp_est.damage_taken_hp && rows[0].move_stats[0].dealt_hp_est && rows[1].hp_est.damage_taken_hp &&
      !rows[1].hp_est.damage_dealt_hp, JSON.stringify(rows.map((r) => r.hp_est)));
    const sum = RS.summarize(rows.map((r) => ({ ...r, brought: 1, won: 0, mvp: 0, mvp_score: 0 })));
    check("summary: a guess in any game marks the total", sum.find((a) => a.player === "A").hp_est.damage_dealt_hp === true);
  }
  {
    // what the game showed: first item / ability; nothing once Trick or Skill Swap could have changed it
    const rows = RS.gameRows({ id: "seen", log: ["|player|p1|A|", "|player|p2|B|", "|poke|p1|Gardevoir|", "|poke|p1|Ferrothorn|",
      "|poke|p2|Garchomp|", "|start", "|switch|p1a: Gardevoir|Gardevoir|100/100", "|switch|p2a: Garchomp|Garchomp|100/100",
      "|-ability|p1a: Gardevoir|Rough Skin|[from] ability: Trace|[of] p2a: Garchomp", "|turn|1",
      "|move|p1a: Gardevoir|Trick|p2a: Garchomp", "|-item|p2a: Garchomp|Choice Scarf|[from] move: Trick",
      "|-item|p1a: Gardevoir|Rocky Helmet|[from] move: Trick", "|move|p2a: Garchomp|Earthquake|p1a: Gardevoir",
      "|-damage|p1a: Gardevoir|50/100", "|-damage|p2a: Garchomp|84/100|[from] item: Rocky Helmet|[of] p1a: Gardevoir",
      "|turn|2", "|switch|p1a: Ferrothorn|Ferrothorn|100/100", "|-heal|p1a: Ferrothorn|100/100|[from] item: Leftovers",
      "|turn|3", "|win|A"].join("\n") });
    const got = Object.fromEntries(rows.map((r) => [r.pokemon, [r.seen_item, r.seen_ability]]));
    const exp = { Gardevoir: ["", "Trace"], Ferrothorn: ["Leftovers", ""], Garchomp: ["", "Rough Skin"] };
    check("seen set: Trace / Trick / Leftovers", same(got, exp), JSON.stringify(got));
  }

  // the user's league team, as copied off its Pokepaste page (``` around each set, trailing spaces)
  const FENCED = "```\nCeruledge @ Weakness Policy  \nAbility: Weak Armor  \nHappiness: 0  \nEVs: 4 HP / 252 Atk / 252 Spe  \n" +
    "Adamant Nature  \n- Will-O-Wisp  \n\n\n```\n\n\n```\nLopunny-Mega @ Lopunnite  \nAbility: Limber  \n" +
    "EVs: 252 Atk / 4 SpD / 252 Spe  \n\n\n```\n\n\n```\nSlowbro @ Heavy-Duty Boots  \nEVs: 248 HP / 252 Def / 8 SpD  \n" +
    "IVs: 0 Atk / 0 Spe  \n\n```\n\n```\nEnamorus (F) @ Choice Scarf  \nEVs: 4 HP / 252 SpA / 252 Spe  \n```\n\n```\n" +
    "Tinkaton @ Air Balloon  \nTera Type: Water  \nEVs: 4 HP / 252 SpD / 252 Spe  \n```\n\n```\nFlygon @ Life Orb  \n" +
    "EVs: 4 HP / 252 Atk / 252 Spe  \n\nhttps://pokepast.es/64b1ebbc35388025\n\n```\n";
  const league = TS.parseTeam(FENCED);
  // base HP (pokedex.json): Ceruledge 75, Lopunny-Mega 65, Slowbro 95, Enamorus 74, Tinkaton 85, Flygon 80
  const LDEX = { ceruledge: { baseStats: { hp: 75 } }, lopunnymega: { baseStats: { hp: 65 } },
    slowbro: { baseStats: { hp: 95 } }, enamorus: { baseStats: { hp: 74 } }, tinkaton: { baseStats: { hp: 85 } },
    flygon: { baseStats: { hp: 80 } } };
  check("fenced paste: 6 sets, items kept", same(league.map((s) => s.species + "@" + s.item), ["Ceruledge@Weakness Policy",
    "Lopunny-Mega@Lopunnite", "Slowbro@Heavy-Duty Boots", "Enamorus@Choice Scarf", "Tinkaton@Air Balloon", "Flygon@Life Orb"]),
    JSON.stringify(league.map((s) => s.species + "@" + s.item)));
  const lhp = league.map((s) => TS.maxHp(s, LDEX));
  check("fenced paste: max HP 292, 271, 393, 290, 312, 302", same(lhp, [292, 271, 393, 290, 312, 302]), JSON.stringify(lhp));
  check("fenced paste: Lopunny at team preview pairs with Lopunny-Mega",
    !!TS.pairSets(["Lopunny", "Ceruledge", "Slowbro", "Enamorus", "Tinkaton", "Flygon"], league));

  const PASTES = [
    ["https://pokepast.es/0123456789abcdef", "0123456789abcdef"],
    ["pokepast.es/ABCDEF0123456789/raw", "abcdef0123456789"],
    ["https://pokepast.es/1234", "1234"],
    ["Garchomp @ Choice Scarf", null],
  ];
  for (const [input, want] of PASTES) {
    const got = TS.pokepasteIdFrom(input);
    check(`pokepaste link: ${input}`, got === want, `got ${got}`);
  }
  const FITS = [["Zamazenta-*", "Zamazenta-Crowned", 1], ["Zamazenta-*", "Zamazenta", 1], ["Mew", "Mewtwo", 0],
    ["Zacian-Crowned", "Zacian", 1], ["Garchomp", "Garchomp", 2], ["Rotom-Wash", "Rotom-Heat", 0]];
  for (const [a, b, want] of FITS) check(`species fit: ${a} / ${b}`, TS.speciesFit(a, b) === want);
  const mews = TS.pairSets(["Mewtwo", "Mew"], TS.parseTeam("Mew\n\nMewtwo"));
  check("pair sets: Mew and Mewtwo not swapped", mews && mews[0].species === "Mewtwo" && mews[1].species === "Mew");

  {
    const replay = await (await fetch("fixtures/gen9nationaldex-2705111047.json")).json();
    const rows = RS.gameRows(replay);
    const jin = TS.parseTeam("Kingambit @ Black Glasses\n\nZoroark-Hisui @ Choice Specs\n\nGarchomp\n\n" +
      "Volcarona\n\nMamoswine\n\nGardevoir @ Choice Scarf");
    const flomarFive = TS.parseTeam("Weavile\n\nAmoonguss\n\nExcadrill\n\nSableye\n\nPrimarina");
    const matches = TS.attachSheets(rows, [{ sets: flomarFive }, { sets: jin }]);
    check("attach: only the full 6 matches", same(matches, [[], [["gen9nationaldex-2705111047", "jinrachi"]]]),
      JSON.stringify(matches));
    const item = (p, sp) => { const r = rows.find((x) => x.player === p && x.pokemon === sp); return r.set ? r.set.item : null; };
    check("attach: each row gets its own set", item("jinrachi", "Zoroark-Hisui") === "Choice Specs" &&
      item("jinrachi", "Gardevoir") === "Choice Scarf" && item("flomarV2", "Primarina") === null);
  }

  // ---- link parsing ----
  const LINKS = [
    ["https://replay.pokemonshowdown.com/gen9randombattle-2704944065", "gen9randombattle-2704944065"],
    ["https://replay.pokemonshowdown.com/gen9ou-2704944065?p2", "gen9ou-2704944065"],
    ["replay.pokemonshowdown.com/gen9ou-123.json", "gen9ou-123"],
    ["https://replay.pokemonshowdown.com/smogtours-gen9ou-812345", "smogtours-gen9ou-812345"],
    ["https://replay.pokemonshowdown.com/gen9ou-2704944065-abc123xyzpw", "gen9ou-2704944065-abc123xyzpw"],
    ["https://example.com/not-a-replay", null],
    ["hello", null],
    ["video-d5ivr2s_7de", "video-d5ivr2s_7de"],   // a stored game rebuilt from its stream (tools/add_game.py)
    ["video-short", null],
  ];
  for (const [input, want] of LINKS) {
    const got = RS.replayIdFrom(input);
    check(`link: ${input}`, got === want, `got ${got}`);
  }
  check("video game: replay_url is the video", RS.gameRows({ id: "video-d5ivr2s_7de", video: "https://youtu.be/d5iVr2s_7dE",
    log: ["|player|p1|A|", "|player|p2|B|", "|poke|p1|Pikachu|", "|poke|p2|Eevee|", "|start",
      "|switch|p1a: Pikachu|Pikachu|100/100", "|switch|p2a: Eevee|Eevee|100/100", "|turn|1", "|win|A"].join("\n") })[0].replay_url === "https://youtu.be/d5iVr2s_7dE");
  check("links: pasted block with duplicates", same(RS.replayIdsFromText(
    "gen9ou-1, https://replay.pokemonshowdown.com/gen9ou-2\n\ngen9ou-1 junk"), ["gen9ou-1", "gen9ou-2"]));

  // ---- how each game ended: [end_reason, turns] from the last -message / |win| / |turn| lines ----
  const ENDS = {
    "gen9championsvgc2026regmb-2691886643": ["normal", 11], "gen9championsvgc2026regmb-2691890620": ["normal", 10],
    "gen9championsvgc2026regmb-2688661099": ["normal", 7], "gen9championsvgc2026regmbbo3-2685575238": ["normal", 5],
    "gen9randombattle-2704944065": ["normal", 19], "gen9nationaldex-2705111047": ["normal", 19],
    "gen9nationaldex-2705121899": ["timer", 3], "gen9nationaldex-2705117998": ["timer", 22],
  };
  for (const [id, want] of Object.entries(ENDS)) {
    const rows = RS.gameRows(await (await fetch(`fixtures/${id}.json`)).json());
    const got = [...new Set(rows.map((r) => r.end_reason + "/" + r.turns))];
    check(`${id}: end reason, turns`, same(got, [want.join("/")]), `got ${got}`);
  }
  const endOf = (tail) => RS.parseBattle(HEAD + tail);
  const ff = endOf("|turn|2\n|-message|Bob forfeited.\n|win|Alice");
  check("end: forfeit", ff.endReason === "forfeit" && ff.turns === 2 && ff.winner === "Alice", JSON.stringify(ff.endReason));
  check("end: tie", endOf("|turn|4\n|tie").endReason === "tie" && endOf("|turn|4\n|tie").turns === 4);
  check("end: no |win| -> unfinished", endOf("|turn|2").endReason === "unfinished");
  check("end: chat line naming 'inactivity' is not a timer loss",
    endOf("|-message|Bob lost due to inactivity. lol\n|win|Alice").endReason === "normal");

  // ---- hazards, hand-counted: [hazard %, hazard KOs, set, removed] per brought Pokemon with any,
  //      and hazard turns per player ----
  const HAZARD_CASES = {
    // Garchomp: Stealth Rock + 3 Spikes; all 134% it dealt was rocks/spikes, none of it a KO
    "gen9nationaldex-2705111047": { mons: { "jinrachi|Garchomp": [134, 0, 4, 0] },
      turns: { jinrachi: 11, flomarV2: 0 } },
    // Garchomp's rocks (turn 11) Rapid Spun away by Terapagos on turn 13
    "gen9nationaldex-2705117998": { mons: { "RevivalSludge24|Garchomp": [0, 0, 1, 0], "Phlegathon|Terapagos": [0, 0, 0, 1] },
      turns: { RevivalSludge24: 2, Phlegathon: 0 } },
  };
  for (const [id, exp] of Object.entries(HAZARD_CASES)) {
    const rows = RS.gameRows(await (await fetch(`fixtures/${id}.json`)).json());
    const got = {}, turns = {};
    for (const r of rows) {
      turns[r.player] = r.hazard_turns;
      const v = [r.hazard_damage_pct, r.hazard_kills, r.hazards_set, r.hazards_removed];
      if (r.brought && v.some((x) => x)) got[`${r.player}|${r.pokemon}`] = v;
    }
    check(`${id}: hazards per Pokémon`, same(got, exp.mons), `expected ${JSON.stringify(exp.mons)}\ngot      ${JSON.stringify(got)}`);
    check(`${id}: hazard turns`, same(turns, exp.turns), JSON.stringify(turns));
  }
  const cc = RS.parseBattle(HEAD + `|move|p2a: Victim|Stealth Rock|p1a: Burner
|-sidestart|p1: Alice|move: Stealth Rock
|turn|2
|move|p1b: Rocker|Court Change|p1b: Rocker
|-swapsideconditions
|-activate|p1b: Rocker|move: Court Change
|turn|3
|switch|p2a: Third|Charizard, L50|20/100
|-damage|p2a: Third|0 fnt|[from] Stealth Rock
|faint|p2a: Third`);
  const rocker = cc.stats.get("p1: Rocker");
  check("hazards: Court Change user gets the swapped rocks' KO and damage",
    rocker.hazardKills === 1 && rocker.passive === 1 && cc.damage.get("p1: Rocker").hazard === 20 &&
    cc.stats.get("p2: Victim").hazardsSet === 1, JSON.stringify([rocker, cc.damage.get("p1: Rocker")]));
  check("hazards: turns up follow the swap", same(cc.hazardTurns, { p1: 2, p2: 1 }), JSON.stringify(cc.hazardTurns));
  const defog = RS.parseBattle(HEAD + `|move|p2a: Victim|Spikes|p1a: Burner
|-sidestart|p1: Alice|Spikes
|move|p1a: Burner|Stealth Rock|p2a: Victim
|-sidestart|p2: Bob|move: Stealth Rock
|turn|2
|move|p2b: Other|Defog|p1a: Burner
|-sideend|p1: Alice|Spikes|[from] move: Defog|[of] p2b: Other
|-sideend|p2: Bob|Stealth Rock|[from] move: Defog|[of] p2b: Other
|turn|3`);
  check("hazards: Defog counts only its own side", defog.stats.get("p2: Other").hazardsRemoved === 1 &&
    defog.stats.get("p1: Burner").hazardsSet === 1 && same(defog.hazardTurns, { p1: 1, p2: 1 }),
    JSON.stringify([defog.stats.get("p2: Other"), defog.hazardTurns]));

  // ---- healing and switches, hand-counted from gen9nationaldex-2705117998 ----
  {
    const rows = RS.gameRows(await (await fetch("fixtures/gen9nationaldex-2705117998.json")).json());
    const got = {};
    for (const r of rows) {
      const v = [r.healing_pct, r.healing_given_pct, r.switches, r.pivots, r.forced_out, r.faint_switch_ins];
      if (r.brought && v.some((x) => x)) got[r.pokemon] = v;
    }
    // Leftovers: Kingambit 6+7+6, Zamazenta 6+6+6+6+7; Terapagos' Tera Shift refill isn't healing.
    // Kyurem, Zamazenta, Latios switched out once each; Tapu Koko U-turned; 7 came in after a KO.
    const exp = { Kingambit: [19, 0, 0, 0, 0, 0], Zamazenta: [31, 0, 1, 0, 0, 1], Kyurem: [0, 0, 1, 0, 0, 0],
      Latios: [0, 0, 1, 0, 0, 1], "Tapu Koko": [0, 0, 0, 1, 0, 1], Dragonite: [0, 0, 0, 0, 0, 1],
      Garchomp: [0, 0, 0, 0, 0, 1], Mimikyu: [0, 0, 0, 0, 0, 1], Terapagos: [0, 0, 0, 0, 0, 1] };
    check("2705117998: healing and switches", same(got, exp), `expected ${JSON.stringify(exp)}\ngot      ${JSON.stringify(got)}`);
    check("2705117998: no hidden Zoroark", rows.every((r) => r.hidden_zoroark === 0));
    // local version: Showdown requests are refused before fetch is called
    RS.setLocalOnly(true);
    let called = false;
    const local = await RS.fetchReplay("x-1", async () => { called = true; return { ok: true, status: 200, json: async () => ({}) }; }, 50)
      .then(() => "loaded", (e) => e.message);
    RS.setLocalOnly(false);
    check("local version: no Showdown request", !called && /isn't contacted/.test(local), local);
    // game library: a stored game loads from site/games/, even in the local version
    RS.setLibrary(["x-2"]);
    RS.setLocalOnly(true);
    const asked = [];
    const stored = await RS.fetchReplay("x-2", async (url) => { asked.push(url); return { ok: true, status: 200, json: async () => ({ id: "x-2" }) }; }, 50)
      .then((r) => r.id, (e) => e.message);
    RS.setLocalOnly(false);
    RS.setLibrary([]);
    check("game library: loads the stored copy", stored === "x-2" && asked.join() === "games/x-2.json", `${stored} ${asked}`);
    // team preview shows 'Zamazenta-*'; the base form Zamazenta came in, so it's one brought row, not two
    const p2 = rows.filter((r) => r.player === "RevivalSludge24").map((r) => r.pokemon + (r.brought ? "" : " (not brought)"));
    check("2705117998: 'Zamazenta-*' matches base Zamazenta", p2.length === 6 && p2.includes("Zamazenta"), JSON.stringify(p2));
  }
  {
    const b = RS.parseBattle(HEAD + `|move|p1a: Burner|Wish|p1a: Burner
|move|p2a: Victim|Earthquake|p1a: Burner
|-damage|p1a: Burner|40/100
|-damage|p1b: Rocker|50/100
|move|p2b: Other|Giga Drain|p1b: Rocker
|-damage|p1b: Rocker|30/100
|-heal|p2b: Other|100/100|[from] drain|[of] p1b: Rocker
|turn|2
|-heal|p1a: Burner|90/100|[from] move: Wish|[wisher] Burner
|move|p1b: Rocker|Heal Pulse|p1a: Burner
|-heal|p1a: Burner|100/100
|move|p1b: Rocker|Rest|p1b: Rocker
|-status|p1b: Rocker|slp|[from] move: Rest
|-heal|p1b: Rocker|100/100 slp|[silent]
|move|p2a: Victim|Earthquake|p1a: Burner
|-damage|p1a: Burner|60/100
|-damage|p2b: Other|80/100
|move|p1b: Rocker|Healing Wish|p1b: Rocker
|faint|p1b: Rocker
|turn|3
|switch|p1b: Third|Clefable, L50|100/100
|detailschange|p1b: Third|Clefable, L50
|-heal|p1b: Third|100/100|[silent]
|move|p1a: Burner|Wish|p1a: Burner
|switch|p1a: Fourth|Blissey, L50|50/100
|-heal|p1a: Fourth|100/100|[from] move: Healing Wish
|turn|4
|-heal|p1a: Fourth|100/100|[from] move: Wish|[wisher] Burner`);
    const heal = (k) => b.healing.get(k) || { self: 0, given: 0 };
    // Burner: Wish on itself 50; Rocker: Heal Pulse 10 + Healing Wish 50 given, Rest 70 self; Other: drain 0
    // (it was at 100) then nothing; Third's forme-change refill and Fourth's capped Wish don't count
    check("healing: self vs given, by source", same(heal("p1: Burner"), { self: 50, given: 0 }) &&
      same(heal("p1: Rocker"), { self: 70, given: 60 }) && same(heal("p2: Other"), { self: 0, given: 0 }) &&
      same(heal("p1: Third"), { self: 0, given: 0 }), JSON.stringify([...b.healing]));
    check("healing: rows split self / given", b.heals.filter(([h]) => h === "p1: Rocker").length === 3, JSON.stringify(b.heals));
  }
  {
    const b = RS.parseBattle(HEAD + `|move|p2a: Victim|Leech Seed|p1a: Burner
|-start|p1a: Burner|move: Leech Seed
|-damage|p2a: Victim|70/100
|-damage|p1a: Burner|88/100|[from] Leech Seed|[of] p2a: Victim
|-heal|p2a: Victim|82/100|[silent]
|turn|2`);
    check("healing: Leech Seed heals the seeder (logged [silent])", same(b.healing.get("p2: Victim"), { self: 12, given: 0 }),
      JSON.stringify([...b.healing]));
  }
  {
    const b = RS.parseBattle(HEAD + `|move|p1a: Burner|U-turn|p2a: Victim
|-damage|p2a: Victim|80/100
|switch|p1a: Fourth|Blissey, L50|100/100|[from] U-turn
|move|p2a: Victim|Roar|p1a: Fourth
|drag|p1a: Burner|Sableye, L50|100/100
|turn|2
|switch|p2a: Fifth|Kingambit, L50|100/100
|move|p1a: Burner|Tackle|p2a: Fifth
|-enditem|p2a: Fifth|Eject Button
|switch|p2a: Victim|Garchomp, L50|80/100
|move|p2b: Other|Knock Off|p1b: Rocker
|-enditem|p1b: Rocker|Eject Button|[from] move: Knock Off|[of] p2b: Other
|move|p2a: Victim|Earthquake|p1b: Rocker
|-damage|p1b: Rocker|0 fnt
|faint|p1b: Rocker
|upkeep
|switch|p1b: Third|Clefable, L50|100/100
|turn|3`);
    const sw = (k) => { const s = b.stats.get(k); return [s.switches, s.pivots, s.forcedOut, s.faintSwitchIns]; };
    check("switches: pivot, dragged, ejected, voluntary, in after KO", same(sw("p1: Burner"), [0, 1, 0, 0]) &&
      same(sw("p1: Fourth"), [0, 0, 1, 0]) && same(sw("p2: Victim"), [1, 0, 0, 0]) && same(sw("p2: Fifth"), [0, 0, 1, 0]) &&
      same(sw("p1: Third"), [0, 0, 0, 1]) && same(sw("p1: Rocker"), [0, 0, 0, 0]),
      JSON.stringify([...b.stats].map(([k, s]) => [k, s.switches, s.pivots, s.forcedOut, s.faintSwitchIns])));
  }
  {
    const zoro = (switchIn) => RS.parseBattle(`|player|p1|Alice|
|player|p2|Bob|
|poke|p1|Zoroark-Hisui, L50|
|poke|p1|Gardevoir, L50|
|poke|p2|Garchomp, L50|
|switch|p1a: Gardy|Gardevoir, L50|100/100
|switch|p2a: Foe|Garchomp, L50|100/100
|turn|1
${switchIn}`).hiddenZoroark;
    check("hidden Zoroark: flagged when it never shows itself", same(zoro(""), { p1: true, p2: false }));
    check("hidden Zoroark: not flagged once revealed",
      same(zoro("|replace|p1a: Zoro|Zoroark-Hisui, L50"), { p1: false, p2: false }));
    // brought 1 of 2 and that one was seen: Zoroark stayed home
    check("hidden Zoroark: not flagged when as many were seen as brought",
      same(zoro("|teamsize|p1|1").p1, false) && same(zoro("|teamsize|p1|2").p1, true));
  }
  // ---- hidden Zoroark: stints read as Zoroark (opts.illusion) and illusion.js's checks ----
  {
    // Zoroark (shown as Gardevoir, stint 1) burns Garchomp (10%) and KOs Foe2 with Night Daze; the real Gardevoir
    // (stint 3) comes in at 100% after "Gardevoir" left at 60%, then KOs Garchomp with Moonblast
    const log = `|player|p1|Alice|
|player|p2|Bob|
|poke|p1|Zoroark, L50|
|poke|p1|Gardevoir, L50|
|poke|p1|Blissey, L50|
|poke|p2|Garchomp, L50|
|poke|p2|Ferrothorn, L50|
|teamsize|p1|3
|switch|p1a: Gardy|Gardevoir, L50|100/100
|switch|p2a: Foe|Garchomp, L50|100/100
|turn|1
|move|p1a: Gardy|Will-O-Wisp|p2a: Foe
|-status|p2a: Foe|brn
|move|p2a: Foe|Stealth Rock|p1a: Gardy
|-damage|p2a: Foe|90/100 brn|[from] brn
|turn|2
|switch|p2a: Foe2|Ferrothorn, L50|100/100
|move|p1a: Gardy|Night Daze|p2a: Foe2
|-damage|p2a: Foe2|0 fnt
|faint|p2a: Foe2
|-damage|p1a: Gardy|60/100|[from] Life Orb
|switch|p2a: Foe|Garchomp, L50|90/100 brn
|turn|3
|switch|p1a: Blob|Blissey, L50|100/100
|-damage|p1a: Blob|88/100|[from] Stealth Rock
|move|p2a: Foe|Earthquake|p1a: Blob
|-damage|p1a: Blob|50/100
|turn|4
|switch|p1a: Gardy|Gardevoir, L50|100/100
|-damage|p1a: Gardy|88/100|[from] Stealth Rock
|move|p1a: Gardy|Moonblast|p2a: Foe
|-damage|p2a: Foe|0 fnt
|faint|p2a: Foe
|win|Alice`;
    const plain = RS.parseBattle(log), moved = RS.parseBattle(log, { illusion: { p1: [1] } });
    const k = (b, key) => { const s = b.stats.get(key) || {}; return [s.direct || 0, s.passive || 0, s.deaths || 0]; };
    check("illusion pick: disguised kill moves to Zoroark", same(k(plain, "p1: Gardy"), [2, 0, 0]) &&
      same(k(moved, "p1: Zoroark"), [1, 0, 0]) && same(k(moved, "p1: Gardy"), [1, 0, 0]),
      JSON.stringify([...moved.stats].map(([key, s]) => [key, s.direct, s.passive, s.deaths])));
    check("illusion pick: burn, Life Orb and moves go with it", same(moved.damage.get("p1: Zoroark"), { dealt: 110, taken: 40, hazard: 0 }) &&
      [...moved.moves.get("p1: Zoroark").keys()].join() === "Will-O-Wisp,Night Daze,Burn (status)" &&
      [...moved.moves.get("p1: Gardy").keys()].join() === "Moonblast",
      JSON.stringify([moved.damage.get("p1: Zoroark"), [...moved.moves.get("p1: Zoroark").keys()]]));
    check("illusion pick: still flagged as hidden", moved.hiddenZoroark.p1 === true && moved.species.get("p1: Zoroark") === "Zoroark");

    const learn = Illusion.parseLearnsets({ zoroark: "willowisp nightdaze uturn", gardevoir: "willowisp moonblast",
      blissey: "softboiled", garchomp: "earthquake stealthrock", ferrothorn: "leechseed" });
    const a = Illusion.analyze(plain.illusion.p1, learn, null);
    const v = Object.fromEntries(a.stints.map((s) => [s.n, s.verdict]));
    // stint 1: Gardevoir can't learn Night Daze; 2 (Blissey): hit by Earthquake; 3: Zoroark can't learn Moonblast
    check("illusion check: proof, hit, move", same(v, { 1: "zoroark", 2: "not", 3: "not" }) && same(a.proven, [1]),
      JSON.stringify(a.stints.map((s) => [s.n, s.verdict, s.why])));
    // without Night Daze: stint 1 left at 60%, stint 3 came in at 100% (no Regenerator), so one of them was Zoroark;
    // stint 3 used Moonblast, so it's stint 1
    const hp = Illusion.analyze(RS.parseBattle(log.replace("Night Daze", "Will-O-Wisp")).illusion.p1, learn, null);
    check("illusion check: HP that doesn't carry over", same(hp.proven, [1]) && /left on turn 3 at 60%/.test(hp.stints[0].why),
      JSON.stringify(hp.stints.map((s) => [s.n, s.verdict, s.why])));
    // with nothing to go on, every stint that wasn't hit stays a maybe and nothing is moved
    const none = Illusion.analyze(RS.parseBattle(log.replace("Night Daze", "Will-O-Wisp").replace("60/100|[from] Life Orb", "100/100|[from] Life Orb")).illusion.p1, learn, null);
    check("illusion check: no proof, no pick", same(none.proven, []) && none.stints[0].verdict === "maybe",
      JSON.stringify(none.stints.map((s) => [s.n, s.verdict, s.why])));
  }
  {
    // gen9nationaldex-2696941700: nezergy's Zoroark-Hisui never revealed; "Donphan" used Shadow Ball (stint 1,
    // turns 1-3) and U-turn (stint 8, turn 10), which Donphan can't learn. Hand-counted: Zoroark-Hisui KOs
    // Rotom-Heat (turn 2, Shadow Ball); Donphan KOs Slowking (turn 28) and faints (turn 29).
    const replay = await (await fetch("fixtures/gen9nationaldex-2696941700.json")).json();
    const learn = await Illusion.loadLearnsets("../site/data/learnsets.json");
    const dex = await (await fetch("../site/data/pokedex.json")).json();
    const b = RS.parseBattle(replay.log);
    const a = Illusion.analyze(b.illusion.p1, learn, dex);
    check("2696941700: stints 1 and 8 proven Zoroark", same(a.proven, [1, 8]),
      JSON.stringify(a.stints.filter((s) => s.verdict !== "not").map((s) => [s.n, s.shown, s.verdict, s.why])));
    const rows = RS.gameRows({ ...replay, illusion: { p1: a.proven } });
    const r = (sp) => rows.find((x) => x.player === "nezergy" && x.pokemon === sp) || {};
    check("2696941700: Zoroark-Hisui 1 kill, Donphan 1 kill 1 death",
      same([r("Zoroark-Hisui").kills, r("Zoroark-Hisui").deaths, r("Zoroark-Hisui").brought, r("Donphan").kills, r("Donphan").deaths], [1, 0, 1, 1, 1]),
      JSON.stringify(rows.filter((x) => x.player === "nezergy").map((x) => [x.pokemon, x.kills, x.deaths, x.brought])));
  }
  {
    const b = RS.parseBattle(HEAD + `|move|p2a: Victim|Earthquake|p1a: Burner
|-damage|p1a: Burner|40/100
|-activate|p1a: Burner|ability: Emergency Exit
|switch|p1a: Fourth|Blissey, L50|50/100
|turn|2
|-enditem|p2b: Other|Eject Pack
|turn|3
|switch|p2b: Fifth|Kingambit, L50|100/100
|move|p1b: Rocker|Surf|p2a: Victim
|-damage|p2a: Victim|60/100
|-heal|p1a: Fourth|100/100|[from] ability: Water Absorb|[of] p1b: Rocker
|move|p1b: Rocker|Parting Shot|p2a: Victim|[zeffect]
|-activate|p1b: Rocker|healreplacement
|switch|p1b: Third|Clefable, L50|100/100|[from] Parting Shot
|-heal|p1b: Third|100/100|[from] move: Parting Shot|[zeffect]`);
    const st = (k) => { const s = b.stats.get(k); return [s.switches, s.forcedOut]; };
    check("switches: Emergency Exit is forced; an unused eject expires at the turn's end",
      same(st("p1: Burner"), [0, 1]) && same(st("p2: Other"), [1, 0]), JSON.stringify([st("p1: Burner"), st("p2: Other")]));
    // Third came in at 100, so the Z heal restores 0; Water Absorb from an ally's Surf counts for the holder
    check("healing: Water Absorb [of] an ally is not healing given", !b.heals.some(([h]) => h === "p1: Rocker") &&
      same(b.healing.get("p1: Fourth"), { self: 50, given: 0 }),
      JSON.stringify(b.heals));
  }
  {
    const b = RS.parseBattle(HEAD + `|move|p1a: Burner|Tackle|p1b: Rocker
|-damage|p1b: Rocker|30/100
|move|p1b: Rocker|Memento|p2a: Victim|[zeffect]
|-activate|p1b: Rocker|healreplacement
|faint|p1b: Rocker
|upkeep
|switch|p1b: Third|Clefable, L50|40/100
|-heal|p1b: Third|100/100|[from] move: Memento|[zeffect]`);
    check("healing: Z-Memento's heal is given by the Memento user", same(b.healing.get("p1: Rocker"), { self: 0, given: 60 }),
      JSON.stringify([...b.healing]));
  }
  {
    // healing in HP: own max HP for self-healing, the teammate's for healing given
    const rows = [
      { replay_id: "g", player: "A", opponent: "B", mon_key: "p1: H", max_hp: 400, damage_taken_pct: 0,
        healing_pct: 25, heals_given: [["p1: T", 50]] },
      { replay_id: "g", player: "A", opponent: "B", mon_key: "p1: T", max_hp: 300, damage_taken_pct: 0,
        healing_pct: 0, heals_given: [] },
    ];
    RS.addDamageHp(rows);
    check("healing HP: self x own max, given x teammate's max", rows[0].healing_hp === 100 && rows[0].healing_given_hp === 150 &&
      rows[1].healing_given_hp === 0, JSON.stringify(rows.map((r) => [r.healing_hp, r.healing_given_hp])));
  }

  // ---- luck: event counts from real replays (hand-counted from each log; unlisted brought Pokemon all 0) ----
  const LUCK_FIELDS = ["crits", "crits_taken", "misses", "dodges", "full_paras", "sleep_turns", "flinched", "confusion_hits", "procs"];
  const LUCK_REAL = {
    // Skeledirge's 2 Torch Song crits; Gardevoir's Focus Blast misses Snorlax; Snorlax sleeps 3 turns (Rest);
    // Pelipper's Scald burns Snorlax (Shedinja's Will-O-Wisp is a status move, not a secondary)
    "gen9nationaldex-2705099074": {
      "keiner23|Skeledirge": { crits: 2 }, "Mrfarofazeze|Snorlax": { crits_taken: 1, dodges: 1, sleep_turns: 3 },
      "Mrfarofazeze|Kingambit": { crits_taken: 1 }, "keiner23|Gardevoir": { misses: 1 }, "keiner23|Pelipper": { procs: 1 } },
    // the disguised Zoroark-Hisui sleeps 2 turns from Spore; Garchomp sleeps 1 turn and wakes; Flame Body is an ability
    "gen9nationaldex-2705111047": { "jinrachi|Zoroark-Hisui": { sleep_turns: 2 }, "jinrachi|Garchomp": { sleep_turns: 1 } },
    "gen9nationaldex-2705117998": {},
    "gen9nationaldex-2705121899": {},
  };
  for (const [id, exp] of Object.entries(LUCK_REAL)) {
    let replay;
    try {
      replay = await (await fetch(`fixtures/${id}.json`)).json();
    } catch (e) {
      check(`${id}: load fixture`, false, String(e));
      continue;
    }
    const got = {}, want = {};
    for (const r of RS.gameRows(replay).filter((r) => r.brought)) {
      const k = r.player + "|" + r.pokemon;
      got[k] = Object.fromEntries(LUCK_FIELDS.map((f) => [f, r[f]]));
      want[k] = Object.fromEntries(LUCK_FIELDS.map((f) => [f, (exp[k] || {})[f] || 0]));
    }
    const diff = Object.keys(want).filter((k) => !same(got[k], want[k]));
    check(`${id}: luck counts`, !diff.length, diff.map((k) => `${k}: expected ${JSON.stringify(want[k])} got ${JSON.stringify(got[k])}`).join("\n"));
  }

  // ---- luck: scoring with a small move table (values worked out by hand from the odds) ----
  const LK = window.Luck;
  const L_MOVES = {
    hurricane: { accuracy: 70, category: "Special", secondary: { chance: 30, volatileStatus: "confusion" } },
    tackle: { accuracy: 100, category: "Physical" },
    stoneedge: { accuracy: 80, category: "Physical", critRatio: 2 },
    scald: { accuracy: 100, category: "Special", secondary: { chance: 30, status: "brn" } },
    ironhead: { accuracy: 100, category: "Physical", secondary: { chance: 30, volatileStatus: "flinch" } },
    toxic: { accuracy: 90, category: "Status" }, spore: { accuracy: 100, category: "Status" },
    protect: { accuracy: true, category: "Status" }, rest: { accuracy: true, category: "Status" },
    focusenergy: { accuracy: true, category: "Status" },
    seismictoss: { accuracy: 100, category: "Physical", damage: "level" },
    focusblast: { accuracy: 70, category: "Special", secondary: { chance: 10, boosts: { spd: -1 } } },
    tripleaxel: { accuracy: 90, category: "Physical", multihit: 3, multiaccuracy: true },
    bulletseed: { accuracy: 100, category: "Physical", multihit: [2, 5] },
  };
  const L_DEX = { pelipper: { types: ["Water", "Flying"] }, garchomp: { types: ["Dragon", "Ground"] },
    toxapex: { types: ["Poison", "Water"] }, heatran: { types: ["Fire", "Steel"] },
    dragonite: { types: ["Dragon", "Flying"], abilities: { 0: "Inner Focus", H: "Multiscale" } },
    togekiss: { types: ["Fairy", "Flying"], abilities: { 0: "Hustle", 1: "Serene Grace", H: "Super Luck" } } };
  const lhead = (a = "Pelipper, L50|100/100", b = "Garchomp, L50|100/100") =>
    `|player|p1|Alice|\n|player|p2|Bob|\n|switch|p1a: A|${a}\n|switch|p2a: B|${b}\n|turn|1\n`;
  const luckOf = (log, sets) => {
    const { byMon } = LK.scoreGame(RS.parseBattle(log).rolls, { moves: L_MOVES, dex: L_DEX }, sets);
    return Object.fromEntries([...byMon].map(([k, v]) => [k, [Math.round(v.luck * 1000) / 1000, Math.round(v.against * 1000) / 1000]]));
  };
  const hitB = "|-damage|p2a: B|60/100";
  const LUCK_CASES = {
    "70% move hits: +0.3 (and a normal hit -1/24)": [lhead() + `|move|p1a: A|Hurricane|p2a: B\n${hitB}`,
      { "p1: A": [0.258, 0], "p2: B": [0, 0.258] }],
    "70% move misses: -0.7": [lhead() + "|move|p1a: A|Hurricane|p2a: B|[miss]\n|-miss|p1a: A|p2a: B",
      { "p1: A": [-0.7, 0], "p2: B": [0, -0.7] }],
    "Hurricane in rain can't miss": [lhead() + `|-weather|RainDance\n|move|p1a: A|Hurricane|p2a: B\n${hitB}`,
      { "p1: A": [-0.042, 0], "p2: B": [0, -0.042] }],
    "Protect: no accuracy roll": [lhead() + "|move|p2a: B|Protect|p2a: B\n|-singleturn|p2a: B|Protect\n" +
      "|move|p1a: A|Hurricane|p2a: B\n|-activate|p2a: B|move: Protect", {}],
    "crit: +23/24": [lhead() + `|move|p1a: A|Tackle|p2a: B\n|-crit|p2a: B\n${hitB}`, { "p1: A": [0.958, 0], "p2: B": [0, 0.958] }],
    "Stone Edge: 80% hit + 1/8 crit": [lhead() + `|move|p1a: A|Stone Edge|p2a: B\n|-crit|p2a: B\n${hitB}`,
      { "p1: A": [1.075, 0], "p2: B": [0, 1.075] }],
    "Focus Energy + Stone Edge always crits": [lhead() + "|move|p1a: A|Focus Energy|p1a: A\n|-start|p1a: A|move: Focus Energy\n" +
      `|turn|2\n|move|p1a: A|Stone Edge|p2a: B\n|-crit|p2a: B\n${hitB}`, { "p1: A": [0.2, 0], "p2: B": [0, 0.2] }],
    "Seismic Toss: no crit roll": [lhead() + `|move|p1a: A|Seismic Toss|p2a: B\n${hitB}`, {}],
    "Scald burns: +0.7": [lhead() + `|move|p1a: A|Scald|p2a: B\n${hitB}\n|-status|p2a: B|brn`,
      { "p1: A": [0.658, 0], "p2: B": [0, 0.658] }],
    "Scald doesn't burn: -0.3": [lhead() + `|move|p1a: A|Scald|p2a: B\n${hitB}`, { "p1: A": [-0.342, 0], "p2: B": [0, -0.342] }],
    "Scald on a Fire type: no burn roll": [lhead(undefined, "Heatran, L50|100/100") + `|move|p1a: A|Scald|p2a: B\n${hitB}`,
      { "p1: A": [-0.042, 0], "p2: B": [0, -0.042] }],
    "Scald on a statused target: no burn roll": [lhead(undefined, "Garchomp, L50|100/100 par") + `|move|p1a: A|Scald|p2a: B\n${hitB}`,
      { "p1: A": [-0.042, 0], "p2: B": [0, -0.042] }],
    "Iron Head flinches: +0.7": [lhead() + `|move|p1a: A|Iron Head|p2a: B\n${hitB}\n|cant|p2a: B|flinch`,
      { "p1: A": [0.658, 0], "p2: B": [0, 0.658] }],
    "Iron Head, target moves after: -0.3": [lhead() + `|move|p1a: A|Iron Head|p2a: B\n${hitB}\n|move|p2a: B|Tackle|p1a: A\n|-damage|p1a: A|50/100`,
      { "p1: A": [-0.342, -0.042], "p2: B": [-0.042, -0.342] }],
    "Iron Head after the target moved: no flinch roll": [lhead() + `|move|p2a: B|Tackle|p1a: A\n|-damage|p1a: A|50/100\n|move|p1a: A|Iron Head|p2a: B\n${hitB}`,
      { "p1: A": [-0.042, -0.042], "p2: B": [-0.042, -0.042] }],
    "paralysis: full para -0.75, moving +0.25": [lhead("Pelipper, L50|100/100 par") +
      "|cant|p1a: A|par\n|turn|2\n|move|p1a: A|Protect|p1a: A", { "p1: A": [-0.5, 0] }],
    "sleep: 1st turn no roll, stays asleep on the 2nd -1/3, wakes on the 3rd +1/2": [lhead() +
      "|move|p2a: B|Spore|p1a: A\n|-status|p1a: A|slp|[from] move: Spore\n|turn|2\n|cant|p1a: A|slp\n|turn|3\n|cant|p1a: A|slp\n" +
      "|turn|4\n|-curestatus|p1a: A|slp|[msg]\n|move|p1a: A|Protect|p1a: A", { "p1: A": [0.167, 0] }],
    "Rest: fixed sleep, no luck": [lhead() + "|move|p1a: A|Rest|p1a: A\n|-status|p1a: A|slp|[from] move: Rest\n|turn|2\n" +
      "|cant|p1a: A|slp\n|turn|3\n|cant|p1a: A|slp\n|turn|4\n|-curestatus|p1a: A|slp|[msg]\n|move|p1a: A|Protect|p1a: A", {}],
    "Chesto Berry wake-up isn't a roll": [lhead() + "|move|p2a: B|Spore|p1a: A\n|-status|p1a: A|slp|[from] move: Spore\n|turn|2\n" +
      "|cant|p1a: A|slp\n|turn|3\n|-enditem|p1a: A|Chesto Berry|[eat]\n|-curestatus|p1a: A|slp|[msg]\n|move|p1a: A|Protect|p1a: A", {}],
    "confusion: self-hit -0.67, passing +0.33": [lhead() + "|-activate|p1a: A|confusion\n|-damage|p1a: A|80/100|[from] confusion\n" +
      "|turn|2\n|-activate|p1a: A|confusion\n|move|p1a: A|Protect|p1a: A", { "p1: A": [-0.34, 0] }],
    "freeze: stays frozen -0.2, thaws +0.8": [lhead("Pelipper, L50|100/100 frz") + "|cant|p1a: A|frz\n|turn|2\n" +
      "|-curestatus|p1a: A|frz|[msg]\n|move|p1a: A|Protect|p1a: A", { "p1: A": [0.6, 0] }],
    "Toxic by a Poison type can't miss": [lhead("Toxapex, L50|100/100") + "|move|p1a: A|Toxic|p2a: B\n|-status|p2a: B|tox", {}],
    "Toxic by a non-Poison type: 90%": [lhead() + "|move|p1a: A|Toxic|p2a: B\n|-status|p2a: B|tox", { "p1: A": [0.1, 0], "p2: B": [0, 0.1] }],
  };
  for (const [name, [log, expected]] of Object.entries(LUCK_CASES)) {
    const got = luckOf(log);
    check(`luck: ${name}`, same(got, expected), `expected ${JSON.stringify(expected)}\ngot      ${JSON.stringify(got)}`);
  }
  // ---- key moments: which rolls count, their words and turns ----
  {
    const named = (id, name) => ({ ...L_MOVES[id], name });
    const KM_MOVES = { ...L_MOVES, tackle: named("tackle", "Tackle"), hurricane: named("hurricane", "Hurricane"),
      scald: named("scald", "Scald"), stoneedge: named("stoneedge", "Stone Edge"),
      hydropump: { accuracy: 80, category: "Special", name: "Hydro Pump" } };
    const momentsOf = (log) => LK.keyMoments(LK.scoreGame(RS.parseBattle(log).rolls, { moves: KM_MOVES, dex: L_DEX }).events)
      .map((m) => `${m.turn} ${m.form}: ${m.text} ${Math.round(m.chance * 100)}`);
    const KM_CASES = {
      "crit KO": [lhead() + "|move|p1a: A|Tackle|p2a: B\n|-crit|p2a: B\n|-damage|p2a: B|0 fnt\n|faint|p2a: B",
        ["1 Pelipper: crit Tackle KO'd Garchomp 4"]],
      "normal hit: nothing": [lhead() + `|move|p1a: A|Tackle|p2a: B\n${hitB}`, []],
      "crit that didn't KO": [lhead() + `|move|p1a: A|Tackle|p2a: B\n|-crit|p2a: B\n${hitB}`, ["1 Pelipper: crit Tackle on Garchomp 4"]],
      "70% move misses: under 80%, nothing": [lhead() + "|move|p1a: A|Hurricane|p2a: B|[miss]\n|-miss|p1a: A|p2a: B", []],
      "80% move misses": [lhead() + "|move|p1a: A|Stone Edge|p2a: B|[miss]\n|-miss|p1a: A|p2a: B",
        ["1 Pelipper: Stone Edge missed Garchomp (80% to hit) 20"]],
      "Hydro Pump misses: always, even at -1 accuracy": [lhead() + "|-unboost|p1a: A|accuracy|1\n" +
        "|move|p1a: A|Hydro Pump|p2a: B|[miss]\n|-miss|p1a: A|p2a: B", ["1 Pelipper: Hydro Pump missed Garchomp (60% to hit) 40"]],
      "Scald burns": [lhead() + `|turn|2\n|move|p1a: A|Scald|p2a: B\n${hitB}\n|-status|p2a: B|brn`, ["2 Pelipper: Scald burned Garchomp 30"]],
      "fully paralyzed twice in a row: one moment": [lhead() + "|-status|p1a: A|par\n|cant|p1a: A|par\n|turn|2\n|cant|p1a: A|par",
        ["1 Pelipper: fully paralyzed 2 turns in a row 6"]],
    };
    for (const [name, [log, expected]] of Object.entries(KM_CASES)) {
      const got = momentsOf(log);
      check(`key moments: ${name}`, same(got, expected), `expected ${JSON.stringify(expected)}\ngot      ${JSON.stringify(got)}`);
    }
  }
  {
    const hurricane = lhead() + `|move|p1a: A|Hurricane|p2a: B\n${hitB}`;
    const ng = luckOf(hurricane, new Map([["p1: A", { ability: "No Guard", item: "" }]]));
    check("luck: No Guard from a team sheet: no accuracy roll", same(ng, { "p1: A": [-0.042, 0], "p2: B": [0, -0.042] }), JSON.stringify(ng));
    const ce = luckOf(lhead() + `|move|p1a: A|Focus Blast|p2a: B\n${hitB}`, new Map([["p1: A", { ability: "Compound Eyes", item: "" }]]));
    check("luck: Compound Eyes 70% -> 91%", same(ce, { "p1: A": [0.048, 0], "p2: B": [0, 0.048] }), JSON.stringify(ce));
    const revealed = luckOf(lhead() + "|-ability|p1a: A|No Guard\n" + `|move|p1a: A|Hurricane|p2a: B\n${hitB}`);
    check("luck: No Guard revealed in the log", same(revealed, { "p1: A": [-0.042, 0], "p2: B": [0, -0.042] }), JSON.stringify(revealed));

    // abilities nobody revealed: a roll counts only if every ability the species can have gives the same odds
    const sheet = (key, ability, item = "") => new Map([[key, { ability, item }]]);
    const dnite = lhead(undefined, "Dragonite, L50|100/100") + `|move|p1a: A|Iron Head|p2a: B\n${hitB}\n|cant|p2a: B|flinch`;
    const AB_CASES = {
      "maybe-Inner Focus Dragonite: no flinch roll": [dnite, undefined, { "p1: A": [-0.042, 0], "p2: B": [0, -0.042] }],
      "Dragonite with Multiscale on its sheet: flinch counts": [dnite, sheet("p2: B", "Multiscale"),
        { "p1: A": [0.658, 0], "p2: B": [0, 0.658] }],
      "revealed Mold Breaker ignores Inner Focus": [lhead(undefined, "Dragonite, L50|100/100") + "|-ability|p1a: A|Mold Breaker\n" +
        `|move|p1a: A|Iron Head|p2a: B\n${hitB}\n|cant|p2a: B|flinch`, undefined, { "p1: A": [0.658, 0], "p2: B": [0, 0.658] }],
      "maybe-Super Luck Togekiss: no crit roll": [lhead("Togekiss, L50|100/100") + `|move|p1a: A|Tackle|p2a: B\n${hitB}`, undefined, {}],
      "Togekiss with Serene Grace on its sheet: crit counts": [lhead("Togekiss, L50|100/100") + `|move|p1a: A|Tackle|p2a: B\n${hitB}`,
        sheet("p1: A", "Serene Grace"), { "p1: A": [-0.042, 0], "p2: B": [0, -0.042] }],
    };
    // multi-hit: Triple Axel rolls accuracy per hit (an early stop is the unlogged miss); 2-5 hits score
    // P(fewer) - P(more): 2 = -0.65, 3 = +0.05, 4 = +0.55, 5 = +0.85; Loaded Dice 4 = -0.5, 5 = +0.5
    const axel = (n) => lhead() + "|move|p1a: A|Triple Axel|p2a: B\n" +
      ["|-damage|p2a: B|80/100", "|-damage|p2a: B|60/100", "|-damage|p2a: B|40/100"].slice(0, n).join("\n") + `\n|-hitcount|p2a: B|${n}`;
    const seed = (hps) => lhead() + "|move|p1a: A|Bullet Seed|p2a: B\n" + hps.map((h) => `|-damage|p2a: B|${h}`).join("\n") +
      `\n|-hitcount|p2a: B|${hps.length}`;
    const known = sheet("p1: A", "Drizzle", "Leftovers");
    Object.assign(AB_CASES, {
      "Triple Axel, item unknown: first accuracy roll only": [axel(2), undefined, { "p1: A": [0.017, 0], "p2: B": [0, 0.017] }],
      "Triple Axel stops after 2 hits: +0.1 +0.1 -0.9": [axel(2), known, { "p1: A": [-0.783, 0], "p2: B": [0, -0.783] }],
      "Triple Axel hits 3 times: 3 x +0.1": [axel(3), known, { "p1: A": [0.175, 0], "p2: B": [0, 0.175] }],
      "Bullet Seed 5 hits: +0.85": [seed(["90/100", "80/100", "70/100", "60/100", "50/100"]), known,
        { "p1: A": [0.642, 0], "p2: B": [0, 0.642] }],
      "Bullet Seed, item unknown: no hit-count roll": [seed(["90/100", "80/100", "70/100", "60/100", "50/100"]), undefined,
        { "p1: A": [-0.208, 0], "p2: B": [0, -0.208] }],
      "Bullet Seed with Loaded Dice, 4 hits: -0.5": [seed(["90/100", "80/100", "70/100", "60/100"]), sheet("p1: A", "Drizzle", "Loaded Dice"),
        { "p1: A": [-0.667, 0], "p2: B": [0, -0.667] }],
      "Bullet Seed KOs on hit 3: count cut short, no roll": [seed(["50/100", "20/100", "0 fnt"]), known,
        { "p1: A": [-0.125, 0], "p2: B": [0, -0.125] }],
    });
    // variance: a yes/no roll with chance p adds p(1 - p) (a crit roll 23/576); 2-5 hits 0.3025, Loaded Dice 0.25
    const varOf = (log, sets) => Math.round(LK.scoreGame(RS.parseBattle(log).rolls, { moves: L_MOVES, dex: L_DEX }, sets)
      .byMon.get("p1: A").luckVar * 10000) / 10000;
    const vs = [varOf(seed(["90/100", "80/100", "70/100", "60/100", "50/100"]), known),
      varOf(seed(["90/100", "80/100", "70/100", "60/100"]), sheet("p1: A", "Drizzle", "Loaded Dice"))];
    check("luck variance: 5 crit rolls + hit count; with Loaded Dice 4 + 0.25", JSON.stringify(vs) === "[0.5022,0.4097]", JSON.stringify(vs));
    for (const [name, [log, sets, expected]] of Object.entries(AB_CASES)) {
      const got = luckOf(log, sets);
      check(`luck: ${name}`, same(got, expected), `expected ${JSON.stringify(expected)}\ngot      ${JSON.stringify(got)}`);
    }

    // the page's path: a sheet matched to a side (row.set) settles the ability for addLuck
    {
      const rows = RS.gameRows({ id: "test-2", log: "|poke|p1|Pelipper|\n|poke|p2|Dragonite|\n" + dnite + "\n|win|Alice" });
      LK.addLuck(rows, { moves: L_MOVES, dex: L_DEX });
      const before = rows.find((r) => r.player === "Alice").luck;
      rows.find((r) => r.player === "Bob").set = { ability: "Multiscale", item: "" };
      LK.addLuck(rows, { moves: L_MOVES, dex: L_DEX });
      const after = rows.find((r) => r.player === "Alice").luck;
      check("luck rows: a team sheet's ability turns the flinch roll on", before === -0.04 && after === 0.66, JSON.stringify([before, after]));
    }

    // rows: player_luck = own side's luck - the opponent's; blanks without move data
    const replay = { id: "test-1", log: "|poke|p1|Pelipper|\n|poke|p2|Garchomp|\n" + lhead("Pelipper, L50|100/100 par") +
      "|cant|p1a: A|par\n|turn|2\n|move|p2a: B|Tackle|p1a: A\n|-crit|p1a: A\n|-damage|p1a: A|10/100\n|win|Bob" };
    const rows = RS.gameRows(replay);
    LK.addLuck(rows, { moves: L_MOVES, dex: L_DEX });
    const lr = rows.map((r) => [r.player, r.luck, r.luck_against, r.player_luck]);
    check("luck rows: luck, luck against, player luck", same(lr, [["Alice", -0.75, 0.96, -1.71], ["Bob", 0.96, 0, 1.71]]), JSON.stringify(lr));
    // full para roll 3/4 * 1/4 = 0.1875; Bob's crit roll 23/576; the game's spread is both sides'
    const lv = rows.map((r) => [r.luck_var, r.player_luck_var]);
    check("luck rows: variance of luck and player luck", same(lv, [[0.1875, 0.2274], [0.0399, 0.2274]]), JSON.stringify(lv));
    // what the hover lists (moves without a name in the data show their id)
    const top = (r, f) => r[f].map((g) => `${g.label} ${g.v} ${g.n}`).join("; ");
    check("luck top: a Pokémon's own rolls", top(rows[0], "luck_top") === "fully paralyzed -0.75 1", top(rows[0], "luck_top"));
    check("luck top: player's view, opponent's rolls counted against", top(rows[0], "player_luck_top") ===
      "their Garchomp: crit with tackle -0.96 1; Pelipper: fully paralyzed -0.75 1", top(rows[0], "player_luck_top"));
    const grouped = LK.topContributors([{ label: "no crits", v: -0.04 }, { label: "no crits", v: -0.04 }, { label: "x", v: 0.01 }], () => 1);
    check("luck top: same label adds up, tiny ones dropped", JSON.stringify(grouped) === '[{"label":"no crits","v":-0.08,"n":2}]', JSON.stringify(grouped));
    const sum = RS.summarize(rows);
    check("luck summary: totals per Pokémon", sum.find((a) => a.player === "Bob").luck === 0.96, JSON.stringify(sum.map((a) => a.luck)));
    LK.addLuck(rows, null);
    check("luck rows: blank without move data", rows.every((r) => r.luck === "" && r.player_luck === ""),
      JSON.stringify(rows.map((r) => r.luck)));
    check("luck summary: blank when a game has no score", RS.summarize(rows).every((a) => a.luck === ""));
  }

  // ---- Performance (mvp_score): +1 per 100% dealt, +1 per kill, +0.5 per 100% taken, +0.05 per turn on field,
  // +0.5 for surviving; the top one per team is Team MVP ----
  {
    const log = "|poke|p1|Pelipper|\n|poke|p1|Blissey|\n|poke|p2|Garchomp|\n|poke|p2|Dragonite|\n" + lhead() +
      "|move|p1a: A|Hurricane|p2a: B\n|-damage|p2a: B|40/100\n|move|p2a: B|Earthquake|p1a: A\n|-damage|p1a: A|50/100\n|turn|2\n" +
      "|move|p1a: A|Hurricane|p2a: B\n|-damage|p2a: B|0 fnt\n|faint|p2a: B\n|switch|p2a: D|Dragonite, L50|100/100\n|turn|3\n" +
      "|move|p2a: D|Extreme Speed|p1a: A\n|-damage|p1a: A|0 fnt\n|faint|p1a: A\n|switch|p1a: C|Blissey, L50|100/100\n|turn|4\n" +
      "|move|p2a: D|Extreme Speed|p1a: C\n|-damage|p1a: C|70/100\n|move|p1a: C|Soft-Boiled|p1a: C\n|-heal|p1a: C|100/100\n|win|Bob";
    const rows = RS.gameRows({ id: "test-mvp", log });
    const got = Object.fromEntries(rows.map((r) => [r.pokemon, [r.mvp_score, r.mvp]]));
    // Performance: A: 100% dealt + 1 KO + 100% taken x0.5 + 3 turns x0.05 = 2.65; C: 30% taken x0.5 + 1 turn + survived = 0.7;
    // B: 50% dealt + 100% taken x0.5 + 2 turns = 1.1; D: 80% dealt + 1 KO + 2 turns + survived = 2.4
    const exp = { Pelipper: [2.65, 1], Blissey: [0.7, 0], Garchomp: [1.1, 0], Dragonite: [2.4, 1] };
    check("mvp: score and one MVP per team", same(got, exp), `expected ${JSON.stringify(exp)}\ngot      ${JSON.stringify(got)}`);
    const d = RS.summarize(rows).find((a) => a.pokemon === "Dragonite");
    check("mvp summary: MVPs and score per game", d.mvps === 1 && d.mvp_score_per_game === 2.4 && !("mvp" in d), JSON.stringify(d));
    const bad = [];
    for (const id of Object.keys(REAL)) {
      const rs = RS.gameRows(await (await fetch(`fixtures/${id}.json`)).json());
      for (const p of new Set(rs.map((r) => r.player))) {
        const n = rs.filter((r) => r.player === p && r.mvp).length;
        if (n !== 1 || rs.some((r) => r.mvp && !r.brought)) bad.push(`${id} ${p}: ${n}`);
      }
    }
    check("mvp: exactly one brought MVP per team in every real replay", !bad.length, bad.join("\n"));
  }

  // ---- survival, Mega Evolution, Z-moves ----
  {
    const log = "|poke|p1|Pelipper|\n|poke|p1|Blissey|\n|poke|p2|Garchomp|\n|poke|p2|Dragonite|\n" + lhead() +
      "|detailschange|p2a: B|Garchomp-Mega, L50\n|-mega|p2a: B|Garchomp|Garchompite\n" +
      "|-zpower|p1a: A\n|move|p1a: A|Supersonic Skystrike|p2a: B|[zeffect]\n|-damage|p2a: B|40/100\n" +
      "|move|p2a: B|Earthquake|p1a: A\n|-damage|p1a: A|50/100\n|turn|2\n" +
      "|move|p1a: A|Hurricane|p2a: B\n|-damage|p2a: B|0 fnt\n|faint|p2a: B\n|switch|p2a: D|Dragonite, L50|100/100\n|turn|3\n" +
      "|move|p2a: D|Extreme Speed|p1a: A\n|-damage|p1a: A|0 fnt\n|faint|p1a: A\n|switch|p1a: C|Blissey, L50|100/100\n|turn|4\n" +
      "|move|p2a: D|Extreme Speed|p1a: C\n|-damage|p1a: C|70/100\n|move|p1a: C|Soft-Boiled|p1a: C\n|-heal|p1a: C|100/100\n|win|Bob";
    const rows = RS.gameRows({ id: "test-surv", log });
    const got = Object.fromEntries(rows.map((r) => [r.pokemon,
      [r.turns_on_field, r.survived, r.ko_before_moving, r.mega, r.mega_turn, r.z_move, r.z_turn, r.mega_form]]));
    const exp = { Pelipper: [3, 0, 0, 0, "", "Supersonic Skystrike", 1, ""], Blissey: [1, 1, 0, 0, "", "", "", ""],
      Garchomp: [2, 0, 0, 1, 1, "", "", "Garchomp-Mega"], Dragonite: [2, 1, 0, 0, "", "", "", ""] };
    check("survival / Mega / Z per game", same(got, exp), `expected ${JSON.stringify(exp)}\ngot      ${JSON.stringify(got)}`);
    const sum = Object.fromEntries(RS.summarize(rows).map((a) => [a.pokemon, [a.megas, a.mega_wins, a.z_moves, a.z_wins, a.survived]]));
    check("survival / Mega / Z summary", same(sum.Garchomp, [1, 1, 0, 0, 0]) && same(sum.Pelipper, [0, 0, 1, 0, 0]) &&
      same(sum.Dragonite, [0, 0, 0, 0, 1]), JSON.stringify(sum));
    // switched in and KO'd before it could act; a forfeit at the start of a turn adds no turn
    const b = RS.parseBattle(lhead() + "|switch|p1a: C|Blissey, L50|100/100\n|move|p2a: B|Close Combat|p1a: C\n" +
      "|-damage|p1a: C|0 fnt\n|faint|p1a: C\n|switch|p1a: A|Pelipper, L50|100/100\n|turn|2\n|-message|Alice forfeited.\n|win|Bob");
    const s = (k) => [b.stats.get(k).turnsOnField, b.stats.get(k).koBeforeMoving];
    // real replays, Mega / Z turns read off the logs
    const megaZ = {};
    for (const id of ["gen9nationaldex-2705117998", "gen9nationaldex-2705099074"]) {
      for (const r of RS.gameRows(await (await fetch(`fixtures/${id}.json`)).json())) {
        if (r.mega || r.z_move) megaZ[r.pokemon] = [r.mega_turn, r.z_move, r.z_turn, r.mega_form];
      }
    }
    // mega_form: the form it turned into (the site names a row after it, or after the drafted Mega)
    const expMZ = { Diancie: [1, "", "", "Diancie-Mega"], Latios: [17, "", "", "Latios-Mega"], Kyurem: ["", "Tectonic Rage", 1, ""],
      Gallade: [1, "", "", "Gallade-Mega"], Gardevoir: [24, "", "", "Gardevoir-Mega"] };
    check("Mega / Z in real Nat Dex replays", same(megaZ, expMZ), `expected ${JSON.stringify(expMZ)}\ngot      ${JSON.stringify(megaZ)}`);
    // singles: one Pokemon per side per turn played, so a side's turns on field add up to the game's turns
    const off = [];
    for (const id of Object.keys(REAL).filter((x) => x.startsWith("gen9nationaldex"))) {
      const rs = RS.gameRows(await (await fetch(`fixtures/${id}.json`)).json());
      for (const p of new Set(rs.map((r) => r.player))) {
        const n = rs.filter((r) => r.player === p).reduce((t, r) => t + r.turns_on_field, 0);
        if (n > rs[0].turns || n < rs[0].turns - 1) off.push(`${id} ${p}: ${n} of ${rs[0].turns} turns`);
      }
    }
    check("turns on field add up to the game's turns (singles)", !off.length, off.join("\n"));
    check("survival: KO'd before moving, no turn for a forfeit", same([s("p1: A"), s("p1: C"), s("p2: B")], [[1, 0], [0, 1], [1, 0]]),
      JSON.stringify([s("p1: A"), s("p1: C"), s("p2: B")]));
  }

  // ---- status inflicted, info shown, game length, momentum (worked out by hand from this log) ----
  {
    const log = "|t:|1000\n|poke|p1|Pelipper|\n|poke|p1|Blissey|\n|poke|p2|Garchomp|\n|poke|p2|Dragonite|\n" +
      "|teamsize|p1|2\n|teamsize|p2|2\n" + lhead() +
      "|move|p1a: A|Scald|p2a: B\n|-damage|p2a: B|60/100\n|-status|p2a: B|brn\n" +
      "|move|p2a: B|Earthquake|p1a: A\n|-damage|p1a: A|50/100\n|-damage|p2a: B|54/100|[from] brn\n|-ability|p1a: A|Drizzle\n" +
      "|t:|1030\n|turn|2\n" +
      "|-zpower|p1a: A\n|move|p1a: A|Hydro Vortex|p2a: B\n|-damage|p2a: B|0 fnt\n|faint|p2a: B\n" +
      "|switch|p2a: D|Dragonite, L50|100/100\n|-item|p2a: D|Leftovers\n|move|p1a: A|Scald|p2a: D\n|-damage|p2a: D|80/100\n" +
      "|move|p2a: D|Toxic|p1a: A\n|-status|p1a: A|tox\n|-damage|p1a: A|44/100|[from] psn\n" +
      "|t:|1090\n|turn|3\n|-message|Bob forfeited.\n|win|Alice\n|t:|1150";
    const rows = RS.gameRows({ id: "test-info", log });
    const got = Object.fromEntries(rows.map((r) => [r.pokemon, [r.statuses_inflicted, r.status_damage_pct, r.moves_revealed,
      r.item_revealed, r.ability_revealed, r.info_revealed_pct]]));
    // Pelipper: Scald (the Z-move isn't a move shown), item via the Z-crystal; info = (1+1+1+1) / 14, (2 + 3) / 14
    const exp = { Pelipper: [1, 6, 1, 1, 1, 28.6], Blissey: [0, 0, 0, 0, 0, 28.6],
      Garchomp: [0, 0, 1, 0, 0, 35.7], Dragonite: [1, 6, 1, 1, 0, 35.7] };
    check("status inflicted and info shown", same(got, exp), `expected ${JSON.stringify(exp)}\ngot      ${JSON.stringify(got)}`);
    check("game length from timestamps", same([rows[0].game_seconds, rows[0].seconds_per_turn], [150, 50]),
      JSON.stringify([rows[0].game_seconds, rows[0].seconds_per_turn]));
    const mom = rows[0].momentum.map((p) => [p.turn, p.p1.left, p.p1.hp, p.p2.left, p.p2.hp]);
    const expMom = [[0, 2, 100, 2, 100], [1, 2, 75, 2, 77], [2, 2, 72, 1, 40], [3, 2, 72, 1, 40]];
    check("momentum: team HP and Pokemon left after each turn", same(mom, expMom),
      `expected ${JSON.stringify(expMom)}\ngot      ${JSON.stringify(mom)}`);
    // a misread name from a rebuilt video log: a Pokemon that never switched in doesn't hold the line up
    const misread = RS.gameRows({ id: "test-misread", log: log.replace("|turn|2\n", "|turn|2\n|-damage|p1a: The opposing|70/100\n") })[0];
    const momM = misread.momentum.map((p) => [p.turn, p.p1.left, p.p1.hp, p.p2.left, p.p2.hp]);
    check("momentum: a misread name isn't a Pokemon", same(momM, expMom), `expected ${JSON.stringify(expMom)}\ngot      ${JSON.stringify(momM)}`);
    const noTime = RS.gameRows({ id: "test-notime", log: log.replace(/^\|t:\|\d+\n?/gm, "") })[0];
    const timed = RS.gameRows({ id: "test-timer", log: log.replace("|teamsize|p1|2\n",
      "|teamsize|p1|2\n|inactive|Battle timer is ON: inactive players will automatically lose when time's up. (requested by alice)\n") });
    const tOn = [...new Set(timed.map((r) => r.player + " " + r.timer_on))];
    check("timer on: credited to who asked (any case), the other player 0", same(tOn, ["Alice 1", "Bob 0"]) &&
      rows.every((r) => r.timer_on === 0), JSON.stringify(tOn));
    check("no timestamps: game length blank", noTime.game_seconds === "" && noTime.seconds_per_turn === "",
      JSON.stringify([noTime.game_seconds, noTime.seconds_per_turn]));
    const sum = Object.fromEntries(RS.summarize(rows).map((a) => [a.pokemon, [a.statuses_inflicted, a.status_damage_pct]]));
    check("status in the summary", same(sum.Pelipper, [1, 6]) && same(sum.Dragonite, [1, 6]), JSON.stringify(sum));
  }
  // real replays: status damage is the "(status)" rows of the move lists, and every finished game ends with a side at 0
  {
    const off = [];
    for (const id of Object.keys(REAL).filter((x) => x.startsWith("gen9nationaldex"))) {
      const rs = RS.gameRows(await (await fetch(`fixtures/${id}.json`)).json());
      const a = rs.reduce((t, r) => t + r.status_damage_pct, 0);
      const b = rs.reduce((t, r) => t + (r.move_stats || []).filter((m) => / \(status\)$/.test(m.move)).reduce((u, m) => u + m.dealt_pct, 0), 0);
      if (Math.abs(a - b) > 0.01) off.push(`${id}: status ${a} vs move list ${b}`);
      const last = rs[0].momentum[rs[0].momentum.length - 1];
      if (rs[0].end_reason === "normal" && last.p1.left && last.p2.left) off.push(`${id}: nobody at 0 at the end`);
      if (rs.some((r) => r.moves_revealed > 4)) off.push(`${id}: more than 4 moves shown`);
    }
    check("status damage, momentum end, moves shown on real replays", !off.length, off.join("\n"));
  }
  // the league library (rebuilt video logs included): a side with no Pokemon left has 0% HP on the chart
  {
    const off = [];
    for (const g of (await (await fetch("../site/games/index.json")).json()).games) {
      const rs = RS.gameRows(await (await fetch(`../site/games/${g.id}.json`)).json());
      for (const p of rs[0].momentum) {
        for (const side of ["p1", "p2"]) if (!p[side].left && p[side].hp) off.push(`${g.id} turn ${p.turn}: ${side} 0 left, ${p[side].hp}% HP`);
      }
    }
    check("momentum: 0 left means 0% HP in every saved game", !off.length, off.slice(0, 10).join("\n"));
  }

  // ---- fetching: time limit and "site is down" errors (fake fetch functions, 50 ms limit) ----
  {
    const fail = async (fetchFn) => {
      try { await RS.fetchReplay("x-1", fetchFn, 50); return null; } catch (e) { return [!!e.down, e.message]; }
    };
    const hang = await fail(() => new Promise(() => {}));
    check("fetch: no answer -> times out as down", hang && hang[0] && hang[1].includes("didn't answer within 0.05 s"), JSON.stringify(hang));
    const cf = await fail(async () => ({ ok: false, status: 522 }));
    check("fetch: Cloudflare 522 -> down", cf && cf[0] && cf[1].includes("HTTP 522"), JSON.stringify(cf));
    const net = await fail(async () => { throw new TypeError("Failed to fetch"); });
    check("fetch: network error -> down", net && net[0] && net[1].includes("couldn't be reached"), JSON.stringify(net));
    const nf = await fail(async () => ({ ok: false, status: 404 }));
    check("fetch: 404 is not 'down'", nf && !nf[0] && nf[1].startsWith("not found"), JSON.stringify(nf));
    const okReplay = await RS.fetchReplay("x-1", async () => ({ ok: true, status: 200, json: async () => ({ id: "x-1" }) }), 50);
    check("fetch: 200 returns the replay", okReplay.id === "x-1", JSON.stringify(okReplay));
  }

  // ---- CSV / TSV escaping ----
  const csv = RS.toCsv(["a", "b"], [{ a: 'x,"y"', b: "Pokémon" }]);
  check("csv escaping", csv === 'a,b\r\n"x,""y""",Pokémon\r\n', JSON.stringify(csv));
  const formula = [{ a: "+2 Atk", b: -0.25 }, { a: "=1+1", b: "@x" }];
  check("csv / tsv: text starting like a formula gets a ', numbers don't",
    RS.toCsv(["a", "b"], formula) === "a,b\r\n'+2 Atk,-0.25\r\n'=1+1,'@x\r\n" &&
    RS.toTsv(["a", "b"], formula) === "a\tb\r\n'+2 Atk\t-0.25\r\n'=1+1\t'@x\r\n", JSON.stringify(RS.toTsv(["a", "b"], formula)));
  check("tsv strips tabs", RS.toTsv(["a"], [{ a: "x\ty" }]) === "a\r\nx y\r\n");

  // ---- Fantasy tab (bet.js) ----
  const recs = Bet.records([
    { players: ["Ann", "Bob"], winner: "ann" },
    { players: ["Bob", "Cy"], winner: "Bob" },
    { players: ["Cy", "Ann"], winner: "" },
  ]);
  check("bet: records, names ignore case, no winner skipped", recs.map((p) => `${p.name} ${p.wins}-${p.losses}`).join(", ") ===
    "Ann 1-0, Bob 1-1, Cy 0-1", JSON.stringify(recs));
  const draft = { costs: { OU: 7, UU: 5, RU: 3 }, players: { "ANN": [{ pokemon: "Garchomp", tier: "OU" }, { pokemon: "Swampert-Mega", tier: "UU" }] } };
  check("bet: a Mega seen as its base species finds its draft entry", (Bet.drafted(draft, "ann", "Swampert") || {}).tier === "UU");
  check("bet: undrafted Pokémon has no entry", Bet.drafted(draft, "Ann", "Toxapex") === null && Bet.drafted(draft, "Bob", "Garchomp") === null);
  const forms = { costs: {}, aliases: { "Ann 17": "ann" }, players: { Ann: [{ pokemon: "Enamorus-Therian", tier: "RU" },
    { pokemon: "Sinistcha", tier: "RU" }, { pokemon: "Arcanine", tier: "UU" }, { pokemon: "Arcanine-Hisui", tier: "RU" }] } };
  check("bet: another form of the pool's only entry of that species matches, both ways",
    (Bet.drafted(forms, "Ann", "Enamorus") || {}).pokemon === "Enamorus-Therian" &&
    (Bet.drafted(forms, "Ann", "Sinistcha-Masterpiece") || {}).pokemon === "Sinistcha");
  check("bet: two forms of one species drafted, only the exact one matches",
    (Bet.drafted(forms, "Ann", "Arcanine-Hisui") || {}).tier === "RU" && Bet.drafted(forms, "Ann", "Arcanine-Paldea") === null);
  check("bet: a player's other Showdown name finds their pool through aliases", (Bet.drafted(forms, "ANN17", "Sinistcha") || {}).tier === "RU");
  const aliasRecs = Bet.records([{ players: ["Ann 17", "Bob"], winner: "Ann 17" }, { players: ["Ann", "Bob"], winner: "Bob" }], forms);
  check("bet: records count a player's other Showdown name as them", aliasRecs.map((p) => `${p.id} ${p.wins}-${p.losses}`).join(", ") ===
    "ann 1-1, bob 1-1", JSON.stringify(aliasRecs));
  const aliasFan = Bet.fantasy([
    { player: "Ann 17", pokemon: "Sinistcha", brought: 1, kills: 1, damage_dealt_pct: 0, survived: 0, won: 0 },
    { player: "Ann", pokemon: "Sinistcha", brought: 1, kills: 1, damage_dealt_pct: 0, survived: 0, won: 0 },
  ], forms);
  check("bet: fantasy, one row per Pokémon across a player's Showdown names", aliasFan.length === 1 && aliasFan[0].games === 2,
    JSON.stringify(aliasFan));
  check("bet: playerKey, the draft name's ID for an alias, else the name's own",
    Bet.playerKey(forms, "ANN17") === "ann" && Bet.playerKey(forms, "Bob B") === "bobb" && Bet.playerKey(null, "Ann 17") === "ann17");
  // Megas are their own Pokémon: Latios (Bob's) and Latios-Mega (Ann's) never merge
  const megas = { costs: {}, players: { Ann: [{ pokemon: "Latios-Mega" }, { pokemon: "Charizard-Mega-X" }], Bob: [{ pokemon: "Latios" }],
    Cy: [{ pokemon: "Gyarados" }, { pokemon: "Gyarados-Mega" }] } };
  const mn = (player, pokemon, mega_form, league = true) => Bet.megaName(megas, { player, pokemon, mega_form }, league);
  check("bet: megaName, the drafted Mega even when it didn't Mega Evolve; the base pick stays base",
    mn("Ann", "Latios", "") === "Latios-Mega" && mn("Ann", "Charizard", "") === "Charizard-Mega-X" && mn("Bob", "Latios", "") === "Latios",
    [mn("Ann", "Latios", ""), mn("Ann", "Charizard", ""), mn("Bob", "Latios", "")].join(", "));
  check("bet: megaName, the Mega it turned into when the draft doesn't say (not drafted, both forms drafted, not a league game)",
    mn("Dee", "Latios", "Latios-Mega") === "Latios-Mega" && mn("Cy", "Gyarados", "Gyarados-Mega") === "Gyarados-Mega" &&
    mn("Cy", "Gyarados", "") === "Gyarados" && mn("Ann", "Latios", "", false) === "Latios" && mn("Ann", "Latios", "Latios-Mega", false) === "Latios-Mega");
  const fan = Bet.fantasy([
    { player: "Ann", pokemon: "Garchomp", brought: 1, kills: 2, damage_dealt_pct: 150, survived: 1, won: 1 },
    { player: "ann", pokemon: "Garchomp", brought: 1, kills: 0, damage_dealt_pct: 50, survived: 0, won: 0 },
    { player: "Bob", pokemon: "Garchomp", brought: 1, kills: 1, damage_dealt_pct: 0, survived: 0, won: 0 },
    { player: "Bob", pokemon: "Toxapex", brought: 0, kills: 0, damage_dealt_pct: 0, survived: 0, won: 0 },
  ], draft);
  // Ann's: 2 KOs (6) + 200% damage (2) + survived once (1) + one win (1) = 10 over 2 games; OU costs 7 -> 1.4 a point
  check("bet: fantasy per player's Pokémon, unbrought skipped, cost from the draft", fan.map((f) =>
    `${f.player} ${f.pokemon} ${f.points} ${f.perGame} ${f.tier || "-"} ${f.cost} ${f.perCost}`).join(", ") ===
    "Ann Garchomp 10 5 OU 7 1.4, Bob Garchomp 3 3 - null null", JSON.stringify(fan));
  const fanHp = Bet.fantasy([
    { player: "Ann", pokemon: "Garchomp", brought: 1, kills: 0, damage_dealt_pct: 100, damage_dealt_hp: 350, hp_est: {}, survived: 0, won: 0 },
    { player: "Ann", pokemon: "Garchomp", brought: 1, kills: 0, damage_dealt_pct: 50, damage_dealt_hp: 200, hp_est: { damage_dealt_hp: true }, survived: 0, won: 0 },
    { player: "Bob", pokemon: "Toxapex", brought: 1, kills: 0, damage_dealt_pct: 30, damage_dealt_hp: 90, survived: 0, won: 0 },
    { player: "Bob", pokemon: "Toxapex", brought: 1, kills: 0, damage_dealt_pct: 10, damage_dealt_hp: "", survived: 0, won: 0 },
  ], draft);
  const ann = fanHp.find((f) => f.player === "Ann"), bob = fanHp.find((f) => f.player === "Bob");
  check("bet: damage in HP summed, ~ when a guess went in, blank when a game has none; points still per 100%",
    ann.damageHp === 550 && ann.damageHpEst && ann.points === 1.5 && bob.damageHp === "" && !bob.damageHpEst,
    JSON.stringify(fanHp.map((f) => [f.damageHp, f.damageHpEst, f.points])));

  // ---- report ----
  const failed = results.filter((r) => !r.ok);
  const out = document.getElementById("out");
  out.textContent = `${results.length - failed.length}/${results.length} passed\n\n` + results.map((r) =>
    (r.ok ? "PASS " : "FAIL ") + r.name + (r.ok ? "" : "\n     " + r.detail.replace(/\n/g, "\n     "))).join("\n");
  document.title = failed.length ? `FAIL (${failed.length})` : "PASS";
  document.body.dataset.result = failed.length ? "fail" : "pass";
})().catch((e) => {
  document.getElementById("out").textContent = "Test run crashed: " + (e && e.stack || e);
  document.title = "CRASH";
});
