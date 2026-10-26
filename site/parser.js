/* Kill/death stats from Pokemon Showdown replay logs. No DOM use, so tests and a future
 * Node CLI can load it too. Exposes window.ReplayStats (browser) or module.exports (Node).
 *
 * Kill rules (common draft-league conventions):
 *   direct   the Pokemon whose attack dealt the KO hit (spread moves can give 2 kills).
 *            Destiny Bond counts as a direct kill for the Destiny Bond user.
 *   passive  indirect damage credited to whoever caused it: burn/poison (who inflicted it),
 *            Leech Seed, Salt Cure, Curse, binding moves, hazards (who set them), weather
 *            (who set it), Rocky Helmet / Rough Skin / Iron Barbs, Perish Song.
 *   fallback if the KO's cause is the fainted Pokemon itself or its own team (recoil, Life Orb,
 *            confusion, own weather, an ally's spread move...), the last opposing Pokemon that
 *            damaged it gets a passive kill. If no opponent ever damaged it, nobody gets a kill.
 *   self-KO  Explosion / Memento / Final Gambit / Healing Wish: a death, no kill.
 *   forfeit  Pokemon left standing after a forfeit are not counted as deaths.
 */
(function (root) {
  "use strict";

  const REPLAY_HOST = "https://replay.pokemonshowdown.com/";

  // ---------- input ----------

  /** Turn a replay URL or ID into the replay ID ('format-12345'), or null. */
  function replayIdFrom(text) {
    text = String(text || "").trim();
    if (!text || text.startsWith("#")) return null;
    text = text.split("?")[0].split("#")[0].replace(/\/+$/, "");
    text = text.slice(text.lastIndexOf("/") + 1).toLowerCase();
    text = text.replace(/\.(json|log)$/, "");
    // optional '-<password>pw' suffix on private replays
    return /^[a-z0-9]+(-[a-z0-9]+)*-\d+(-[a-z0-9]+pw)?$/.test(text) ? text : null;
  }

  /** All replay IDs found in a block of pasted text (links separated by lines, spaces or commas). */
  function replayIdsFromText(text) {
    const ids = [];
    for (const token of String(text || "").split(/[\s,]+/)) {
      const id = replayIdFrom(token);
      if (id && !ids.includes(id)) ids.push(id);
    }
    return ids;
  }

  // ---------- log parsing ----------

  /** 'p1a: Charizard' -> 'p1: Charizard' (drop the slot so Ally Switch doesn't matter). */
  function monKey(ident) {
    const i = ident.indexOf(": ");
    return i < 0 ? ident.slice(0, 2) : ident.slice(0, 2) + ": " + ident.slice(i + 2);
  }

  const sideOf = (key) => key.slice(0, 2);

  /** 'move: Leech Seed' / 'Leech Seed' / 'leechseed' -> 'leechseed'. */
  function norm(effect) {
    return String(effect).trim().replace(/^(move|ability|item):\s*/i, "")
      .toLowerCase().replace(/[^a-z0-9]/g, "");
  }

  /** Collect '[from] X' / '[of] Y' style tags from a split protocol line. */
  function tagsOf(parts) {
    const tags = {};
    for (const p of parts) {
      const m = /^\[(\w+)\]\s*(.*)$/.exec(p);
      if (m) tags[m[1]] = m[2];
    }
    return tags;
  }

  /** 'Charizard-Mega-Y, L50, F' -> 'Charizard'; 'Rotom-Fan, L50' -> 'Rotom-Fan'. */
  function baseSpecies(details) {
    return details.split(",")[0].trim().replace(/-Mega(-[XY])?$/, "");
  }

  const HAZARDS = new Set(["stealthrock", "spikes", "toxicspikes", "gmaxsteelsurge", "steelsurge"]);
  const WEATHERS = new Set(["sandstorm", "hail", "snow"]);
  const STATUS_DAMAGE = new Set(["brn", "psn", "tox"]);
  const DELAYED_MOVES = new Set(["futuresight", "doomdesire"]);

  function parseBattle(log) {
    const players = {};                 // 'p1' -> name
    const preview = { p1: [], p2: [] }; // species at team preview
    const species = new Map();          // mon key -> species (insertion order = first seen)
    const stats = new Map();            // mon key -> {direct, passive, deaths}
    let winner = null;
    let forfeited = false;

    let mover = null;                   // mon key of the Pokemon whose move is resolving
    const statusSrc = new Map();        // mon key -> who inflicted its status
    const effectSrc = new Map();        // 'key|effect' -> source mon (Leech Seed, Salt Cure, perish...)
    const hazardSrc = new Map();        // 'side|hazard' -> setter
    let weatherSrc = null;
    const delayedSrc = new Map();       // 'side|move' -> user of Future Sight / Doom Desire
    const lastOppHit = new Map();       // mon key -> last opposing mon that damaged it
    const pendingKo = new Map();        // mon key -> [killer, kind], set on the 0 HP damage line
    let destinyBond = null;             // mon key whose Destiny Bond triggered
    const kills = [];                   // [killer or null, kind, victim] for checking

    const statOf = (key) => {
      if (!stats.has(key)) stats.set(key, { direct: 0, passive: 0, deaths: 0 });
      return stats.get(key);
    };

    /** Apply the 'source must be an opponent, else fall back' rule. */
    function credit(target, source, kind) {
      if (source && sideOf(source) !== sideOf(target)) return [source, kind];
      const fallback = lastOppHit.get(target);
      return fallback ? [fallback, "passive"] : [null, "none"];
    }

    for (const line of String(log).split(/\r?\n/)) {
      if (!line.startsWith("|")) continue;
      const parts = line.split("|").slice(1);
      const cmd = parts[0];
      const tags = tagsOf(parts);

      if (cmd === "player" && parts[2]) {
        players[parts[1]] = parts[2];
      } else if (cmd === "poke") {
        (preview[parts[1]] = preview[parts[1]] || []).push(baseSpecies(parts[2]));
      } else if (cmd === "switch" || cmd === "drag" || cmd === "replace") {
        const key = monKey(parts[1]);
        if (!species.has(key)) species.set(key, baseSpecies(parts[2]));
        mover = null;
      } else if (cmd === "turn" || cmd === "upkeep") {
        mover = null;
        if (cmd === "turn") destinyBond = null;
      } else if (cmd === "move") {
        mover = monKey(parts[1]);
        const move = norm(parts[2]);
        if (DELAYED_MOVES.has(move) && parts[3]) delayedSrc.set(parts[3].slice(0, 2) + "|" + move, mover);
      } else if (cmd === "-end" && parts[2] && DELAYED_MOVES.has(norm(parts[2]))) {
        // Future Sight landing: the damage line that follows belongs to its user
        mover = delayedSrc.get(parts[1].slice(0, 2) + "|" + norm(parts[2])) || null;
      } else if (cmd === "-status") {
        const target = monKey(parts[1]);
        const frm = tags.from || "";
        if ("of" in tags) statusSrc.set(target, monKey(tags.of));
        else if (frm.startsWith("item:")) statusSrc.set(target, null); // Flame Orb / Toxic Orb
        else if (mover) statusSrc.set(target, mover);
        else statusSrc.set(target, hazardSrc.get(sideOf(target) + "|toxicspikes") || null);
      } else if (cmd === "-curestatus") {
        statusSrc.delete(monKey(parts[1]));
      } else if (cmd === "-start" || cmd === "-activate") {
        const target = monKey(parts[1]);
        let effect = parts[2] ? norm(parts[2]) : "";
        if (effect.startsWith("perish")) effect = "perish";
        const src = "of" in tags ? monKey(tags.of) : mover;
        if (cmd === "-activate" && effect === "destinybond") destinyBond = target;
        else if (src && !effectSrc.has(target + "|" + effect)) effectSrc.set(target + "|" + effect, src);
      } else if (cmd === "-sidestart") {
        hazardSrc.set(parts[1].slice(0, 2) + "|" + norm(parts[2]), mover);
      } else if (cmd === "-sideend") {
        hazardSrc.delete(parts[1].slice(0, 2) + "|" + norm(parts[2]));
      } else if (cmd === "-weather" && !("upkeep" in tags)) {
        if (norm(parts[1]) === "none") weatherSrc = null;
        else weatherSrc = "of" in tags ? monKey(tags.of) : mover;
      } else if (cmd === "-damage") {
        const target = monKey(parts[1]);
        let source, kind;
        if (!("from" in tags)) {
          source = mover; kind = "direct";
        } else {
          const frm = norm(tags.from);
          kind = "passive";
          if (STATUS_DAMAGE.has(frm)) source = statusSrc.get(target);
          else if ("of" in tags && monKey(tags.of) !== target) source = monKey(tags.of); // Leech Seed, Rocky Helmet...
          else if (HAZARDS.has(frm)) source = hazardSrc.get(sideOf(target) + "|" + frm);
          else if (WEATHERS.has(frm)) source = weatherSrc;
          else if (effectSrc.has(target + "|" + frm)) source = effectSrc.get(target + "|" + frm); // Salt Cure, Curse, binding
          else source = null; // recoil, Life Orb, confusion, etc.
        }
        if (source && sideOf(source) !== sideOf(target)) lastOppHit.set(target, source);
        if ((parts[2] || "").startsWith("0")) pendingKo.set(target, credit(target, source, kind));
      } else if (cmd === "faint") {
        const victim = monKey(parts[1]);
        statOf(victim).deaths += 1;
        let killer, kind;
        if (pendingKo.has(victim)) {
          [killer, kind] = pendingKo.get(victim);
          pendingKo.delete(victim);
        } else if (destinyBond && sideOf(destinyBond) !== sideOf(victim)) {
          [killer, kind] = [destinyBond, "direct"];
        } else if (effectSrc.has(victim + "|perish")) {
          [killer, kind] = credit(victim, effectSrc.get(victim + "|perish"), "passive");
        } else {
          [killer, kind] = [null, "none"]; // Explosion, Memento, Final Gambit...
        }
        if (killer && (kind === "direct" || kind === "passive")) statOf(killer)[kind] += 1;
        kills.push([killer, kind, victim]);
      } else if (cmd === "-message" && (parts[1] || "").includes("forfeited")) {
        forfeited = true;
      } else if (cmd === "win") {
        winner = parts[1];
      }
    }

    return { players, preview, species, stats, winner, forfeited, kills };
  }

  // ---------- rows ----------

  const GAME_FIELDS = ["replay_id", "date", "format", "player", "opponent", "won", "pokemon", "nickname",
    "brought", "kills", "direct_kills", "passive_kills", "deaths", "replay_url"];

  /** One row per Pokemon per game: all 6 from team preview (brought or not), else every one seen. */
  function gameRows(replay) {
    const b = parseBattle(replay.log);
    const rid = replay.id;
    const date = replay.uploadtime ? new Date(replay.uploadtime * 1000).toISOString().slice(0, 10) : "";
    const rows = [];
    for (const side of ["p1", "p2"]) {
      const player = b.players[side] || side;
      const opponent = b.players[side === "p1" ? "p2" : "p1"] || "";
      const brought = [...b.species].filter(([k]) => sideOf(k) === side);
      const seen = new Set();
      const row = (key, sp) => {
        const st = (key && b.stats.get(key)) || { direct: 0, passive: 0, deaths: 0 };
        return {
          replay_id: rid, date, format: replay.format || "", player, opponent,
          won: b.winner === player ? 1 : 0,
          pokemon: sp, nickname: key ? key.slice(4) : "", brought: key ? 1 : 0,
          kills: st.direct + st.passive, direct_kills: st.direct, passive_kills: st.passive,
          deaths: st.deaths, replay_url: REPLAY_HOST + rid,
        };
      };
      for (const sp of b.preview[side] || []) {
        const prefix = sp.replace(/\*$/, ""); // 'Urshifu-*' at team preview
        const hit = brought.find(([k, s]) => !seen.has(k) && (s === sp || s.startsWith(prefix)));
        if (hit) seen.add(hit[0]);
        rows.push(row(hit ? hit[0] : null, hit ? hit[1] : sp));
      }
      // no team preview (Random Battles) or no match: every Pokemon that appeared
      for (const [k, s] of brought) if (!seen.has(k)) rows.push(row(k, s));
    }
    return rows;
  }

  const SUMMARY_FIELDS = ["player", "pokemon", "games_brought", "wins_when_brought", "kills",
    "direct_kills", "passive_kills", "deaths", "kills_per_game"];

  /** Totals per player + Pokemon (or per Pokemon only when byPlayer is false), most kills first. */
  function summarize(rows, byPlayer = true) {
    const agg = new Map();
    for (const r of rows) {
      if (!r.brought) continue;
      const k = byPlayer ? r.player + "\u0000" + r.pokemon : r.pokemon;
      if (!agg.has(k)) {
        agg.set(k, { player: byPlayer ? r.player : "", pokemon: r.pokemon, games_brought: 0,
          wins_when_brought: 0, kills: 0, direct_kills: 0, passive_kills: 0, deaths: 0, kills_per_game: 0 });
      }
      const a = agg.get(k);
      a.games_brought += 1;
      a.wins_when_brought += r.won;
      for (const f of ["kills", "direct_kills", "passive_kills", "deaths"]) a[f] += r[f];
    }
    const out = [...agg.values()];
    for (const a of out) a.kills_per_game = Math.round((a.kills / a.games_brought) * 100) / 100;
    out.sort((x, y) => y.kills - x.kills || x.deaths - y.deaths ||
      x.player.toLowerCase().localeCompare(y.player.toLowerCase()) || x.pokemon.localeCompare(y.pokemon));
    return out;
  }

  // ---------- output ----------

  function toDelimited(fields, rows, sep) {
    const cell = (v) => {
      const s = String(v ?? "");
      if (sep === "\t") return s.replace(/[\t\r\n]+/g, " ");
      return /[",\r\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    return [fields.join(sep), ...rows.map((r) => fields.map((f) => cell(r[f])).join(sep))].join("\r\n") + "\r\n";
  }

  const toCsv = (fields, rows) => toDelimited(fields, rows, ",");
  const toTsv = (fields, rows) => toDelimited(fields, rows, "\t");

  async function fetchReplay(id, fetchFn = root.fetch) {
    const resp = await fetchFn(REPLAY_HOST + id + ".json");
    if (resp.status === 404) throw new Error("not found (deleted, private, or never saved)");
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    return resp.json();
  }

  const api = {
    REPLAY_HOST, GAME_FIELDS, SUMMARY_FIELDS,
    replayIdFrom, replayIdsFromText, parseBattle, gameRows, summarize, toCsv, toTsv, fetchReplay,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ReplayStats = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
