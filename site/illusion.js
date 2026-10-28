/* Hidden Zoroark: which stays on the field could have been a Zoroark that never dropped its disguise.
 * Works on parser.js's battle.illusion (one side's stints) with learnsets (tools/learnsets.py) and the
 * Pokedex (abilities). No DOM. Exposes window.Illusion (browser) or module.exports (Node).
 *
 * A stint can't be Zoroark when a move hit it (that breaks Illusion; a hit on a Substitute doesn't).
 * For the others every split "Zoroark / the Pokemon shown" is tried, and a split must add up:
 *   - each Pokemon (Zoroark too) first comes in at 100% with no status;
 *   - it comes back with the HP and status it left with (more HP only with Regenerator, status gone
 *     only with Natural Cure or a Heal Bell / Aromatherapy in between); a fainted one never comes back
 *     (unless its side used Revival Blessing);
 *   - it is never on the field twice at once (doubles);
 *   - it only uses moves it can learn (any generation), at most 4 different ones.
 * A stint that is Zoroark in every split that adds up is proven ("zoroark"), one that is Zoroark in
 * none can't be ("not"), the rest "maybe". With no split that adds up (odd log, data gap), only the
 * move check on each stint on its own is used.
 */
(function (root) {
  "use strict";

  const toID = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const MAX_TRIED = 16;                 // stints tried both ways at most (2^16 splits)
  const FREE_MOVES = new Set(["struggle"]);
  const COPY_MOVES = new Set(["transform", "mimic", "sketch"]); // can use more than 4 moves

  let learnsetsPromise = null;
  /** {species id: Set of move ids | "*"}, loaded once. */
  function loadLearnsets(url = "data/learnsets.json", fetchFn = root.fetch) {
    return learnsetsPromise || (learnsetsPromise = fetchFn(url).then((r) => {
      if (!r.ok) throw new Error("learnsets HTTP " + r.status);
      return r.json();
    }).then(parseLearnsets).catch((e) => { learnsetsPromise = null; throw e; }));
  }
  function parseLearnsets(raw) {
    const out = {};
    for (const [id, moves] of Object.entries(raw)) out[id] = moves === "*" ? "*" : new Set(moves.split(" "));
    return out;
  }

  /** Can this species learn this move? null when the data doesn't say (species or move unknown). */
  function canLearn(learn, species, move, known) {
    const ls = learn[toID(species)] || learn[toID(String(species).split("-")[0])];
    const id = toID(move);
    if (!ls || !known.has(id)) return null;
    return ls === "*" || ls.has(id);
  }

  function abilitiesOf(dex, species) {
    const d = dex && (dex[toID(species)] || dex[toID(String(species).split("-")[0])]);
    return d && d.abilities ? Object.values(d.abilities) : null;
  }

  const fmt = (hp, status) => `${Math.round(hp)}%${status ? " " + status : ""}`;

  /**
   * One side: {zoroark, stints: [{n, verdict: "zoroark" | "not" | "maybe" | "shown", why}], proven: [n],
   * splits} ("shown": Zoroark showed itself in this stint). learn from loadLearnsets, dex from TS.loadDex
   * (both may be null: then fewer checks).
   */
  function analyze(info, learn, dex) {
    learn = learn || {};
    const known = new Set();            // move ids some Pokemon learns (Z-moves, Max moves... aren't checked)
    for (const ls of Object.values(learn)) if (ls !== "*") for (const m of ls) known.add(m);
    const stints = info.stints;
    const zoro = info.zoroark;
    const out = stints.map((s) => ({ n: s.n, shown: s.shown, turnIn: s.turnIn, turnOut: s.turnOut, moves: s.moves,
      verdict: s.zoroark ? "shown" : "maybe", why: "" }));
    const byN = new Map(out.map((o) => [o.n, o]));

    // moves each stint can't have used as the Pokemon shown / as Zoroark
    const badShown = new Map(), badZoro = new Map();
    for (const s of stints) {
      if (s.zoroark) continue;
      badShown.set(s.n, s.moves.filter((m) => !FREE_MOVES.has(toID(m)) && canLearn(learn, s.shown, m, known) === false));
      badZoro.set(s.n, s.moves.filter((m) => !FREE_MOVES.has(toID(m)) && canLearn(learn, zoro, m, known) === false));
    }
    const tried = [];
    for (const s of stints) {
      if (s.zoroark) continue;
      const o = byN.get(s.n);
      if (s.attacked) { o.verdict = "not"; o.why = "a move hit it and no disguise broke"; }
      else if (badZoro.get(s.n).length) { o.verdict = "not"; o.why = `${zoro} can't learn ${badZoro.get(s.n).join(", ")}`; }
      else tried.push(s);
    }

    const regen = (sp) => (abilitiesOf(dex, sp) || []).includes("Regenerator");
    const natCure = (sp) => (abilitiesOf(dex, sp) || []).includes("Natural Cure");
    /** Why this run of stints (one Pokemon, in order) can't be one Pokemon, or "" when it can. */
    function chainProblem(run, species, who) {
      const moves = new Set();
      for (let i = 0; i < run.length; i++) {
        const b = run[i];
        for (const m of b.moves) if (!FREE_MOVES.has(toID(m))) moves.add(toID(m));
        if (i === 0) {
          if (b.hpIn < 100 || b.statusIn) return `${who} first came in at ${fmt(b.hpIn, b.statusIn)}`;
          continue;
        }
        const a = run[i - 1];
        if (a.lineOut === null || b.lineIn < a.lineOut) return `${who} would be on the field twice at once`;
        if (a.hpOut === 0 && !info.revived) return `${who} fainted on turn ${a.turnOut} but came back`;
        if (a.hpOut === 0) continue;
        const hpOk = b.hpIn === a.hpOut || (b.hpIn > a.hpOut && b.hpIn <= a.hpOut + 34 && regen(species));
        const cured = !b.statusIn && a.statusOut && (natCure(species) || info.cures.some((l) => l > a.lineOut && l < b.lineIn));
        if (!hpOk || (b.statusIn !== a.statusOut && !cured)) {
          return `${who} left on turn ${a.turnOut} at ${fmt(a.hpOut, a.statusOut)} but came back at ${fmt(b.hpIn, b.statusIn)}`;
        }
      }
      if (moves.size > 4 && ![...moves].some((m) => COPY_MOVES.has(m))) return `${who} would have used ${moves.size} different moves`;
      return "";
    }
    /** "" when this split (set of stint numbers that were Zoroark) adds up, else why not. */
    function splitProblem(z) {
      const runs = new Map();
      for (const s of stints) {
        const owner = s.zoroark || z.has(s.n) ? "\u0000zoroark" : s.key;
        if (!s.zoroark && !z.has(s.n) && badShown.get(s.n).length) return `${s.shown} can't learn ${badShown.get(s.n).join(", ")}`;
        if (!runs.has(owner)) runs.set(owner, []);
        runs.get(owner).push(s);
      }
      for (const [owner, run] of runs) {
        const zr = owner === "\u0000zoroark";
        const p = chainProblem(run, zr ? zoro : run[0].shown, zr ? zoro : run[0].shown);
        if (p) return p;
      }
      return "";
    }

    let splits = 0;
    if (tried.length <= MAX_TRIED) {
      const inAll = new Set(tried.map((s) => s.n)), inSome = new Set();
      let example = null;               // one split that adds up
      for (let mask = 0; mask < 1 << tried.length; mask++) {
        const z = new Set(tried.filter((s, i) => mask & (1 << i)).map((s) => s.n));
        if (splitProblem(z)) continue;
        splits += 1;
        example = example || z;
        for (const s of tried) { if (z.has(s.n)) inSome.add(s.n); else inAll.delete(s.n); }
      }
      if (splits) {
        for (const s of tried) {
          const o = byN.get(s.n);
          if (inAll.has(s.n)) {
            o.verdict = "zoroark";
            const without = new Set([...example].filter((n) => n !== s.n));
            o.why = badShown.get(s.n).length ? `${s.shown} can't learn ${badShown.get(s.n).join(", ")}` : `if it wasn't Zoroark, ${splitProblem(without)}`;
          } else if (!inSome.has(s.n)) {
            o.verdict = "not";
            o.why = "HP, status or moves don't add up if this was Zoroark";
          }
        }
      }
    }
    if (!splits) {
      // nothing adds up as a whole: just the moves each stint used
      for (const s of tried) {
        if (badShown.get(s.n).length) Object.assign(byN.get(s.n), { verdict: "zoroark", why: `${s.shown} can't learn ${badShown.get(s.n).join(", ")}` });
      }
    }
    return { zoroark: zoro, stints: out, proven: out.filter((o) => o.verdict === "zoroark").map((o) => o.n), splits };
  }

  const api = { loadLearnsets, parseLearnsets, canLearn, analyze };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.Illusion = api;
})(typeof window !== "undefined" ? window : globalThis);
