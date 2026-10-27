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
      "Stolemyusername|Galvantula": [0, 1, 1], "Stolemyusername|Blissey": [0, 0, 0],
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
    "life orb recoil -> last opposing attacker": [`
|move|p1a: Burner|Foul Play|p2a: Victim
|-damage|p2a: Victim|5/100
|turn|2
|move|p2a: Victim|Earthquake|p1b: Rocker
|-damage|p1b: Rocker|50/100
|-damage|p2a: Victim|0 fnt|[from] item: Life Orb
|faint|p2a: Victim`, [["p1: Burner", "passive", "p2: Victim"]]],
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
|faint|p2b: Other`, [["p2: Other", "direct", "p1: Burner"], [null, "none", "p2: Other"]]],
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
  };
  for (const [name, [body, expected]] of Object.entries(CASES)) {
    const got = RS.parseBattle(HEAD + body.replace(/^\n/, "")).kills;
    check(`rule: ${name}`, same(got, expected), `expected ${JSON.stringify(expected)}\ngot      ${JSON.stringify(got)}`);
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
    check("illusion: real Gardevoir keeps its own kill, no death", same(b.stats.get("p1: Gardy"), { direct: 1, passive: 0, deaths: 0 }),
      JSON.stringify(b.stats.get("p1: Gardy")));
    check("illusion: species", b.species.get("p1: Zoro") === "Zoroark-Hisui" && b.species.get("p1: Gardy") === "Gardevoir",
      JSON.stringify([...b.species]));
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
  check("max HP: unknown species -> null", TS.maxHp({ species: "Missingno", evs: {}, ivs: {} }, DEX) === null);

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
  ];
  for (const [input, want] of LINKS) {
    const got = RS.replayIdFrom(input);
    check(`link: ${input}`, got === want, `got ${got}`);
  }
  check("links: pasted block with duplicates", same(RS.replayIdsFromText(
    "gen9ou-1, https://replay.pokemonshowdown.com/gen9ou-2\n\ngen9ou-1 junk"), ["gen9ou-1", "gen9ou-2"]));

  // ---- CSV / TSV escaping ----
  const csv = RS.toCsv(["a", "b"], [{ a: 'x,"y"', b: "Pokémon" }]);
  check("csv escaping", csv === 'a,b\r\n"x,""y""",Pokémon\r\n', JSON.stringify(csv));
  check("tsv strips tabs", RS.toTsv(["a"], [{ a: "x\ty" }]) === "a\r\nx y\r\n");

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
