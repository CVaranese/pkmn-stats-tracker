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
 *
 * Hazards: hazard_damage_pct is the part of damage_dealt_pct done by Stealth Rock / Spikes /
 *   Steelsurge, hazard_kills the part of passive kills. hazards_set counts each layer set on the
 *   opponent's side (Sticky Web and Toxic Spikes too), hazards_removed each hazard cleared from its
 *   own side (Defog clearing the opponent's side doesn't count). After Court Change the swapped
 *   hazards count as the Court Change user's. hazard_turns (per player): turns that ended with any
 *   hazard on the opponent's side, the turn the game ended in included.
 *
 * How a game ended (end_reason): "forfeit" (-message "X forfeited."), "timer" (-message
 *   "X lost due to inactivity."), "normal" (a |win| with neither), "tie" (|tie|), "unfinished".
 *
 * Damage rules (same credit as kills): each -damage line is a hit of (HP % before - HP % after),
 *   so overkill never counts. Direct hits go to the attacker, indirect damage to its cause (as
 *   above). Self-inflicted damage (recoil, Life Orb, confusion, Substitute cost, own weather, an
 *   ally's hit) counts as taken with no dealer. Hits on a Substitute lose no HP and count 0; the
 *   Disguise bust goes to the attacker that broke it. Pain Split lowering HP counts for its user.
 *   A faint with HP left (Destiny Bond, Perish Song, Explosion user) counts that HP, credited like
 *   the kill. Healing only raises the baseline. Public replays show whole %, so each hit is
 *   accurate to about +-1% of max HP.
 *   Illusion while disguised, Zoroark is logged as the Pokemon it copies. When the disguise
 *            breaks (|replace|), everything from that time on the field moves to Zoroark. A
 *            disguise that never breaks can't be detected, so it stays with the copied Pokemon.
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

  /** 'p1a: Charizard' -> 'p1a'; null when the ident has no slot letter ('p1: Charizard'). */
  function slotOf(ident) {
    return /^p\d[a-z]:/.test(ident) ? ident.slice(0, 3) : null;
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

  /** HP in % of max from '64/100 brn', '188/312', '0 fnt'; null when there is none. */
  function hpOf(text) {
    const m = /^(\d+(?:\.\d+)?)(?:\/(\d+))?/.exec(String(text || "").trim());
    if (!m) return null;
    return m[2] ? (Number(m[1]) / Number(m[2])) * 100 : Number(m[1]);
  }

  const HAZARDS = new Set(["stealthrock", "spikes", "toxicspikes", "gmaxsteelsurge", "steelsurge"]);
  const ENTRY_HAZARDS = new Set([...HAZARDS, "stickyweb"]); // counted as set / removed / turns up
  const WEATHERS = new Set(["sandstorm", "hail", "snow"]);
  const STATUS_DAMAGE = new Set(["brn", "psn", "tox"]);
  const DELAYED_MOVES = new Set(["futuresight", "doomdesire"]);

  function parseBattle(log) {
    const players = {};                 // 'p1' -> name
    const preview = { p1: [], p2: [] }; // species at team preview
    let winner = null;
    let forfeited = false;
    let timedOut = false;               // lost to the battle timer
    let tie = false;
    let turns = 0;                      // last |turn| number
    const hazardTurns = { p1: 0, p2: 0 }; // turns that ended with hazards on the opponent's side

    // A "stint" is one stay on the field: {key, side, species, direct, passive, deaths, hp}.
    // Credit goes to stints, so an Illusion reveal can re-assign one stint without touching
    // the copied Pokemon's other stints. Stats are summed per key at the end.
    const stints = [];
    const slots = {};                   // 'p1a' -> stint currently in that position
    const latestByKey = new Map();      // mon key -> its most recent stint

    let mover = null;                   // stint whose move is resolving
    // Per-target state, keyed by mon key (it survives switching out); values are stints.
    const statusSrc = new Map();        // mon key -> who inflicted its status
    const effectSrc = new Map();        // 'key|effect' -> source (Leech Seed, Salt Cure, perish...)
    const lastOppHit = new Map();       // mon key -> last opposing stint that damaged it
    const pendingKo = new Map();        // mon key -> [killer, kind], set on the 0 HP damage line
    const hazardSrc = new Map();        // 'side|hazard' -> setter
    let weatherSrc = null;
    const delayedSrc = new Map();       // 'side|move' -> user of Future Sight / Doom Desire
    let destinyBond = null;             // stint whose Destiny Bond triggered
    const kills = [];                   // [killer stint or null, kind, victim stint]
    const hits = [];                    // [dealer stint or null, target stint, % of max HP lost]

    function newStint(key, sp) {
      const s = { key, side: sideOf(key), species: sp, direct: 0, passive: 0, deaths: 0, hp: 100,
        hazardKills: 0, hazardsSet: 0, hazardsRemoved: 0, prev: latestByKey.get(key) };
      stints.push(s);
      latestByKey.set(key, s);
      return s;
    }

    /** The stint an ident refers to: by position when it has one, else the latest with that key. */
    function stintOf(ident) {
      const key = monKey(ident);
      const s = slots[slotOf(ident)];
      if (s && s.key === key) return s;
      return latestByKey.get(key) || newStint(key, null);
    }

    /** Snapshot of the per-target state for a key, so an Illusion reveal can restore it. */
    function targetState(key) {
      const effects = [...effectSrc].filter(([k]) => k.startsWith(key + "|"));
      return { status: statusSrc.get(key), hasStatus: statusSrc.has(key), lastOpp: lastOppHit.get(key), effects };
    }

    /** Apply the 'source must be an opponent, else fall back' rule. */
    function credit(targetKey, source, kind) {
      if (source && source.side !== sideOf(targetKey)) return [source, kind];
      const fallback = lastOppHit.get(targetKey);
      return fallback ? [fallback, "passive"] : [null, "none"];
    }

    /** Record HP lost by a stint; the dealer only when it is an opponent. */
    function hit(target, source, newHp, hazard = false) {
      const lost = Math.round((target.hp - newHp) * 100) / 100;
      target.hp = newHp;
      const dealer = source && source.side !== target.side ? source : null;
      if (lost > 0) hits.push([dealer, target, lost, hazard && !!dealer]);
    }

    /** At the end of a turn: each player with an entry hazard on the opponent's side gets a turn. */
    function countHazardTurns() {
      for (const side of ["p1", "p2"]) {
        const opp = side === "p1" ? "p2" : "p1";
        if ([...hazardSrc.keys()].some((k) => k.startsWith(opp + "|") && ENTRY_HAZARDS.has(k.slice(3)))) {
          hazardTurns[side] += 1;
        }
      }
    }

    function moveKey(map, from, to) {
      if (map.has(from)) { map.set(to, map.get(from)); map.delete(from); }
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
      } else if (cmd === "switch" || cmd === "drag") {
        const s = newStint(monKey(parts[1]), baseSpecies(parts[2]));
        s.hp = hpOf(parts[3]) ?? 100;
        s.entryState = targetState(s.key);
        slots[slotOf(parts[1])] = s;
        mover = null;
      } else if (cmd === "replace") {
        // Illusion broke: this stint was really the Pokemon named here (Zoroark)
        const s = slots[slotOf(parts[1])];
        const newKey = monKey(parts[1]);
        if (s && s.key !== newKey) {
          const oldKey = s.key;
          const entry = s.entryState || targetState(oldKey);
          // per-target state gathered while disguised belongs to Zoroark
          moveKey(statusSrc, oldKey, newKey);
          moveKey(lastOppHit, oldKey, newKey);
          moveKey(pendingKo, oldKey, newKey);
          for (const [k] of [...effectSrc]) {
            if (k.startsWith(oldKey + "|")) moveKey(effectSrc, k, newKey + k.slice(oldKey.length));
          }
          // ...and the copied Pokemon gets back what it had before this stint
          if (entry.hasStatus) statusSrc.set(oldKey, entry.status);
          if (entry.lastOpp) lastOppHit.set(oldKey, entry.lastOpp);
          for (const [k, v] of entry.effects) effectSrc.set(k, v);
          if (latestByKey.get(oldKey) === s) {
            if (s.prev) latestByKey.set(oldKey, s.prev); else latestByKey.delete(oldKey);
          }
          s.key = newKey;
          s.species = baseSpecies(parts[2]);
          s.prev = latestByKey.get(newKey);
          latestByKey.set(newKey, s);
        }
      } else if (cmd === "swap") {
        // Ally Switch: the Pokemon in this slot moves to position N; the other one takes its place
        const from = slotOf(parts[1]);
        const to = from && from.slice(0, 2) + "abc"[Number(parts[2])];
        if (from && to && from !== to) [slots[from], slots[to]] = [slots[to], slots[from]];
      } else if (cmd === "turn" || cmd === "upkeep") {
        mover = null;
        if (cmd === "turn") {
          destinyBond = null;
          if (turns > 0) countHazardTurns(); // the turn before this one just ended
          turns = Number(parts[1]) || turns;
        }
      } else if (cmd === "move") {
        mover = stintOf(parts[1]);
        const move = norm(parts[2]);
        if (DELAYED_MOVES.has(move) && parts[3]) delayedSrc.set(parts[3].slice(0, 2) + "|" + move, mover);
      } else if (cmd === "-end" && parts[2] && DELAYED_MOVES.has(norm(parts[2]))) {
        // Future Sight landing: the damage line that follows belongs to its user
        mover = delayedSrc.get(parts[1].slice(0, 2) + "|" + norm(parts[2])) || null;
      } else if (cmd === "-status") {
        const target = monKey(parts[1]);
        const frm = tags.from || "";
        if ("of" in tags) statusSrc.set(target, stintOf(tags.of));
        else if (frm.startsWith("item:")) statusSrc.set(target, null); // Flame Orb / Toxic Orb
        else if (mover) statusSrc.set(target, mover);
        else statusSrc.set(target, hazardSrc.get(sideOf(target) + "|toxicspikes") || null);
      } else if (cmd === "-curestatus") {
        statusSrc.delete(monKey(parts[1]));
      } else if (cmd === "-start" || cmd === "-activate") {
        const target = monKey(parts[1]);
        let effect = parts[2] ? norm(parts[2]) : "";
        if (effect.startsWith("perish")) effect = "perish";
        const src = "of" in tags ? stintOf(tags.of) : mover;
        if (cmd === "-activate" && effect === "destinybond") destinyBond = stintOf(parts[1]);
        else if (src && !effectSrc.has(target + "|" + effect)) effectSrc.set(target + "|" + effect, src);
      } else if (cmd === "-sidestart") {
        const side = parts[1].slice(0, 2), hazard = norm(parts[2]);
        hazardSrc.set(side + "|" + hazard, mover);
        if (mover && mover.side !== side && ENTRY_HAZARDS.has(hazard)) mover.hazardsSet += 1; // each layer
      } else if (cmd === "-sideend") {
        const side = parts[1].slice(0, 2), hazard = norm(parts[2]);
        hazardSrc.delete(side + "|" + hazard);
        // Defog / Rapid Spin / Mortal Spin / Tidy Up: only clearing its own side counts
        const remover = "of" in tags ? stintOf(tags.of) : mover;
        if ("from" in tags && remover && remover.side === side && ENTRY_HAZARDS.has(hazard)) remover.hazardsRemoved += 1;
      } else if (cmd === "-swapsideconditions") {
        // Court Change: hazards move to the other side and now count as the Court Change user's
        const swapped = [...hazardSrc].map(([k, v]) => [(k.startsWith("p1") ? "p2" : "p1") + k.slice(2), mover || v]);
        hazardSrc.clear();
        for (const [k, v] of swapped) hazardSrc.set(k, v);
      } else if (cmd === "-weather" && !("upkeep" in tags)) {
        if (norm(parts[1]) === "none") weatherSrc = null;
        else weatherSrc = "of" in tags ? stintOf(tags.of) : mover;
      } else if (cmd === "-heal") {
        const hp = hpOf(parts[2]);
        if (hp !== null) stintOf(parts[1]).hp = hp;
      } else if (cmd === "-sethp") {
        // Pain Split: HP going down is damage by the move's user
        const hp = hpOf(parts[2]);
        if (hp !== null) hit(stintOf(parts[1]), mover, hp);
      } else if (cmd === "-damage") {
        const target = monKey(parts[1]);
        let source, kind, hazard = false;
        if (!("from" in tags) || /^pokemon:/i.test(tags.from)) { // no tag, or Disguise bust
          source = mover; kind = "direct";
        } else {
          const frm = norm(tags.from);
          kind = "passive";
          if (STATUS_DAMAGE.has(frm)) source = statusSrc.get(target);
          else if ("of" in tags && monKey(tags.of) !== target) source = stintOf(tags.of); // Leech Seed, Rocky Helmet...
          else if (HAZARDS.has(frm)) { source = hazardSrc.get(sideOf(target) + "|" + frm); hazard = true; }
          else if (WEATHERS.has(frm)) source = weatherSrc;
          else if (effectSrc.has(target + "|" + frm)) source = effectSrc.get(target + "|" + frm); // Salt Cure, Curse, binding
          else source = null; // recoil, Life Orb, confusion, etc.
        }
        if (source && source.side !== sideOf(target)) lastOppHit.set(target, source);
        if ((parts[2] || "").startsWith("0")) {
          const [killer, k] = credit(target, source, kind);
          pendingKo.set(target, [killer, k, hazard && killer === source]);
        }
        const hp = hpOf(parts[2]);
        if (hp !== null) hit(stintOf(parts[1]), source, hp, hazard);
      } else if (cmd === "faint") {
        const victim = stintOf(parts[1]);
        victim.deaths += 1;
        let killer, kind, byHazard = false;
        if (pendingKo.has(victim.key)) {
          [killer, kind, byHazard] = pendingKo.get(victim.key);
          pendingKo.delete(victim.key);
        } else if (destinyBond && destinyBond.side !== victim.side) {
          [killer, kind] = [destinyBond, "direct"];
        } else if (effectSrc.has(victim.key + "|perish")) {
          [killer, kind] = credit(victim.key, effectSrc.get(victim.key + "|perish"), "passive");
        } else {
          [killer, kind] = [null, "none"]; // Explosion, Memento, Final Gambit...
        }
        if (killer && (kind === "direct" || kind === "passive")) killer[kind] += 1;
        if (killer && byHazard) killer.hazardKills += 1;
        hit(victim, kind === "direct" || kind === "passive" ? killer : null, 0); // HP left at a faint with no 0 HP hit
        kills.push([killer, kind, victim]);
      } else if (cmd === "-message" && (parts[1] || "").includes("forfeited")) {
        forfeited = true;
      } else if (cmd === "-message" && / lost due to inactivity\.$/.test(parts[1] || "")) {
        timedOut = true;
      } else if (cmd === "win") {
        winner = parts[1];
      } else if (cmd === "tie") {
        tie = true;
      }
    }

    if (turns > 0) countHazardTurns(); // the last turn (the game ended during it)

    // Sum stints per Pokemon (keys resolved after any Illusion reveal)
    const species = new Map();          // mon key -> species (insertion order = first seen)
    const stats = new Map();            // mon key -> {direct, passive, deaths}
    for (const s of stints) {
      if (!species.has(s.key) && s.species) species.set(s.key, s.species);
      if (!stats.has(s.key)) stats.set(s.key, { direct: 0, passive: 0, deaths: 0, hazardKills: 0, hazardsSet: 0, hazardsRemoved: 0 });
      const st = stats.get(s.key);
      for (const f of ["direct", "passive", "deaths", "hazardKills", "hazardsSet", "hazardsRemoved"]) st[f] += s[f];
    }
    const damage = new Map();           // mon key -> {dealt, taken, hazard} in % of max HP
    const dmg = (key) => damage.get(key) || damage.set(key, { dealt: 0, taken: 0, hazard: 0 }).get(key);
    const round2 = (x) => Math.round(x * 100) / 100;
    for (const [d, t, pct, hz] of hits) {
      if (d) dmg(d.key).dealt = round2(dmg(d.key).dealt + pct);
      if (hz) dmg(d.key).hazard = round2(dmg(d.key).hazard + pct);
      dmg(t.key).taken = round2(dmg(t.key).taken + pct);
    }
    const keyOf = (s) => (s ? s.key : null);
    const endReason = forfeited ? "forfeit" : timedOut ? "timer" : winner ? "normal" : tie ? "tie" : "unfinished";
    return {
      players, preview, species, stats, damage, winner, forfeited, endReason, turns, hazardTurns,
      kills: kills.map(([k, kind, v]) => [keyOf(k), kind, keyOf(v)]),
      hits: hits.map(([d, t, pct, hz]) => [keyOf(d), keyOf(t), pct, hz]),
    };
  }

  // ---------- rows ----------

  const GAME_FIELDS = ["replay_id", "date", "format", "player", "opponent", "won", "end_reason", "turns", "pokemon", "nickname",
    "brought", "kills", "direct_kills", "passive_kills", "deaths", "damage_dealt_pct", "damage_taken_pct",
    "hazard_damage_pct", "hazard_kills", "hazards_set", "hazards_removed", "hazard_turns", "replay_url"];

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
        const st = (key && b.stats.get(key)) || { direct: 0, passive: 0, deaths: 0, hazardKills: 0, hazardsSet: 0, hazardsRemoved: 0 };
        const dm = (key && b.damage.get(key)) || { dealt: 0, taken: 0, hazard: 0 };
        return {
          replay_id: rid, date, format: replay.format || "", player, opponent,
          won: b.winner === player ? 1 : 0, end_reason: b.endReason, turns: b.turns,
          pokemon: sp, nickname: key ? key.slice(4) : "", brought: key ? 1 : 0,
          kills: st.direct + st.passive, direct_kills: st.direct, passive_kills: st.passive,
          deaths: st.deaths, damage_dealt_pct: dm.dealt, damage_taken_pct: dm.taken,
          hazard_damage_pct: dm.hazard, hazard_kills: st.hazardKills, hazards_set: st.hazardsSet,
          hazards_removed: st.hazardsRemoved, hazard_turns: b.hazardTurns[side], replay_url: REPLAY_HOST + rid,
          // not exported: what addDamageHp needs once max HP is known
          mon_key: key, hits_dealt: b.hits.filter(([d]) => d && d === key).map(([, t, pct, hz]) => [t, pct, hz]),
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

  /**
   * Raw HP from % once rows have max_hp (team sheets): damage_dealt_hp = sum of each hit's % x the
   * target's max HP, damage_taken_hp = % taken x own max HP. Blank ("") when a max HP is unknown.
   */
  function addDamageHp(rows) {
    const maxHp = new Map();            // replay id + mon key -> max HP
    for (const r of rows) if (r.mon_key && r.max_hp) maxHp.set(r.replay_id + "\u0000" + r.mon_key, r.max_hp);
    for (const r of rows) {
      const own = r.mon_key && r.max_hp;
      r.damage_taken_hp = own ? Math.round((r.damage_taken_pct * r.max_hp) / 100) : "";
      let dealt = 0, hazard = 0;
      for (const [t, pct, hz] of r.hits_dealt || []) {
        const m = maxHp.get(r.replay_id + "\u0000" + t);
        if (!m) { dealt = null; break; }
        dealt += (pct * m) / 100;
        if (hz) hazard += (pct * m) / 100;
      }
      // a Pokemon that dealt nothing still needs the opposing side's sheet to show 0
      const oppKnown = rows.some((o) => o.replay_id === r.replay_id && o.player === r.opponent && o.max_hp);
      r.damage_dealt_hp = dealt === null || !oppKnown ? "" : Math.round(dealt);
      r.hazard_damage_hp = dealt === null || !oppKnown ? "" : Math.round(hazard);
    }
    return rows;
  }

  const SUMMARY_FIELDS = ["player", "pokemon", "games_brought", "wins_when_brought", "kills",
    "direct_kills", "passive_kills", "deaths", "kills_per_game", "damage_dealt_pct", "damage_taken_pct",
    "damage_dealt_hp", "damage_taken_hp", "hazard_damage_pct", "hazard_damage_hp", "hazard_kills",
    "hazards_set", "hazards_removed"];
  const SUM_FIELDS = ["kills", "direct_kills", "passive_kills", "deaths", "damage_dealt_pct", "damage_taken_pct",
    "hazard_damage_pct", "hazard_kills", "hazards_set", "hazards_removed"];
  const HP_FIELDS = ["damage_dealt_hp", "damage_taken_hp", "hazard_damage_hp"];

  /** Totals per player + Pokemon (or per Pokemon only when byPlayer is false), most kills first. */
  function summarize(rows, byPlayer = true) {
    const agg = new Map();
    for (const r of rows) {
      if (!r.brought) continue;
      const k = byPlayer ? r.player + "\u0000" + r.pokemon : r.pokemon;
      if (!agg.has(k)) {
        agg.set(k, { player: byPlayer ? r.player : "", pokemon: r.pokemon, games_brought: 0,
          wins_when_brought: 0, kills: 0, direct_kills: 0, passive_kills: 0, deaths: 0, kills_per_game: 0,
          damage_dealt_pct: 0, damage_taken_pct: 0, damage_dealt_hp: 0, damage_taken_hp: 0,
          hazard_damage_pct: 0, hazard_damage_hp: 0, hazard_kills: 0, hazards_set: 0, hazards_removed: 0 });
      }
      const a = agg.get(k);
      a.games_brought += 1;
      a.wins_when_brought += r.won;
      for (const f of SUM_FIELDS) a[f] += r[f] || 0;
      // raw HP totals only when every game has it, so a blank never hides inside a sum
      for (const f of HP_FIELDS) a[f] = a[f] === "" || r[f] === "" || r[f] === undefined ? "" : a[f] + r[f];
    }
    const out = [...agg.values()];
    for (const a of out) {
      a.kills_per_game = Math.round((a.kills / a.games_brought) * 100) / 100;
      a.damage_dealt_pct = Math.round(a.damage_dealt_pct * 100) / 100;
      a.damage_taken_pct = Math.round(a.damage_taken_pct * 100) / 100;
      a.hazard_damage_pct = Math.round(a.hazard_damage_pct * 100) / 100;
    }
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
    replayIdFrom, replayIdsFromText, parseBattle, gameRows, addDamageHp, summarize, toCsv, toTsv, fetchReplay,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ReplayStats = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
