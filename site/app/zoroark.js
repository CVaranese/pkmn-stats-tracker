/* Hidden Zoroark (illusion.js): which stays count as Zoroark, the notice and the admin's Move buttons. */
"use strict";

// which stays on the field were Zoroark: the league admin's picks in the game library (index.json "illusion",
// written by tools/set_illusion.py), else the ones illusion.js proves. The admin tries picks out on the local
// site (served from this computer: Move to / Move back buttons, kept in this browser) before rolling them out.
const ADMIN = ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname);
const PICKS_KEY = "rs-illusion";
function savedPicks() {
  try { return JSON.parse(localStorage.getItem(PICKS_KEY)) || {}; } catch (e) { return {}; }
}
function savePicks(id, side, ns) {
  const all = savedPicks();
  if (ns === null) { if (all[id]) delete all[id][side]; } else all[id] = { ...(all[id] || {}), [side]: ns };
  try { localStorage.setItem(PICKS_KEY, JSON.stringify(all)); } catch (e) { /* private window: this page view only */ }
}
/** Sets replay.illusion (what gameRows counts as Zoroark) and replay.zoroarks (for the notice). */
async function prepareIllusion(replay) {
  if (!replay || replay.zoroarks) return;
  const b = RS.parseBattle(replay.log);
  replay.zoroarks = {};
  delete replay.illusionNote;
  if (!Illusion.hiddenSides(b).length) return;
  let learn = null, dex = null;
  try { [learn, dex] = await Promise.all([Illusion.loadLearnsets(), TS.loadDex()]); } catch (e) {
    replay.illusionNote = `the move / Pokédex data for the hidden Zoroark check didn't load (${e.message || e}), so fewer stays are ruled out`;
  }
  const lib = (library.find((g) => g.id === replay.id) || {}).illusion || {};
  const mine = ADMIN ? savedPicks()[replay.id] || {} : {};
  const { illusion, analyses } = Illusion.picks(b, { ...lib, ...mine }, learn, dex);
  replay.illusion = illusion;
  for (const [side, a] of Object.entries(analyses)) {
    const from = side in mine ? "you" : side in lib ? "library" : "proven";
    replay.zoroarks[side] = { ...a, player: b.players[side] || side, from };
  }
}
/** Change one side's picks and count the game again. */
function pickZoroark(replay, side, ns) {
  savePicks(replay.id, side, ns);
  delete replay.zoroarks;
  invalidateLeague();
  run(true);
}
const turnSpan = (s) => {
  const a = Math.max(1, s.turnIn), b = Math.max(1, s.turnOut);
  return a === b ? `Turn ${a}` : `Turns ${a}–${b}`;
};
/** The notice under the links: one item per side whose Zoroark never showed itself. */
function renderZoroarks(replays) {
  const items = [];
  for (const replay of replays) {
    for (const [side, z] of Object.entries((replay && replay.zoroarks) || {})) {
      const picked = new Set(replay.illusion[side] || []);
      const li = el("li");
      const moved = z.stints.filter((s) => picked.has(s.n));
      li.append(el("span", "", `${replay.id}: ${z.player} had a ${z.zoroark} that never dropped its disguise. ` + (moved.length
        ? `Counted as ${z.zoroark}: ${moved.map((s) => `${turnSpan(s).toLowerCase()} (shown as ${s.shown})`).join(", ")}.`
        : `Nothing shows it came in, so whatever it did is counted on the Pokémon it copied.`)));
      if (z.from === "you") {
        li.append(el("span", "", " Trying out a pick on this computer only. To roll it out: "),
          el("code", "", `python -I tools/set_illusion.py ${replay.id} ${side} ${[...picked].join(",") || "none"}`));
      } else if (z.from === "library") li.append(el("span", "", " Set by the league admin."));
      const open = z.stints.filter((s) => s.verdict === "zoroark" || s.verdict === "maybe" || picked.has(s.n));
      const not = z.stints.filter((s) => s.verdict === "not" && !picked.has(s.n));
      const box = el("details", "zoro-pick");
      box.open = replays.filter(Boolean).length === 1; // open for one game, closed in a list of many
      box.append(el("summary", "", `Stays that could have been ${z.zoroark} (${open.length})`));
      const list = el("ul");
      for (const s of open) {
        const row = el("li");
        const on = picked.has(s.n);
        const what = `${turnSpan(s)}, shown as ${s.shown}` + (s.moves.length ? ` (${s.moves.join(", ")})` : "") +
          (s.verdict === "zoroark" ? `: must be ${z.zoroark}, ${s.why}.` : s.verdict === "not" ? `: ${s.why}.` : ".") +
          (ADMIN ? "" : on ? ` Counted as ${z.zoroark}.` : ` Counted as ${s.shown}.`);
        row.append(el("span", "", what + " "));
        if (ADMIN) {
          const btn = el("button", "small", on ? `Move back to ${s.shown}` : `Move to ${z.zoroark}`);
          btn.type = "button";
          btn.setAttribute("aria-pressed", on ? "true" : "false");
          btn.addEventListener("click", () => {
            const next = new Set(picked);
            if (on) next.delete(s.n); else next.add(s.n);
            pickZoroark(replay, side, [...next].sort((x, y) => x - y));
          });
          row.append(btn);
        }
        list.append(row);
      }
      if (!open.length) list.append(el("li", "", "None: every stay rules it out."));
      box.append(list);
      if (not.length) {
        const why = el("details", "zoro-pick");
        why.append(el("summary", "", `Ruled out (${not.length})`));
        const ul = el("ul");
        ul.append(...not.map((s) => el("li", "", `${turnSpan(s)}, shown as ${s.shown}: ${s.why}.`)));
        why.append(ul);
        box.append(why);
      }
      if (z.from === "you") {
        const reset = el("button", "small", "Stop trying it out");
        reset.type = "button";
        reset.addEventListener("click", () => pickZoroark(replay, side, null));
        box.append(reset);
      }
      li.append(box);
      items.push(li);
    }
  }
  $("warnings").hidden = !items.length;
  $("warnings").replaceChildren(...items);
}
