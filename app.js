import { PilgrimAudio } from "./audio.js";
import {
  EDGES,
  EVENT_WINDOWS,
  MAX_TIME,
  NODES,
  REQUIRED_SHRINES,
  activeEvents,
  availableMoves,
  calculateScore,
  coordinate,
  createGame,
  finishGame,
  move,
  rest,
} from "./game.js";
import { loadBest, loadRoutes, saveBest, saveRoute } from "./persist.js";

const $ = (selector) => document.querySelector(selector);
const audio = new PilgrimAudio();
const nodeImages = {
  temple: "shrine.png",
  gate: "gate.png",
  shrine: "shrine.png",
  residential: "house.png",
};
const eventDetails = {
  traffic: ["車潮湧現", "香市往彩橋封路；可派協調隊開道。"],
  clash: ["陣頭交會", "東境小壇往燈火埕封路；可協調通行。"],
  storm: ["午後驟雨", "彩橋、水岸路段多花 1 刻。"],
};

let game = null;
let best = 0;
let routes = [];
let routePath = [];

function shrineProgress() {
  return REQUIRED_SHRINES.map((id) =>
    game.visitedShrines.includes(id) ? "●" : "○",
  ).join("");
}

function renderHud() {
  const overtime = Math.max(0, game.time - MAX_TIME);
  $("#time-value").textContent = overtime
    ? `${game.time}（逾時 ${overtime}）`
    : `${game.time} / ${MAX_TIME}`;
  $("#stamina-value").textContent = `${game.stamina} / ${game.maxStamina}`;
  $("#incense-value").textContent = String(game.incense);
  $("#disturbance-value").textContent = String(game.disturbance);
  $("#shrine-value").textContent = shrineProgress();
  $("#time-fill").style.width = `${Math.min(100, (game.time / MAX_TIME) * 100)}%`;
  $("#time-fill").classList.toggle("overtime", overtime > 0);
}

function edgeIsBlocked(edge) {
  return Boolean(edge.block && activeEvents(game.time).includes(edge.block));
}

function renderBoard() {
  const choices = availableMoves(game);
  const byDestination = new Map(choices.map((choice) => [choice.to, choice]));
  $("#street-lines").innerHTML = EDGES.map((edge) => {
    const from = NODES[edge.from];
    const to = NODES[edge.to];
    return `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}" class="${edgeIsBlocked(edge) ? "blocked" : ""}" />`;
  }).join("");
  $("#shortcut-line").hidden = !game.shortcuts.includes("riverside");

  $("#map-nodes").innerHTML = Object.entries(NODES)
    .map(([id, node]) => {
      const choice = byDestination.get(id);
      const current = game.position === id;
      const visited = game.visitedStops.includes(id);
      const shrineDone = game.visitedShrines.includes(id);
      const image = nodeImages[node.kind];
      const cost = choice
        ? `<small>${choice.time}刻 · ${choice.stamina}力</small>`
        : "";
      const state = [
        current ? "current" : "",
        visited ? "visited" : "",
        shrineDone ? "complete" : "",
        choice?.blocked ? "road-blocked" : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `
        <button class="map-node ${state}" data-node="${id}" type="button"
          style="--x:${node.x}%;--y:${node.y}%"
          ${choice || current ? "" : "disabled"}
          aria-label="${node.name}${current ? "，目前位置" : choice ? `，前往需 ${choice.time} 刻` : ""}">
          <span class="node-token">${image ? `<img src="./assets/images/${image}" alt="" />` : node.icon}</span>
          <strong>${node.name}</strong>
          ${current ? "<small>隊伍在此</small>" : cost}
        </button>
      `;
    })
    .join("");

  document.querySelectorAll("[data-node]").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.dataset.node === game.position) return;
      act(() => move(game, button.dataset.node), "move");
    });
  });
  $("#procession").style.setProperty("--x", `${NODES[game.position].x}%`);
  $("#procession").style.setProperty("--y", `${NODES[game.position].y}%`);
}

function renderEvents() {
  const events = activeEvents(game.time);
  const container = $("#event-strip");
  if (!events.length) {
    container.innerHTML =
      '<div class="event calm"><span>✦</span><div><strong>街路順暢</strong><small>把握時辰前往三座小壇。</small></div></div>';
  } else {
    container.innerHTML = events
      .map(
        (id) => `
          <div class="event ${id}">
            <span>${id === "storm" ? "☂" : id === "traffic" ? "車" : "陣"}</span>
            <div><strong>${eventDetails[id][0]}</strong><small>${eventDetails[id][1]}</small></div>
          </div>`,
      )
      .join("");
  }
  $("#board").classList.toggle("storming", events.includes("storm"));
}

function renderActions() {
  const canFinish = game.position === "temple" && routePath.length > 1;
  $("#rest-button").disabled = game.stamina >= game.maxStamina;
  $("#coordinate-button").disabled =
    !game.coordination.available || game.coordination.prepared;
  $("#coordinate-button").textContent = game.coordination.prepared
    ? "協調隊待命中"
    : game.coordination.available
      ? "派協調隊 · 1 刻"
      : "協調已用過";
  $("#finish-button").hidden = !canFinish;
  $("#location-line").innerHTML =
    `現在在 <strong>${NODES[game.position].name}</strong> · ` +
    `${game.visitedShrines.length}/3 小壇完成`;
}

function renderLog() {
  $("#route-log").innerHTML = game.log
    .slice(-5)
    .reverse()
    .map((line, index) => `<li class="${index === 0 ? "latest" : ""}">${line}</li>`)
    .join("");
}

function render() {
  renderHud();
  renderBoard();
  renderEvents();
  renderActions();
  renderLog();
  $("#message").textContent = "";
}

function act(makeNext, type) {
  const previousEvents = activeEvents(game.time).join(",");
  try {
    const oldPosition = game.position;
    game = makeNext();
    if (type === "move" && oldPosition !== game.position) {
      routePath.push(game.position);
    }
    audio.play(
      previousEvents !== activeEvents(game.time).join(",") ? "event" : "click",
    );
    render();
  } catch (error) {
    $("#message").textContent = error.message;
    audio.play("event");
  }
}

function routeCard(route) {
  return `<li><strong>${route.score} 分</strong><span>${route.time} 刻 · ${route.disturbance} 擾動</span><small>${route.path.join(" → ")}</small></li>`;
}

function renderLobbyRecords() {
  $("#best-score").textContent = `${best} 分`;
  $("#route-records").innerHTML = routes.length
    ? routes.map(routeCard).join("")
    : "<li class='empty'>尚無完成紀錄，等你帶隊開路。</li>";
}

function openResult(result) {
  const missingNames = result.missingShrines.map((id) => NODES[id].name);
  $("#result-title").textContent = result.eligible
    ? result.score >= 20
      ? "香路圓滿，大成功！"
      : "平安回壇！"
    : result.overtime
      ? "回壇了，但錯過時辰"
      : "還有小壇未巡";
  $("#result-body").innerHTML = result.eligible
    ? `
      <p>三境參禮完成，隊伍在第 <strong>${game.time}</strong> 刻回到主壇。</p>
      <div class="score-total">${result.score}<small>本局得分</small></div>
      <dl class="score-breakdown">
        <div><dt>計入香火</dt><dd>+${result.incenseCounted}</dd></div>
        <div><dt>剩餘體力</dt><dd>+${game.stamina}</dd></div>
        <div><dt>街坊擾動</dt><dd>−${game.disturbance}</dd></div>
      </dl>
      ${game.disturbance >= 6 ? "<p class='warning'>擾動過高，香火只計一半。</p>" : ""}
    `
    : `
      <p>${result.overtime ? `超過 18 刻 ${result.overtime} 刻。` : `尚缺：${missingNames.join("、")}。`}</p>
      <div class="score-total failed">0<small>未符合計分資格</small></div>
      <p>只有完成三座指定小壇、並在 18 刻內回到主壇才計分。</p>
    `;
  $("#result-sheet").hidden = false;
  $("#result-close").focus();
}

async function finish() {
  try {
    const result = finishGame(game);
    game.phase = "ended";
    if (result.eligible) {
      best = await saveBest(result.score, best);
      const record = {
        score: result.score,
        time: game.time,
        disturbance: game.disturbance,
        path: routePath.map((id) => NODES[id].name),
      };
      routes = await saveRoute(record, routes);
    }
    renderLobbyRecords();
    audio.play(result.eligible ? "chime" : "event");
    openResult(result);
  } catch (error) {
    $("#message").textContent = error.message;
  }
}

$("#start-button").addEventListener("click", () => {
  void audio.start();
  game = createGame();
  routePath = ["temple"];
  globalThis.__pilgrim = { getGame: () => game, calculateScore };
  $("#lobby").hidden = true;
  $("#game").hidden = false;
  render();
  $("#board").focus();
});

$("#rest-button").addEventListener("click", () => act(() => rest(game), "rest"));
$("#coordinate-button").addEventListener("click", () =>
  act(() => coordinate(game), "coordinate"),
);
$("#finish-button").addEventListener("click", finish);

$("#result-close").addEventListener("click", () => {
  $("#result-sheet").hidden = true;
  $("#game").hidden = true;
  $("#lobby").hidden = false;
  game = null;
  renderLobbyRecords();
  $("#start-button").focus();
});

$("#how-button").addEventListener("click", () => {
  $("#about-sheet").hidden = false;
  $("#about-close").focus();
  audio.play("click");
});

$("#about-close").addEventListener("click", () => {
  $("#about-sheet").hidden = true;
  $("#how-button").focus();
  audio.play("click");
});

$("#sound-toggle").addEventListener("click", () => {
  audio.setEnabled(!audio.enabled);
  $("#sound-toggle").textContent = audio.enabled ? "♪ 聲音開" : "♩ 聲音關";
  $("#sound-toggle").setAttribute("aria-pressed", String(audio.enabled));
  if (audio.enabled) audio.play("click");
});

[best, routes] = await Promise.all([loadBest(), loadRoutes()]);
renderLobbyRecords();
