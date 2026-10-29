/* Awards tab: the standouts (League.awards, then League.moreAwards) of one week's saved league games, or all weeks. */
"use strict";

let awardsShown = false;  // the tab is drawn for the picked week; a new game or a stage change draws it again
onLeagueChange(() => { awardsShown = false; });
let awWeek = null;  // null: not picked yet (opens on the latest week); "" = all weeks, else "Week 3"
async function renderAwards() {
  if (awardsShown) return;
  awardsShown = true;
  $("aw-status").textContent = "Loading games…";
  const league = await loadLeague();
  fillWeeks("aw-week", (w) => { awWeek = w; awardsShown = false; renderAwards(); });
  const sel = $("aw-week");
  // opens on the latest week played (the last option), not the whole season
  if (awWeek === null) awWeek = sel.options.length > 1 ? sel.options[sel.options.length - 1].value : "";
  sel.value = awWeek;
  if (sel.value !== awWeek) awWeek = sel.value;  // that week isn't in the picked stage
  const games = library.filter((g) => (!awWeek || g.week === awWeek) && inStage(g.week));
  const ids = new Set(games.map((g) => g.id));
  const rows = league.filter((r) => ids.has(r.replay_id));
  const all = [...League.awards(rows, playerKey), ...League.moreAwards(rows, playerKey)];
  const list = all.filter((a) => a.winners.length);
  const counted = new Set(rows.map((r) => r.replay_id)).size;
  const label = awWeek || "All weeks";
  $("aw-status").textContent = !games.length ? "No saved games in this week." :
    `${label}: ${counted} game${counted === 1 ? "" : "s"}` + (counted < games.length ? ` (${games.length - counted} didn't load)` : "") + ".";
  $("aw-list").replaceChildren(...list.map(awardCard));
  const none = all.filter((a) => !a.winners.length);
  $("aw-none").textContent = games.length && none.length ? `No winner in these games: ${none.map((a) => a.title).join(", ")}.` : "";
}
/** One award: its name (hover for how it's picked), then each winner: sprite, Pokémon and player (or the player),
    what it did, and Stats to open that game. A tie of many (e.g. KO'd before moving): the first 3, then how many
    more, named on hover. */
function awardCard(a) {
  const card = el("article", "award");
  const h = el("h3", "", a.title);
  h.title = a.how;
  card.append(h);
  const SHOWN = 3;
  for (const w of a.winners.slice(0, SHOWN)) {
    const line = el("div", "award-win");
    if (w.pokemon) line.append(sprite(w.pokemon, ["gen5/"], "small"));
    const name = el("div", "award-who");
    name.title = w.pokemon ? `${w.pokemon} (${shownName(w.player)})` : shownName(w.player);  // cut short on a narrow card
    name.append(el("strong", "", w.pokemon || shownName(w.player)), w.pokemon ? el("span", "muted", shownName(w.player)) : "");
    line.append(name, el("div", "award-value", w.value));
    const g = w.game && library.find((x) => x.id === w.game);
    if (g) {
      const b = Object.assign(el("button", "small", "Stats"), { type: "button",
        title: `${g.week}: ${g.players.join(" vs ")} in Main viewer` });
      b.addEventListener("click", () => openGame(g.id));
      line.append(b);
    }
    card.append(line);
  }
  const rest = a.winners.slice(SHOWN);
  if (rest.length) {
    const more = el("p", "award-more muted", `and ${rest.length} more tied`);
    more.title = rest.map((w) => (w.pokemon ? `${w.pokemon} (${shownName(w.player)})` : shownName(w.player))).join(", ");
    card.append(more);
  }
  return card;
}
