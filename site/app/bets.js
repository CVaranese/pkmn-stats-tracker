/* Gambling tab, preview only: each week's drawn bets (Bet.weeklyBets) with their lines and results. The live site
   keeps the "Under construction" box alone (the tab only teases until betting is built). */
"use strict";

// the next branch's preview (/next/ in the address) or this computer: where the bets show
const PREVIEW = ADMIN || location.pathname.includes("/next/");
// only formats whose lines are worked out (Bet.BET_FORMATS): Nat Dex; no VGC for now (user 2026-10-29)
const BETS_ON = PREVIEW && Bet.BET_FORMATS.includes(LEAGUE.format);
let betsShown = false;
onLeagueChange(() => { betsShown = false; });
let betWeek = null;  // null: not picked yet (opens on the latest week)
async function renderBets() {
  if (!BETS_ON || betsShown) return;
  betsShown = true;
  if (!$("bet-draw").childElementCount) buildBetDraw();
  $("bet-draw").hidden = false;
  const [league] = await Promise.all([loadLeague(), loadDraft()]);
  // { week: [each game's rows] }, weeks in the order played (the library is sorted by date)
  const weeks = {};
  for (const g of library) {
    const rs = league.filter((r) => r.replay_id === g.id);
    (weeks[g.week] = weeks[g.week] || []).push(...(rs.length ? [rs] : []));
  }
  const sel = $("bet-week");
  const names = Object.keys(weeks);
  sel.replaceChildren(...names.map((w) => new Option(w, w)));
  if (betWeek === null || !names.includes(betWeek)) betWeek = names[names.length - 1] || "";
  sel.value = betWeek;
  if (!sel.dataset.ready) {
    sel.dataset.ready = "1";
    sel.addEventListener("change", () => { betWeek = sel.value; betsShown = false; renderBets(); });
  }
  // the games each week has: saved or played without a replay, and in a regular week of a league playing one game a
  // week each, every player's (half the draft); bets wait for the rest before settling
  const pairs = !LEAGUE.best_of && draft && draft.players ? Math.floor(Object.keys(draft.players).length / 2) : 0;
  const planned = Object.fromEntries(names.map((w) => [w, Math.max(
    library.filter((g) => g.week === w).length + missing.filter((m) => m.week === w).length,
    League.isPlayoffWeek(w) ? 0 : pairs)]));
  const counted = (weeks[betWeek] || []).length, due = planned[betWeek] || counted;
  $("bet-status").textContent = `${betWeek}: ${counted} of ${due} game${due === 1 ? "" : "s"} counted` +
    (counted < due ? "; a bet settles once the rest can't change it" : "") + ".";
  $("bet-list").replaceChildren(...Bet.weeklyBets(LEAGUE.id, betWeek, weeks, 6, planned).map(betCard));
}
/** The block's parts, made here rather than in the page so the live page's HTML doesn't spell out the bets. */
function buildBetDraw() {
  const bar = el("div", "pl-bar"), label = el("label", "inline", "Week ");
  label.append(Object.assign(el("select"), { id: "bet-week" }));
  bar.append(label);
  $("bet-draw").replaceChildren(el("h2", "section-title", "This week's bets"),
    el("p", "hint", "Six bets drawn for each week, the same for everyone. Over / under lines come from the weeks before. Shown, not yet bettable."),
    bar, Object.assign(el("p", "hint"), { id: "bet-status" }), Object.assign(el("div", "award-grid"), { id: "bet-list" }));
}
/** One bet: what it's on, the line (over / under) or Yes / No, and how it came out once the week's games are in. */
function betCard(b) {
  const card = el("article", "award bet");
  card.append(el("h3", "", b.text));
  card.append(el("p", "bet-line", b.kind === "ou" ? `Over / under ${b.line}` : "Yes / No"));
  const r = b.result;
  const out = el("p", "bet-result");
  if (!r) out.append(el("span", "muted", "Not played yet"));
  else if (!r.outcome) out.append(el("span", "muted", b.kind === "ou" ? `${r.detail} so far` : "Not yet"));
  else {
    out.append(el("span", "badge" + (r.outcome === "Over" || r.outcome === "Yes" ? " win" : ""), r.outcome));
    if (r.detail) out.append(" ", el("span", "", b.kind === "ou" ? `${r.detail} this week` : r.detail));
  }
  card.append(out);
  return card;
}
