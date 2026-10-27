/* Page logic: read links, fetch replays, render tables, copy/download. Parsing lives in parser.js. */
(function () {
  "use strict";
  const RS = window.ReplayStats;
  const TS = window.TeamSheets;
  const LK = window.Luck;
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "replay-kill-tracker.links";
  const SHEETS_KEY = "replay-kill-tracker.sheets";

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
    mvp_score: "MVP score", mvp: "Team MVP", mvps: "MVPs", mvp_score_per_game: "MVP score / game",
  };
  const YES_NO = new Set(["won", "brought", "hidden_zoroark", "mvp"]);
  const GAME_VIEW_FIELDS = RS.GAME_FIELDS.filter((f) => f !== "replay_id" && f !== "format");
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
  $("clear").addEventListener("click", () => {
    $("links").value = "";
    $("links").dispatchEvent(new Event("input"));
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
  const shared = RS.replayIdsFromText(params.get("r") || "");
  if (shared.length) {
    $("links").value = shared.map((id) => RS.REPLAY_HOST + id).join("\n");
    run();
  }

  async function run() {
    const ids = RS.replayIdsFromText($("links").value);
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
    async function worker() {
      while (next < ids.length) {
        const i = next++;
        const id = ids[i];
        try {
          if (!cache.has(id)) cache.set(id, await RS.fetchReplay(id));
          results[i] = cache.get(id);
        } catch (e) {
          errors.push(`${id}: ${e.message || e}`);
        }
        done++;
        status();
      }
    }
    await Promise.all([worker(), worker(), worker(), worker()]);

    rows = [];
    for (const replay of results) {
      if (!replay) continue;
      try {
        rows.push(...RS.gameRows(replay));
      } catch (e) {
        errors.push(`${replay.id}: could not read the battle log (${e.message || e})`);
      }
    }
    await applySheets(errors);
    await applyLuck(errors);
    const ok = results.filter(Boolean).length;
    $("status").textContent = `Loaded ${ok} replay${ok === 1 ? "" : "s"}` +
      (errors.length ? `, ${errors.length} failed.` : ".");
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
    render();
  }

  /** The rows and columns currently shown (also what copy/download export). */
  function currentTable() {
    const player = $("player").value;
    const filtered = player ? rows.filter((r) => r.player === player) : rows;
    let fields, data;
    if (view === "summary") {
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
    $("group-wrap").hidden = view !== "summary";
    const { fields, data, numeric } = currentTable();

    const thead = document.createElement("thead");
    const hr = thead.insertRow();
    for (const f of fields) {
      const th = document.createElement("th");
      th.textContent = LABELS[f] || f;
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
    const ids = RS.replayIdsFromText($("links").value);
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
