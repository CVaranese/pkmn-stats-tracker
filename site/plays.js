/* Reads and misplays: choices in a game the log alone shows were good or bad, by turn, for each player. No engine, no
 * damage calc: only what the log says happened (docs/knowledge/plays.md has the rules and what they miss).
 *   good: a switch in on a hit that does nothing or is resisted; an attack that hits the Pokémon switching in super
 *         effectively when it wouldn't have hit the one leaving that hard (a predicted switch; needs move and Pokédex data)
 *   bad:  a switch in on a super-effective hit; an attack or status move into a Pokémon already on the field that it
 *         can't affect (types, or an ability already seen); a move that fails (Sucker Punch into a status move, a second
 *         Protect in a row, Fake Out after the first turn, status on something already statused)
 *   brilliant: an unexpected or narrow play whose payoff the log shows: Destiny Bond takes the attacker down; Counter /
 *         Mirror Coat / Metal Burst KOs; Pursuit KOs the Pokémon switching out; Encore locks a status move (or one that
 *         failed) and the foe switches or uses it again; Taunt stops a status move; Haze / Clear Smog / a phazing move
 *         takes away +2 or more; Trick / Switcheroo puts a Choice item on a foe whose next action is a status move or a
 *         switch; a foe faints to Perish Song; a Pokémon that lived on Focus Sash / Sturdy KOs a foe before it goes down
 * No DOM. Exposes window.Plays (browser) or module.exports (Node).
 */
(function (root) {
  "use strict";
  const toID = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // attacking type: [super effective against, not very effective against, no effect on]
  const CHART = {
    Normal: [[], ["Rock", "Steel"], ["Ghost"]],
    Fire: [["Grass", "Ice", "Bug", "Steel"], ["Fire", "Water", "Rock", "Dragon"], []],
    Water: [["Fire", "Ground", "Rock"], ["Water", "Grass", "Dragon"], []],
    Electric: [["Water", "Flying"], ["Electric", "Grass", "Dragon"], ["Ground"]],
    Grass: [["Water", "Ground", "Rock"], ["Fire", "Grass", "Poison", "Flying", "Bug", "Dragon", "Steel"], []],
    Ice: [["Grass", "Ground", "Flying", "Dragon"], ["Fire", "Water", "Ice", "Steel"], []],
    Fighting: [["Normal", "Ice", "Rock", "Dark", "Steel"], ["Poison", "Flying", "Psychic", "Bug", "Fairy"], ["Ghost"]],
    Poison: [["Grass", "Fairy"], ["Poison", "Ground", "Rock", "Ghost"], ["Steel"]],
    Ground: [["Fire", "Electric", "Poison", "Rock", "Steel"], ["Grass", "Bug"], ["Flying"]],
    Flying: [["Grass", "Fighting", "Bug"], ["Electric", "Rock", "Steel"], []],
    Psychic: [["Fighting", "Poison"], ["Psychic", "Steel"], ["Dark"]],
    Bug: [["Grass", "Psychic", "Dark"], ["Fire", "Fighting", "Poison", "Flying", "Ghost", "Steel", "Fairy"], []],
    Rock: [["Fire", "Ice", "Flying", "Bug"], ["Fighting", "Ground", "Steel"], []],
    Ghost: [["Psychic", "Ghost"], ["Dark"], ["Normal"]],
    Dragon: [["Dragon"], ["Steel"], ["Fairy"]],
    Dark: [["Psychic", "Ghost"], ["Fighting", "Dark", "Fairy"], []],
    Steel: [["Ice", "Rock", "Fairy"], ["Fire", "Water", "Electric", "Steel"], []],
    Fairy: [["Fighting", "Dragon", "Dark"], ["Fire", "Poison", "Steel"], []],
  };
  /** What an attack of `type` does to a Pokémon of `types` (types only, no abilities): 0, 0.25 ... 4. */
  function effect(type, types, move = "") {
    const [se, nve, none] = CHART[type] || [[], [], []];
    let m = 1;
    for (const t of types) {
      if (move === "freezedry" && t === "Water") m *= 2;
      else m *= none.includes(t) ? 0 : se.includes(t) ? 2 : nve.includes(t) ? 0.5 : 1;
    }
    return m;
  }
  // a -fail that isn't the mover's mistake: a stat drop blocked by the target's ability (Clear Body against Parting Shot)
  const NOT_MISTAKE = new Set(["unboost"]);
  const COUNTERS = new Set(["counter", "mirrorcoat", "metalburst", "comeuppance"]);
  const PHAZE = new Set(["roar", "whirlwind", "dragontail", "circlethrow"]);
  const TRICK = new Set(["trick", "switcheroo"]);
  /** Boosts for a brilliant Haze or phaze: the raised stats' stages added up (+2 or more counts). */
  const raised = (b) => Object.values(b || {}).reduce((a, v) => a + Math.max(0, v), 0);

  /** The game's reads and misplays: { events: [{ turn, side ("p1" / "p2"), good, brilliant, kind, mon, text }], p1 / p2:
      { name, good, bad, brilliant } } (a brilliant play is good: true and counted in brilliant, not good). log: the
      replay's log; data: { moves, dex } (Showdown's), optional: without it, no predicted switches, and Encore / Trick
      count only a locked move that had failed / a switch (status moves need the move data). */
  function analyze(log, data = null) {
    const out = { events: [], p1: { name: "", good: 0, bad: 0, brilliant: 0 }, p2: { name: "", good: 0, bad: 0, brilliant: 0 } };
    const active = {};          // position (p1a) -> { species, nick }
    const left = {};            // position -> the species that switched out this turn, for a predicted switch
    let switchedIn = new Set(); // positions whose Pokémon switched in this turn (by choice: not a lead or a replacement)
    const encored = new Set();  // positions under Encore: their move isn't a choice
    let turn = 0, inTurn = false, ctx = null;
    const seen = {};            // "p1: Nick" -> abilities shown so far
    const pos = (ident) => (/^(p[12][a-d]?)/.exec(ident || "") || [])[1] || "";
    const sideOf = (ident) => pos(ident).slice(0, 2);
    const monId = (ident) => sideOf(ident) + ": " + String(ident).replace(/^p[12][a-d]?: /, "");
    const speciesAt = (ident) => (active[pos(ident)] || {}).species || String(ident).replace(/^p[12][a-d]?: /, "");
    const add = (side, good, kind, mon, text) => {
      out.events.push({ turn, side, good, kind, mon, text });
      out[side][good ? "good" : "bad"]++;
    };
    const brilliant = (side, kind, mon, text) => {
      out.events.push({ turn, side, good: true, brilliant: true, kind, mon, text });
      out[side].brilliant++;
    };
    const isStatus = (move) => { const m = data && data.moves && data.moves[toID(move)]; return !!m && m.category === "Status"; };
    // brilliant plays waiting on their payoff, by the position of the foe they act on (the survivor's, for a Sash)
    const boosts = {};          // position -> { atk: 2, ... } as the log shows them
    const last = {};            // position -> { move, failed }: the move an Encore would lock
    const encore = {}, taunt = {}, trick = {}, pursued = {}, perish = {}, hung = {};
    const hit = {};             // position -> true once the current move's own damage took it to 0 (not sand, poison...)
    let bond = null;            // a Destiny Bond that went off: { side, mon }, until the attacker's faint
    const show = (ident, ability) => (seen[monId(ident)] = seen[monId(ident)] || new Set()).add(toID(ability));
    const typesOf = (species) => {
      const d = data && data.dex && (data.dex[toID(species)] || null);
      return d ? d.types : null;
    };
    for (const line of String(log || "").split("\n")) {
      const p = line.split("|");
      const cmd = p[1];
      const tags = p.slice(2).filter((x) => x.startsWith("["));
      // abilities shown: [from] ability: X [of] mon, or -ability
      const fromAb = /^\[from\] ability: (.+)$/.exec(tags.find((t) => t.startsWith("[from] ability:")) || "");
      if (cmd === "-ability") show(p[2], p[3]);
      brilliantLine(cmd, p, tags);
      if (cmd === "player" && out[p[2]] && p[3]) out[p[2]].name = p[3];  // p3 / p4 (free-for-all) have no counts
      else if (cmd === "turn") { turn = Number(p[2]); inTurn = true; switchedIn = new Set(); ctx = null; }
      else if (cmd === "upkeep") { inTurn = false; ctx = null; }
      else if (cmd === "switch" || cmd === "drag" || cmd === "replace") {
        const at = pos(p[2]);
        if (cmd === "switch" && inTurn) { switchedIn.add(at); left[at] = (active[at] || {}).species || ""; }
        if (cmd !== "replace") encored.delete(at);
        active[at] = { species: p[3].split(",")[0], nick: p[2] };
        if (cmd === "switch") ctx = null;
      } else if ((cmd === "-start" || cmd === "-end") && /encore$/i.test(p[3] || "")) {
        if (cmd === "-start") encored.add(pos(p[2])); else encored.delete(pos(p[2]));
      } else if (cmd === "move") {
        // a move the player didn't pick this turn (locked into Outrage, called by another move, Encore) or with no target
        const chosen = !tags.some((t) => t.startsWith("[from]") || t === "[notarget]") && !encored.has(pos(p[2]));
        ctx = { side: sideOf(p[2]), at: pos(p[2]), mon: speciesAt(p[2]), move: p[3], target: pos(p[4]), chosen, done: false };
      } else if (ctx && !ctx.done && ctx.chosen && inTurn) {
        const target = pos(p[2]);
        const foe = target && sideOf(p[2]) !== ctx.side;
        const switched = switchedIn.has(target);
        if (cmd === "-immune" && foe) {
          ctx.done = true;
          const by = fromAb ? toID(fromAb[1]) : "";
          if (switched) add(sideOf(p[2]), true, "switch-immune", speciesAt(p[2]), `${speciesAt(p[2])} switched in on ${ctx.mon}'s ${ctx.move}: no effect`);
          // an ability immunity counts only once that ability has been seen (Levitate is nearly always known)
          else if (!by || by === "levitate" || (seen[monId(p[2])] && seen[monId(p[2])].has(by)))
            add(ctx.side, false, "immune", ctx.mon, `${ctx.mon}'s ${ctx.move} into ${speciesAt(p[2])}: no effect`);
        } else if (cmd === "-resisted" && foe && switched) {
          ctx.done = true;
          add(sideOf(p[2]), true, "switch-resisted", speciesAt(p[2]), `${speciesAt(p[2])} switched in on ${ctx.mon}'s ${ctx.move}: resisted`);
        } else if (cmd === "-supereffective" && foe && switched) {
          ctx.done = true;
          add(sideOf(p[2]), false, "switch-weak", speciesAt(p[2]), `${speciesAt(p[2])} switched in on ${ctx.mon}'s ${ctx.move}: super effective`);
          // the attacker saw it coming if the move wouldn't have hit the one that left as hard
          const mv = data && data.moves && data.moves[toID(ctx.move)];
          const was = typesOf(left[target]);
          if (mv && was && effect(mv.type, was, toID(ctx.move)) <= 1)
            add(ctx.side, true, "predicted", ctx.mon, `${ctx.mon}'s ${ctx.move} hit ${speciesAt(p[2])} switching in super effectively (${left[target]} wouldn't have been hit as hard)`);
        } else if (cmd === "-fail" && !NOT_MISTAKE.has(p[3]) && !switchedIn.has(ctx.target)) {
          ctx.done = true;
          add(ctx.side, false, "fail", ctx.mon, `${ctx.mon}'s ${ctx.move} failed`);
        }
      }
      // an ability shown in passing ([from] ability: X [of] mon, -activate ability: X) is known from here on
      const of = tags.find((t) => t.startsWith("[of] "));
      if (fromAb && p[2]) show(of ? of.slice(5) : p[2], fromAb[1]);
      if (cmd === "-activate" && /^ability: /.test(p[3] || "")) show(p[2], p[3].slice(9));
    }
    return out;

    /** One log line's part in a brilliant play: the play (kept until its payoff) or the payoff. Runs before the line
        changes who is on the field, so a drag or a switch still sees the Pokémon that leaves. */
    function brilliantLine(cmd, p, tags) {
      const at = pos(p[2]);
      const onFoe = !!(ctx && at && sideOf(p[2]) !== ctx.side);  // the line is about a foe of the current move's user
      const mv = ctx ? toID(ctx.move) : "";
      const gone = (q) => { for (const w of [encore, trick, taunt, pursued, perish, hung, last, hit]) delete w[q]; };
      if (cmd === "move") {
        const e = encore[at], t = trick[at];
        if (e) {
          delete encore[at];
          if (toID(p[3]) === toID(e.move)) brilliant(e.side, "encore", e.mon, `${e.mon}'s Encore locked ${speciesAt(p[2])} into ${e.move}, and it used it again`);
        }
        if (t && !tags.some((x) => x.startsWith("[from]"))) {
          delete trick[at];
          if (isStatus(p[3])) brilliant(t.side, "trick", t.mon, `${t.mon}'s ${t.move} gave ${speciesAt(p[2])} ${t.item}, and it then used ${p[3]}`);
        }
        last[at] = { move: p[3], failed: false };
        // Perish Song starts a count on each Pokémon on the field that hasn't one yet: whose song it is goes with it
        if (toID(p[3]) === "perishsong")
          for (const q of Object.keys(active)) if (!perish[q]) perish[q] = { side: sideOf(p[2]), mon: speciesAt(p[2]), due: false };
        for (const q of Object.keys(hit)) delete hit[q];
      } else if (cmd === "-fail" && ctx && at === ctx.at && last[at]) {
        last[at].failed = true;
      } else if (cmd === "switch" || cmd === "drag") {
        const e = encore[at], t = trick[at], leaving = speciesAt(p[2]);
        if (cmd === "switch" && inTurn) {
          if (e) brilliant(e.side, "encore", e.mon, `${e.mon}'s Encore locked ${leaving} into ${e.move}, and it switched out`);
          if (t) brilliant(t.side, "trick", t.mon, `${t.mon}'s ${t.move} gave ${leaving} ${t.item}, and it then switched out`);
        }
        if (cmd === "drag" && onFoe && PHAZE.has(mv) && raised(boosts[at]) >= 2)
          brilliant(ctx.side, "phaze", ctx.mon, `${ctx.mon}'s ${ctx.move} forced out ${leaving} at +${raised(boosts[at])}`);
        // Baton Pass hands its boosts on; any other way in starts from none
        if (!(cmd === "switch" && ctx && mv === "batonpass" && ctx.at === at)) delete boosts[at];
        gone(at);
      } else if (cmd === "-boost" || cmd === "-unboost") {
        const b = (boosts[at] = boosts[at] || {});
        b[p[3]] = Math.max(-6, Math.min(6, (b[p[3]] || 0) + (cmd === "-boost" ? 1 : -1) * Number(p[4] || 0)));
      } else if (cmd === "-setboost") {
        (boosts[at] = boosts[at] || {})[p[3]] = Number(p[4] || 0);
      } else if (cmd === "-clearallboost") {
        if (ctx) for (const q of Object.keys(boosts))
          if (q.slice(0, 2) !== ctx.side && raised(boosts[q]) >= 2)
            brilliant(ctx.side, "haze", ctx.mon, `${ctx.mon}'s ${ctx.move} wiped ${speciesAt(q)}'s +${raised(boosts[q])}`);
        for (const q of Object.keys(boosts)) delete boosts[q];
      } else if (cmd === "-clearboost" || cmd === "-clearpositiveboost") {
        if (onFoe && raised(boosts[at]) >= 2) brilliant(ctx.side, "haze", ctx.mon, `${ctx.mon}'s ${ctx.move} wiped ${speciesAt(p[2])}'s +${raised(boosts[at])}`);
        if (cmd === "-clearboost") delete boosts[at];
        else for (const k in boosts[at] || {}) boosts[at][k] = Math.min(0, boosts[at][k]);
      } else if (cmd === "-clearnegativeboost") {
        for (const k in boosts[at] || {}) boosts[at][k] = Math.max(0, boosts[at][k]);
      } else if (cmd === "-copyboost" && p[3]) {
        boosts[at] = Object.assign({}, boosts[pos(p[3])]);
      } else if (cmd === "-start" && onFoe && /encore$/i.test(p[3] || "")) {
        const l = last[at];
        if (l && (l.failed || isStatus(l.move))) encore[at] = { side: ctx.side, mon: ctx.mon, move: l.move };
      } else if (cmd === "-end" && /encore$/i.test(p[3] || "")) {
        delete encore[at];
      } else if (cmd === "-start" && onFoe && p[3] === "move: Taunt") {
        taunt[at] = { side: ctx.side, mon: ctx.mon };
      } else if (cmd === "-end" && p[3] === "move: Taunt") {
        delete taunt[at];
      } else if (cmd === "cant" && p[3] === "move: Taunt" && taunt[at]) {
        const t = taunt[at];
        delete taunt[at];  // one call per Taunt
        brilliant(t.side, "taunt", t.mon, `${t.mon}'s Taunt stopped ${speciesAt(p[2])}'s ${p[4] || "status move"}`);
      } else if (cmd === "-item" && onFoe && TRICK.has(mv) && /^Choice /.test(p[3] || "") && tags.some((x) => /^\[from\] move: (Trick|Switcheroo)$/.test(x))) {
        trick[at] = { side: ctx.side, mon: ctx.mon, move: ctx.move, item: p[3] };
      } else if (cmd === "-activate" && p[3] === "move: Pursuit") {
        pursued[at] = true;
      } else if (cmd === "-activate" && p[3] === "move: Destiny Bond") {
        bond = { side: sideOf(p[2]), mon: speciesAt(p[2]) };
      } else if (cmd === "-start" && p[3] === "perish0") {
        if (perish[at]) perish[at].due = true;
      } else if (cmd === "-damage" && onFoe && /^0 fnt/.test(p[3] || "") && !tags.some((x) => x.startsWith("[from]"))) {
        hit[at] = true;
      } else if (!tags.some((x) => x.startsWith("[from]")) &&  // not a Sash knocked off, not Sturdy copied by Trace
                 ((cmd === "-enditem" && p[3] === "Focus Sash") || (cmd === "-end" && p[3] === "item: Focus Sash") ||
                  (cmd === "-activate" && p[3] === "ability: Sturdy") || (cmd === "-ability" && p[3] === "Sturdy"))) {
        hung[at] = { side: sideOf(p[2]), mon: speciesAt(p[2]), by: p[3].replace(/^(item|ability): /, "") };
      } else if (cmd === "faint") {
        const foe = speciesAt(p[2]), side = sideOf(p[2]);
        if (bond && bond.side !== side) { brilliant(bond.side, "destinybond", bond.mon, `${bond.mon}'s Destiny Bond took ${foe} down with it`); bond = null; }
        const ps = perish[at];
        if (ps && ps.due && ps.side !== side) brilliant(ps.side, "perishsong", ps.mon, `${foe} fainted to ${ps.mon}'s Perish Song`);
        if (onFoe && hit[at]) {  // KO'd by the move itself
          if (COUNTERS.has(mv)) brilliant(ctx.side, "counter", ctx.mon, `${ctx.mon}'s ${ctx.move} KO'd ${foe}`);
          if (mv === "pursuit" && pursued[at]) brilliant(ctx.side, "pursuit", ctx.mon, `${ctx.mon}'s Pursuit KO'd ${foe} as it switched out`);
          const h = hung[ctx.at];
          if (h && h.side === ctx.side) {
            delete hung[ctx.at];  // one call per survival
            brilliant(ctx.side, "survived", h.mon, `${h.mon} lived on its ${h.by}, then KO'd ${foe}`);
          }
        }
        gone(at);
        delete boosts[at];
      }
    }
  }

  const Plays = { CHART, effect, analyze };
  if (typeof module !== "undefined" && module.exports) module.exports = Plays;
  else root.Plays = Plays;
})(typeof globalThis !== "undefined" ? globalThis : this);
