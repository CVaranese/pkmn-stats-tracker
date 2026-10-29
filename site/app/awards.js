/* Awards tab: each week's standouts (League.awards) from the saved league games, or the season so far. */
"use strict";

let awardsShown = false;  // the tab is drawn for the picked week; a new game or a stage change draws it again
onLeagueChange(() => { awardsShown = false; });
let awWeek = null;  // null: not picked yet (opens on the latest week); "" = all weeks, else "Week 3"
let awText = "";
// every idea's number and name, to say which had no winner (League.awardIdeas leaves those out)
const IDEA_NAMES = [[1, "Luckiest Pokémon"], [2, "Unluckiest Pokémon"], [3, "Crit machine"], [4, "Butterfingers"], [5, "Untouchable"],
  [6, "Sleepyhead"], [7, "Stuck in place"], [8, "Hurt itself in its confusion"], [9, "Flinch magnet"], [10, "Hazard king"], [11, "Janitor"],
  [12, "Medic"], [13, "Plague doctor"], [14, "Pivot master"], [15, "Iron man"], [16, "One and done"], [17, "Passive aggressive"],
  [18, "Revolving door"], [19, "Poker face"], [20, "Open book"], [21, "Clean sweep"], [22, "Nail-biter"], [23, "Marathon"]];  // the picked week's awards as Discord text
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
  const list = League.awards(rows, playerKey);
  const counted = new Set(rows.map((r) => r.replay_id)).size;
  const label = awWeek || "Season so far";
  $("aw-status").textContent = !games.length ? "No saved games in this week." :
    `${label}: ${counted} game${counted === 1 ? "" : "s"}` + (counted < games.length ? ` (${games.length - counted} didn't load)` : "") + ".";
  $("aw-list").replaceChildren(...list.map(awardCard));
  // ideas on trial (user 2026-10-29), numbered as brainstormed
  const ideas = League.awardIdeas(rows, playerKey);
  $("aw-ideas").replaceChildren(...ideas.map(awardCard));
  const none = IDEA_NAMES.filter(([n]) => !ideas.some((a) => a.n === n));
  $("aw-ideas-none").textContent = none.length ? `No winner in these games: ${none.map(([n, t]) => `#${n} ${t}`).join(", ")}.` : "";
  // **Week 3 awards**, then one line each: "Top Pokémon: Garchomp (Ann), Performance 5.5"
  const who = (w) => (w.pokemon ? `${w.pokemon} (${shownName(w.player)})` : shownName(w.player));
  awText = [`**${LEAGUE.short || LEAGUE.name} · ${awWeek ? awWeek + " awards" : "season awards so far"}**`,
    ...list.map((a) => `${a.title}: ${a.winners.map((w) => `${who(w)}, ${w.value}`).join("; ")}`)].join("\n");
  $("aw-copy").disabled = !list.length;
}
/** One award: its name (hover for how it's picked), then each winner: sprite, Pokémon and player (or the player),
    what it did, and Stats to open that game. */
function awardCard(a) {
  const card = el("article", "award");
  const h = el("h3", "", a.n ? `#${a.n} ${a.title}` : a.title);
  h.title = a.how;
  card.append(h);
  // a tie of many (e.g. KO'd before moving): the first 3, then how many more, named on hover
  const SHOWN = 3;
  for (const w of a.winners.slice(0, SHOWN)) {
    const line = el("div", "award-win");
    if (w.pokemon) line.append(sprite(w.pokemon, ["gen5/"], "small"));
    const name = el("div", "award-who");
    name.title = w.pokemon ? `${w.pokemon} (${shownName(w.player)})` : shownName(w.player);  // cut short on a narrow card
    name.append(el("strong", "", w.pokemon || shownName(w.player)), w.pokemon ? el("span", "muted", shownName(w.player)) : "");
    const value = el("div", "award-value", w.value);
    line.append(name, value);
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
$("aw-copy").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(awText);
    flash($("aw-copy"), "Copied!");
  } catch {
    flash($("aw-copy"), "Copy failed");
  }
});
