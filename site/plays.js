/* Reads and misplays: choices in a game the log alone shows were good or bad, by turn, for each player. No engine, no
 * damage calc: only what the log says happened (docs/knowledge/plays.md has the rules and what they miss).
 *   good: a switch in on a hit that does nothing or is resisted; an attack that hits the Pokémon switching in super
 *         effectively when it wouldn't have hit the one leaving that hard (a predicted switch; needs move and Pokédex data)
 *   bad:  a switch in on a super-effective hit; an attack or status move into a Pokémon already on the field that it
 *         can't affect (types, or an ability already seen); a move that fails (Sucker Punch into a status move, a second
 *         Protect in a row, Fake Out after the first turn, status on something already statused)
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

  /** The game's reads and misplays: { events: [{ turn, side ("p1" / "p2"), good, kind, mon, text }], p1 / p2: { name,
      good, bad } }. log: the replay's log; data: { moves, dex } (Showdown's), optional: without it, no predicted switches. */
  function analyze(log, data = null) {
    const out = { events: [], p1: { name: "", good: 0, bad: 0 }, p2: { name: "", good: 0, bad: 0 } };
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
      if (cmd === "player" && p[2] && p[3]) out[p[2]].name = p[3];
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
        ctx = { side: sideOf(p[2]), mon: speciesAt(p[2]), move: p[3], target: pos(p[4]), chosen, done: false };
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
  }

  const Plays = { CHART, effect, analyze };
  if (typeof module !== "undefined" && module.exports) module.exports = Plays;
  else root.Plays = Plays;
})(typeof globalThis !== "undefined" ? globalThis : this);
