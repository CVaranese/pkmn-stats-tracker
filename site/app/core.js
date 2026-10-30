/* Shared by every tab: the libraries, page state (mode, rows, sort), column labels and tooltips, navigation
   (tabs, Back / Forward), small DOM helpers (el, sprite, tables, luck badge, tap tips). */
"use strict";

const RS = window.ReplayStats;
const TS = window.TeamSheets;
const LK = window.Luck;
const { PCT_TO_HP, pct, sum, amount, moveDealt, seasonLuck, normalCdf, koPairs, seasonMoves, dealtKey, bestMove, spriteId } = window.League;
const $ = (id) => document.getElementById(id);
// served from this computer: no requests to Showdown at all (replays only from site/games/, move / Pokedex data from
// site/data/, no sprites). Add ?online to the address to use Showdown as the live site does.
const LOCAL = ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname) &&
  !new URLSearchParams(location.search).has("online");
// the league this page is for (site/leagues.json, written into the page by tools/build_pages.py); its files are in
// site/<id>/ (games, team sheets, trainer sprites), everything shared is one folder up (the page's <base>)
const LEAGUE = window.LEAGUE || { id: "", name: "", tag: "" };
const DIR = LEAGUE.id ? LEAGUE.id + "/" : "";
const KEYS = "replay-kill-tracker." + DIR.replace("/", ".");  // remembered per league
const STORAGE_KEY = KEYS + "links";
const SHEETS_KEY = KEYS + "sheets";
const ONE_KEY = KEYS + "one-link";
const MODE_KEY = KEYS + "mode";
const cache = new Map();   // replay id -> replay json (for this page visit)
const pasteCache = new Map(); // pokepaste id -> export text
let rows = [];             // game rows from the last run
let moveInfo = null;       // Showdown's move data once loaded (luck), for type chips in move lists
let view = "summary";
let sort = { field: "kills", dir: -1 };
const LABELS = {
  replay_id: "Replay", date: "Date", format: "Format", player: "Player", opponent: "Opponent",
  won: "Won", end_reason: "Ended by", turns: "Turns", game_seconds: "Game length (s)", seconds_per_turn: "Seconds / turn", timer_on: "Timer on", pokemon: "Pokémon", nickname: "Nickname", brought: "Brought", kills: "Kills",
  direct_kills: "Direct", passive_kills: "Passive", deaths: "Deaths", self_kos: "Self KOs", replay_url: "Link",
  games_brought: "Games", wins_when_brought: "Wins", kills_per_game: "Kills / game",
  max_hp: "Max HP", max_hp_from: "Max HP from", item: "Item", ability: "Ability", moves: "Moves",
  damage_dealt_pct: "Dealt %", damage_taken_pct: "Taken %", damage_dealt_hp: "Dealt HP", damage_taken_hp: "Taken HP",
  hazard_damage_pct: "Hazard %", hazard_damage_hp: "Hazard HP", hazard_kills: "Hazard KOs",
  hazards_set: "Hazards set", hazards_removed: "Hazards removed", hazard_turns: "Hazard turns",
  healing_pct: "Healed %", healing_hp: "Healed HP", healing_given_pct: "Heal given %", healing_given_hp: "Heal given HP",
  statuses_inflicted: "Statuses", status_damage_pct: "Status dmg %", status_damage_hp: "Status dmg HP",
  moves_revealed: "Moves shown", item_revealed: "Item shown", ability_revealed: "Ability shown", info_revealed_pct: "Info shown %",
  switches: "Switches", pivots: "Pivots", forced_out: "Forced out", faint_switch_ins: "In after KO",
  crits: "Crits", crits_taken: "Crits taken", misses: "Misses", dodges: "Dodged", full_paras: "Full paras",
  sleep_turns: "Sleep turns", flinched: "Flinched", confusion_hits: "Hit itself", procs: "Effects landed",
  luck: "Luck", luck_against: "Luck against", player_luck: "Player luck",
  hidden_zoroark: "Hidden Zoroark",
  turns_on_field: "Turns on field", survived: "Survived", ko_before_moving: "KO'd before moving",
  mega: "Mega", mega_turn: "Mega turn", z_move: "Z-move", z_turn: "Z turn",
  megas: "Megas", mega_wins: "Mega wins", z_moves: "Z-moves", z_wins: "Z wins",
  mvp_score: "Performance", mvp: "Team MVP", mvps: "MVPs", mvp_score_per_game: "Performance / game",
};
// column header tooltips (title text); "How each column is counted" has the full rules
const DESCRIPTIONS = {
  replay_id: "Showdown replay ID.", date: "Day the replay was uploaded.", format: "Showdown format.",
  player: "The player who brought this Pokémon.", opponent: "The other player in that game.",
  won: "Whether this player won the game.", end_reason: "How the game ended: normal, forfeit, timer, tie or unfinished.",
  turns: "Number of turns the game lasted.",
  game_seconds: "How long the game took, from the replay's first to last timestamp (blank for games rebuilt from video).",
  seconds_per_turn: "Game length divided by turns.",
  timer_on: "This player turned on the battle timer in that game (the replay says who asked for it).",
  statuses_inflicted: "Burns, poisonings, paralyses, sleeps and freezes it put on opponents (Toxic Spikes count for whoever set them).",
  status_damage_pct: "Part of Dealt % done by burn or poison it inflicted.",
  status_damage_hp: "Part of Dealt HP done by burn or poison it inflicted (~ = uses a guessed max HP, no team sheet).",
  moves_revealed: "Different moves it used, of 4 (Z-moves not counted).",
  item_revealed: "The game showed its item (a Mega Stone or Z-crystal counts).", ability_revealed: "The game showed its ability.",
  info_revealed_pct: "How much of their team the player gave away: of 7 facts per Pokémon (sent out, item, ability, 4 moves), the share the game showed.", pokemon: "Species (form included).", nickname: "Nickname used in the game.",
  brought: "Whether it played: in singles every Pokémon on the team counts, even one that never came in; in VGC (4 of 6) the ones that came in.",
  kills: "Opponents it KO'd: direct + passive.", direct_kills: "KOs from its own attacks (spread KOs count each; Destiny Bond counts).",
  passive_kills: "KOs from indirect damage it caused: burn, poison, hazards, weather, Leech Seed, Rocky Helmet…",
  deaths: "Times it fainted (still standing at a forfeit doesn't count).",
  self_kos: "Times it knocked itself out: recoil, Life Orb, Explosion, Memento, Final Gambit, Healing Wish. Nobody gets the kill.", replay_url: "Link to the replay.",
  games_brought: "Games it was brought to.", wins_when_brought: "Games won when it was brought.",
  kills_per_game: "Kills divided by games brought.",
  max_hp: "Max HP from the team sheet. Without one, a guess (marked ~): 0 or 252 HP EVs, as most Smogon Nat Dex sets, else as on the player's other sheets, else from its base stats.",
  max_hp_from: "Where Max HP came from: sheet, other sheet (the same player, another game), Smogon (usage stats) or base stats.",
  item: "Item from the team sheet, else the first one the game showed.", ability: "Ability from the team sheet, else the one the game showed.",
  moves: "Moves from the team sheet, else the moves it used.",
  damage_dealt_pct: "Damage it dealt, in % of the targets' max HP (100 = one full Pokémon). Overkill doesn't count.",
  damage_taken_pct: "Damage it took, in % of its own max HP, self-inflicted damage included.",
  damage_dealt_hp: "Damage dealt in HP (about ±1% of max HP per hit; ~ = uses a guessed max HP, no team sheet).",
  damage_taken_hp: "Damage taken in HP (about ±1% of max HP per hit; ~ = uses a guessed max HP, no team sheet).",
  hazard_damage_pct: "Part of Dealt % done by Stealth Rock / Spikes / Steelsurge it set.",
  hazard_damage_hp: "Part of Dealt HP done by hazards it set (~ = uses a guessed max HP, no team sheet).",
  hazard_kills: "Part of its passive kills that came from hazards.", hazards_set: "Hazard layers it set.",
  hazards_removed: "Hazards it cleared from its own side (Defog, Rapid Spin…).",
  hazard_turns: "Turns that ended with this player's hazards on the opponent's side.",
  healing_pct: "HP it restored to itself (Leftovers, Recover, drain, berries…), in % of its max HP.",
  healing_hp: "HP it restored to itself (~ = uses a guessed max HP, no team sheet).",
  healing_given_pct: "HP it restored to teammates (Wish, Healing Wish, Heal Pulse…), in % of their max HP.",
  healing_given_hp: "HP it restored to teammates (~ = uses a guessed max HP, no team sheet).",
  switches: "Times it switched out by choice.", pivots: "Times it left through its own move (U-turn, Volt Switch, Parting Shot…).",
  forced_out: "Times it was forced out (Roar, Whirlwind, Dragon Tail, Red Card, Eject Button…).",
  faint_switch_ins: "Times it came in to replace a fainted teammate.",
  crits: "Critical hits it landed.", crits_taken: "Critical hits it took.", misses: "Its moves that missed.",
  dodges: "Opponents' moves that missed it.", full_paras: "Turns it was fully paralyzed.", sleep_turns: "Turns it stayed asleep.",
  flinched: "Times it flinched.", confusion_hits: "Times it hit itself in confusion.",
  procs: "Status conditions and flinches its attacks caused.",
  luck: "Its luck: each random roll counts as result minus odds. About 0 is average; higher is luckier.",
  luck_against: "Opponents' luck on rolls aimed at it. High means they got lucky against it.",
  player_luck: "The player's luck minus the opponent's in that game.",
  hidden_zoroark: "This team had a Zoroark that never dropped its disguise; its stats sit on the Pokémon it copied.",
  turns_on_field: "Turns it started on the field.", survived: "Still standing when the game ended.",
  ko_before_moving: "Times it fainted during a stay on the field before it got to act.",
  mega: "Whether it Mega Evolved.", mega_turn: "Turn it Mega Evolved.", z_move: "Z-move it used.", z_turn: "Turn it used the Z-move.",
  megas: "Games it Mega Evolved.", mega_wins: "Games won after it Mega Evolved.", z_moves: "Games it used a Z-move.",
  z_wins: "Games won after it used a Z-move.",
  mvp_score: "Performance, roughly in KOs' worth: +1 per 100% dealt, +1 per kill, +0.5 per 100% taken, +0.05 per turn on field, +0.5 for surviving.",
  mvp: "Best Performance on its team in that game.", mvps: "Times it was Team MVP.", mvp_score_per_game: "Average Performance per game brought.",
};
const YES_NO = new Set(["won", "brought", "hidden_zoroark", "mvp", "survived", "mega", "item_revealed", "ability_revealed", "timer_on"]);
// no date column (user 2026-10-28: the week is enough), in the tables or the exports
const GAME_VIEW_FIELDS = RS.GAME_FIELDS.filter((f) => f !== "replay_id" && f !== "format" && f !== "date");
const ONE_GAME_HIDDEN = new Set(["date", "opponent", "won", "end_reason", "turns", "game_seconds", "seconds_per_turn", "timer_on",
  "info_revealed_pct", "player_luck", "replay_url"]);
const SHEET_FIELDS = ["max_hp", "max_hp_from", "item", "ability", "moves"]; // per game, once any max HP is known
const HP_FROM = { player: "other sheet", smogon: "Smogon", stats: "base stats" }; // max_hp_from of a guess
const HP_AFTER = { damage_taken_pct: ["damage_dealt_hp", "damage_taken_hp"], hazard_damage_pct: ["hazard_damage_hp"],
  healing_pct: ["healing_hp"], healing_given_pct: ["healing_given_hp"], status_damage_pct: ["status_damage_hp"] };
// Main viewer (one game, the default) or "many" (several games added up: a set from Set stats, or a link with several ?r= ids; no tab of its own since 2026-10-28); each has its own input, remembered separately
let mode = "one";
const activeInput = () => (mode === "one" ? $("one-link") : $("links"));
// tabs with no link box: their own views over the saved league games (gamble: Gambling, still a "coming soon" page)
const NO_INPUT_TABS = ["fantasy", "gamble", "games", "players", "mons", "awards", "draft"];
const activeIds = () => (NO_INPUT_TABS.includes(mode) ? [] :
  RS.replayIdsFromText(activeInput().value).slice(0, mode === "one" ? 1 : Infinity));
function setMode(m, load = true) {
  mode = m;
  openedSet = null;
  shownSet = null;
  $("set-head").hidden = true;
  try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* storage blocked */ }
  for (const tab of document.querySelectorAll(".modes [data-mode]")) markCurrent(tab, tab.dataset.mode === m);
  // phones scroll the tab row sideways: keep the selected tab in sight (e.g. a ?tab=fantasy link)
  const current = document.querySelector('.modes [aria-current="true"]');
  if (current) {
    const nav = current.parentNode;
    const right = current.getBoundingClientRect().right - nav.getBoundingClientRect().left + nav.scrollLeft;
    nav.scrollLeft = Math.max(0, right - nav.clientWidth + 28);
  }
  const noInputs = NO_INPUT_TABS.includes(m);
  $("one-input").hidden = m !== "one";
  $("many-input").hidden = m !== "many";
  $("fantasy").hidden = m !== "fantasy";
  $("gamble").hidden = m !== "gamble";
  $("players").hidden = m !== "players";
  $("mons").hidden = m !== "mons";
  $("awards").hidden = m !== "awards";
  $("draft").hidden = m !== "draft";
  $("library").hidden = m !== "games";
  setCollapsed(false);  // the button lives with the results, which a mode change hides
  $("inputs").hidden = noInputs;
  cancelRun();
  view = m === "one" ? "games" : "summary";
  sort = m === "one" ? { field: "player", dir: 1 } : { field: "kills", dir: -1 };
  rows = [];
  $("results").hidden = true;
  $("errors").hidden = true;
  $("warnings").hidden = true;
  $("status").textContent = "";
  if (load && activeIds().length) run();
  if (m === "fantasy") renderFantasy();
  if (m === "players") renderPlayers();
  if (m === "mons") renderMons();
  if (m === "awards") renderAwards();
  if (m === "gamble") renderBets();
  if (m === "draft") renderDraft();
}
// Back / Forward: each tab, game and Watch panel is a history entry ({ mode, r, watch, pick }), so Back returns to
// the previous one instead of leaving the site. The address follows (?tab=games, ?r=<id>, ?tab=players&player=<key>,
// ?tab=mons&mon=<name>); other params stay. pick: the player (key) or Pokémon picked on Players / Pokémon.
const navPick = () => (mode === "players" ? (playerWanted && playerKey(playerWanted)) || playerPicked :
  mode === "mons" ? monWanted || monPicked : mode === "draft" ? draftPicked && playerKey(draftPicked) : "");
const navState = () => ({ mode, r: mode === "one" ? activeIds()[0] || "" : "", watch: $("lib-watch").hidden ? "" : watching,
  pick: navPick(), set: openedSet ? openedSet.join(",") : "" });
const navUrl = (st) => location.pathname + League.navQuery(location.search, st);
function pushNav() {
  const st = navState();
  if (JSON.stringify(st) === JSON.stringify(history.state)) return;
  try { history.pushState(st, "", navUrl(st)); } catch (e) { /* sandboxed frame: no history */ }
}
/** The address follows a pick inside Players / Pokémon (a link to share) without a Back step per click. */
function replaceNav() {
  const st = navState();
  try { history.replaceState(st, "", navUrl(st)); } catch (e) { /* sandboxed frame: no history */ }
}
/** A table with a header row; each cell is [text or node, "num" or ""], a header cell may add a title. */
function simpleTable(table, head, body) {
  const tr = (cells, tag) => {
    const r = document.createElement("tr");
    r.append(...cells.map(([v, cls, title]) => { const c = el(tag, cls); c.append(v); if (title) c.title = title; return c; }));
    return r;
  };
  table.replaceChildren(tr(head, "th"), ...body.map((cells) => tr(cells, "td")));
}
/** Marks the selected tab, or the row whose details show below its table (aria-current: screen readers announce it). */
const markCurrent = (tr, on) => (on ? tr.setAttribute("aria-current", "true") : tr.removeAttribute("aria-current"));
/** A table sorted by clicking a header (▲▼; numbers biggest first). cols: { label, cls, title, key(item) }.
    On a phone the first tap on a header with a title explains it, a second sorts (like the results table). */
function sortableTable(table, cols, items, state, cells, after) {
  const draw = () => {
    const k = cols[state.col].key;
    const order = (x, y) => (typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y)));
    const sorted = [...items].sort((a, b) => order(k(a), k(b)) * state.dir);  // stable: ties keep the items' order
    simpleTable(table, cols.map((c) => [c.label, c.cls || "", c.title]), sorted.map(cells));
    [...table.rows[0].cells].forEach((th, i) => {
      th.scope = "col";
      cellButton(th);
      if (i === state.col) th.setAttribute("aria-sort", state.dir < 0 ? "descending" : "ascending");
      th.addEventListener("click", () => {
        const tk = "sort:" + table.id + i;
        if (TOUCH && th.title && tipKey !== tk) { showTip(th, th.title + " Tap again to sort.", tk); return; }
        hideTip();
        state.dir = state.col === i ? -state.dir : cols[i].cls === "num" ? -1 : 1;  // numbers biggest first
        state.col = i;
        draw();
      });
    });
    if (after) after(sorted);
  };
  draw();
}
/** What goes in the link box: a Showdown link, or the bare id of a game rebuilt from its stream video. */
const linkFor = (id) => (id.startsWith("video-") ? id : RS.REPLAY_HOST + id);
/** Open a stored game in Main viewer (stats, so the result shows). */
function openGame(id) {
  $("one-link").value = linkFor(id);
  $("one-link").dispatchEvent(new Event("input"));
  setMode("one");
  pushNav();
  $("sheets-wrap").open = false;
  window.scrollTo(0, 0);
}
// a set opened with Set stats (its game ids), or null: the several-games totals under a heading naming the set,
// the Games tab marked, the link box folded away
let openedSet = null;
/** Open a set's games together (from Games or a game's line in Main viewer): their stats added up under the set's
    name. push: false when Back / Forward or a ?set= link brings it back. One game's id is enough: ?set=<id> opens
    that game's whole set. */
function openSet(ids, push = true) {
  const first = library.find((g) => g.id === ids[0]);
  const s = first && setOf(first);
  if (s) ids = s.games.map((g) => g.id);  // any one game's id opens its whole set (the replay player's "a best-of-3")
  $("links").value = ids.map(linkFor).join("\n");
  $("links").dispatchEvent(new Event("input"));
  setMode("many");
  if (s) {
    openedSet = ids;
    for (const tab of document.querySelectorAll(".modes [data-mode]")) markCurrent(tab, tab.dataset.mode === "games");
    setCollapsed(true);
    setHead(s);
  }
  if (push) pushNav();
  $("sheets-wrap").open = false;
  window.scrollTo(0, 0);
}
/** The opened set's heading: who, the week, the score (missing games' winners counted), each game to open alone. */
function setHead(s) {
  const lost = missing.filter((m) => m.week === s.week && pairKey(m.players) === pairKey(s.players));
  const score = LEAGUE.best_of ? setSlots({ ...s, missing: lost }).score : s;
  // each game opens alone from the game-by-game table (setGames), numbered as played
  const line = el("p", "game-line", `${s.week} · ${setScore(score)}`);
  const note = lost.length ? el("p", "hint", `${lost.length} game${lost.length > 1 ? "s" : ""} of this set had no ` +
    `replay saved, so ${lost.length > 1 ? "they aren't" : "it isn't"} in these numbers.`) : "";
  const games = el("div", "table-wrap");
  games.id = "set-games";
  $("set-head").replaceChildren(el("h2", "section-title", `Set stats: ${s.players.join(" vs ")}`), line, note, games,
    el("p", "hint", "Every saved game of the set, added up below."));
  $("set-head").hidden = false;
  shownSet = { ...s, missing: lost };
  // the rows already shown, only when they're this set's (else run() draws it once the set's games are in)
  const ids = new Set(s.games.map((g) => g.id));
  if (rows.length && rows.every((r) => ids.has(r.replay_id))) setGames(rows);
}
let shownSet = null;  // the set setHead shows (with its missing games), for setGames once the rows are in
/** The opened set game by game, above its totals: winner, turns, each side's MVP and KOs, Stats / Watch; a game
    played with no replay or never played (the set already won) says so. rs: the loaded rows (the set's games). */
function setGames(rs) {
  const box = $("set-games");
  if (!box || !shownSet) return;
  const s = shownSet;
  const slots = LEAGUE.best_of ? setSlots(s).slots : s.games.map((g, i) => ({ n: i + 1, game: g }));
  const side = (g, p) => rs.filter((r) => r.replay_id === g.id && playerKey(r.player) === playerKey(p));
  const mvp = (g, p) => (side(g, p).find((r) => r.mvp) || {}).pokemon || "–";
  const table = el("table");
  // Stats / Watch next to the game number: on a phone the table scrolls sideways, and they stay in view
  simpleTable(table, [["Game", ""], ["", ""], ["Winner", ""], ["Turns", "num"], ...s.players.map((p) => [`${p}'s MVP`, ""]),
    ["KOs", "num", `KOs: ${s.players.join(" – ")}`]],
    slots.map((sl) => {
      const g = sl.game;
      if (!g) {
        const what = sl.kind === "unplayed" ? "Not played" : "No replay";
        return [[`Game ${sl.n}`, ""], [el("span", "muted", what), ""], [sl.winner || "–", ""], ["–", "num"],
          ...s.players.map(() => ["", ""]), ["", "num"]];
      }
      const loaded = rs.some((r) => r.replay_id === g.id);
      const kos = s.players.map((p) => sum(side(g, p), "kills")).join("–");
      const stats = Object.assign(el("button", "small", "Stats"), { type: "button", title: "This game on its own (Main viewer)" });
      stats.addEventListener("click", () => openGame(g.id));
      const watch = Object.assign(el("button", "small", "Watch"), { type: "button", title: "Play the replay" });
      watch.addEventListener("click", () => watchHere(g));
      const acts = el("span", "row");
      acts.append(stats, watch);
      return [[`Game ${sl.n}`, ""], [acts, ""], [g.winner || "–", ""], [String(g.turns ?? "–"), "num"],
        ...s.players.map((p) => [loaded ? mvp(g, p) : "–", ""]), [loaded ? kos : "–", "num"]];
    }));
  box.replaceChildren(table);
}
/** Open a player's season (tab "players", their name or key) or a Pokémon's ("mons", its name as the Pokémon tab
    shows it), picked and scrolled into view; Back returns here. */
function openSeason(tab, value) {
  if (mode !== tab) setMode(tab);
  if (tab === "players") wantPlayer(value); else wantMon(value);
  pushNav();
}
/** A link to a player's or Pokémon's season (openSeason): a real address, so it can be opened in a new tab or copied. */
function seasonLink(text, tab, value, cls = "season-link") {
  const a = el("a", cls, text);
  a.href = navUrl({ mode: tab, r: "", pick: tab === "players" ? playerKey(value) : value });
  a.addEventListener("click", (e) => {
    if (e.button || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;  // new tab / window: the browser's
    e.preventDefault();
    openSeason(tab, value);
  });
  return a;
}
const SPRITES = "https://play.pokemonshowdown.com/sprites/";
/** A sprite <img> that tries each folder in turn, then shows the name's initials (unknown form, no copy). */
function sprite(species, folders, cls, fill = false) {
  const box = el("span", "sprite " + cls);
  const img = document.createElement("img");
  img.alt = species;
  img.loading = "lazy";
  // the copies saved in site/sprites/ (league Pokémon; animated ones where Showdown has them): the only source
  // locally, the fallback when Showdown is down.
  // fill: the saved copy first, since only a same-site image can be cropped (Showdown's server sends no CORS header)
  const saved = folders.includes("ani/") ? ["sprites/ani/", "sprites/gen5/"] : ["sprites/gen5/"];
  const list = LOCAL ? saved : fill ? ["sprites/gen5/", ...folders.map((f) => SPRITES + f)]
    : [...folders.map((f) => SPRITES + f), ...saved];
  if (fill) img.addEventListener("load", () => fillBox(img, box), { once: true });
  let i = 0;
  const next = () => {
    if (i < list.length) { img.src = list[i++] + spriteId(species) + (list[i - 1].endsWith("ani/") ? ".gif" : ".png"); return; }
    img.remove();
    box.textContent = species.replace(/[^A-Za-z ]/g, " ").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2);
  };
  img.addEventListener("error", next);
  next();
  box.appendChild(img);
  return box;
}
/** Crop a sprite to the Pokémon itself and scale it to fill its box, so a Joltik isn't tiny next to a Hoopa
 * (gen5 sprites keep each Pokémon's true size in the same 96px frame). Leaves the image as it is if it can't be read. */
function fillBox(img, box) {
  if (!img.src.includes("/sprites/gen5/") || img.src.startsWith(SPRITES)) return;   // only the saved copies
  try {
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = Object.assign(document.createElement("canvas"), { width: w, height: h });
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0);
    const px = g.getImageData(0, 0, w, h).data;
    let x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (px[(y * w + x) * 4 + 3] > 16) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    }
    if (x1 < 0) return;
    const bw = x1 - x0 + 1, bh = y1 - y0 + 1, side = Math.max(bw, bh);
    const out = Object.assign(document.createElement("canvas"), { width: side, height: side });
    const o = out.getContext("2d");
    o.drawImage(c, x0, y0, bw, bh, Math.floor((side - bw) / 2), Math.floor((side - bh) / 2), bw, bh);
    out.setAttribute("role", "img");
    out.setAttribute("aria-label", img.alt);
    out.className = "sprite-fill";
    box.replaceChildren(out);
  } catch (e) { /* tainted or unreadable: keep the plain image */ }
}
/** A cell's contents in a button that looks like the text, so a keyboard can reach it; the click still goes to the
    row's or header's own handler. */
function cellButton(cell) {
  const b = el("button", "cell-btn");
  b.type = "button";
  b.append(...cell.childNodes);
  cell.append(b);
}
function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}
function stat(label, value, field) {
  const d = el("div", "stat");
  d.append(el("span", "stat-value", String(value)), el("span", "stat-label", label));
  if (field && DESCRIPTIONS[field]) d.title = DESCRIPTIONS[field];
  return d;
}
// luck in words: the score is the sum of (result - odds) over a game's rolls. Cut-offs re-sampled 2026-10-28 from
// 75 games (45 league + 30 Nat Dex ladder, tests/luck-sample.html): player luck (own minus opponent's) has sd 1.44,
// its middle half within +-1.1, 1 game in 8 beyond +-2.25; a Pokémon's luck: 3 in 4 within +-0.21, 1 in 10 beyond 0.8.
// season: the total over the spread its own rolls could have given (seasonLuck: each roll with chance p adds
// p(1-p)), a normal z: middle half +-0.67, 1 season in 10 beyond 1.64. Checked on the 75 games 2026-10-28
// (tests/luck-var.html, docs/knowledge/luck.md).
const LUCK_STEPS = { player: [1.1, 2.25], pokemon: [0.25, 0.75], season: [0.67, 1.64] };
const LUCK_WORDS = ["Very unlucky", "Unlucky", "Fair", "Lucky", "Very lucky"];
const PIPS = [[50, 50], [25, 25, 75, 75], [25, 25, 50, 50, 75, 75], [25, 25, 75, 25, 25, 75, 75, 75],
  [25, 25, 75, 25, 50, 50, 25, 75, 75, 75]];
/** A die face (1 pip = very unlucky ... 5 = very lucky) and the word; the number is in the tooltip. */
function luckBadge(v, kind, top = []) {
  const box = el("span", "luck");
  if (typeof v !== "number") { box.textContent = "–"; box.title = "No luck score (move data didn't load)."; return box; }
  const [a, b] = LUCK_STEPS[kind];
  const level = v <= -b ? 0 : v <= -a ? 1 : v < a ? 2 : v < b ? 3 : 4;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("class", "die level-" + level);
  svg.setAttribute("aria-hidden", "true");
  let inner = '<rect x="4" y="4" width="92" height="92" rx="18"/>';
  const pips = PIPS[level];
  for (let i = 0; i < pips.length; i += 2) inner += `<circle cx="${pips[i]}" cy="${pips[i + 1]}" r="10"/>`;
  svg.innerHTML = inner;
  box.append(svg, el("span", "", LUCK_WORDS[level]));
  box.title = `Luck score ${v > 0 ? "+" : ""}${v.toFixed(2)}. ` + (kind === "player"
    ? "This player's rolls (hits, crits, status chances…) against the opponent's: about 0 is fair."
    : "Its own rolls (hits, crits, status chances…): about 0 is fair.") + " +1 is about one crit more than the odds." +
    (top.length ? " Biggest: " + top.map((g) => `${g.label}${g.n > 1 ? " ×" + g.n : ""} (${g.v > 0 ? "+" : "−"}${Math.abs(g.v).toFixed(2)})`).join("; ") + "." : "");
  return box;
}
/** Luck over a season (a player's games, or a Pokémon's): the die and word on the season scale; in the tooltip the
    total, the spread these rolls could have given, and how often a season is this lucky. rows: one per game,
    luckField / varField: player_luck / player_luck_var or luck / luck_var. */
function seasonLuckBadge(rows, luckField, varField) {
  const s = seasonLuck(rows, luckField, varField);
  if (!s) return luckBadge("", "season");
  const box = luckBadge(s.z, "season");
  const sign = (x) => (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x).toFixed(1);
  box.title = `${s.games} game${s.games === 1 ? "" : "s"}, luck added up ${sign(s.total)} (rolls that went their way ` +
    `minus the odds: a crit is +0.96, a 70% move missing −0.7). ` + (s.sd > 0 ? `With these rolls half of all seasons ` +
    `would land within ±${(LUCK_STEPS.season[0] * s.sd).toFixed(1)}. ` + luckOdds(s.z) : "No rolls to judge.");
  return box;
}
/** "Luckier than 84% of seasons with these rolls (about 1 in 6 is this lucky)." for a season z. */
function luckOdds(z) {
  const below = normalCdf(z), tail = z >= 0 ? 1 - below : below;
  const pct = Math.round(100 * (1 - tail));
  const word = z >= 0 ? "Luckier" : "Unluckier", adj = z >= 0 ? "lucky" : "unlucky";
  return `${word} than ${Math.min(pct, 99)}% of seasons with these rolls` +
    (tail <= 0.25 ? ` (about 1 in ${Math.round(1 / tail)} is this ${adj}).` : ".");
}
/** A drawn table as shown (its order, rows the filter hid left out), for Copy for Google Sheets / Download CSV:
    each cell's text; a cell with only pictures (sprites) gives their titles. Whole numbers ("12", "−3", "+2") go out
    as numbers so Sheets can add them up. */
function shownTable(table) {
  const [head, ...body] = [...table.rows];
  const fields = [...head.cells].map((th) => th.textContent.replace(/[▲▼]/g, "").trim());
  const value = (td) => {
    const text = td.textContent.trim() ||
      [...td.querySelectorAll("[title]")].map((x) => x.title).join(", ");
    return /^[−+-]?\d+(\.\d+)?$/.test(text) ? Number(text.replace("−", "-")) : text;
  };
  const data = body.filter((tr) => !tr.hidden).map((tr) => Object.fromEntries([...tr.cells].map((td, i) => [fields[i], value(td)])));
  return { fields, data };
}
/** Copy for Google Sheets and Download CSV buttons for a table drawn on a tab (Players, Pokémon). */
function tableExport(copyBtn, downloadBtn, table, file) {
  copyBtn.addEventListener("click", async () => {
    const { fields, data } = shownTable(table);
    try {
      await navigator.clipboard.writeText(RS.toTsv(fields, data));
      flash(copyBtn, "Copied! Paste into Sheets");
    } catch (e) {
      flash(copyBtn, "Copy failed: use Download CSV");
    }
  });
  downloadBtn.addEventListener("click", () => {
    const { fields, data } = shownTable(table);
    // BOM so Excel reads accented names (Pokémon, player names) as UTF-8
    const blob = new Blob(["﻿" + RS.toCsv(fields, data)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = file;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
}
function flash(btn, text) {
  const old = btn.textContent;
  btn.textContent = text;
  setTimeout(() => { btn.textContent = old; }, 1800);
}
// phones can't hover: a tap on anything with a title (luck words, sprites…) shows it in a tip under it.
// Headers call showTip themselves (first tap explains, second sorts).
const TOUCH = matchMedia("(hover: none)").matches;
let tip = null, tipTimer = 0, tipKey = "";
function showTip(target, text, key = "") {
  if (!tip) {
    tip = el("div", "tap-tip");
    tip.setAttribute("role", "status");
    document.body.append(tip);
  }
  tip.textContent = text;
  tip.hidden = false;
  tipKey = key;
  const r = target.getBoundingClientRect();
  const maxLeft = document.documentElement.clientWidth - tip.offsetWidth - 8;
  tip.style.left = window.scrollX + Math.max(8, Math.min(r.left, maxLeft)) + "px";
  tip.style.top = window.scrollY + r.bottom + 6 + "px";
  clearTimeout(tipTimer);
  tipTimer = setTimeout(hideTip, 5000);
}
function hideTip() {
  if (tip) tip.hidden = true;
  tipKey = "";
}
