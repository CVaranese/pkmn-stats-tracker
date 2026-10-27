/*
 * Team sheets: parse a Showdown teambuilder export (or a Pokepaste of one), match it to a side of a
 * replay by species, and compute each Pokemon's max HP. No DOM. Exposes window.TeamSheets
 * (browser) or module.exports (Node).
 */
(function (root) {
  "use strict";

  const PASTE_HOST = "https://pokepast.es/";
  const DEX_URL = "https://play.pokemonshowdown.com/data/pokedex.json";

  /** Showdown's ID form: 'Landorus-Therian' -> 'landorustherian'. */
  const toID = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

  /** Pokepaste id from a link ('pokepast.es/<16 hex>' or an old numeric one), else null. */
  function pokepasteIdFrom(text) {
    const m = /pokepast\.es\/([0-9a-f]{16}|[0-9]{1,10})(?![0-9a-z])/i.exec(String(text || ""));
    return m ? m[1].toLowerCase() : null;
  }

  const STAT_NAMES = { hp: "hp", atk: "atk", def: "def", spa: "spa", spd: "spd", spe: "spe" };

  function parseStats(spec) {
    const out = {};
    for (const part of spec.split("/")) {
      const m = /^\s*(\d+)\s+(\w+)\s*$/.exec(part);
      if (m && STAT_NAMES[m[2].toLowerCase()]) out[STAT_NAMES[m[2].toLowerCase()]] = Number(m[1]);
    }
    return out;
  }

  /**
   * Showdown export text -> list of sets. First line of a set:
   * 'Nickname (Species) (M) @ Item', 'Species (F) @ Item', 'Species @ Item' or 'Species'.
   * Missing values get Showdown's defaults: level 100, IVs 31, EVs 0.
   */
  function parseTeam(text) {
    const sets = [];
    let cur = null;
    for (const raw of String(text || "").split(/\r?\n/)) {
      const line = raw.trim();
      // blank line, '=== [gen9] Team ===', or the ``` lines around each set when copied off a Pokepaste page
      if (!line || line.startsWith("===") || line.startsWith("```")) { cur = null; continue; }
      if (/^(https?:\/\/|pokepast\.es\/)/i.test(line)) continue; // a link pasted along with the team
      if (!cur) {
        let head = line, item = "";
        const at = head.lastIndexOf(" @ ");
        if (at >= 0) { item = head.slice(at + 3).trim(); head = head.slice(0, at).trim(); }
        let gender = "";
        const g = /\s+\(([MF])\)$/.exec(head);
        if (g) { gender = g[1]; head = head.slice(0, g.index).trim(); }
        let nickname = "", species = head;
        const n = /^(.*\S)\s+\(([^()]+)\)$/.exec(head);
        if (n) { nickname = n[1]; species = n[2].trim(); }
        cur = { nickname, species, gender, item, ability: "", level: 100, nature: "",
          evs: {}, ivs: {}, moves: [] };
        sets.push(cur);
        continue;
      }
      let m;
      if (line.startsWith("-")) cur.moves.push(line.replace(/^-\s*/, ""));
      else if ((m = /^Ability:\s*(.+)$/i.exec(line))) cur.ability = m[1].trim();
      else if ((m = /^Level:\s*(\d+)/i.exec(line))) cur.level = Number(m[1]);
      else if ((m = /^EVs:\s*(.+)$/i.exec(line))) cur.evs = parseStats(m[1]);
      else if ((m = /^IVs:\s*(.+)$/i.exec(line))) cur.ivs = parseStats(m[1]);
      else if ((m = /^(\w+)\s+Nature\s*$/i.exec(line))) cur.nature = m[1];
      // Shiny, Tera Type, Happiness, Gigantamax, ... don't matter here
    }
    return sets.filter((s) => s.species);
  }

  /** Max HP: floor((2*base + IV + floor(EV/4)) * level / 100) + level + 10; Shedinja always 1. */
  function maxHp(set, dex) {
    const entry = dex && dex[toID(set.species)];
    if (!entry || !entry.baseStats) return null;
    const base = entry.baseStats.hp;
    if (base === 1) return 1;
    const iv = set.ivs.hp ?? 31, ev = set.evs.hp ?? 0, lvl = set.level || 100;
    return Math.floor(((2 * base + iv + Math.floor(ev / 4)) * lvl) / 100) + lvl + 10;
  }

  // ---------- matching a sheet to a replay side ----------

  /**
   * How well a replay species ('Zamazenta-*' at team preview, 'Zacian-Crowned' after switching in)
   * fits a sheet species: 2 = same, 1 = same Pokemon, other forme ('Zamazenta' / 'Zamazenta-Crowned'),
   * 0 = no. Formes match on the part before a hyphen boundary, so 'Mew' never fits 'Mewtwo'.
   */
  function speciesFit(replaySp, sheetSp) {
    const a = String(replaySp).replace(/-\*$/, "").toLowerCase();
    const b = String(sheetSp).toLowerCase();
    if (a === b && !/-\*$/.test(replaySp)) return 2;
    if (a === b || b.startsWith(a + "-") || a.startsWith(b + "-")) return 1;
    return 0;
  }

  /**
   * Pair each replay species with a distinct set: exact names first, then formes.
   * Returns an array of sets (same order as species) or null if any species has no set.
   */
  function pairSets(species, sets) {
    const out = new Array(species.length).fill(null);
    const used = new Set();
    for (const want of [2, 1]) {
      species.forEach((sp, i) => {
        if (out[i]) return;
        const j = sets.findIndex((s, k) => !used.has(k) && speciesFit(sp, s.species) === want);
        if (j >= 0) { out[i] = sets[j]; used.add(j); }
      });
    }
    return out.every(Boolean) ? out : null;
  }

  /**
   * Attach sets to game rows (from ReplayStats.gameRows). A sheet applies to a player's side in a
   * game when every Pokemon on that side (all 6 from team preview) pairs with one of its sets.
   * The first sheet that fits wins. Sets row.set; returns, per sheet, the [replay_id, player] it matched.
   * sheets: [{ sets }] (entries without sets are skipped).
   */
  function attachSheets(rows, sheets) {
    const groups = new Map();
    for (const r of rows) {
      const k = r.replay_id + "\u0000" + r.player;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    const matches = sheets.map(() => []);
    for (const group of groups.values()) {
      for (const r of group) delete r.set;
      const species = group.map((r) => r.pokemon);
      for (let i = 0; i < sheets.length; i++) {
        if (!sheets[i] || !sheets[i].sets || !sheets[i].sets.length) continue;
        const paired = pairSets(species, sheets[i].sets);
        if (!paired) continue;
        group.forEach((r, j) => { r.set = paired[j]; });
        matches[i].push([group[0].replay_id, group[0].player]);
        break;
      }
    }
    return matches;
  }

  // ---------- fetching ----------

  /** Plain export text of a Pokepaste (its /raw page allows cross-origin requests). */
  async function fetchPokepaste(id, fetchFn = root.fetch) {
    const resp = await fetchFn(PASTE_HOST + id + "/raw");
    if (resp.status === 404) throw new Error("Pokepaste not found");
    if (!resp.ok) throw new Error("Pokepaste HTTP " + resp.status);
    return resp.text();
  }

  let dexPromise = null;
  /** Showdown's Pokedex (base stats), fetched once per page visit. */
  function loadDex(fetchFn = root.fetch) {
    if (!dexPromise) {
      dexPromise = fetchFn(DEX_URL).then((r) => {
        if (!r.ok) throw new Error("Pokedex HTTP " + r.status);
        return r.json();
      });
      dexPromise.catch(() => { dexPromise = null; }); // allow a retry on the next run
    }
    return dexPromise;
  }

  const api = {
    PASTE_HOST, DEX_URL, toID, pokepasteIdFrom, parseTeam, maxHp, speciesFit, pairSets, attachSheets,
    fetchPokepaste, loadDex,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TeamSheets = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
