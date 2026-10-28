/* Luck score from the rolls parser.js records. No DOM use. Exposes window.Luck (browser) or module.exports.
 *
 * Each roll scores outcome - expectation for the Pokemon it favours: a good result that had chance p
 * gives +(1 - p), a bad one -p' where p' was the chance of the good result. A 70% move hitting = +0.3,
 * missing = -0.7; a normal hit = -1/24, a crit = +23/24. Average luck sums to about 0 over many games.
 *
 *   luck          rolls made by this Pokemon: its accuracy, crits and secondary effects, and its own
 *                 full paralysis / waking up / thawing / confusion rolls.
 *   luck_against  opponents' accuracy, crit and secondary rolls aimed at it, scored for them (high = they
 *                 got lucky against it).
 *   player_luck   (per game) the player's luck minus the opponent's: one number for "who got the rolls".
 *   luck_var, player_luck_var   the spread those scores could have had: each roll with chance p adds p(1 - p).
 *                 Season luck = total / sqrt(total variance) (League.seasonLuck).
 *
 * Odds come from Showdown's moves.json and pokedex.json (types, possible abilities). An ability is known when the
 * log revealed it, a team sheet gives it, or the species (Mega forms) has only one. Otherwise each roll is worked
 * out for every ability the species can have, and skipped when they don't all give the same odds (an unrevealed
 * Inner Focus could have stopped the flinch). Items count when the log or a sheet shows them, else none, except
 * that multi-hit luck (hit count, Triple Axel's extra accuracy rolls) needs the item known: Loaded Dice.
 * See docs/knowledge/luck.md for the rules and blind spots.
 */
(function (root) {
  "use strict";

  const MOVES_URL = "https://play.pokemonshowdown.com/data/moves.json";
  const DEX_URL = "https://play.pokemonshowdown.com/data/pokedex.json";
  const toID = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // damage set by a formula: no crit roll (moves.json has 'damage' only for the first four)
  const FIXED_DAMAGE = new Set(["seismictoss", "nightshade", "dragonrage", "sonicboom", "superfang", "ruination",
    "naturesmadness", "guardianofalola", "endeavor", "finalgambit", "counter", "mirrorcoat", "metalburst",
    "comeuppance", "bide", "psywave"]);
  const RAIN_SURE = new Set(["thunder", "hurricane", "bleakwindstorm", "wildboltstorm", "sandsearstorm"]);
  const SUN_HALF = new Set(["thunder", "hurricane"]);
  const CRIT_ODDS = [0, 1 / 24, 1 / 8, 1 / 2];   // by stage; 4+ always crits
  const STATUS_NAMES = { brn: "burn", par: "paralysis", psn: "poison", tox: "bad poison", frz: "freeze", slp: "sleep" };
  const STATUS_DONE = { burn: "burned", paralysis: "paralyzed", poison: "poisoned", "bad poison": "badly poisoned", freeze: "froze" };
  const STATUS_BLOCK = {                         // abilities that stop a status
    brn: ["Water Veil", "Water Bubble", "Thermal Exchange"], par: ["Limber"], psn: ["Immunity", "Pastel Veil"],
    tox: ["Immunity", "Pastel Veil"], frz: ["Magma Armor"], slp: ["Insomnia", "Vital Spirit", "Sweet Veil"],
  };
  const TYPE_BLOCK = { brn: ["Fire"], par: ["Electric"], psn: ["Poison", "Steel"], tox: ["Poison", "Steel"], frz: ["Ice"] };

  const MOLD_BREAKERS = new Set(["Mold Breaker", "Teravolt", "Turboblaze"]);
  const HIT_ODDS = { 2: 0.35, 3: 0.35, 4: 0.15, 5: 0.15 };   // 2-5 hit moves
  const DICE_ODDS = { 4: 0.5, 5: 0.5 };                     // with Loaded Dice

  const isRain = (w) => w === "raindance" || w === "primordialsea";
  const isSun = (w) => w === "sunnyday" || w === "desolateland";
  const isSnow = (w) => w === "snowscape" || w === "hail" || w === "snow";

  /**
   * Score one game's rolls. data: {moves, dex}; sets: mon key -> team-sheet set ({item, ability}).
   * Returns {byMon: Map key -> {luck, against, luckVar}, bySide: {p1, p2}, varSide: {p1, p2}}: varSide / luckVar add up
   * each roll's variance (p(1 - p) for a yes/no roll), the spread the score could have had.
   */
  function scoreGame(rolls, data, sets = new Map()) {
    const moves = data.moves || {}, dex = data.dex || {};
    const byMon = new Map();
    const bySide = { p1: 0, p2: 0 }, varSide = { p1: 0, p2: 0 };
    const events = [];  // every scored roll: {actor, form, v, label}, for "biggest contributors"
    const add = (key, f, v) => {
      if (!byMon.has(key)) byMon.set(key, { luck: 0, against: 0, luckVar: 0 });
      byMon.get(key)[f] += v;
    };
    const setOf = (r, who) => sets.get(who === "a" ? r.actor : r.target) || {};
    /** Item as far as the log or a sheet shows it; null when unknown. */
    const knownItem = (r, who) => r[who + "Item"] ?? setOf(r, who).item ?? null;
    const item = (r, who) => knownItem(r, who) ?? "";
    const typesOf = (r, who) => r[who + "Types"] || (dex[toID(r[who + "Form"])] || {}).types || null;

    /** Abilities this side of the roll may have: the one the log / sheet shows, else every one its species can. */
    function possible(r, who) {
      if (r[who + "Ability"]) return [r[who + "Ability"]];
      const entry = dex[toID(r[who + "Form"])];
      const forDex = entry && entry.abilities ? [...new Set(Object.values(entry.abilities))] : null;
      const sheet = setOf(r, who).ability;
      if (sheet && !/-Mega/.test(r[who + "Form"] || "")) return [sheet]; // a sheet gives the pre-Mega ability
      return forDex && forDex.length ? forDex : [sheet || ""];
    }
    let cur = { a: "", t: "" };             // the abilities being tried by agree()
    const ability = (r, who) => (who === "t" && MOLD_BREAKERS.has(cur.a) ? "" : cur[who]);

    /** fn's result if it is the same whichever possible abilities the two sides have; undefined if not. */
    function agree(r, fn) {
      let first, firstKey;
      for (const a of possible(r, "a")) {
        for (const t of possible(r, "t")) {
          cur = { a, t };
          const v = fn(), k = JSON.stringify(v);
          if (firstKey === undefined) { first = v; firstKey = k; } else if (k !== firstKey) return undefined;
        }
      }
      return first;
    }

    /** Add v (positive = went the actor's way) to the actor's luck, and to the target's 'against' when aimed at it;
        variance: the roll's expected spread (v averages 0). */
    function scoreValue(r, v, aimed, label, variance, chance) {
      // roll / chance (of what happened; null for multi-hit counts): for keyMoments
      events.push({ actor: r.actor, form: r.aForm || "", v, label, roll: r, chance: chance ?? null });
      add(r.actor, "luck", v);
      add(r.actor, "luckVar", variance);
      if (aimed) add(r.target, "against", v);
      bySide[r.actor.slice(0, 2)] += v;
      varSide[r.actor.slice(0, 2)] += variance;
    }
    /** good: the roll went the actor's way; p: chance it would. */
    function score(r, good, p, aimed, label) {
      if (p === null || p === undefined || p <= 0 || p >= 1) return;
      scoreValue(r, good ? 1 - p : -p, aimed, label, p * (1 - p), good ? p : 1 - p);
    }
    const moveName = (r) => (moves[r.move] && moves[r.move].name) || r.move || "a move";

    /** Chance the move hits, or null when it can't miss / isn't known. */
    function hitChance(r) {
      const m = moves[r.move];
      if (!m || m.accuracy === true || m.ohko) return null;
      const aA = ability(r, "a"), tA = ability(r, "t"), aI = item(r, "a"), tI = item(r, "t");
      if (aA === "No Guard" || tA === "No Guard") return null;
      let acc = m.accuracy;
      const umbrella = tI === "Utility Umbrella";
      if (RAIN_SURE.has(r.move) && isRain(r.weather) && !umbrella) return null;
      if (SUN_HALF.has(r.move) && isSun(r.weather) && !umbrella) acc = 50;
      if (r.move === "blizzard" && isSnow(r.weather)) return null;
      if (r.move === "toxic" && (typesOf(r, "a") || []).includes("Poison")) return null;
      if (m.category === "Status" && tA === "Wonder Skin" && acc > 50) acc = 50;
      let stage = 0;
      if (!m.ignoreAccuracy && tA !== "Unaware") stage += r.accBoost || 0;
      if (!m.ignoreEvasion && !["Keen Eye", "Mind's Eye", "Unaware"].includes(aA)) stage -= r.evaBoost || 0;
      stage = Math.max(-6, Math.min(6, stage));
      if (stage > 0) acc = Math.trunc((acc * (3 + stage)) / 3);
      else if (stage < 0) acc = Math.trunc((acc * 3) / (3 - stage));
      if (aA === "Compound Eyes") acc *= 1.3;
      if (aA === "Hustle" && m.category === "Physical") acc *= 0.8;
      if (aA === "Victory Star") acc *= 1.1;
      if (aI === "Wide Lens") acc *= 1.1;
      if (aI === "Zoom Lens" && r.targetMoved) acc *= 1.2;
      if (tI === "Bright Powder") acc *= 0.9;
      if (tA === "Sand Veil" && r.weather === "sandstorm") acc *= 0.8;
      if (tA === "Snow Cloak" && isSnow(r.weather)) acc *= 0.8;
      if (r.gravity) acc *= 5 / 3;
      return acc >= 100 ? null : acc / 100;
    }

    /** Chance of a crit on this hit, or null when it can't crit / always crits. */
    function critChance(r) {
      const m = moves[r.move];
      if (!m || m.category === "Status" || m.damage || FIXED_DAMAGE.has(r.move) || m.willCrit || r.laser) return null;
      const aA = ability(r, "a"), tA = ability(r, "t"), aI = item(r, "a");
      if (tA === "Battle Armor" || tA === "Shell Armor" || r.luckyChant) return null;
      if (aA === "Merciless" && /^(psn|tox)$/.test(r.statusBefore)) return null;
      let stage = (m.critRatio || 1) + (r.critBoost || 0);
      if (aA === "Super Luck") stage += 1;
      if (aI === "Scope Lens" || aI === "Razor Claw") stage += 1;
      if ((aI === "Leek" || aI === "Stick") && /^(Farfetch|Sirfetch)/.test(r.aForm || "")) stage += 2;
      if (aI === "Lucky Punch" && /^Chansey/.test(r.aForm || "")) stage += 2;
      return stage >= 4 ? null : CRIT_ODDS[stage];
    }

    /** Can this hit's target visibly get this status? (types / abilities / field / Safeguard) */
    function canStatus(r, status) {
      if (r.fainted || r.sub || r.statusBefore) return false;
      const types = typesOf(r, "t");
      if (!types) return false;
      const aA = ability(r, "a"), tA = ability(r, "t"), tI = item(r, "t");
      const corrosion = aA === "Corrosion" && (status === "psn" || status === "tox");
      if (!corrosion && (TYPE_BLOCK[status] || []).some((t) => types.includes(t))) return false;
      if ((STATUS_BLOCK[status] || []).includes(tA) || tA === "Comatose" || tA === "Purifying Salt") return false;
      if (tA === "Leaf Guard" && isSun(r.weather)) return false;
      if (status === "frz" && isSun(r.weather)) return false;
      if (r.safeguard && aA !== "Infiltrator") return false;
      const grounded = r.gravity || (!types.includes("Flying") && tA !== "Levitate" && tI !== "Air Balloon");
      if (grounded && r.terrain === "mistyterrain") return false;
      if (grounded && r.terrain === "electricterrain" && status === "slp") return false;
      return true;
    }

    /** Status and flinch secondaries of a hit that can be seen: [[went the actor's way, chance], ...]. */
    function secondaries(r) {
      const out = [];
      const m = moves[r.move];
      if (!m || m.category === "Status" || r.sub) return out;
      const aA = ability(r, "a"), aI = item(r, "a"), tA = ability(r, "t"), tI = item(r, "t");
      let list = (m.secondaries || (m.secondary ? [m.secondary] : [])).slice();
      if (aA === "Sheer Force" && list.length) return out;
      if (tA === "Shield Dust" || tI === "Covert Cloak") return out;
      if (!list.some((s) => s.volatileStatus === "flinch") &&
          (aI === "King's Rock" || aI === "Razor Fang" || aA === "Stench")) list.push({ chance: 10, volatileStatus: "flinch" });
      for (const sec of list) {
        if (typeof sec.chance !== "number") continue;
        const p = Math.min(100, sec.chance * (aA === "Serene Grace" ? 2 : 1)) / 100;
        if (sec.status) {
          if (canStatus(r, sec.status)) out.push([r.status === sec.status, p, STATUS_NAMES[sec.status] || sec.status]);
        } else if (sec.volatileStatus === "flinch") {
          if (r.flinch !== null && !r.fainted && tA !== "Inner Focus") out.push([r.flinch, p, "flinch"]);
        }
      }
      return out;
    }

    /** Triple Axel / Population Bomb: accuracy rolls after the first hit (one per further hit, plus the unlogged
     * miss that ended it early). None with Skill Link / Loaded Dice (one check), or when the item is unknown. */
    function laterHits(r) {
      const m = moves[r.move];
      if (!m || !m.multiaccuracy || r.missed || knownItem(r, "a") === null || item(r, "a") === "Loaded Dice") return null;
      if (ability(r, "a") === "Skill Link") return null;
      const max = typeof m.multihit === "number" ? m.multihit : 1;
      return { ok: Math.max(0, r.hits - 1), failed: !r.cut && r.hits < max ? 1 : 0 };
    }

    /** 2-5 hit moves: chance of fewer hits minus chance of more, and that score's variance over all hit counts
        ([v, variance]; null when there is no roll to score). */
    function hitCountLuck(r) {
      const m = moves[r.move];
      if (!m || !Array.isArray(m.multihit) || r.cut || knownItem(r, "a") === null) return null;
      if (ability(r, "a") === "Skill Link") return null;
      const odds = item(r, "a") === "Loaded Dice" ? DICE_ODDS : HIT_ODDS;
      if (!(r.count in odds)) return null;
      const scoreOf = (count) => Object.entries(odds).reduce((t, [n, p]) => t + (Number(n) < count ? p : Number(n) > count ? -p : 0), 0);
      return [scoreOf(r.count), Object.entries(odds).reduce((t, [n, p]) => t + p * scoreOf(Number(n)) ** 2, 0)];
    }

    for (const r of rolls) {
      if (r.kind === "acc") {
        const p = agree(r, () => hitChance(r));
        const mv = moveName(r);
        score(r, !r.missed, p, true, mv + (r.missed ? " missed" : " hit"));
        const later = p === undefined ? undefined : agree(r, () => laterHits(r));
        if (later) {
          for (let i = 0; i < later.ok; i++) score(r, true, p, true, mv + " hit");
          if (later.failed) score(r, false, p, true, mv + " missed");
        }
      } else if (r.kind === "hit") {
        score(r, r.crit, agree(r, () => critChance(r)), true, r.crit ? "crit with " + moveName(r) : "no crits");
        for (const [good, p, what] of agree(r, () => secondaries(r)) || []) {
          score(r, good, p, true, (good ? "" : "no ") + what + " from " + moveName(r));
        }
      } else if (r.kind === "hits") {
        const [v, variance] = agree(r, () => hitCountLuck(r)) || [];
        if (typeof v === "number" && Math.abs(v) > 1e-9) scoreValue(r, v, true, `${moveName(r)} hit ${r.count} times`, variance);
      }
      else if (r.kind === "par") score(r, !r.fullPara, 3 / 4, false, r.fullPara ? "fully paralyzed" : "moved through paralysis");
      else if (r.kind === "frz") score(r, r.thawed, 1 / 5, false, r.thawed ? "thawed out" : "stayed frozen");
      else if (r.kind === "conf") score(r, !r.selfHit, 67 / 100, false, r.selfHit ? "hit itself in confusion" : "attacked through confusion");
      else if (r.kind === "slp" && !r.rest) {
        // chance to wake on this attempt: 1/3 on the 2nd, 1/2 on the 3rd (1st never, 4th always)
        score(r, r.woke, agree(r, () => (ability(r, "a") === "Early Bird" ? null
          : r.attempt === 2 ? 1 / 3 : r.attempt === 3 ? 1 / 2 : null)), false, r.woke ? "woke up early" : "stayed asleep");
      }
    }
    return { byMon, bySide, varSide, events };
  }

  /** The rolls that moved a score most: events grouped by label (sign: +1 for the player, -1 for the opponent),
      biggest total first. [{label, v, n}] */
  function topContributors(events, sign, howMany = 3) {
    const by = new Map();
    for (const e of events) {
      const s = sign(e);
      if (!s) continue;
      const label = e.prefix ? e.prefix + e.label : e.label;
      if (!by.has(label)) by.set(label, { label, v: 0, n: 0 });
      const g = by.get(label);
      g.v += s * e.v;
      g.n++;
    }
    return [...by.values()].filter((g) => Math.abs(g.v) >= 0.05)
      .sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, howMany).map((g) => ({ ...g, v: round2(g.v) }));
  }

  /**
   * A game's key moments from its scored rolls, in turn order: [{turn, actor, target, text, chance, good}].
   * Counted (rules in docs/knowledge/luck.md): a crit that KO'd, a miss of a move that hits 80%+ of the time
   * (any Hydro Pump miss), a status / flinch secondary with a 30% chance or less, full paralysis, hitting itself in
   * confusion, thawing out, waking on the 2nd sleep turn. The same Pokemon fully paralyzed on back-to-back
   * turns is one moment. Over `most`: the least likely kept, still in turn order.
   */
  function keyMoments(events, most = 10) {
    const out = [];
    for (const e of events) {
      const r = e.roll;
      // a Hydro Pump miss always counts (a league joke, user 2026-10-28)
      const pump = r && r.kind === "acc" && r.missed && r.move === "hydropump";
      if (!r || (!pump && (e.chance === null || e.chance > 0.34))) continue;
      const by = r.aForm || r.actor.slice(5), at = r.tForm || (r.target ? r.target.slice(5) : "");
      // a hit scores its crit roll ("crit with X" / "no crits") and each secondary ("burn from X" / "no burn from X")
      let text = null;
      if (r.kind === "hit" && e.label.startsWith("crit with ")) {
        const move = e.label.slice(10);
        if (r.fainted) text = `crit ${move} KO'd ${at}`;  // a crit that didn't KO made no difference (user)
      } else if (r.kind === "hit" && e.label.includes(" from ") && !e.label.startsWith("no ")) {
        const [what, mv] = e.label.split(" from ");
        text = what === "flinch" ? `${mv} made ${at} flinch` : what === "sleep" ? `${mv} put ${at} to sleep`
          : `${mv} ${STATUS_DONE[what] || "gave a " + what + " to"} ${at}`;
      } else if (r.kind === "acc" && r.missed && (pump || e.chance <= 0.2)) {
        const odds = e.chance === null ? "" : ` (${Math.round((1 - e.chance) * 100)}% to hit)`;
        text = `${e.label.replace(/ missed$/, "")} missed ${at}${odds}`;
      }
      else if (r.kind === "par" && r.fullPara) text = "fully paralyzed";
      else if (r.kind === "conf" && r.selfHit) text = "hit itself in confusion";
      else if (r.kind === "frz" && r.thawed) text = "thawed out";
      else if (r.kind === "slp" && r.woke) text = "woke up after one turn";
      if (!text) continue;
      const prev = out[out.length - 1];
      if (text === "fully paralyzed" && prev && prev.actor === r.actor && prev.text.startsWith("fully paralyzed") &&
          prev.lastTurn === r.turn - 1) {
        prev.times += 1;
        prev.lastTurn = r.turn;
        prev.text = `fully paralyzed ${prev.times} turns in a row`;
        prev.chance *= e.chance;
        continue;
      }
      out.push({ turn: r.turn, lastTurn: r.turn, times: 1, actor: r.actor, form: by, target: r.target || "",
        text, chance: e.chance, good: e.v > 0 });
    }
    const kept = out.length <= most ? out : [...out].sort((a, b) => a.chance - b.chance).slice(0, most);
    return out.filter((m) => kept.includes(m)).map(({ lastTurn, times, ...m }) => m);
  }

  const round2 = (x) => Math.round(x * 100) / 100;
  const round4 = (x) => Math.round(x * 10000) / 10000;

  /**
   * Fill luck / luck_against / player_luck on game rows (parser.js gameRows, after team sheets set row.set).
   * data: {moves, dex}. Without move data the columns stay blank.
   */
  function addLuck(rows, data) {
    const games = new Map();
    for (const r of rows) {
      if (!games.has(r.replay_id)) games.set(r.replay_id, []);
      games.get(r.replay_id).push(r);
    }
    for (const group of games.values()) {
      const rolls = group[0].rolls;
      if (!data || !data.moves || !rolls) {
        for (const r of group) r.luck = r.luck_against = r.player_luck = r.luck_var = r.player_luck_var = "";
        continue;
      }
      const sets = new Map(group.filter((r) => r.mon_key && r.set).map((r) => [r.mon_key, r.set]));
      const { byMon, bySide, varSide, events } = scoreGame(rolls, data, sets);
      const moments = keyMoments(events);  // the game's, shared by its rows (not exported)
      const sideOf = new Map(group.filter((r) => r.mon_key).map((r) => [r.player, r.mon_key.slice(0, 2)]));
      const sideEv = (side) => events.map((e) => ({ ...e,
        prefix: (e.actor.slice(0, 2) === side ? "" : "their ") + (e.form || e.actor.slice(5)) + ": " }));
      for (const r of group) {
        const m = (r.mon_key && byMon.get(r.mon_key)) || { luck: 0, against: 0, luckVar: 0 };
        r.luck = r.brought ? round2(m.luck) : "";
        r.luck_against = r.brought ? round2(m.against) : "";
        r.luck_var = r.brought ? round4(m.luckVar) : "";
        const side = sideOf.get(r.player) || (sideOf.get(r.opponent) === "p1" ? "p2" : "p1");
        r.player_luck = round2(bySide[side] - bySide[side === "p1" ? "p2" : "p1"]);
        r.player_luck_var = round4(varSide.p1 + varSide.p2);
        // not exported: what the hover lists
        r.luck_top = r.mon_key ? topContributors(events, (e) => (e.actor === r.mon_key ? 1 : 0)) : [];
        r.player_luck_top = topContributors(sideEv(side), (e) => (e.actor.slice(0, 2) === side ? 1 : -1));
        r.key_moments = moments;
      }
    }
    return rows;
  }

  // parser.js's fetch with a time limit and "site is down" errors (parser.js loads first on every page)
  const fetchChecked = (url, fetchFn) => (root.ReplayStats || require("./parser.js")).fetchChecked(url, fetchFn);
  const cache = {};
  /** Fetch a Showdown data file once per page visit (a failure allows a retry on the next run). */
  function load(url, fetchFn = root.fetch) {
    if (!cache[url]) {
      cache[url] = fetchChecked(url, fetchFn).then((r) => {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      });
      cache[url].catch(() => { delete cache[url]; });
    }
    return cache[url];
  }
  const loadMoves = (fetchFn) => load(MOVES_URL, fetchFn);

  const api = { MOVES_URL, DEX_URL, scoreGame, topContributors, keyMoments, addLuck, loadMoves };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Luck = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
