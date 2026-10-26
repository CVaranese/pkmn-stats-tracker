/* Page logic: read links, fetch replays, render tables, copy/download. Parsing lives in parser.js. */
(function () {
  "use strict";
  const RS = window.ReplayStats;
  const $ = (id) => document.getElementById(id);
  const STORAGE_KEY = "replay-kill-tracker.links";

  const cache = new Map();   // replay id -> replay json (for this page visit)
  let rows = [];             // game rows from the last run
  let view = "summary";
  let sort = { field: "kills", dir: -1 };

  const LABELS = {
    replay_id: "Replay", date: "Date", format: "Format", player: "Player", opponent: "Opponent",
    won: "Won", pokemon: "Pokémon", nickname: "Nickname", brought: "Brought", kills: "Kills",
    direct_kills: "Direct", passive_kills: "Passive", deaths: "Deaths", replay_url: "Link",
    games_brought: "Games", wins_when_brought: "Wins", kills_per_game: "Kills / game",
  };
  const NUMERIC = new Set(["won", "brought", "kills", "direct_kills", "passive_kills", "deaths",
    "games_brought", "wins_when_brought", "kills_per_game"]);
  const GAME_VIEW_FIELDS = ["date", "player", "opponent", "won", "pokemon", "nickname", "brought",
    "kills", "direct_kills", "passive_kills", "deaths", "replay_url"];

  // remember pasted links between visits (convenience only; the page works without it)
  try { $("links").value = localStorage.getItem(STORAGE_KEY) || ""; } catch (e) { /* storage blocked */ }
  $("links").addEventListener("input", () => {
    try { localStorage.setItem(STORAGE_KEY, $("links").value); } catch (e) { /* storage blocked */ }
  });

  $("run").addEventListener("click", run);
  $("clear").addEventListener("click", () => {
    $("links").value = "";
    $("links").dispatchEvent(new Event("input"));
    rows = [];
    $("results").hidden = true;
    $("errors").hidden = true;
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

  // ?r=id1,id2 opens with those replays filled in and loaded (shareable leaderboard link)
  const shared = RS.replayIdsFromText(new URLSearchParams(location.search).get("r") || "");
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
    const ok = results.filter(Boolean).length;
    $("status").textContent = `Loaded ${ok} replay${ok === 1 ? "" : "s"}` +
      (errors.length ? `, ${errors.length} failed.` : ".");
    $("errors").hidden = !errors.length;
    $("errors").replaceChildren(...errors.map((t) => Object.assign(document.createElement("li"), { textContent: t })));
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
      fields = RS.SUMMARY_FIELDS.filter((f) => byPlayer || f !== "player");
    } else {
      data = filtered.slice();
      fields = GAME_VIEW_FIELDS;
    }
    const { field, dir } = sort;
    if (fields.includes(field)) {
      data.sort((a, b) => {
        const x = a[field], y = b[field];
        const c = NUMERIC.has(field) ? x - y : String(x).localeCompare(String(y));
        return c * dir;
      });
    }
    return { fields, data };
  }

  function render() {
    for (const tab of document.querySelectorAll(".tabs button")) {
      tab.setAttribute("aria-selected", String(tab.dataset.view === view));
    }
    $("group-wrap").hidden = view !== "summary";
    const { fields, data } = currentTable();

    const thead = document.createElement("thead");
    const hr = thead.insertRow();
    for (const f of fields) {
      const th = document.createElement("th");
      th.textContent = LABELS[f] || f;
      th.scope = "col";
      if (NUMERIC.has(f)) th.className = "num";
      if (sort.field === f) th.setAttribute("aria-sort", sort.dir < 0 ? "descending" : "ascending");
      th.addEventListener("click", () => {
        sort = sort.field === f ? { field: f, dir: -sort.dir } : { field: f, dir: NUMERIC.has(f) ? -1 : 1 };
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
        if (NUMERIC.has(f)) td.className = "num";
        if (f === "replay_url") {
          const a = document.createElement("a");
          a.href = r[f];
          a.textContent = r.replay_id;
          a.target = "_blank";
          a.rel = "noopener";
          td.appendChild(a);
        } else if (f === "won" || f === "brought") {
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
    const url = location.origin + location.pathname + "?r=" + ids.join(",");
    try {
      await navigator.clipboard.writeText(url);
      flash($("share"), "Link copied");
    } catch (e) {
      flash($("share"), "Copy failed");
    }
  }

  function flash(btn, text) {
    const old = btn.textContent;
    btn.textContent = text;
    setTimeout(() => { btn.textContent = old; }, 1800);
  }
})();
