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
  // TEMPORARY (Showdown outage, 2026-10-26): these replays load from site/mock/ instead of Showdown. Remove after.
  const MOCK_REPLAYS = new Set(["gen9nationaldex-2705099074", "gen9nationaldex-2705111047",
    "gen9nationaldex-2705117998", "gen9nationaldex-2705121899"]);

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

  // per-stint counters, summed per Pokemon
  const COUNTS = ["direct", "passive", "deaths", "hazardKills", "hazardsSet", "hazardsRemoved",
    "switches", "pivots", "forcedOut", "faintSwitchIns",
    "crits", "critsTaken", "misses", "dodges", "fullParas", "sleepTurns", "flinched", "confusionHits", "procs",
    "turnsOnField", "koBeforeMoving"];
  const zeroCounts = () => Object.fromEntries(COUNTS.map((f) => [f, 0]));
  const NO_DAMAGE = { dealt: 0, taken: 0, hazard: 0 };
  const NO_HEALING = { self: 0, given: 0 };

  const HAZARDS = new Set(["stealthrock", "spikes", "toxicspikes", "gmaxsteelsurge", "steelsurge"]);
  const ENTRY_HAZARDS = new Set([...HAZARDS, "stickyweb"]); // counted as set / removed / turns up
  const WEATHERS = new Set(["sandstorm", "hail", "snow"]);
  const STATUS_DAMAGE = new Set(["brn", "psn", "tox"]);
  const DELAYED_MOVES = new Set(["futuresight", "doomdesire"]);
  const HEAL_WISHES = new Set(["healingwish", "lunardance"]); // heal the user's replacement
  const SILENT_HEALS = new Set(["rest", "leechseed"]);        // the only real heals logged [silent]
  const SEMI_INVULNERABLE = new Set(["fly", "bounce", "dig", "dive", "phantomforce", "shadowforce", "skydrop"]);
  const PROTECTS = /^move: (Protect|Detect|King's Shield|Spiky Shield|Baneful Bunker|Obstruct|Silk Trap|Burning Bulwark|Max Guard|Mat Block|Quick Guard|Wide Guard|Crafty Shield)$/;
  // a 'cant' reason checked before flinching (sleep, freeze, recharge, Truant): the flinch roll stays unseen
  const BEFORE_FLINCH = new Set(["slp", "frz", "recharge", "ability: Truant"]);

  function parseBattle(log) {
    const players = {};                 // 'p1' -> name
    const preview = { p1: [], p2: [] }; // species at team preview
    const teamSize = {};                // 'p1' -> how many it brought (|teamsize|)
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
    const healWishSrc = new Map();      // side -> its last Healing Wish / Lunar Dance user
    let ejected = null;                 // stint whose Eject Button / Eject Pack just went off
    let prevFrom = "";                  // [from] of the previous line (what a [silent] heal follows)
    const kills = [];                   // [killer stint or null, kind, victim stint]
    const hits = [];                    // [dealer stint or null, target stint, % of max HP lost]
    const heals = [];                   // [healer stint, target stint, % of max HP restored]

    // Luck: every random roll the log shows, with what luck.js needs to work out its odds.
    const rolls = [];                   // {kind: acc / hit / par / slp / frz / conf, actor, target?, ...}
    const statusOf = new Map();         // mon key -> 'par' / 'slp' / ... (kept while switched out)
    const itemOf = new Map();           // mon key -> item the log revealed ("" once it's gone)
    const abilityOf = new Map();        // mon key -> ability the log revealed
    const sleepOf = new Map();          // mon key -> {rest, attempts} for its current sleep
    const pendingFlinch = new Map();    // stint -> hit rolls on it this turn before it tried to move
    const movedThisTurn = new Set();    // stints that tried to move this turn
    const lastConf = new Map();         // stint -> its confusion roll this action
    let weather = "", terrain = "", gravity = false;
    let ctx = null;                     // the move resolving: {actor, move, targets, crits, lastHit, noRoll}
    let prevParts = [];
    let turnStarters = null;            // stints on the field when the current turn began, until it gets played
    let zPending = null;                // stint whose |-zpower| line came just before its Z-move

    function newStint(key, sp) {
      const s = { key, side: sideOf(key), species: sp, hp: 100, ...zeroCounts(), prev: latestByKey.get(key),
        form: sp, types: null, boosts: { accuracy: 0, evasion: 0 }, critBoost: 0, laser: false, semiInv: false };
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

    /** Record HP restored to a stint; a healer from the other side doesn't count (heals itself). */
    function heal(target, healer, newHp) {
      const gained = Math.round((newHp - target.hp) * 100) / 100;
      target.hp = newHp;
      if (gained > 0) heals.push([healer && healer.side === target.side ? healer : target, target, gained]);
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

    /** What luck.js needs about both sides of a roll, as things stand right now. */
    function snap(actor, target) {
      return { actor, target, move: ctx.move, aForm: actor.form, tForm: target.form, aTypes: actor.types, tTypes: target.types,
        aItem: itemOf.get(actor.key), tItem: itemOf.get(target.key),
        aAbility: abilityOf.get(actor.key), tAbility: abilityOf.get(target.key), weather, terrain, gravity };
    }

    /** A roll on a Pokemon's own turn (paralysis, sleep, freeze, confusion): who, and its form / ability. */
    const self = (s) => ({ actor: s, aForm: s.form, aAbility: abilityOf.get(s.key) });

    /** Accuracy state of one opposing target of the move resolving. */
    function aimed(t) {
      if (!ctx.targets.has(t)) ctx.targets.set(t, { missed: false, blocked: false, hit: false, hits: 0, named: false, invulnerable: false });
      return ctx.targets.get(t);
    }

    /** A hit of the move resolving on an opponent (or its Substitute): one crit roll, maybe secondary rolls. */
    function moveHit(t, sub, hpText) {
      if (!ctx || t.side === ctx.actor.side) return;
      aimed(t).hit = true;
      aimed(t).hits += 1;
      const crit = ctx.crits.delete(t);
      const r = { kind: "hit", ...snap(ctx.actor, t), crit, sub, statusBefore: statusOf.get(t.key) || "",
        fainted: !sub && hpOf(hpText) === 0, status: "", flinch: null, critBoost: ctx.actor.critBoost,
        laser: ctx.actor.laser, luckyChant: hazardSrc.has(t.side + "|luckychant"), safeguard: hazardSrc.has(t.side + "|safeguard") };
      rolls.push(r);
      ctx.lastHit.set(t, r);
      if (crit) { ctx.actor.crits += 1; t.critsTaken += 1; }
      if (!sub && !r.fainted && !movedThisTurn.has(t)) {
        if (!pendingFlinch.has(t)) pendingFlinch.set(t, []);
        pendingFlinch.get(t).push(r);
      }
    }

    /** The move resolving is over: one accuracy roll per opposing target it was aimed at. */
    function endMove() {
      if (!ctx) return;
      if (!ctx.noRoll) {
        for (const [t, st] of ctx.targets) {
          if (st.blocked || st.invulnerable || !(st.missed || st.named || st.hit)) continue;
          // hits / cut: Triple Axel and Population Bomb roll accuracy again for each hit, and a miss there isn't logged
          const last = ctx.lastHit.get(t);
          rolls.push({ kind: "acc", ...snap(ctx.actor, t), missed: st.missed, hits: st.hits,
            cut: !!(last && last.fainted) || ctx.actorFainted, accBoost: ctx.actor.boosts.accuracy,
            evaBoost: t.boosts.evasion, targetMoved: ctx.targetMoved.has(t) });
          if (st.missed) { ctx.actor.misses += 1; t.dodges += 1; }
        }
      }
      if (ctx.move !== "laserfocus") ctx.actor.laser = false;
      ctx = null;
    }

    /** A Pokemon tried to act (moved, or 'cant'): settles flinch rolls on it from earlier this turn. */
    /** The current turn is being played (not just forfeited at its start): its starters get a turn on the field. */
    function turnPlayed() {
      if (turnStarters) for (const s of turnStarters) s.turnsOnField += 1;
      turnStarters = null;
    }

    function acted(s, reason) {
      s.acted = true;
      const pending = pendingFlinch.get(s);
      pendingFlinch.delete(s);
      movedThisTurn.add(s);
      if (!pending || BEFORE_FLINCH.has(reason)) return;
      for (const r of pending) {
        r.flinch = reason === "flinch";
        if (r.flinch) r.actor.procs += 1;
      }
    }

    /** Boost changes on accuracy / evasion (the only ones luck needs). */
    function setBoost(s, stat, value) {
      if (stat in s.boosts) s.boosts[stat] = Math.max(-6, Math.min(6, value));
    }

    for (const line of String(log).split(/\r?\n/)) {
      if (!line.startsWith("|")) continue;
      const parts = line.split("|").slice(1);
      const cmd = parts[0];
      const tags = tagsOf(parts);

      if (cmd === "player" && parts[2]) {
        players[parts[1]] = parts[2];
      } else if (cmd === "teamsize") {
        teamSize[parts[1]] = Number(parts[2]);
      } else if (cmd === "poke") {
        (preview[parts[1]] = preview[parts[1]] || []).push(baseSpecies(parts[2]));
      } else if (cmd === "switch" || cmd === "drag") {
        turnPlayed();
        const out = slots[slotOf(parts[1])];
        const passed = ctx && ctx.actor === out && ctx.move === "batonpass";
        endMove();
        const s = newStint(monKey(parts[1]), baseSpecies(parts[2]));
        s.form = parts[2].split(",")[0].trim();
        s.hp = hpOf(parts[3]) ?? 100;
        const st = /\s(par|slp|frz|brn|psn|tox)$/.exec(parts[3] || "");
        if (st) statusOf.set(s.key, st[1]); else statusOf.delete(s.key);
        if (passed) { s.boosts = { ...out.boosts }; s.critBoost = out.critBoost; }
        s.entryState = targetState(s.key);
        // how the Pokemon in this slot left (nothing there for a lead)
        if (out) {
          if (out.deaths) s.faintSwitchIns += 1;
          else if (cmd === "drag" || out === ejected) out.forcedOut += 1; // Roar, Red Card, Eject Button, Emergency Exit
          else if ("from" in tags) out.pivots += 1;  // '[from] U-turn' on the incoming Pokemon
          else out.switches += 1;
        }
        slots[slotOf(parts[1])] = s;
        mover = null;
        ejected = null;
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
        endMove();
        if (cmd === "turn") ejected = null; // ejected but nothing to switch to
        if (cmd === "turn") {
          movedThisTurn.clear();
          pendingFlinch.clear(); // flinch rolls on Pokemon that never tried to move again can't be seen
          lastConf.clear();
          destinyBond = null;
          if (turns > 0) countHazardTurns(); // the turn before this one just ended
          turns = Number(parts[1]) || turns;
          turnStarters = [...new Set(Object.values(slots))].filter((x) => x && !x.deaths);
        }
      } else if (cmd === "move") {
        endMove();
        turnPlayed();
        mover = stintOf(parts[1]);
        if (zPending === mover && !mover.zMove) [mover.zMove, mover.zTurn] = [parts[2], turns];
        zPending = null;
        const move = norm(parts[2]);
        mover.semiInv = false; // its Fly / Dig turn is over
        // a move it chose itself went through the checks before moving: paralysis passed if it has it
        if (!tags.from || norm(tags.from) === "lockedmove") {
          acted(mover, "move");
          if (statusOf.get(mover.key) === "par") rolls.push({ kind: "par", ...self(mover), fullPara: false });
        }
        ctx = { actor: mover, move, targets: new Map(), crits: new Set(), lastHit: new Map(),
          targetMoved: new Set(movedThisTurn), noRoll: "notarget" in tags, actorFainted: false };
        if (/^p\d[a-z]: /.test(parts[3] || "")) {
          const t = stintOf(parts[3]);
          if (t.side !== mover.side) aimed(t).named = true;
        }
        if (DELAYED_MOVES.has(move) && parts[3]) delayedSrc.set(parts[3].slice(0, 2) + "|" + move, mover);
        if (HEAL_WISHES.has(move)) healWishSrc.set(mover.side, mover);
      } else if ((cmd === "-enditem" && /^Eject (Button|Pack)$/.test(parts[2] || "") && !("from" in tags)) ||
          (cmd === "-activate" && /^ability: (Emergency Exit|Wimp Out)$/.test(parts[2] || ""))) {
        ejected = stintOf(parts[1]); // it switches out next (an Eject Button Knocked Off has a [from])
      } else if (cmd === "-activate" && parts[2] === "healreplacement") {
        healWishSrc.set(sideOf(monKey(parts[1])), stintOf(parts[1])); // Z-Memento / Z-Parting Shot
      } else if (cmd === "-end" && parts[2] && DELAYED_MOVES.has(norm(parts[2]))) {
        // Future Sight landing: the damage line that follows belongs to its user
        endMove();
        mover = delayedSrc.get(parts[1].slice(0, 2) + "|" + norm(parts[2])) || null;
      } else if (cmd === "-status") {
        const target = monKey(parts[1]);
        const frm = tags.from || "";
        if ("of" in tags) statusSrc.set(target, stintOf(tags.of));
        else if (frm.startsWith("item:")) statusSrc.set(target, null); // Flame Orb / Toxic Orb
        else if (mover) statusSrc.set(target, mover);
        else statusSrc.set(target, hazardSrc.get(sideOf(target) + "|toxicspikes") || null);
        statusOf.set(target, parts[2]);
        if (parts[2] === "slp") sleepOf.set(target, { rest: norm(frm) === "rest", attempts: 0 });
        // a damaging move's secondary effect (a status move makes no hit roll)
        const t = stintOf(parts[1]);
        if (ctx && !frm && ctx.lastHit.has(t)) { ctx.lastHit.get(t).status = parts[2]; ctx.actor.procs += 1; }
      } else if (cmd === "-curestatus") {
        const key = monKey(parts[1]);
        statusSrc.delete(key);
        statusOf.delete(key);
        // waking up / thawing on its own, right before moving (Chesto / Lum / Shed Skin show a line about it first)
        const cause = (prevParts[0] === "-enditem" || prevParts[0] === "-activate") && monKey(prevParts[1] || "") === key;
        if ("msg" in tags && !("from" in tags) && !cause && (parts[2] === "slp" || parts[2] === "frz")) {
          const s = stintOf(parts[1]);
          if (parts[2] === "frz") rolls.push({ kind: "frz", ...self(s), thawed: true });
          else {
            const sl = sleepOf.get(key) || { rest: false, attempts: 0 };
            sl.attempts += 1;
            rolls.push({ kind: "slp", ...self(s), attempt: sl.attempts, woke: true, rest: sl.rest });
          }
        }
        sleepOf.delete(key);
      } else if (cmd === "-cureteam") {
        for (const k of [...statusOf.keys()]) if (sideOf(k) === sideOf(monKey(parts[1]))) statusOf.delete(k);
      } else if (cmd === "cant") {
        endMove();
        turnPlayed();
        const s = stintOf(parts[1]), reason = parts[2] || "";
        acted(s, reason);
        if (reason === "par") { rolls.push({ kind: "par", ...self(s), fullPara: true }); s.fullParas += 1; }
        else if (reason === "frz") rolls.push({ kind: "frz", ...self(s), thawed: false });
        else if (reason === "flinch") s.flinched += 1;
        else if (reason === "slp") {
          s.sleepTurns += 1;
          const sl = sleepOf.get(s.key);
          if (sl) {
            sl.attempts += 1;
            rolls.push({ kind: "slp", ...self(s), attempt: sl.attempts, woke: false, rest: sl.rest });
          }
        }
      } else if (cmd === "-hitcount") {
        // how many times a multi-hit move hit; cut short when the target or the user fainted first
        if (ctx && parts[1]) {
          const t = stintOf(parts[1]), last = ctx.lastHit.get(t);
          if (t.side !== ctx.actor.side) {
            rolls.push({ kind: "hits", ...snap(ctx.actor, t), count: Number(parts[2]) || 0,
              cut: !!(last && last.fainted) || ctx.actorFainted });
          }
        }
      } else if (cmd === "-crit") {
        if (ctx) ctx.crits.add(stintOf(parts[1]));
      } else if (cmd === "-miss") {
        if (ctx && parts[2]) {
          const t = stintOf(parts[2]);
          if (t.side !== ctx.actor.side) {
            const st = aimed(t);
            if (!st.hit) st.missed = true; // a later hit of Triple Axel missing still hit
            if (t.semiInv) st.invulnerable = true; // missed because it was in the air / underground
          }
        }
      } else if (cmd === "-immune" || cmd === "-notarget") {
        if (ctx && parts[1]) {
          const t = stintOf(parts[1]);
          if (t.side !== ctx.actor.side) aimed(t).blocked = true;
          else if (cmd === "-notarget") ctx.noRoll = true;
        } else if (ctx) ctx.noRoll = true;
      } else if (cmd === "-fail") {
        if (ctx && stintOf(parts[1]) === ctx.actor) ctx.noRoll = true; // failed before aiming (Sucker Punch...)
      } else if (cmd === "-prepare") {
        // a charge turn rolls nothing; Fly / Dig make the user dodge everything until it attacks
        if (ctx && stintOf(parts[1]) === ctx.actor) {
          ctx.noRoll = true;
          if (SEMI_INVULNERABLE.has(norm(parts[2]))) ctx.actor.semiInv = true;
        }
      } else if (cmd === "-boost" || cmd === "-unboost") {
        const s = stintOf(parts[1]), n = Number(parts[3]) || 0;
        if (parts[2] in s.boosts) setBoost(s, parts[2], s.boosts[parts[2]] + (cmd === "-boost" ? n : -n));
      } else if (cmd === "-setboost") {
        setBoost(stintOf(parts[1]), parts[2], Number(parts[3]) || 0);
      } else if (cmd === "-clearboost" || cmd === "-clearallboost" || cmd === "-clearnegativeboost" || cmd === "-invertboost") {
        const targets = cmd === "-clearallboost" ? Object.values(slots) : [stintOf(parts[1])];
        for (const s of targets) {
          for (const stat of Object.keys(s.boosts)) {
            const v = s.boosts[stat];
            s.boosts[stat] = cmd === "-invertboost" ? -v : cmd === "-clearnegativeboost" ? Math.max(0, v) : 0;
          }
        }
      } else if (cmd === "-copyboost") {
        // Psych Up: the user (first) copies the target's boosts
        if (parts[2]) stintOf(parts[1]).boosts = { ...stintOf(parts[2]).boosts };
      } else if (cmd === "detailschange" || cmd === "-formechange") {
        if (cmd === "detailschange") abilityOf.delete(monKey(parts[1] || "")); // Mega Evolution changes the ability
        if (slotOf(parts[1] || "")) stintOf(parts[1]).form = (parts[2] || "").split(",")[0].trim();
      } else if (cmd === "-fieldstart" || cmd === "-fieldend") {
        const effect = norm(parts[1] || "");
        if (effect === "gravity") gravity = cmd === "-fieldstart";
        else if (effect.endsWith("terrain")) terrain = cmd === "-fieldstart" ? effect : "";
      } else if (cmd === "-end" && /^(move: )?Substitute$/.test(parts[2] || "")) {
        if (ctx && !("from" in tags) && mover === ctx.actor) moveHit(stintOf(parts[1]), true, "");
      } else if (cmd === "-end" && parts[2] === "typechange") {
        stintOf(parts[1]).types = null;
      } else if (cmd === "-start" || cmd === "-activate") {
        const target = monKey(parts[1]);
        const s = stintOf(parts[1]);
        if (cmd === "-activate" && parts[2] === "confusion") {
          endMove(); // it is about to act
          const r = { kind: "conf", ...self(s), selfHit: false };
          rolls.push(r);
          lastConf.set(s, r);
          acted(s, "confusion");
        } else if (cmd === "-activate" && /^(move: )?Substitute$/.test(parts[2] || "") && "damage" in tags) {
          if (ctx && mover === ctx.actor) moveHit(s, true, "");
        } else if (cmd === "-activate" && ctx && PROTECTS.test(parts[2] || "") && s.side !== ctx.actor.side) {
          aimed(s).blocked = true;
        } else if (cmd === "-start" && parts[2] === "typechange") {
          s.types = (parts[3] || "").split("/").filter(Boolean);
        } else if (cmd === "-start" && /^(move: )?Focus Energy$/.test(parts[2] || "")) {
          s.critBoost = 2;
        } else if (cmd === "-start" && /^(move: )?Dragon Cheer$/.test(parts[2] || "")) {
          s.critBoost = 1; // +2 for Dragon types; luck.js doesn't know types here
        } else if (cmd === "-start" && /^(move: )?Laser Focus$/.test(parts[2] || "")) {
          s.laser = true;
        }
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
        weather = norm(parts[1]) === "none" ? "" : norm(parts[1]);
      } else if (cmd === "-heal" && hpOf(parts[2]) !== null) {
        const hp = hpOf(parts[2]), target = stintOf(parts[1]);
        if ("silent" in tags && !SILENT_HEALS.has(norm(prevFrom))) {
          target.hp = hp; // a forme change refilling HP (Tera Shift), not healing
        } else {
          const frm = norm(tags.from || "");
          const healer = "wisher" in tags ? latestByKey.get(target.side + ": " + tags.wisher)
            : HEAL_WISHES.has(frm) || ("zeffect" in tags && frm) ? healWishSrc.get(target.side)
            : frm === "hospitality" && "of" in tags ? stintOf(tags.of)
            : frm || "silent" in tags ? target  // items, abilities (Water Absorb), drain, terrain, Rest, Leech Seed
            : mover;                            // a move: Recover, or Heal Pulse on an ally
          heal(target, healer, hp);
        }
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
        if (!("from" in tags) && ctx && mover === ctx.actor) moveHit(stintOf(parts[1]), false, parts[2]);
        if (ctx && stintOf(parts[1]) === ctx.actor && hpOf(parts[2]) === 0) ctx.actorFainted = true; // Rocky Helmet...
        if (norm(tags.from || "") === "confusion") {
          const s = stintOf(parts[1]), r = lastConf.get(s);
          if (r && !r.selfHit) { r.selfHit = true; s.confusionHits += 1; }
        }
      } else if (cmd === "faint") {
        const victim = stintOf(parts[1]);
        victim.deaths += 1;
        if (!victim.acted) victim.koBeforeMoving += 1;
        statusOf.delete(victim.key);
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
      } else if (cmd === "-mega") {
        const m = stintOf(parts[1]);
        if (m.megaTurn === undefined) m.megaTurn = turns;
      } else if (cmd === "-zpower") {
        zPending = stintOf(parts[1]);
      } else if (cmd === "win") {
        winner = parts[1];
      } else if (cmd === "tie") {
        tie = true;
      }
      // abilities and items the log shows (luck.js needs No Guard, Scope Lens, Covert Cloak...)
      if (cmd === "-ability" && parts[2]) abilityOf.set(monKey(parts[1]), parts[2]);
      else if (cmd === "-item" && parts[2]) itemOf.set(monKey(parts[1]), parts[2]);
      else if (cmd === "-enditem" && parts[1]) {
        itemOf.set(monKey(parts[1]), "");
        if (parts[2] === "Power Herb" && ctx && stintOf(parts[1]) === ctx.actor) { ctx.noRoll = false; ctx.actor.semiInv = false; }
      }
      if (cmd !== "-ability" && cmd !== "-item" && cmd !== "-enditem" && /^p\d/.test(parts[1] || "")) {
        const owner = "of" in tags ? monKey(tags.of) : monKey(parts[1]);
        const frm = /^(ability|item):\s*(.+)$/.exec(tags.from || "");
        if (frm) (frm[1] === "ability" ? abilityOf : itemOf).set(owner, frm[2]);
        if (cmd === "-activate" && /^ability: /.test(parts[2] || "")) abilityOf.set(monKey(parts[1]), parts[2].slice(9));
      }
      prevFrom = tags.from || "";
      prevParts = parts;
    }

    if (turns > 0) countHazardTurns(); // the last turn (the game ended during it)
    endMove();

    // Sum stints per Pokemon (keys resolved after any Illusion reveal)
    const species = new Map();          // mon key -> species (insertion order = first seen)
    const stats = new Map();            // mon key -> COUNTS
    for (const s of stints) {
      if (!species.has(s.key) && s.species) species.set(s.key, s.species);
      if (!stats.has(s.key)) stats.set(s.key, zeroCounts());
      const st = stats.get(s.key);
      for (const f of COUNTS) st[f] += s[f];
      if (s.megaTurn !== undefined && st.megaTurn === undefined) st.megaTurn = s.megaTurn;
      if (s.zMove && !st.zMove) [st.zMove, st.zTurn] = [s.zMove, s.zTurn];
    }
    const round2 = (x) => Math.round(x * 100) / 100;
    const add = (map, zero, key, f, pct) => {
      if (!map.has(key)) map.set(key, { ...zero });
      map.get(key)[f] = round2(map.get(key)[f] + pct);
    };
    const damage = new Map();           // mon key -> {dealt, taken, hazard} in % of max HP
    for (const [d, t, pct, hz] of hits) {
      if (d) add(damage, NO_DAMAGE, d.key, "dealt", pct);
      if (hz) add(damage, NO_DAMAGE, d.key, "hazard", pct);
      add(damage, NO_DAMAGE, t.key, "taken", pct);
    }
    const healing = new Map();          // mon key -> {self, given} in % of the healed Pokemon's max HP
    for (const [h, t, pct] of heals) add(healing, NO_HEALING, h.key, h.key === t.key ? "self" : "given", pct);

    // Zoroark at team preview that never showed itself, while fewer Pokemon were seen than brought
    // (else it stayed home, e.g. bring 4 of 6): its disguised stints may sit on other Pokemon
    const hiddenZoroark = {};
    for (const side of ["p1", "p2"]) {
      const seen = new Set(stints.filter((s) => s.side === side && s.species).map((s) => s.species));
      hiddenZoroark[side] = (preview[side] || []).some((sp) => sp.startsWith("Zoroark")) &&
        ![...seen].some((sp) => sp.startsWith("Zoroark")) && seen.size < (teamSize[side] || preview[side].length);
    }

    const keyOf = (s) => (s ? s.key : null);
    const endReason = forfeited ? "forfeit" : timedOut ? "timer" : winner ? "normal" : tie ? "tie" : "unfinished";
    return {
      // alive at the end: its latest stay on the field didn't end in a faint (Revival Blessing brings one back)
      alive: new Set([...latestByKey].filter(([, st]) => !st.deaths).map(([k]) => k)),
      players, preview, species, stats, damage, healing, winner, forfeited, endReason, turns, hazardTurns, hiddenZoroark,
      kills: kills.map(([k, kind, v]) => [keyOf(k), kind, keyOf(v)]),
      hits: hits.map(([d, t, pct, hz]) => [keyOf(d), keyOf(t), pct, hz]),
      heals: heals.map(([h, t, pct]) => [keyOf(h), keyOf(t), pct]),
      rolls: rolls.map((r) => ({ ...r, actor: keyOf(r.actor), ...(r.target ? { target: keyOf(r.target) } : {}) })),
    };
  }

  // ---------- rows ----------

  // luck event counts (straight from the log) and the luck score (luck.js, needs Showdown's move data)
  const LUCK_COUNT_FIELDS = ["crits", "crits_taken", "misses", "dodges", "full_paras", "sleep_turns", "flinched",
    "confusion_hits", "procs"];
  const LUCK_FIELDS = ["luck", "luck_against"];

  const GAME_FIELDS = ["replay_id", "date", "format", "player", "opponent", "won", "end_reason", "turns", "pokemon", "nickname",
    "brought", "kills", "direct_kills", "passive_kills", "deaths", "damage_dealt_pct", "damage_taken_pct",
    "hazard_damage_pct", "hazard_kills", "hazards_set", "hazards_removed", "hazard_turns", "healing_pct",
    "healing_given_pct", "switches", "pivots", "forced_out", "faint_switch_ins", "turns_on_field", "survived", "ko_before_moving", "mega", "mega_turn", "z_move", "z_turn",
    "mvp_score", "mvp", ...LUCK_COUNT_FIELDS,
    "luck", "luck_against", "player_luck", "hidden_zoroark", "replay_url"];

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
        const st = (key && b.stats.get(key)) || zeroCounts();
        const dm = (key && b.damage.get(key)) || NO_DAMAGE;
        const hl = (key && b.healing.get(key)) || NO_HEALING;
        return {
          replay_id: rid, date, format: replay.format || "", player, opponent,
          won: b.winner === player ? 1 : 0, end_reason: b.endReason, turns: b.turns,
          pokemon: sp, nickname: key ? key.slice(4) : "", brought: key ? 1 : 0,
          kills: st.direct + st.passive, direct_kills: st.direct, passive_kills: st.passive,
          deaths: st.deaths, damage_dealt_pct: dm.dealt, damage_taken_pct: dm.taken,
          hazard_damage_pct: dm.hazard, hazard_kills: st.hazardKills, hazards_set: st.hazardsSet,
          hazards_removed: st.hazardsRemoved, hazard_turns: b.hazardTurns[side],
          healing_pct: hl.self, healing_given_pct: hl.given, switches: st.switches, pivots: st.pivots,
          forced_out: st.forcedOut, faint_switch_ins: st.faintSwitchIns,
          turns_on_field: st.turnsOnField, survived: key && b.alive.has(key) ? 1 : 0, ko_before_moving: st.koBeforeMoving,
          mega: st.megaTurn !== undefined ? 1 : 0, mega_turn: st.megaTurn ?? "", z_move: st.zMove || "", z_turn: st.zTurn ?? "",
          crits: st.crits, crits_taken: st.critsTaken, misses: st.misses, dodges: st.dodges, full_paras: st.fullParas,
          sleep_turns: st.sleepTurns, flinched: st.flinched, confusion_hits: st.confusionHits, procs: st.procs,
          luck: "", luck_against: "", player_luck: "", // filled by Luck.addLuck once move data is loaded
          hidden_zoroark: b.hiddenZoroark[side] ? 1 : 0,
          replay_url: REPLAY_HOST + rid,
          // not exported: what addDamageHp needs once max HP is known
          mon_key: key, hits_dealt: b.hits.filter(([d]) => d && d === key).map(([, t, pct, hz]) => [t, pct, hz]),
          rolls: b.rolls, // the whole game's, shared by its rows
          heals_given: b.heals.filter(([h, t]) => h && h === key && t !== key).map(([, t, pct]) => [t, pct]),
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
    return addMvp(rows);
  }

  /**
   * MVP score, in rough "KOs' worth": +1 per 100% dealt, +1 per kill, +0.5 per 100% healed (self or
   * given), +0.5 for surviving. Brought Pokemon only. mvp = 1 for the top score on each team; ties go
   * to more kills, then more damage, then team order.
   */
  function addMvp(rows) {
    const best = {};
    for (const r of rows) {
      if (!r.brought) { r.mvp_score = ""; r.mvp = 0; continue; }
      r.mvp_score = Math.round((r.damage_dealt_pct / 100 + r.kills +
        0.5 * (r.healing_pct + r.healing_given_pct) / 100 + (r.deaths ? 0 : 0.5)) * 100) / 100;
      r.mvp = 0;
      const b = best[r.player];
      if (!b || r.mvp_score > b.mvp_score || (r.mvp_score === b.mvp_score && (r.kills > b.kills ||
        (r.kills === b.kills && r.damage_dealt_pct > b.damage_dealt_pct)))) best[r.player] = r;
    }
    for (const r of Object.values(best)) r.mvp = 1;
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
      /** Sum of [target key, %] entries in HP, rounded; "" when a target's max HP is unknown. */
      const hpSum = (entries) => {
        let sum = 0;
        for (const [t, pct] of entries) {
          const m = maxHp.get(r.replay_id + "\u0000" + t);
          if (!m) return "";
          sum += (pct * m) / 100;
        }
        return Math.round(sum);
      };
      const own = r.mon_key && r.max_hp;
      const hits = r.hits_dealt || [];
      r.damage_taken_hp = own ? Math.round((r.damage_taken_pct * r.max_hp) / 100) : "";
      // a Pokemon that dealt nothing still needs the opposing side's sheet to show 0
      const oppKnown = rows.some((o) => o.replay_id === r.replay_id && o.player === r.opponent && o.max_hp);
      const dealt = oppKnown ? hpSum(hits) : "";
      r.damage_dealt_hp = dealt;
      r.hazard_damage_hp = dealt === "" ? "" : hpSum(hits.filter(([, , hz]) => hz));
      // healing stays within the team, so its own sheet covers both
      r.healing_hp = own ? Math.round((r.healing_pct * r.max_hp) / 100) : "";
      r.healing_given_hp = own ? hpSum(r.heals_given || []) : "";
    }
    return rows;
  }

  const SUMMARY_FIELDS = ["player", "pokemon", "games_brought", "wins_when_brought", "kills",
    "direct_kills", "passive_kills", "deaths", "kills_per_game", "mvps", "mvp_score_per_game", "damage_dealt_pct", "damage_taken_pct",
    "damage_dealt_hp", "damage_taken_hp", "hazard_damage_pct", "hazard_damage_hp", "hazard_kills",
    "hazards_set", "hazards_removed", "healing_pct", "healing_hp", "healing_given_pct", "healing_given_hp",
    "switches", "pivots", "forced_out", "faint_switch_ins", "turns_on_field", "survived", "ko_before_moving",
    "megas", "mega_wins", "z_moves", "z_wins", ...LUCK_COUNT_FIELDS, ...LUCK_FIELDS];
  const PCT_FIELDS = ["damage_dealt_pct", "damage_taken_pct", "hazard_damage_pct", "healing_pct", "healing_given_pct"];
  const SUM_FIELDS = ["kills", "direct_kills", "passive_kills", "deaths", "hazard_kills", "hazards_set",
    "hazards_removed", "switches", "pivots", "forced_out", "faint_switch_ins", "turns_on_field", "survived",
    "ko_before_moving", ...LUCK_COUNT_FIELDS, ...PCT_FIELDS];
  const HP_FIELDS = ["damage_dealt_hp", "damage_taken_hp", "hazard_damage_hp", "healing_hp", "healing_given_hp"];

  /** Totals per player + Pokemon (or per Pokemon only when byPlayer is false), most kills first. */
  function summarize(rows, byPlayer = true) {
    const agg = new Map();
    for (const r of rows) {
      if (!r.brought) continue;
      const k = byPlayer ? r.player + "\u0000" + r.pokemon : r.pokemon;
      if (!agg.has(k)) {
        agg.set(k, { ...Object.fromEntries(SUMMARY_FIELDS.map((f) => [f, 0])),
          player: byPlayer ? r.player : "", pokemon: r.pokemon });
      }
      const a = agg.get(k);
      a.games_brought += 1;
      a.wins_when_brought += r.won;
      for (const f of SUM_FIELDS) a[f] += r[f] || 0;
      a.mvps += r.mvp;
      a.megas += r.mega;
      a.mega_wins += r.mega && r.won;
      a.z_moves += r.z_move ? 1 : 0;
      a.z_wins += r.z_move && r.won ? 1 : 0;
      a.mvp_score_per_game += r.mvp_score;
      // raw HP totals only when every game has it, so a blank never hides inside a sum
      for (const f of [...HP_FIELDS, ...LUCK_FIELDS]) a[f] = a[f] === "" || r[f] === "" || r[f] === undefined ? "" : a[f] + r[f];
    }
    const out = [...agg.values()];
    for (const a of out) {
      a.kills_per_game = Math.round((a.kills / a.games_brought) * 100) / 100;
      a.mvp_score_per_game = Math.round((a.mvp_score_per_game / a.games_brought) * 100) / 100;
      for (const f of [...PCT_FIELDS, ...LUCK_FIELDS]) if (a[f] !== "") a[f] = Math.round(a[f] * 100) / 100;
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

  const FETCH_TIMEOUT_MS = 15000;      // a replay normally loads in under a second

  /**
   * fetch with a time limit. Throws an Error with .down = true when the server doesn't answer in time,
   * can't be reached, or answers 5xx (Cloudflare's 52x: the site behind it is down). Other statuses
   * come back as the response, for the caller to explain.
   */
  async function fetchChecked(url, fetchFn = root.fetch, timeoutMs = FETCH_TIMEOUT_MS) {
    const host = new URL(url).hostname;
    const down = (why) => Object.assign(new Error(`${host} ${why}; the site may be down, try again in a few minutes`), { down: true });
    const ctrl = typeof AbortController === "function" ? new AbortController() : null;
    let timer;
    const timeout = new Promise((_, reject) => {
      timer = setTimeout(() => {
        reject(down(`didn't answer within ${timeoutMs / 1000} s`));
        if (ctrl) ctrl.abort();
      }, timeoutMs);
    });
    try {
      const resp = await Promise.race([fetchFn(url, ctrl ? { signal: ctrl.signal } : undefined), timeout]);
      if (resp.status >= 500) throw down(`is down or overloaded (HTTP ${resp.status})`);
      return resp;
    } catch (e) {
      throw e.down ? e : down("couldn't be reached (check your internet connection)");
    } finally {
      clearTimeout(timer);
    }
  }

  async function fetchReplay(id, fetchFn = root.fetch, timeoutMs = FETCH_TIMEOUT_MS) {
    if (MOCK_REPLAYS.has(id)) {
      const mock = await fetchFn("mock/" + id + ".json");
      if (mock.ok) return mock.json();
    }
    const resp = await fetchChecked(REPLAY_HOST + id + ".json", fetchFn, timeoutMs);
    if (resp.status === 404) throw new Error("not found (deleted, private, or never saved)");
    if (!resp.ok) throw new Error("HTTP " + resp.status);
    return resp.json();
  }

  const api = {
    REPLAY_HOST, GAME_FIELDS, SUMMARY_FIELDS, HP_FIELDS, LUCK_FIELDS, norm,
    replayIdFrom, replayIdsFromText, parseBattle, gameRows, addDamageHp, summarize, toCsv, toTsv, fetchChecked, fetchReplay,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.ReplayStats = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
