/* Main viewer and Playoffs: load the games (run), team cards, the results table, copy / download / share. */
"use strict";

let watchId = "";
function updateWatch() {
  const id = mode === "one" && rows.length ? rows[0].replay_id : "";
  $("watch").hidden = !id;
  if (id !== watchId) {
    watchId = id;
    $("watch").open = false;
    $("watch-frame").hidden = true;
    $("watch-frame").removeAttribute("src");
  }
}
// hide the links / sheets box (cleaner screenshots); the results stay
function setCollapsed(on) {
  $("inputs").hidden = on;
  $("collapse").textContent = on ? "Show links and sheets" : "Hide links and sheets";
  $("collapse").setAttribute("aria-expanded", String(!on));
}
// each run gets a number: a newer run, a tab change or Clear makes an older one stop at its next await, so a slow
// game can't replace the one picked after it or show its results on another tab
let runSeq = 0;
function cancelRun() {
  runSeq++;
  $("run").disabled = false;
}
async function run(again) {
  const my = ++runSeq;
  const stale = () => my !== runSeq;
  await libraryReady;  // stored games load from site/games/, not Showdown
  if (stale()) return;
  // a new game typed or pasted in gets its own history entry (again: the same games counted again, after a Zoroark pick)
  if (mode === "one" && again !== true) pushNav();
  const ids = activeIds();
  const errors = [];
  if (!ids.length) {
    $("status").textContent = "No replay links found.";
    return;
  }
  $("run").disabled = true;
  try {
    let done = 0;
    const status = () => { if (!stale()) $("status").textContent = `Loading ${done} of ${ids.length}…`; };
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
    if (stale()) return;
    if (down) {
      errors.unshift(`Pokémon Showdown isn't responding, so ${notTried} replay${notTried === 1 ? " wasn't" : "s weren't"} loaded: ` +
        `${down.message}.`);
    }

    const rs = [];  // this run's rows; they replace the shown ones only if no newer run started meanwhile
    await Promise.all(results.map((r) => prepareIllusion(r).catch((e) => {
      delete r.zoroarks;  // try again on the next run
      errors.push(`${r.id}: the hidden Zoroark check failed (${e.message || e}), so whatever it did is counted on the Pokémon it copied.`);
    })));
    for (const r of results) if (r && r.illusionNote) errors.push(`${r.id}: ${r.illusionNote}.`);
    for (const replay of results) {
      if (!replay) continue;
      try {
        rs.push(...RS.gameRows(replay));
      } catch (e) {
        errors.push(`${replay.id}: could not read the battle log (${e.message || e})`);
      }
    }
    await loadDraft();  // before the sheets: draft aliases (DEJIME17 -> DEJIME) for the player's other sheets
    await addMockSheets(ids);
    await applySheets(rs, errors);
    await applyLuck(rs, errors);
    if (stale()) return;
    megaNames(rs);
    rows = rs;
    const ok = results.filter(Boolean).length;
    $("status").textContent = `Loaded ${ok} replay${ok === 1 ? "" : "s"}` +
      (ids.length > ok ? `, ${ids.length - ok} failed.` : ".");
    $("errors").hidden = !errors.length;
    $("errors").replaceChildren(...errors.map((t) => Object.assign(document.createElement("li"), { textContent: t })));
    renderZoroarks(results);

    const players = [...new Set(rows.map((r) => r.player))].sort((a, b) => a.localeCompare(b));
    const current = $("player").value;
    $("player").replaceChildren(new Option("All players", ""), ...players.map((p) => new Option(p, p)));
    if (players.includes(current)) $("player").value = current;

    $("results").hidden = !rows.length;
    renderTeams();
    updateWatch();
    render();
  } finally {
    if (!stale()) $("run").disabled = false;
  }
}
/** A team card stat for some rows' % fields, in HP or % (League.amount); its tooltip explains that unit. */
function amountStat(label, rs, pctFields) {
  const a = amount(rs, pctFields);
  return stat(label, a.text, a.hp ? PCT_TO_HP[pctFields[0]] : pctFields[0]);
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
  // a stream video's lines the screen reading got wrong (index.json known_errors), so numbers off by them are explained
  const lib = library.find((x) => x.id === g.replay_id);
  const errs = lib && lib.known_errors ? el("p", "hint", "Rebuilt from the stream video, with errors: " + lib.known_errors) : "";
  box.replaceChildren(el("h2", "section-title", "This game"), head, errs, videoButtons(g.replay_id), el("div", "team-grid"));
  box.lastChild.append(...cards);
}
// short league name for video titles, e.g. "PPPPP Week 6 Big Large Vs Nezergy" (PeterPikmon's videos)
const LEAGUE_TAGS = { pinecord: "PPPPP" };
/** Copy buttons for the league's videos: a YouTube title, and the names + MVPs for the thumbnail. */
function videoButtons(id) {
  const g = library.find((x) => x.id === id);
  // the library's player order when it's a stored game, else the order the replay lists them
  const players = g ? g.players : [...new Set(rows.map((r) => r.player))];
  const copyBtn = (label, title, text) => {
    const b = Object.assign(el("button", "small", label), { type: "button", title });
    b.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(text());
        flash(b, "Copied!");
      } catch {
        flash(b, "Copy failed");
      }
    });
    return b;
  };
  const title = () => [g && LEAGUE_TAGS[g.league], g && g.week, players.join(" Vs ")].filter(Boolean).join(" ");
  const thumb = () => [players.join(" vs "), ...players.map((p) => {
    const mvp = rows.find((r) => r.player === p && r.mvp);
    return `${p} MVP: ${mvp ? mvp.pokemon : "none"}`;
  })].join("\n");
  const bar = el("div", "row video-copy");
  bar.append(copyBtn("Copy YouTube title", "Copies a video title: league, week, players", title),
    copyBtn("Copy thumbnail info", "Copies the player names and each team's MVP, one per line", thumb));
  return bar;
}
function megaZ(r) {
  if (r.mega) return `Mega Evolved on turn ${r.mega_turn}`;
  if (r.z_move) return `Used ${r.z_move} (Z-move) on turn ${r.z_turn}`;
  return "";
}
function teamCard(player, rs) {
  const brought = rs.filter((r) => r.brought);
  const card = el("article", "team-card");
  card.classList.toggle("simple", !detailed);
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
    syncDetail(card);
  };
  for (const r of rs) {
    const s = sprite(r.pokemon, ["gen5/"], "small");
    const status = !r.brought ? "not brought" : r.deaths ? "fainted" : "survived";
    const label = (r.nickname && r.nickname !== r.pokemon ? `${r.nickname} (${r.pokemon})` : r.pokemon) + ": " + status +
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
    amountStat("Dealt", brought, ["damage_dealt_pct"]),
    amountStat("Healed", brought, ["healing_pct", "healing_given_pct"]),
    stat("Hazards set", sum(brought, "hazards_set"), "hazards_set"),
    stat("Switches", sum(brought, "switches") + sum(brought, "pivots"), "switches"),
    stat("Crits", sum(brought, "crits"), "crits"));
  const luck = el("div", "team-luck");
  luck.append(el("span", "stat-label", "Team luck"), luckBadge(rs[0].player_luck, "player", rs[0].player_luck_top));
  team.append(el("h4", "", "Team"), nums, luck);
  card.appendChild(team);
  return card;
}
/** The selected Pokémon: sprite, name, Performance, its stats, Mega / Z-move. */
function monDetail(r) {
  // every line is always there (blank when it doesn't apply), so switching Pokémon doesn't change the height
  const who = el("div", "mon-who");
  who.appendChild(el("span", "mvp-tag", r.mvp ? "Team MVP" : "\u00a0"));
  // nickname as the name and the species under it; species alone when there's no nickname
  const nick = r.nickname && r.nickname !== r.pokemon;
  who.appendChild(el("span", "mon-name", nick ? r.nickname : r.pokemon));
  who.appendChild(el("span", "mon-nick", nick ? r.pokemon : "\u00a0"));
  const perf = el("span", "mon-perf", `Performance ${r.mvp_score}`);
  perf.title = DESCRIPTIONS.mvp_score;
  who.appendChild(perf);
  const best = bestMove(r);
  who.appendChild(el("span", "mon-best", best ? `Best move: ${best.move}` +
    (best.kos ? `, ${best.kos} KO${best.kos > 1 ? "s" : ""}` : "") : " "));
  const grid = el("div", "stats");
  // .adv: only in the detailed view (see toggleDetail)
  const adv = (node) => { node.classList.add("adv"); return node; };
  grid.append(
    stat("Kills", r.kills + (r.passive_kills ? ` (${r.passive_kills} passive)` : ""), "kills"),
    amountStat("Dealt", [r], ["damage_dealt_pct"]),
    amountStat("Taken", [r], ["damage_taken_pct"]),
    stat("Survived", r.survived ? "yes" : "no", "survived"),
    adv(stat("Turns on field", r.turns_on_field, "turns_on_field")),
    adv(amountStat("Healed", [r], ["healing_pct", "healing_given_pct"])));
  const luck = el("div", "mon-luck adv");
  luck.append(el("span", "stat-label", "Luck"), luckBadge(r.luck, "pokemon", r.luck_top));
  const mark = el("p", "mon-mark");
  const mz = megaZ(r);
  if (mz) mark.appendChild(el("span", "mark " + (r.mega ? "mega" : "z"), mz)); else mark.textContent = "\u00a0";
  const more = Object.assign(el("button", "small detail-toggle"), { type: "button" });
  more.addEventListener("click", () => toggleDetail(more.closest(".team-card")));
  return [sprite(r.pokemon, ["ani/", "dex/", "gen5/"], "big"), who, mark, grid, adv(moveList(r, best)), luck, more];
}
// simple view (name, best move, kills, damage, survived) or detailed (+ turns, healing, damage sources, luck);
// per team card (opening one doesn't shift the other); the last choice is remembered as the default for new games
const DETAIL_KEY = "replay-kill-tracker.detailed";
let detailed = false;
function toggleDetail(card) {
  detailed = card.classList.contains("simple");
  try { localStorage.setItem(DETAIL_KEY, detailed ? "1" : "0"); } catch (e) { /* storage blocked */ }
  card.classList.toggle("simple", !detailed);
  syncDetail(card);
}
function syncDetail(card) {
  const on = !card.classList.contains("simple");
  for (const b of card.querySelectorAll(".detail-toggle")) {
    b.textContent = on ? "Less detail" : "More detail";
    b.setAttribute("aria-pressed", String(on));
  }
}
/**
 * Its moves, one line each: name and times used, a bar for its share of the damage (longest = the move that
 * did the most), damage, KOs. With a team sheet, the sheet moves it never used are listed greyed out.
 */
function moveList(r, best) {
  const key = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, "");
  const all = r.move_stats || [];
  const ms = all.filter((m) => m.move && !m.source);
  const sources = all.filter((m) => m.source && (m.dealt_pct > 0 || m.kos > 0));
  const other = all.find((m) => !m.move && (m.dealt_pct > 0 || m.kos > 0));
  const unused = r.set ? r.set.moves.filter((n) => !ms.some((m) => key(m.move) === key(n))) : [];
  const total = all.reduce((t, m) => t + m.dealt_pct, 0);
  const box = el("div", "move-list");
  const h = el("h4", "", "Moves and damage sources");
  h.title = "Each bar is that line's share of all the damage this Pokémon did.";
  box.appendChild(h);
  const line = (m, name, cls, title) => {
    const row = el("div", "move-row " + cls);
    const who = el("span", "move-name", name);
    if (m && m.z) who.append(" ", el("span", "mark z", "Z"));
    if (m && m.uses) who.append(" ", el("span", "move-uses", "×" + m.uses));
    if (title) who.title = title;
    const bar = el("span", "move-bar");
    const fill = el("span", "");
    const share = m && total ? (100 * m.dealt_pct) / total : 0;
    fill.style.width = share + "%";
    if (m && total) bar.title = `${Math.round(share)}% of its damage`;
    bar.appendChild(fill);
    const dealt = el("span", "move-num", m && m.dealt_pct ? moveDealt(m) : m ? "–" : "not used");
    const kos = el("span", "move-num", m && m.kos ? `${m.kos} KO${m.kos > 1 ? "s" : ""}` : "");
    row.append(who, bar, dealt, kos);
    box.appendChild(row);
  };
  for (const m of ms) line(m, m.move, m === best ? "best" : "");
  for (const m of sources) line(m, m.move, "other");
  if (other) line(other, "Other", "other", "Damage or a KO credited to it with no move or effect named in the log.");
  for (const n of unused) line(null, n, "unused"); // sheet moves it never used: last
  if (!ms.length && !unused.length && !sources.length && !other) box.appendChild(el("p", "move-none", "It didn't use a move."));
  return box;
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
    fields = rows.some((r) => r.max_hp) ? base.flatMap((f) => [f, ...(HP_AFTER[f] || [])]).concat(SHEET_FIELDS) : base;
  } else if (view === "summary") {
    const byPlayer = $("group").value === "player";
    data = RS.summarize(filtered, byPlayer);
    const anySheet = rows.some((r) => r.max_hp);
    fields = RS.SUMMARY_FIELDS.filter((f) => (byPlayer || f !== "player") && (anySheet || !RS.HP_FIELDS.includes(f)));
  } else {
    data = filtered.slice();
    // with sheets: HP columns next to the % ones, set details at the end
    fields = rows.some((r) => r.max_hp) ? GAME_VIEW_FIELDS.flatMap((f) =>
      [f, ...(HP_AFTER[f] || [])]).concat(SHEET_FIELDS) : GAME_VIEW_FIELDS;
  }
  // Dealt % / Taken % go when every row shown has the HP figure (sheets for both teams); kept when any is blank
  fields = fields.filter((f) => !(PCT_TO_HP[f] && fields.includes(PCT_TO_HP[f]) && data.length &&
    data.every((r) => r.brought === 0 || typeof r[PCT_TO_HP[f]] === "number")));
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
    markCurrent(tab, tab.dataset.view === view);
  }
  $("group-wrap").hidden = mode === "one" || view !== "summary";
  document.querySelector(".toolbar .tabs").hidden = mode === "one";
  const { fields, data, numeric } = currentTable();

  const thead = document.createElement("thead");
  const hr = thead.insertRow();
  for (const f of fields) {
    const th = document.createElement("th");
    th.textContent = LABELS[f] || f;
    cellButton(th);
    if (DESCRIPTIONS[f]) th.title = DESCRIPTIONS[f];
    th.scope = "col";
    if (numeric.has(f)) th.className = "num";
    if (sort.field === f) th.setAttribute("aria-sort", sort.dir < 0 ? "descending" : "ascending");
    th.addEventListener("click", () => {
      if (TOUCH && th.title && tipKey !== "th:" + f) { showTip(th, th.title + " Tap again to sort.", "th:" + f); return; }
      hideTip();
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
        const guess = (r.hp_est && r.hp_est[f]) || (f === "max_hp" && r.max_hp && r.max_hp_from !== "sheet");
        td.textContent = (guess ? "~" : "") + r[f];
        if (f === "max_hp" && r.max_hp_note) td.title = r.max_hp_note;
        else if (guess) td.title = "Uses a guessed max HP (no team sheet).";
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
/** Luck score columns: need Showdown's move data (and the Pokedex for types); blank if they don't load. */
async function applyLuck(rows, errors) {
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
