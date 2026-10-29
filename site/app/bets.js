/* Gambling tab, preview only: each week's drawn bets (Bet.weeklyBets) with their lines and results. The live site
   keeps the "Under construction" box alone (the tab only teases until betting is built). */
"use strict";

// the next branch's preview (/next/ in the address) or this computer: where the bets show
const PREVIEW = ADMIN || location.pathname.includes("/next/");
// leagues.json bets: on for Pinecord; off for VGC leagues until their lines are worked out (user 2026-10-29)
const BETS_ON = PREVIEW && !!LEAGUE.bets;
let betsShown = false;
onLeagueChange(() => { betsShown = false; });
let betWeek = null;  // null: not picked yet (opens on the latest week)
async function renderBets() {
  if (!BETS_ON || betsShown) return;
  betsShown = true;
  $("bet-draw").hidden = false;
  const league = await loadLeague();
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
  // a game that didn't load isn't counted: say so, as results and lines would be off
  const inWeek = library.filter((g) => g.week === betWeek).length, counted = (weeks[betWeek] || []).length;
  $("bet-status").textContent = `${betWeek}: ${counted} game${counted === 1 ? "" : "s"}` +
    (counted < inWeek ? ` (${inWeek - counted} didn't load, so the results may be off)` : "") + ".";
  $("bet-list").replaceChildren(...Bet.weeklyBets(LEAGUE.id, betWeek, weeks).map(betCard));
}
/** One bet: what it's on, the line (over / under) or Yes / No, and how it came out once the week's games are in. */
function betCard(b) {
  const card = el("article", "award bet");
  card.append(el("h3", "", b.text));
  card.append(el("p", "bet-line", b.kind === "ou" ? `Over / under ${b.line}` : "Yes / No"));
  const r = b.result;
  const out = el("p", "bet-result");
  if (!r) out.append(el("span", "muted", "Not played yet"));
  else {
    out.append(el("span", "badge" + (r.outcome === "Over" || r.outcome === "Yes" ? " win" : ""), r.outcome));
    if (r.detail) out.append(" ", el("span", "", b.kind === "ou" ? `${r.detail} this week` : r.detail));
  }
  card.append(out);
  return card;
}
