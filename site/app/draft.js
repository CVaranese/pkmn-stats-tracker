/* Draft tab (mode "draft"): each player's drafted Pokémon (site/games/draft.json), one sub-tab per player, with how
   each pick has done in the saved league games (fantasy points from bet.js, as on Fantasy). */
"use strict";

let draftPicked = "";   // the player shown: a name or key, from a sub-tab or ?tab=draft&player=<key>
let draftRows = null;   // every league game's rows, loaded the first time the tab opens
const draftSort = { col: 2, dir: -1 };  // by cost, dearest first
async function renderDraft() {
  if (draftRows) { showDraft(); return; }
  draftRows = [];  // marks the tab as rendering
  $("dr-status").textContent = "Loading the draft…";
  await libraryReady;
  await loadDraft();
  if (!draft || !draft.players) { $("dr-status").textContent = "The draft didn't load."; draftRows = null; return; }
  draftRows = await loadLeague();
  const games = new Set(draftRows.map((r) => r.replay_id)).size;
  $("dr-status").textContent = games < library.length ? `Counted ${games} of ${library.length} games (the rest didn't load).` : "";
  const names = Object.keys(draft.players).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  $("dr-players").replaceChildren(...names.map((name) => {
    const b = Object.assign(el("button", "", name), { type: "button" });
    b.dataset.key = playerKey(name);
    b.addEventListener("click", () => { draftPicked = b.dataset.key; showDraft(); replaceNav(); });
    return b;
  }));
  showDraft();
}
/** One drafted Pokémon's season: its fantasy entries summed (a Mega and its base form count as the one pick). */
function draftPick(d, mine) {
  const fs = mine.filter((f) => Bet.drafted(draft, f.player, f.pokemon) === d);
  const add = (k) => fs.reduce((t, f) => t + f[k], 0);
  const cost = draft.costs[d.tier] ?? null;
  const games = add("games");
  const points = Math.round(add("points") * 10) / 10;
  return { pokemon: d.pokemon, tier: d.tier, cost, games, wins: add("wins"), kills: add("kills"), points,
    perCost: cost && games ? Math.round((points / cost) * 10) / 10 : null };
}
/** The picked player's draft: a line about their season, then every pick (never-brought ones greyed). */
function showDraft() {
  if (!draft || !draftRows) return;
  const names = [...$("dr-players").children].map((b) => b.textContent);
  if (!names.length) return;
  const name = names.find((n) => playerKey(n) === playerKey(draftPicked || "")) || names[0];
  draftPicked = playerKey(name);
  for (const b of $("dr-players").children) markCurrent(b, b.dataset.key === draftPicked);
  // phones scroll the row sideways: keep the picked player in sight (e.g. a ?tab=draft&player= link)
  const bar = $("dr-players"), cur = bar.querySelector('[aria-current="true"]');
  if (cur && bar.scrollWidth > bar.clientWidth) bar.scrollLeft = Math.max(0, cur.offsetLeft - (bar.clientWidth - cur.offsetWidth) / 2);
  const pool = draft.players[name];
  const mine = Bet.fantasy(draftRows.filter((r) => playerKey(r.player) === draftPicked), draft);
  const picks = pool.map((d) => draftPick(d, mine));
  const extra = mine.filter((f) => !pool.includes(Bet.drafted(draft, f.player, f.pokemon)));

  const rec = Bet.records(library, draft).find((p) => p.id === draftPicked);
  const spent = picks.reduce((t, p) => t + (p.cost || 0), 0);
  const brought = picks.filter((p) => p.games);
  const best = [...brought].filter((p) => p.perCost !== null).sort((a, b) => b.perCost - a.perCost)[0];
  const head = el("h2", "section-title");
  head.append(seasonLink(name, "players", name));
  head.firstChild.title = "Their season on Players";
  const line = el("p", "hint", [rec ? `${rec.wins}–${rec.losses} in the saved games` : "No saved games yet",
    `${pool.length} Pokémon for ${spent} draft points`, `${brought.length} brought so far`,
    best ? `best value: ${best.pokemon}, ${best.perCost} points per draft point` : ""].filter(Boolean).join(" · "));
  $("dr-head").replaceChildren(head, line);

  const num = (label, title, key) => ({ label, cls: "num", title, key });
  sortableTable($("dr-table"), [
    { label: "Pokémon", key: (p) => p.pokemon },
    { label: "Tier", title: "Its Nat Dex tier on draft day, from the draft sheet.", key: (p) => p.tier },
    num("Cost", "Draft points it cost (set by its tier on draft day).", (p) => p.cost ?? -1),
    num("Games", "Games it was brought to (not just shown at team preview).", (p) => p.games),
    num("Wins", "Games won when it was brought.", (p) => p.wins),
    num("KOs", DESCRIPTIONS.kills, (p) => p.kills),
    num("Points", "Fantasy points, as on Fantasy: 3 a KO, 1 per 100% damage, 1 for each game alive at the end, 1 for each win.", (p) => p.points),
    num("Per cost", "Points for each draft point it cost.", (p) => p.perCost ?? -Infinity),
  ], picks, draftSort, (p) => {
    const mon = el("span", "bet-mon");
    mon.append(sprite(p.pokemon, ["gen5/"], "tiny"), p.games ? seasonLink(p.pokemon, "mons", p.pokemon) : p.pokemon);
    const dash = (v) => (p.games ? String(v) : "–");
    return [[mon, ""], [p.tier || "–", ""], [p.cost === null ? "–" : String(p.cost), "num"], [String(p.games), "num"],
      [dash(p.wins), "num"], [dash(p.kills), "num"], [dash(p.points.toFixed(1)), "num"],
      [p.perCost === null ? "–" : p.perCost.toFixed(1), "num"]];
  }, (sorted) => {
    [...$("dr-table").rows].slice(1).forEach((tr, i) => {
      if (!sorted[i].games) { tr.classList.add("not-brought"); tr.title = "Not brought to a saved game yet"; }
    });
  });
  // a Pokémon brought that the draft sheet doesn't list (a trade, a free pick): said, not hidden
  // trades after Week 4 (draft.trades, still being filled in): a traded-away Pokémon isn't in the pool any more
  const trades = (Object.entries(draft.trades || {}).find(([p]) => p !== "_note" && playerKey(p) === draftPicked) || [, []])[1];
  const traded = trades.map((t) => `${t.out} for ${t.in || "(not known yet)"}, after ${t.after}`);
  $("dr-extra").textContent = [
    traded.length ? "Traded: " + traded.join("; ") + "." : "",
    extra.length ? "Also brought, not on the draft sheet: " +
      extra.map((f) => `${f.pokemon} (${f.games} game${f.games > 1 ? "s" : ""})`).join(", ") + "." : ""].filter(Boolean).join(" ");
}
