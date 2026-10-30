/* Draft tab (mode "draft"): each player's drafted Pokémon (site/games/draft.json), one sub-tab per player, with how
   each pick has done in the saved league games (fantasy points from bet.js, as on Fantasy). */
"use strict";

let draftPicked = "";   // the player shown: a name or key, from a sub-tab or ?tab=draft&player=<key>
let draftRows = null;   // every league game's rows, loaded the first time the tab opens
let draftCards = [];    // Bet.reportCards over those rows: each player's grade, best first
onLeagueChange(() => { draftRows = null; draftCards = []; });
const draftSort = { col: 2, dir: -1 };  // by cost, dearest first
async function renderDraft() {
  if (draftRows) { showDraft(); return; }
  draftRows = [];  // marks the tab as rendering
  $("dr-status").textContent = "Loading the draft…";
  await libraryReady;
  await loadDraft();
  if (!draft || !draft.players) { $("dr-status").textContent = "The draft didn't load."; draftRows = null; return; }
  draftRows = await loadLeague();
  draftCards = Bet.reportCards(draft, draftRows);
  const games = new Set(draftRows.map((r) => r.replay_id)).size;
  $("dr-status").textContent = games < library.length ? `Counted ${games} of ${library.length} games (the rest didn't load).` : "";
  const names = Object.keys(draft.players).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  $("dr-players").replaceChildren(...names.map((name) => {
    const b = Object.assign(el("button"), { type: "button" });
    b.dataset.key = playerKey(name);
    b.append(trainerImg(b.dataset.key, "trainer small"), el("span", "", name));
    b.addEventListener("click", () => { draftPicked = b.dataset.key; showDraft(); replaceNav(); });
    return b;
  }));
  showDraft();
}
/** The player's trainer sprite from the draft sheet (site/<league>/img/trainers/<key>.png); gone if they have none. */
function trainerImg(key, cls) {
  const img = Object.assign(el("img", cls), { src: `${DIR}img/trainers/${key}.png`, alt: "", loading: "lazy" });
  img.addEventListener("error", () => img.remove());
  return img;
}
/** One drafted Pokémon's season: its fantasy entries summed (a Mega and its base form count as the one pick). */
function draftPick(d, mine) {
  const fs = mine.filter((f) => Bet.drafted(draft, f.player, f.pokemon) === d);
  const add = (k) => fs.reduce((t, f) => t + f[k], 0);
  const cost = Bet.pickCost(draft, d);
  const games = add("games");
  const points = Math.round(add("points") * 10) / 10;
  return { pokemon: d.pokemon, tier: d.tier, cost, games, wins: add("wins"), kills: add("kills"), points,
    perCost: cost && games ? Math.round((points / cost) * 10) / 10 : null };
}
/** +3.5 / −2.0 / 0.0: a number above or below expectation, one decimal, a real minus sign. */
const signed = (x) => (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toFixed(1);
/** The report card above the picks: the grade on the league's curve, then value, depth, waste, best pick and biggest
    bust (Bet.reportCards), and how it's graded. Hidden for a player with no games yet. */
function showReportCard(c) {
  $("dr-card").hidden = !c || !c.grade;
  if (!c || !c.grade) return;
  const n = draftCards.filter((x) => x.grade).length;
  const tiers = Bet.hasTiers(draft), group = tiers ? "tier" : "price band";
  $("dr-grade").textContent = `Report card: ${c.grade} (${c.place} of ${n} drafts)`;
  const pick = (p) => `${p.pokemon} (${p.group ? (tiers ? p.group : "price " + p.group) : "no " + group}), ${signed(p.above)} in ${p.games} game${p.games === 1 ? "" : "s"}`;
  simpleTable($("dr-card-table"), [["", ""], ["", ""]], [
    [["Value", ""], [`${signed(c.value)} points compared with what picks of the same ${group} earn (${signed(c.perGame)} a game)`, ""]],
    [["Depth", ""], [`${c.depth[0]} of ${c.depth[1]} picks brought at or above their ${group}`, ""]],
    [["Waste", ""], [c.waste ? `${c.waste} draft point${c.waste === 1 ? "" : "s"} on Pokémon never brought (${c.wasted.join(", ")})` : "Every pick brought at least once", ""]],
    [["Best pick", ""], [c.best ? pick(c.best) : "–", ""]],
    [["Biggest bust", ""], [c.bust ? pick(c.bust) : "None below their " + group, ""]],
  ]);
  $("dr-card-table").rows[0].remove();  // no header row: each row names itself
  $("dr-card-how").textContent = `Graded against the league's other drafts: value a game counts double, then depth and waste. ` +
    `A pick is held to what a ${group} pick earns a game across the league (fantasy points, as on Fantasy). ` +
    `About a sixth of the drafts get an A, a quarter a B, a sixth each a D and an F.`;
}
/** The picked player's draft: a line about their season, then every pick (never-brought ones greyed). */
function showDraft() {
  if (!draft || !draftRows) return;
  const names = [...$("dr-players").children].map((b) => b.textContent);  // the image adds no text
  if (!names.length) return;
  const name = names.find((n) => playerKey(n) === playerKey(draftPicked || "")) || names[0];
  draftPicked = playerKey(name);
  for (const b of $("dr-players").children) markCurrent(b, b.dataset.key === draftPicked);
  // phones scroll the row sideways: keep the picked player in sight (e.g. a ?tab=draft&player= link)
  const bar = $("dr-players"), cur = bar.querySelector('[aria-current="true"]');
  if (cur && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = Math.max(0, cur.offsetLeft - (bar.clientWidth - cur.offsetWidth) / 2);
  // trades (draft.trades): both Pokémon stay in the table with a badge, a traded-away one the sheet no longer lists
  // added back with its games before the trade (Bet.draftPool)
  const dp = Bet.draftPool(draft, name);
  const mine = Bet.fantasy(draftRows.filter((r) => playerKey(r.player) === draftPicked), draft);
  const picks = dp.pool.map((p) => Object.assign(draftPick(p.entry, mine), { trade: p.trade }));
  const extra = mine.filter((f) => !Bet.drafted(draft, f.player, f.pokemon));
  const kept = picks.filter((p) => !(p.trade && p.trade.away));

  const rec = Bet.records(library, draft).find((p) => p.id === draftPicked);
  const card = draftCards.find((c) => c.key === draftPicked);
  const spent = dp.spent;
  const brought = picks.filter((p) => p.games);
  const best = [...brought].filter((p) => p.perCost !== null).sort((a, b) => b.perCost - a.perCost)[0];
  const head = el("h2", "section-title");
  head.append(seasonLink(name, "players", name));
  head.firstChild.title = "Their season on Players";
  const who = el("div", "draft-who");
  who.append(trainerImg(draftPicked, "trainer big"), head);
  const line = el("p", "hint", [rec ? `${rec.wins}–${rec.losses} in the saved games` : "No saved games yet",
    `${kept.length} Pokémon for ${spent} draft points`, picks.length > kept.length ? `${picks.length - kept.length} traded away` : "",
    `${brought.length} brought so far`,
    // the report card names the best pick (against its tier) when there is one: one "best" on the page, not two
    best && !(card && card.grade) ? `best value: ${best.pokemon}, ${best.perCost} points per draft point` : ""].filter(Boolean).join(" · "));
  $("dr-head").replaceChildren(who, line);
  showReportCard(card);
  // each pick's points against what its tier (or price band) earns in as many games, from the report card
  const above = (i) => (card && card.picks[i] ? card.picks[i].above : null);
  picks.forEach((p, i) => { p.above = above(i); });

  const num = (label, title, key) => ({ label, cls: "num", title, key });
  // a league priced per Pokémon has no tiers: no Tier column
  const tiers = Bet.hasTiers(draft);
  sortableTable($("dr-table"), [
    { label: "Pokémon", key: (p) => p.pokemon },
    ...(tiers ? [{ label: "Tier", title: "Its Nat Dex tier on draft day, from the draft sheet.", key: (p) => p.tier }] : []),
    num("Cost", tiers ? "Draft points it cost (set by its tier on draft day)." : "Draft points it cost, from the draft sheet.", (p) => p.cost ?? -1),
    num("Games", "Games it was brought to (not just shown at team preview).", (p) => p.games),
    num("Wins", "Games won when it was brought.", (p) => p.wins),
    num("KOs", DESCRIPTIONS.kills, (p) => p.kills),
    num("Points", "Fantasy points, as on Fantasy: 3 a KO, 1 per 100% damage, 1 for each game alive at the end, 1 for each win.", (p) => p.points),
    num("Per cost", "Points for each draft point it cost.", (p) => p.perCost ?? -Infinity),
    num(tiers ? "vs tier" : "vs price", `Points above (or below) what a pick of its ${tiers ? "tier" : "price band"} earns in as many games.`,
      (p) => p.above ?? -Infinity),
  ], picks, draftSort, (p) => {
    const mon = el("span", "bet-mon");
    mon.append(sprite(p.pokemon, ["gen5/"], "tiny"), p.games ? seasonLink(p.pokemon, "mons", p.pokemon) : p.pokemon);
    if (p.trade) mon.append(Object.assign(el("span", "badge", p.trade.label), { title: p.trade.title }));
    const dash = (v) => (p.games ? String(v) : "–");
    return [[mon, ""], ...(tiers ? [[p.tier || "–", ""]] : []), [p.cost === null ? "–" : String(p.cost), "num"], [String(p.games), "num"],
      [dash(p.wins), "num"], [dash(p.kills), "num"], [dash(p.points.toFixed(1)), "num"],
      [p.perCost === null ? "–" : p.perCost.toFixed(1), "num"], [p.above === null ? "–" : signed(p.above), "num"]];
  }, (sorted) => {
    [...$("dr-table").rows].slice(1).forEach((tr, i) => {
      if (!sorted[i].games) { tr.classList.add("not-brought"); tr.title = "Not brought to a saved game yet"; }
    });
  });
  // a Pokémon brought that the draft sheet doesn't list (a trade, a free pick): said, not hidden
  const traded = dp.trades.map((t) => `${t.out.join(", ")} for ${t.in.join(", ") || "(not known yet)"}, after ${t.after}`);
  $("dr-extra").textContent = [
    traded.length ? "Traded: " + traded.join("; ") + "." : "",
    extra.length ? "Also brought, not on the draft sheet: " +
      extra.map((f) => `${f.pokemon} (${f.games} game${f.games > 1 ? "s" : ""})`).join(", ") + "." : ""].filter(Boolean).join(" ");
}
