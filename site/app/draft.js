/* Draft tab (mode "draft"): each player's drafted Pokémon (site/games/draft.json), one sub-tab per player, with how
   each pick has done in the saved league games (fantasy points from bet.js, as on Fantasy). */
"use strict";

let draftPicked = "";   // the player shown: a name or key, from a sub-tab or ?tab=draft&player=<key>
let draftRows = null;   // every league game's rows, loaded the first time the tab opens
let draftCards = [];    // Bet.reportCards over those rows: each player's picks and grade, best first
// the report card (grade, vs tier column) only for formats it's designed for (Bet.CARD_FORMATS): singles, no VGC yet
const CARDS_ON = Bet.CARD_FORMATS.includes(LEAGUE.format);
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
  // the weeks played, in order (the library is sorted by date): a pick traded in after the last isn't waste yet
  draftCards = Bet.reportCards(draft, draftRows, [...new Set(library.map((g) => g.week))]);
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
/** +3.5 / −2.0 / 0.0: a number above or below expectation, one decimal, a real minus sign. */
const signed = (x) => (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toFixed(1);
/** The report card above the picks: the overall grade on the league's curve, then firepower, bulk, peaks and even use,
    each with its letter, the best pick and biggest bust (Bet.reportCards), and how it's graded. Hidden for a player
    with no games yet. */
function showReportCard(c) {
  $("dr-card").hidden = !c || !c.grade;
  if (!c || !c.grade) return;
  const n = draftCards.filter((x) => x.grade).length;
  const tiers = Bet.hasTiers(draft), group = tiers ? "tier" : "price band";
  const plural = (k, one, many = one + "s") => `${k} ${k === 1 ? one : many}`;
  $("dr-grade").textContent = `Report card: ${c.grade} (${c.place} of ${n} drafts)`;
  const label = (p) => (p.group ? (tiers ? p.group : "price " + p.group) : "no " + group);
  const pick = (p) => `${p.pokemon} (${label(p)}), ${signed(p.above)} in ${plural(p.games, "game")}`;
  const weekOf = (id) => (library.find((g) => g.id === id) || {}).week || "";
  const peak = c.peaks.best;
  const { most, least } = c.even;
  simpleTable($("dr-card-table"), [["", ""], ["", ""], ["", ""]], [
    [["Firepower", ""], [c.firepower.grade, ""], [`${signed(c.firepower.perGame)} a game: KOs and damage compared with picks of the same ${group}`, ""]],
    [["Bulk", ""], [c.bulk.grade, ""], [`${signed(c.bulk.perGame)} hits taken a game compared with picks of the same ${group} (hits from moves)`, ""]],
    [["Peaks", ""], [c.peaks.grade, ""], [`${c.peaks.count} of ${plural(c.peaks.of, "pick")} brought had a top-10% game ` +
      `(${c.peaks.line} or more)` + (peak ? `; best: ${peak.pokemon}, ${peak.points} in ${weekOf(peak.game) || "one game"}` : ""), ""]],
    [["Even use", ""], [c.even.grade, ""], [most ? `Most brought ${most.pokemon} (${plural(most.games, "game")}), least ${least.pokemon} ` +
      `(${plural(least.games, "game")})` : "–", ""]],
    [["Best pick", ""], ["", ""], [c.best ? pick(c.best) : "–", ""]],
    [["Biggest bust", ""], ["", ""], [c.bust ? pick(c.bust) : "None below their " + group, ""]],
  ]);
  $("dr-card-table").rows[0].remove();  // no header row: each row names itself
  $("dr-card-how").textContent = `Each part is graded against the league's other drafts, and the overall grade from all four. ` +
    `Firepower and the best pick and bust: 3 points a KO and 1 per 100% damage, against what a ${group} pick does in as many games. ` +
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
  // each pick's season and its number against its tier: the report card's picks (Bet.reportCards), one count for both
  const card = draftCards.find((c) => c.key === draftPicked);
  const picks = card ? card.picks : [];
  const extra = mine.filter((f) => !Bet.drafted(draft, f.player, f.pokemon));
  const kept = picks.filter((p) => !(p.trade && p.trade.away));

  const rec = Bet.records(library, draft).find((p) => p.id === draftPicked);
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
    best && !(CARDS_ON && card && card.grade) ? `best value: ${best.pokemon}, ${best.perCost} points per draft point` : ""].filter(Boolean).join(" · "));
  $("dr-head").replaceChildren(who, line);
  showReportCard(CARDS_ON ? card : null);

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
    ...(CARDS_ON ? [num(tiers ? "vs tier" : "vs price", `Firepower (3 a KO, 1 per 100% damage) above or below what a pick of its ${tiers ? "tier" : "price band"} does in as many games.`,
      (p) => p.above ?? -Infinity)] : []),
  ], picks, draftSort, (p) => {
    const mon = el("span", "bet-mon");
    mon.append(sprite(p.pokemon, ["gen5/"], "tiny"), p.games ? seasonLink(p.pokemon, "mons", p.pokemon) : p.pokemon);
    if (p.trade) mon.append(Object.assign(el("span", "badge", p.trade.label), { title: p.trade.title }));
    const dash = (v) => (p.games ? String(v) : "–");
    return [[mon, ""], ...(tiers ? [[p.tier || "–", ""]] : []), [p.cost === null ? "–" : String(p.cost), "num"], [String(p.games), "num"],
      [dash(p.wins), "num"], [dash(p.kills), "num"], [dash(p.points.toFixed(1)), "num"],
      [p.perCost === null ? "–" : p.perCost.toFixed(1), "num"], ...(CARDS_ON ? [[p.above === null ? "–" : signed(p.above), "num"]] : [])];
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
