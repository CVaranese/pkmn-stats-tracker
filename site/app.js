/* Page logic: read links, fetch replays, render tables, copy/download. Parsing lives in parser.js. */
(function () {
  "use strict";
  const RS = window.ReplayStats;
  const TS = window.TeamSheets;
  const LK = window.Luck;
  const $ = (id) => document.getElementById(id);
  // served from this computer: no requests to Showdown at all (replays only from site/mock/, move / Pokedex data from
  // site/data/, no sprites). Add ?online to the address to use Showdown as the live site does.
  const LOCAL = ["127.0.0.1", "localhost", "[::1]"].includes(location.hostname) &&
    !new URLSearchParams(location.search).has("online");
  RS.setLocalOnly(LOCAL);
  const STORAGE_KEY = "replay-kill-tracker.links";
  const SHEETS_KEY = "replay-kill-tracker.sheets";
  const ONE_KEY = "replay-kill-tracker.one-link";
  const MODE_KEY = "replay-kill-tracker.mode";

  const cache = new Map();   // replay id -> replay json (for this page visit)
  const pasteCache = new Map(); // pokepaste id -> export text
  let rows = [];             // game rows from the last run
  let view = "summary";
  let sort = { field: "kills", dir: -1 };

  const LABELS = {
    replay_id: "Replay", date: "Date", format: "Format", player: "Player", opponent: "Opponent",
    won: "Won", end_reason: "Ended by", turns: "Turns", pokemon: "Pokémon", nickname: "Nickname", brought: "Brought", kills: "Kills",
    direct_kills: "Direct", passive_kills: "Passive", deaths: "Deaths", replay_url: "Link",
    games_brought: "Games", wins_when_brought: "Wins", kills_per_game: "Kills / game",
    max_hp: "Max HP", item: "Item", ability: "Ability", moves: "Moves",
    damage_dealt_pct: "Dealt %", damage_taken_pct: "Taken %", damage_dealt_hp: "Dealt HP", damage_taken_hp: "Taken HP",
    hazard_damage_pct: "Hazard %", hazard_damage_hp: "Hazard HP", hazard_kills: "Hazard KOs",
    hazards_set: "Hazards set", hazards_removed: "Hazards removed", hazard_turns: "Hazard turns",
    healing_pct: "Healed %", healing_hp: "Healed HP", healing_given_pct: "Heal given %", healing_given_hp: "Heal given HP",
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
  // column header tooltips (title text); "How kills and damage are counted" has the full rules
  const DESCRIPTIONS = {
    replay_id: "Showdown replay ID.", date: "Day the replay was uploaded.", format: "Showdown format.",
    player: "The player who brought this Pokémon.", opponent: "The other player in that game.",
    won: "Whether this player won the game.", end_reason: "How the game ended: normal, forfeit, timer, tie or unfinished.",
    turns: "Number of turns the game lasted.", pokemon: "Species (form included).", nickname: "Nickname used in the game.",
    brought: "Whether it was brought to the battle (not just shown at team preview).",
    kills: "Opponents it KO'd: direct + passive.", direct_kills: "KOs from its own attacks (spread KOs count each; Destiny Bond counts).",
    passive_kills: "KOs from indirect damage it caused: burn, poison, hazards, weather, Leech Seed, Rocky Helmet…",
    deaths: "Times it fainted (still standing at a forfeit doesn't count).", replay_url: "Link to the replay.",
    games_brought: "Games it was brought to.", wins_when_brought: "Games won when it was brought.",
    kills_per_game: "Kills divided by games brought.",
    max_hp: "Max HP from the team sheet.", item: "Item from the team sheet.", ability: "Ability from the team sheet.", moves: "Moves from the team sheet.",
    damage_dealt_pct: "Damage it dealt, in % of the targets' max HP (100 = one full Pokémon). Overkill doesn't count.",
    damage_taken_pct: "Damage it took, in % of its own max HP, self-inflicted damage included.",
    damage_dealt_hp: "Damage dealt in HP (needs team sheets; about ±1% of max HP per hit).",
    damage_taken_hp: "Damage taken in HP (needs team sheets; about ±1% of max HP per hit).",
    hazard_damage_pct: "Part of Dealt % done by Stealth Rock / Spikes / Steelsurge it set.",
    hazard_damage_hp: "Part of Dealt HP done by hazards it set (needs team sheets).",
    hazard_kills: "Part of its passive kills that came from hazards.", hazards_set: "Hazard layers it set.",
    hazards_removed: "Hazards it cleared from its own side (Defog, Rapid Spin…).",
    hazard_turns: "Turns that ended with this player's hazards on the opponent's side.",
    healing_pct: "HP it restored to itself (Leftovers, Recover, drain, berries…), in % of its max HP.",
    healing_hp: "HP it restored to itself (needs team sheets).",
    healing_given_pct: "HP it restored to teammates (Wish, Healing Wish, Heal Pulse…), in % of their max HP.",
    healing_given_hp: "HP it restored to teammates (needs team sheets).",
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
  const YES_NO = new Set(["won", "brought", "hidden_zoroark", "mvp", "survived", "mega"]);
  const GAME_VIEW_FIELDS = RS.GAME_FIELDS.filter((f) => f !== "replay_id" && f !== "format");
  const ONE_GAME_HIDDEN = new Set(["date", "opponent", "won", "end_reason", "turns", "player_luck", "replay_url"]);
  const SHEET_FIELDS = ["max_hp", "item", "ability", "moves"]; // per game, once any sheet matched
  const HP_AFTER = { damage_taken_pct: ["damage_dealt_hp", "damage_taken_hp"], hazard_damage_pct: ["hazard_damage_hp"],
    healing_pct: ["healing_hp"], healing_given_pct: ["healing_given_hp"] };

  // remember pasted links between visits (convenience only; the page works without it)
  try { $("links").value = localStorage.getItem(STORAGE_KEY) || ""; } catch (e) { /* storage blocked */ }
  $("links").addEventListener("input", () => {
    try { localStorage.setItem(STORAGE_KEY, $("links").value); } catch (e) { /* storage blocked */ }
  });

  // team sheets: one box each, remembered like the links
  let savedSheets = [];
  try { savedSheets = JSON.parse(localStorage.getItem(SHEETS_KEY) || "[]"); } catch (e) { /* storage blocked */ }
  for (const text of savedSheets) addSheetBox(text);
  $("sheets-wrap").open = savedSheets.length > 0;
  $("add-sheet").addEventListener("click", () => addSheetBox("").querySelector("textarea").focus());

  $("run").addEventListener("click", run);
  // One game (the default) or Several games; each has its own input, remembered separately
  let mode = "one";
  try { mode = ["many", "bet"].includes(localStorage.getItem(MODE_KEY)) ? localStorage.getItem(MODE_KEY) : "one"; } catch (e) { /* storage blocked */ }
  try { $("one-link").value = localStorage.getItem(ONE_KEY) || ""; } catch (e) { /* storage blocked */ }
  $("one-link").addEventListener("input", () => {
    try { localStorage.setItem(ONE_KEY, $("one-link").value); } catch (e) { /* storage blocked */ }
  });
  $("one-link").addEventListener("keydown", (e) => { if (e.key === "Enter") run(); });
  const activeInput = () => (mode === "one" ? $("one-link") : $("links"));
  const activeIds = () => (mode === "bet" ? [] : RS.replayIdsFromText(activeInput().value).slice(0, mode === "one" ? 1 : Infinity));
  function setMode(m, load = true) {
    mode = m;
    try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* storage blocked */ }
    for (const tab of document.querySelectorAll(".modes [data-mode]")) tab.setAttribute("aria-selected", String(tab.dataset.mode === m));
    $("one-input").hidden = m !== "one";
    $("many-input").hidden = m !== "many";
    $("gambling").hidden = m !== "bet";
    $("collapse").hidden = m === "bet";
    $("inputs").hidden = m === "bet" || collapsed;
    view = m === "one" ? "games" : "summary";
    sort = m === "one" ? { field: "player", dir: 1 } : { field: "kills", dir: -1 };
    rows = [];
    $("results").hidden = true;
    $("errors").hidden = true;
    $("warnings").hidden = true;
    $("status").textContent = "";
    if (load && activeIds().length) run();
  }
  for (const tab of document.querySelectorAll(".modes [data-mode]")) tab.addEventListener("click", () => setMode(tab.dataset.mode));
  // hide the links / sheets box (cleaner screenshots); the results stay
  let collapsed = false;
  $("collapse").addEventListener("click", () => {
    collapsed = !collapsed;
    $("inputs").hidden = collapsed;
    $("collapse").textContent = collapsed ? "Show links and sheets" : "Hide links and sheets";
    $("collapse").setAttribute("aria-expanded", String(!collapsed));
  });

  $("clear").addEventListener("click", () => {
    activeInput().value = "";
    activeInput().dispatchEvent(new Event("input"));
    rows = [];
    $("results").hidden = true;
    $("errors").hidden = true;
    $("warnings").hidden = true;
    $("status").textContent = "";
  });
  for (const tab of document.querySelectorAll(".tabs button")) {
    tab.addEventListener("click", () => {
      view = tab.dataset.view;
      sort = view === "summary" ? { field: "kills", dir: -1 } : { field: "date", dir: -1 };
      render();
    });
  }
  $("group").addEventListener("change", render);
  $("player").addEventListener("change", render);
  $("copy").addEventListener("click", copyTable);
  $("download").addEventListener("click", downloadCsv);
  $("share").addEventListener("click", copyShareLink);

  // ?r=id1,id2 opens with those replays filled in and loaded (shareable leaderboard link);
  // &t=paste1,paste2 adds those Pokepaste team sheets
  const params = new URLSearchParams(location.search);
  const sharedPastes = (params.get("t") || "").split(",").map((t) => TS.pokepasteIdFrom(TS.PASTE_HOST + t.trim()))
    .filter((id) => id && !sheetInputs().some((s) => TS.pokepasteIdFrom(s) === id));
  for (const id of sharedPastes) addSheetBox(TS.PASTE_HOST + id);
  if (sharedPastes.length) { $("sheets-wrap").open = true; saveSheets(); }
  // one replay in the link opens One game, more open Several games
  const shared = RS.replayIdsFromText(params.get("r") || "");
  if (shared.length === 1) $("one-link").value = RS.REPLAY_HOST + shared[0];
  else if (shared.length) $("links").value = shared.map((id) => RS.REPLAY_HOST + id).join("\n");
  if (shared.length) activeInput().dispatchEvent(new Event("input"));
  setMode(shared.length ? (shared.length === 1 ? "one" : "many") : mode, shared.length > 0);

  async function run() {
    const ids = activeIds();
    const errors = [];
    if (!ids.length) {
      $("status").textContent = "No replay links found.";
      return;
    }
    $("run").disabled = true;
    let done = 0;
    const status = () => { $("status").textContent = `Loading ${done} of ${ids.length}…`; };
    status();

    // a few at a time, to be gentle on Showdown's server
    const results = new Array(ids.length);
    let next = 0;
    let down = null;                    // first "Showdown is down" error: skip the rest, report it once
    let notTried = 0;
    async function worker() {
      while (next < ids.length) {
        const i = next++;
        const id = ids[i];
        try {
          if (!cache.has(id)) {
            if (down) { notTried++; done++; status(); continue; }
            cache.set(id, await RS.fetchReplay(id));
          }
          results[i] = cache.get(id);
        } catch (e) {
          if (e.down) { down = down || e; notTried++; } else errors.push(`${id}: ${e.message || e}`);
        }
        done++;
        status();
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);
    if (down) {
      errors.unshift(`Pokémon Showdown isn't responding, so ${notTried} replay${notTried === 1 ? " wasn't" : "s weren't"} loaded: ` +
        `${down.message}.`);
    }

    rows = [];
    for (const replay of results) {
      if (!replay) continue;
      try {
        rows.push(...RS.gameRows(replay));
      } catch (e) {
        errors.push(`${replay.id}: could not read the battle log (${e.message || e})`);
      }
    }
    await addMockSheets(ids);
    await applySheets(errors);
    await applyLuck(errors);
    const ok = results.filter(Boolean).length;
    $("status").textContent = `Loaded ${ok} replay${ok === 1 ? "" : "s"}` +
      (ids.length > ok ? `, ${ids.length - ok} failed.` : ".");
    $("errors").hidden = !errors.length;
    $("errors").replaceChildren(...errors.map((t) => Object.assign(document.createElement("li"), { textContent: t })));
    const zoroarks = [...new Set(rows.filter((r) => r.hidden_zoroark).map((r) => `${r.replay_id}: ${r.player}`))];
    $("warnings").hidden = !zoroarks.length;
    $("warnings").replaceChildren(...zoroarks.map((t) => Object.assign(document.createElement("li"), {
      textContent: `${t} had a Zoroark that never dropped its disguise. Whatever it did is counted on the Pokémon it copied.` })));
    $("run").disabled = false;

    const players = [...new Set(rows.map((r) => r.player))].sort((a, b) => a.localeCompare(b));
    const current = $("player").value;
    $("player").replaceChildren(new Option("All players", ""), ...players.map((p) => new Option(p, p)));
    if (players.includes(current)) $("player").value = current;

    $("results").hidden = !rows.length;
    renderTeams();
    render();
  }

  // ---------- team summary (one game only) ----------

  const SPRITES = "https://play.pokemonshowdown.com/sprites/";
  // names whose hyphen is part of the species, not a form ("Ho-Oh" is hooh, "Urshifu-Rapid-Strike" is urshifu-rapidstrike)
  const HYPHEN_NAMES = new Set(["hooh", "porygonz", "jangmoo", "hakamoo", "kommoo", "wochien", "chienpao", "tinglu", "chiyu",
    "nidoranf", "nidoranm"]);
  function spriteId(species) {
    const parts = species.split("-");
    let base = parts.shift();
    if (parts.length && HYPHEN_NAMES.has(TS.toID(base + parts[0]))) base += parts.shift();
    return TS.toID(base) + (parts.length ? "-" + TS.toID(parts.join("")) : "");
  }
  /** A sprite <img> that tries each folder in turn, then shows the name's initials (Showdown down, unknown form). */
  /** A sprite <img> that tries each folder in turn, then shows the name's initials (unknown form, no copy). */
  function sprite(species, folders, cls) {
    const box = el("span", "sprite " + cls);
    const img = document.createElement("img");
    img.alt = species;
    img.loading = "lazy";
    // local version: only the gen5 copies saved in site/sprites/ (Pokémon from the saved replays)
    const base = LOCAL ? "sprites/" : SPRITES;
    const list = LOCAL ? ["gen5/"] : folders;
    let i = 0;
    const next = () => {
      if (i < list.length) { img.src = base + list[i++] + spriteId(species) + (list[i - 1] === "ani/" ? ".gif" : ".png"); return; }
      img.remove();
      box.textContent = species.replace(/[^A-Za-z ]/g, " ").split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2);
    };
    img.addEventListener("error", next);
    next();
    box.appendChild(img);
    return box;
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const pct = (v) => (typeof v === "number" ? Math.round(v) + "%" : "–");
  const withHp = (p, hp) => pct(p) + (typeof hp === "number" ? ` (${Math.round(hp)} HP)` : "");
  const sum = (rs, f) => rs.reduce((t, r) => t + (typeof r[f] === "number" ? r[f] : 0), 0);
  function stat(label, value, field) {
    const d = el("div", "stat");
    d.append(el("span", "stat-value", String(value)), el("span", "stat-label", label));
    if (field && DESCRIPTIONS[field]) d.title = DESCRIPTIONS[field];
    return d;
  }

  /** Two team cards (MVP, team stats, sprites) above the table when exactly one game is loaded. */
  function renderTeams() {
    const box = $("teams");
    const games = new Set(rows.map((r) => r.replay_id));
    box.hidden = mode !== "one" || games.size !== 1;
    if (box.hidden) { box.replaceChildren(); return; }
    const g = rows[0];
    const head = el("p", "game-line");
    const link = Object.assign(el("a", "", g.replay_id), { href: g.replay_url, target: "_blank", rel: "noopener" });
    head.append(link, ` · ${g.date} · ${g.turns} turns · ended by ${g.end_reason}`);
    // winner first
    const players = [...new Set(rows.map((r) => r.player))].sort((a, b) =>
      rows.find((r) => r.player === b).won - rows.find((r) => r.player === a).won);
    const cards = players.map((p) => teamCard(p, rows.filter((r) => r.player === p)));
    box.replaceChildren(el("h2", "section-title", "This game"), head, el("div", "team-grid"));
    box.lastChild.append(...cards);
  }

  // luck in words: the score is the sum of (result - odds) over a game's rolls. Cut-offs from 34 Nat Dex games
  // (2026-10-26): player luck (own minus opponent's) has its middle half within +-0.9, a Pokémon's within +-0.15.
  const LUCK_STEPS = { player: [0.75, 2], pokemon: [0.25, 0.75] };
  const LUCK_WORDS = ["Very unlucky", "Unlucky", "Fair", "Lucky", "Very lucky"];
  const PIPS = [[50, 50], [25, 25, 75, 75], [25, 25, 50, 50, 75, 75], [25, 25, 75, 25, 25, 75, 75, 75],
    [25, 25, 75, 25, 50, 50, 25, 75, 75, 75]];
  /** A die face (1 pip = very unlucky ... 5 = very lucky) and the word; the number is in the tooltip. */
  function luckBadge(v, kind) {
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
      : "Its own rolls (hits, crits, status chances…): about 0 is fair.");
    return box;
  }
  function megaZ(r) {
    if (r.mega) return `Mega Evolved on turn ${r.mega_turn}`;
    if (r.z_move) return `Used ${r.z_move} (Z-move) on turn ${r.z_turn}`;
    return "";
  }

  function teamCard(player, rs) {
    const brought = rs.filter((r) => r.brought);
    const card = el("article", "team-card");
    const h = el("h3", "team-name");
    h.append(el("span", "", player), el("span", rs[0].won ? "badge win" : "badge loss", rs[0].won ? "Won" : "Lost"));
    card.appendChild(h);

    // the team: brought ones are buttons that show their stats below (Team MVP first)
    const strip = el("div", "team-strip");
    const detail = el("div", "mon-detail");
    const buttons = [];
    const show = (r) => {
      for (const b of buttons) b.setAttribute("aria-pressed", String(b.row === r));
      detail.replaceChildren(...monDetail(r));
    };
    for (const r of rs) {
      const s = sprite(r.pokemon, ["gen5/"], "small");
      const status = !r.brought ? "not brought" : r.deaths ? "fainted" : "survived";
      const label = r.pokemon + (r.nickname && r.nickname !== r.pokemon ? ` (${r.nickname})` : "") + ": " + status +
        (r.mega ? ", Mega Evolved" : r.z_move ? ", used a Z-move" : "");
      const slot = el(r.brought ? "button" : "span", "slot " + status.replace(" ", "-"));
      slot.title = label;
      slot.appendChild(s);
      if (r.mega || r.z_move) slot.appendChild(el("span", "mark " + (r.mega ? "mega" : "z"), r.mega ? "Mega" : "Z"));
      if (r.brought) {
        slot.type = "button";
        slot.setAttribute("aria-label", label);
        slot.row = r;
        slot.addEventListener("click", () => show(r));
        buttons.push(slot);
      }
      strip.appendChild(slot);
    }
    card.append(strip, detail);
    show(rs.find((r) => r.mvp) || brought[0] || rs[0]);

    const team = el("div", "team-totals");
    const lost = sum(brought, "deaths");
    const nums = el("div", "stats");
    nums.append(
      stat("Kills", sum(brought, "kills"), "kills"),
      stat("Lost", `${lost} of ${brought.length}`, "deaths"),
      stat("Dealt", pct(sum(brought, "damage_dealt_pct")), "damage_dealt_pct"),
      stat("Healed", pct(sum(brought, "healing_pct") + sum(brought, "healing_given_pct")), "healing_pct"),
      stat("Hazards set", sum(brought, "hazards_set"), "hazards_set"),
      stat("Switches", sum(brought, "switches") + sum(brought, "pivots"), "switches"),
      stat("Crits", sum(brought, "crits"), "crits"));
    const luck = el("div", "team-luck");
    luck.append(el("span", "stat-label", "Team luck"), luckBadge(rs[0].player_luck, "player"));
    team.append(el("h4", "", "Team"), nums, luck);
    card.appendChild(team);
    return card;
  }

  /** The selected Pokémon: sprite, name, Performance, its stats, Mega / Z-move. */
  function monDetail(r) {
    // every line is always there (blank when it doesn't apply), so switching Pokémon doesn't change the height
    const who = el("div", "mon-who");
    who.appendChild(el("span", "mvp-tag", r.mvp ? "Team MVP" : "\u00a0"));
    who.appendChild(el("span", "mon-name", r.pokemon));
    who.appendChild(el("span", "mon-nick", r.nickname && r.nickname !== r.pokemon ? r.nickname : "\u00a0"));
    const perf = el("span", "mon-perf", `Performance ${r.mvp_score}`);
    perf.title = DESCRIPTIONS.mvp_score;
    who.appendChild(perf);
    const grid = el("div", "stats");
    grid.append(
      stat("Kills", r.kills + (r.passive_kills ? ` (${r.passive_kills} passive)` : ""), "kills"),
      stat("Dealt", withHp(r.damage_dealt_pct, r.damage_dealt_hp), "damage_dealt_pct"),
      stat("Taken", withHp(r.damage_taken_pct, r.damage_taken_hp), "damage_taken_pct"),
      stat("Turns on field", r.turns_on_field, "turns_on_field"),
      stat("Survived", r.survived ? "yes" : "no", "survived"),
      stat("Healed", pct(r.healing_pct + r.healing_given_pct), "healing_pct"));
    const luck = el("div", "mon-luck");
    luck.append(el("span", "stat-label", "Luck"), luckBadge(r.luck, "pokemon"));
    const mark = el("p", "mon-mark");
    const mz = megaZ(r);
    if (mz) mark.appendChild(el("span", "mark " + (r.mega ? "mega" : "z"), mz)); else mark.textContent = "\u00a0";
    return [sprite(r.pokemon, ["ani/", "dex/", "gen5/"], "big"), who, mark, grid, luck];
  }

  /** The rows and columns currently shown (also what copy/download export). */
  function currentTable() {
    const player = $("player").value;
    const filtered = player ? rows.filter((r) => r.player === player) : rows;
    let fields, data;
    if (mode === "one") {
      // the game itself (date, result, turns, link) is in the team summary above, so not repeated per row
      data = filtered.slice();
      const base = GAME_VIEW_FIELDS.filter((f) => !ONE_GAME_HIDDEN.has(f));
      fields = rows.some((r) => r.set) ? base.flatMap((f) => [f, ...(HP_AFTER[f] || [])]).concat(SHEET_FIELDS) : base;
    } else if (view === "summary") {
      const byPlayer = $("group").value === "player";
      data = RS.summarize(filtered, byPlayer);
      const anySheet = rows.some((r) => r.set);
      fields = RS.SUMMARY_FIELDS.filter((f) => (byPlayer || f !== "player") && (anySheet || !RS.HP_FIELDS.includes(f)));
    } else {
      data = filtered.slice();
      // with sheets: HP columns next to the % ones, set details at the end
      fields = rows.some((r) => r.set) ? GAME_VIEW_FIELDS.flatMap((f) =>
        [f, ...(HP_AFTER[f] || [])]).concat(SHEET_FIELDS) : GAME_VIEW_FIELDS;
    }
    // numeric columns (right-aligned, sorted as numbers): any number in them; blanks don't count
    const numeric = new Set(fields.filter((f) => data.some((r) => typeof r[f] === "number")));
    const { field, dir } = sort;
    if (fields.includes(field)) {
      data.sort((a, b) => {
        const x = a[field], y = b[field];
        // blanks (no team sheet) sort below every number
        const num = (v) => (v === "" || v === undefined ? -Infinity : v);
        const c = numeric.has(field) ? Math.sign(num(x) - num(y)) || 0 : String(x).localeCompare(String(y));
        return c * dir;
      });
    }
    return { fields, data, numeric };
  }

  function render() {
    for (const tab of document.querySelectorAll(".tabs button")) {
      tab.setAttribute("aria-selected", String(tab.dataset.view === view));
    }
    $("group-wrap").hidden = mode === "one" || view !== "summary";
    document.querySelector(".toolbar .tabs").hidden = mode === "one";
    const { fields, data, numeric } = currentTable();

    const thead = document.createElement("thead");
    const hr = thead.insertRow();
    for (const f of fields) {
      const th = document.createElement("th");
      th.textContent = LABELS[f] || f;
      if (DESCRIPTIONS[f]) th.title = DESCRIPTIONS[f];
      th.scope = "col";
      if (numeric.has(f)) th.className = "num";
      if (sort.field === f) th.setAttribute("aria-sort", sort.dir < 0 ? "descending" : "ascending");
      th.addEventListener("click", () => {
        sort = sort.field === f ? { field: f, dir: -sort.dir } : { field: f, dir: numeric.has(f) ? -1 : 1 };
        render();
      });
      hr.appendChild(th);
    }
    const tbody = document.createElement("tbody");
    for (const r of data) {
      const tr = tbody.insertRow();
      if (view === "games" && !r.brought) tr.className = "not-brought";
      for (const f of fields) {
        const td = tr.insertCell();
        if (numeric.has(f)) td.className = "num";
        if (f === "replay_url") {
          const a = document.createElement("a");
          a.href = r[f];
          a.textContent = r.replay_id;
          a.target = "_blank";
          a.rel = "noopener";
          td.appendChild(a);
        } else if (YES_NO.has(f)) {
          td.textContent = r[f] ? "yes" : "no";
        } else {
          td.textContent = r[f];
        }
      }
    }
    $("table").replaceChildren(thead, tbody);
  }

  async function copyTable() {
    const { fields, data } = currentTable();
    const tsv = RS.toTsv(fields, data);
    try {
      await navigator.clipboard.writeText(tsv);
      flash($("copy"), "Copied! Paste into Sheets");
    } catch (e) {
      flash($("copy"), "Copy failed: use Download CSV");
    }
  }

  function downloadCsv() {
    const { fields, data } = currentTable();
    // BOM so Excel reads accented names (Pokémon, player names) as UTF-8
    const blob = new Blob(["﻿" + RS.toCsv(fields, data)], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = view === "summary" ? "kill-leaderboard.csv" : "kills-per-game.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function copyShareLink() {
    const ids = activeIds();
    const pastes = sheetInputs().map(TS.pokepasteIdFrom).filter(Boolean);
    const url = location.origin + location.pathname + "?r=" + ids.join(",") +
      (pastes.length ? "&t=" + pastes.join(",") : "");
    try {
      await navigator.clipboard.writeText(url);
      flash($("share"), "Link copied");
    } catch (e) {
      flash($("share"), "Copy failed");
    }
  }

  // ---------- team sheets ----------

  // TEMPORARY (Showdown outage): the saved test game comes with both team sheets, from site/mock/
  const MOCK_SHEETS = { "gen9nationaldex-2705117998": ["Phlegathon", "RevivalSludge24"] };
  async function addMockSheets(ids) {
    const have = new Set(sheetInputs().map((t) => t.trim()));
    for (const id of ids) {
      for (const player of MOCK_SHEETS[id] || []) {
        try {
          const resp = await fetch(`mock/${id}-${player}.txt`);
          const text = resp.ok ? (await resp.text()).trim() : "";
          if (text && !have.has(text)) { addSheetBox(text); have.add(text); $("sheets-wrap").open = true; }
        } catch (e) { /* no saved sheet: the game still loads */ }
      }
    }
    saveSheets();
  }

  function addSheetBox(text) {
    const box = document.createElement("div");
    box.className = "sheet";
    const ta = document.createElement("textarea");
    ta.rows = 3;
    ta.spellcheck = false;
    ta.setAttribute("aria-label", "Team sheet: Pokepaste link or Showdown export");
    ta.placeholder = "https://pokepast.es/…  or paste the export:\nGarchomp @ Rocky Helmet\nAbility: Rough Skin\n…";
    ta.value = text;
    ta.addEventListener("input", saveSheets);
    const status = Object.assign(document.createElement("span"), { className: "status" });
    const remove = Object.assign(document.createElement("button"), { type: "button", textContent: "Remove" });
    remove.addEventListener("click", () => { box.remove(); saveSheets(); });
    const row = document.createElement("div");
    row.className = "row";
    row.append(remove, status);
    box.append(ta, row);
    $("sheets").appendChild(box);
    return box;
  }

  function sheetInputs() {
    return [...$("sheets").querySelectorAll("textarea")].map((t) => t.value);
  }

  function saveSheets() {
    try { localStorage.setItem(SHEETS_KEY, JSON.stringify(sheetInputs().filter((t) => t.trim()))); } catch (e) { /* storage blocked */ }
  }

  /** Read every sheet box, match the sheets to the loaded games, add max HP / item / ability / moves to rows. */
  async function applySheets(errors) {
    const boxes = [...$("sheets").querySelectorAll(".sheet")];
    const sheets = await Promise.all(boxes.map(async (box) => {
      const text = box.querySelector("textarea").value;
      if (!text.trim()) return { sets: [], note: "" };
      const id = TS.pokepasteIdFrom(text);
      try {
        if (id && !pasteCache.has(id)) pasteCache.set(id, await TS.fetchPokepaste(id));
        const sets = TS.parseTeam(id ? pasteCache.get(id) : text);
        if (!sets.length) return { sets, bad: true, note: "No Pokémon found. Paste a Pokepaste link or a Showdown export." };
        return { sets, note: (id ? "Pokepaste: " : "") + sets.map((s) => s.species).join(", ") };
      } catch (e) {
        return { sets: [], bad: true, note: String(e.message || e) };
      }
    }));
    const matches = TS.attachSheets(rows, sheets);

    let dex = null;
    if (rows.some((r) => r.set)) {
      try { dex = await TS.loadDex(); } catch (e) { errors.push(`Pokédex (for max HP): ${e.message || e}`); }
    }
    for (const r of rows) {
      const s = r.set;
      r.max_hp = s && dex ? (TS.maxHp(s, dex) ?? "") : "";
      r.item = s ? s.item : "";
      r.ability = s ? s.ability : "";
      r.moves = s ? s.moves.join(" / ") : "";
    }
    RS.addDamageHp(rows);

    boxes.forEach((box, i) => {
      const st = box.querySelector(".status");
      const sh = sheets[i];
      let used = "";
      if (sh.sets.length && rows.length) {
        const players = [...new Set(matches[i].map(([, p]) => p))];
        used = matches[i].length
          ? ` · used for ${players.join(", ")} in ${matches[i].length} game${matches[i].length === 1 ? "" : "s"}`
          : " · no loaded game has exactly this team";
      }
      st.textContent = sh.note + used;
      st.classList.toggle("bad", !!sh.bad);
    });
  }

  /** Luck score columns: need Showdown's move data (and the Pokedex for types); blank if they don't load. */
  async function applyLuck(errors) {
    let data = null;
    if (rows.length) {
      try {
        const [moves, dex] = await Promise.all([LK.loadMoves(), TS.loadDex()]);
        data = { moves, dex };
      } catch (e) {
        errors.push(`Move data (for the luck score): ${e.message || e}`);
      }
    }
    LK.addLuck(rows, data);
  }

  function flash(btn, text) {
    const old = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = old; }, 1800);
  }
})();
