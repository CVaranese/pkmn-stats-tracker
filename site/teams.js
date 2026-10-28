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
      // a move after a blank line (some exports put one before the moves): still the last set's
      if (!cur && /^[-*]\s/.test(line) && sets.length) cur = sets[sets.length - 1];
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
      if (/^[-*]\s/.test(line)) cur.moves.push(line.replace(/^[-*]\s*/, ""));
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

  /**
   * Max HP for a Pokemon its game has no sheet for, assuming HP investment is all or nothing (0 or 252
   * EVs, 31 IVs, level 100). In order: Smogon's Nat Dex spreads (smogon: { mons: { id: { hp, share } } },
   * tools/smogon_hp.py), the same player's sets for it on other sheets (EVs 128+ count as 252; the more
   * common choice wins, a tie goes on), else 252 when its base HP + Def + SpD beat Atk + SpA + Spe.
   * Smogon comes first: on the league's 66 saved sets it guessed 55 right, players' other sheets 31 of 43
   * (players change HP EVs between games; user picked Smogon first, 2026-10-27).
   * playerSets: [{ set, label }]. Returns { max_hp, from: "smogon" | "player" | "stats", note } or null.
   */
  function guessMaxHp(species, playerSets, smogon, dex) {
    const sp = String(species).replace(/-\*$/, "");
    const withEvs = (hp, s = sp) => maxHp({ species: s, evs: { hp }, ivs: {}, level: 100 }, dex);
    const mons = (smogon && smogon.mons) || {};
    const id = toID(sp);
    const s = mons[id] || mons[toID(sp.split("-")[0])];
    if (s) {
      const v = withEvs(s.hp);
      if (v) return { max_hp: v, from: "smogon", note: `${s.hp} HP EVs: ${Math.round(s.share * 100)}% of Smogon's Nat Dex sets invest in HP` };
    }
    const mine = (playerSets || []).filter((p) => speciesFit(species, p.set.species));
    if (mine.length) {
      const bulky = mine.filter((p) => (p.set.evs.hp || 0) >= 128);
      if (bulky.length * 2 !== mine.length) {
        const hp = bulky.length * 2 > mine.length ? 252 : 0;
        const from = (hp ? bulky : mine.filter((p) => !bulky.includes(p))).map((p) => p.label);
        const v = withEvs(hp, mine[0].set.species);
        if (v) return { max_hp: v, from: "player", note: `${hp} HP EVs, as on the player's ${from.join(", ")} sheet` };
      }
    }
    const entry = dex && (dex[id] || dex[toID(sp.split("-")[0])]);
    if (!entry || !entry.baseStats) return null;
    const b = entry.baseStats;
    const hp = b.hp + b.def + b.spd > b.atk + b.spa + b.spe ? 252 : 0;
    const v = withEvs(hp, dex[id] ? sp : sp.split("-")[0]);
    return v ? { max_hp: v, from: "stats", note: `${hp} HP EVs, a guess from its base stats (${hp ? "bulky" : "offensive"})` } : null;
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

  // parser.js's fetch with a time limit and "site is down" errors (parser.js loads first on every page)
  const fetchChecked = (url, fetchFn) => (root.ReplayStats || require("./parser.js")).fetchChecked(url, fetchFn);

  /** Plain export text of a Pokepaste (its /raw page allows cross-origin requests). */
  async function fetchPokepaste(id, fetchFn = root.fetch) {
    const resp = await fetchChecked(PASTE_HOST + id + "/raw", fetchFn);
    if (resp.status === 404) throw new Error("Pokepaste not found");
    if (!resp.ok) throw new Error("Pokepaste HTTP " + resp.status);
    return resp.text();
  }

  let dexPromise = null;
  /** Showdown's Pokedex (base stats), fetched once per page visit. */
  function loadDex(fetchFn = root.fetch) {
    if (!dexPromise) {
      dexPromise = fetchChecked(DEX_URL, fetchFn).then((r) => {
        if (!r.ok) throw new Error("Pokedex HTTP " + r.status);
        return r.json();
      });
      dexPromise.catch(() => { dexPromise = null; }); // allow a retry on the next run
    }
    return dexPromise;
  }

  let smogonPromise = null;
  /** site/data/smogon_hp.json (HP investment per Pokemon, tools/smogon_hp.py); null if it doesn't load. */
  function loadSmogonHp(url, fetchFn = root.fetch) {
    if (!smogonPromise) smogonPromise = fetchFn(url).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    return smogonPromise;
  }

  const api = {
    PASTE_HOST, DEX_URL, toID, pokepasteIdFrom, parseTeam, maxHp, guessMaxHp, speciesFit, pairSets, attachSheets,
    fetchPokepaste, loadDex, loadSmogonHp,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TeamSheets = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
