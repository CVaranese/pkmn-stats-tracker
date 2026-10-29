/* Library snapshot: every saved league game (site/<league>/games/) through parser.js, with the hidden-Zoroark picks
   the site uses, boiled down to a few numbers per Pokémon. tests.js compares them with tests/snapshot.json, so a
   parser change that moves any of them shows up. It says "unchanged", not "right": the hand-counted fixtures in
   tests.js stay the source of truth. Rewrite snapshot.json only on purpose (a rule change), with the diff reviewed:
   .claude/skills/test/write-snapshot.ps1 (it reads tests/snapshot.html). */
(function () {
  "use strict";
  const FIELDS = ["kills", "direct_kills", "passive_kills", "deaths", "self_kos", "damage_dealt_pct", "damage_taken_pct",
    "healing_pct", "healing_given_pct", "hazard_damage_pct", "hazard_kills", "switches"];

  /** {fields, games: {"league/id": {"player|pokemon": [FIELDS...]}}}, rows not brought left out. */
  async function compute(site = "../site/") {
    const RS = window.ReplayStats, IL = window.Illusion;
    const get = async (path) => {
      const r = await fetch(site + path);
      if (!r.ok) throw new Error(path + ": HTTP " + r.status);
      return r.json();
    };
    const learn = await IL.loadLearnsets(site + "data/learnsets.json");
    const dex = await get("data/pokedex.json");
    const games = {};
    for (const league of (await get("leagues.json")).leagues) {
      for (const g of (await get(league.id + "/games/index.json")).games) {
        const replay = await get(league.id + "/games/" + g.id + ".json");
        // as app/zoroark.js does it, minus the admin's local picks
        const b = RS.parseBattle(replay.log);
        if (IL.hiddenSides(b).length) replay.illusion = IL.picks(b, g.illusion || {}, learn, dex).illusion;
        const mons = {};
        for (const r of RS.gameRows(replay)) if (r.brought) mons[r.player + "|" + r.pokemon] = FIELDS.map((f) => r[f]);
        games[league.id + "/" + g.id] = Object.fromEntries(Object.keys(mons).sort().map((k) => [k, mons[k]]));
      }
    }
    return { fields: FIELDS, games };
  }

  /** JSON with one game per line, so a rewrite's diff shows the games that changed. */
  function format(snap) {
    const ids = Object.keys(snap.games).sort();
    return "{\n" + `"fields": ${JSON.stringify(snap.fields)},\n"games": {\n` +
      ids.map((id) => JSON.stringify(id) + ": " + JSON.stringify(snap.games[id])).join(",\n") + "\n}\n}\n";
  }

  /** What changed between two snapshots: {changed: ["id player|pokemon: field a -> b"...], added: [id], removed: [id]}. */
  function diff(stored, now) {
    const changed = [], added = [], removed = [];
    if (JSON.stringify(stored.fields) !== JSON.stringify(now.fields)) changed.push(`fields: ${stored.fields} -> ${now.fields}`);
    for (const id of Object.keys(now.games)) {
      const a = stored.games[id], b = now.games[id];
      if (!a) { added.push(id); continue; }
      for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) {
        if (!a[k] || !b[k]) { changed.push(`${id} ${k}: ${a[k] ? "no longer brought" : "newly brought"}`); continue; }
        now.fields.forEach((f, i) => { if (a[k][i] !== b[k][i]) changed.push(`${id} ${k}: ${f} ${a[k][i]} -> ${b[k][i]}`); });
      }
    }
    for (const id of Object.keys(stored.games)) if (!now.games[id]) removed.push(id);
    return { changed, added, removed };
  }

  window.LibrarySnapshot = { FIELDS, compute, format, diff };
})();
