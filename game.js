export const MAX_TIME = 18;

export const NODES = Object.freeze({
  temple: { name: "主壇", kind: "temple", x: 50, y: 88, icon: "◆" },
  gate: { name: "迎福門", kind: "gate", x: 27, y: 76, icon: "門" },
  market: { name: "香市", kind: "shop", x: 16, y: 57, icon: "店" },
  northShrine: { name: "北境小壇", kind: "shrine", x: 18, y: 25, icon: "祈" },
  residential: { name: "安居巷", kind: "residential", x: 39, y: 39, icon: "宅" },
  school: { name: "學堂口", kind: "rest", x: 48, y: 15, icon: "休" },
  eastShrine: { name: "東境小壇", kind: "shrine", x: 78, y: 23, icon: "祈" },
  bridge: { name: "彩橋", kind: "road", x: 67, y: 45, icon: "橋" },
  riverShrine: { name: "水岸小壇", kind: "shrine", x: 88, y: 56, icon: "祈" },
  supply: { name: "補給站", kind: "supply", x: 77, y: 75, icon: "給" },
  drumLane: { name: "鼓仔街", kind: "drums", x: 48, y: 59, icon: "鼓" },
  plaza: { name: "燈火埕", kind: "plaza", x: 55, y: 77, icon: "燈" },
});

export const EDGES = Object.freeze([
  { from: "temple", to: "gate", time: 1, stamina: 1 },
  { from: "temple", to: "plaza", time: 1, stamina: 1 },
  { from: "gate", to: "market", time: 2, stamina: 1 },
  { from: "gate", to: "drumLane", time: 2, stamina: 2 },
  { from: "market", to: "northShrine", time: 2, stamina: 2 },
  { from: "market", to: "residential", time: 1, stamina: 1 },
  { from: "market", to: "bridge", time: 2, stamina: 2, block: "traffic" },
  { from: "northShrine", to: "school", time: 2, stamina: 2 },
  { from: "northShrine", to: "residential", time: 2, stamina: 1 },
  { from: "residential", to: "school", time: 1, stamina: 1 },
  { from: "residential", to: "drumLane", time: 1, stamina: 1 },
  { from: "school", to: "eastShrine", time: 2, stamina: 2 },
  { from: "eastShrine", to: "bridge", time: 1, stamina: 1 },
  { from: "eastShrine", to: "plaza", time: 2, stamina: 1, block: "clash" },
  { from: "bridge", to: "riverShrine", time: 2, stamina: 2 },
  { from: "bridge", to: "drumLane", time: 1, stamina: 1 },
  { from: "riverShrine", to: "supply", time: 1, stamina: 1 },
  { from: "supply", to: "plaza", time: 1, stamina: 1 },
  { from: "drumLane", to: "plaza", time: 1, stamina: 1 },
]);

export const REQUIRED_SHRINES = Object.freeze([
  "northShrine",
  "eastShrine",
  "riverShrine",
]);

export const EVENT_WINDOWS = Object.freeze({
  traffic: { start: 3, end: 7, name: "廟口車潮" },
  clash: { start: 7, end: 11, name: "陣頭交會" },
  storm: { start: 11, end: 16, name: "午後驟雨" },
});

const BLOCK_MESSAGES = {
  traffic: "車潮堵住彩橋口",
  clash: "陣頭交會，燈火埕暫時封路",
};

export function activeEvents(time) {
  return Object.entries(EVENT_WINDOWS)
    .filter(([, window]) => time >= window.start && time < window.end)
    .map(([id]) => id);
}

function edgeBetween(from, to, shortcuts = []) {
  const edge = EDGES.find(
    (candidate) =>
      (candidate.from === from && candidate.to === to) ||
      (candidate.to === from && candidate.from === to),
  );
  if (edge) return edge;
  if (
    shortcuts.includes("riverside") &&
    ((from === "gate" && to === "supply") ||
      (from === "supply" && to === "gate"))
  ) {
    return { from, to, time: 1, stamina: 1, shortcut: true };
  }
  return null;
}

function cloneGame(game) {
  return {
    ...game,
    visitedShrines: [...game.visitedShrines],
    visitedStops: [...game.visitedStops],
    shortcuts: [...game.shortcuts],
    coordination: { ...game.coordination },
    log: [...game.log],
  };
}

export function createGame({ seed = Date.now() } = {}) {
  return {
    seed: Number(seed) >>> 0,
    position: "temple",
    time: 0,
    stamina: 10,
    maxStamina: 12,
    incense: 0,
    disturbance: 0,
    visitedShrines: [],
    visitedStops: ["temple"],
    shortcuts: [],
    coordination: { available: true, prepared: false },
    phase: "playing",
    log: ["隊伍從主壇整隊出發。"],
    lastAction: null,
  };
}

export function availableMoves(game) {
  const regular = EDGES.flatMap((edge) => {
    if (edge.from === game.position) return [{ ...edge, to: edge.to }];
    if (edge.to === game.position) return [{ ...edge, to: edge.from }];
    return [];
  });
  if (game.shortcuts.includes("riverside")) {
    if (game.position === "gate") {
      regular.push({
        from: "gate",
        to: "supply",
        time: 1,
        stamina: 1,
        shortcut: true,
      });
    } else if (game.position === "supply") {
      regular.push({
        from: "supply",
        to: "gate",
        time: 1,
        stamina: 1,
        shortcut: true,
      });
    }
  }
  const events = activeEvents(game.time);
  return regular.map((edge) => ({
    ...edge,
    blocked: Boolean(edge.block && events.includes(edge.block)),
    blockName: edge.block ? EVENT_WINDOWS[edge.block]?.name : null,
  }));
}

function applyStopEffect(game, stopId, firstVisit) {
  const stop = NODES[stopId];
  if (stop.kind === "shrine" && !game.visitedShrines.includes(stopId)) {
    game.visitedShrines.push(stopId);
    game.incense += 5;
    game.stamina = Math.min(game.maxStamina, game.stamina + 1);
    game.log.push(`${stop.name}參禮完成，香火 +5、體力 +1。`);
  } else if (stop.kind === "shop" && firstVisit) {
    game.incense += 2;
    game.log.push("香市居民添香，香火 +2。");
  } else if (stop.kind === "supply" && firstVisit) {
    game.stamina = Math.min(game.maxStamina, game.stamina + 3);
    game.shortcuts.push("riverside");
    game.log.push("補給站補水，體力 +3；河岸捷徑開通！");
  } else if (stop.kind === "rest" && firstVisit) {
    game.stamina = Math.min(game.maxStamina, game.stamina + 2);
    game.log.push("學堂口志工遞上茶水，體力 +2。");
  }

  if (stop.kind === "residential" && !firstVisit) {
    game.disturbance += 2;
    game.log.push("隊伍重繞安居巷，擾動 +2。");
  }
  if (stop.kind === "drums" && game.time >= 12) {
    game.disturbance += 3;
    game.log.push("入夜鼓聲驚擾街坊，擾動 +3。");
  }
}

export function move(game, destination) {
  if (game.phase !== "playing") throw new Error("本局已結束");
  const edge = edgeBetween(game.position, destination, game.shortcuts);
  if (!edge) throw new Error("目的地不是相鄰街口");

  const next = cloneGame(game);
  const events = activeEvents(next.time);
  const blocked = edge.block && events.includes(edge.block);
  if (blocked && !next.coordination.prepared) {
    throw new Error(BLOCK_MESSAGES[edge.block]);
  }
  if (blocked) {
    next.coordination.prepared = false;
    next.coordination.available = false;
    next.log.push(`協調隊引導通過「${EVENT_WINDOWS[edge.block].name}」。`);
  }

  const stormDelay =
    events.includes("storm") &&
    ["bridge", "riverShrine"].some(
      (id) => id === game.position || id === destination,
    )
      ? 1
      : 0;
  const timeCost = edge.time + stormDelay;
  if (next.stamina < edge.stamina) throw new Error("體力不足，請先歇腳");

  next.time += timeCost;
  next.stamina -= edge.stamina;
  next.position = destination;
  const firstVisit = !next.visitedStops.includes(destination);
  if (firstVisit) next.visitedStops.push(destination);
  next.log.push(
    `${NODES[game.position].name} → ${NODES[destination].name}（${timeCost} 刻、體力 -${edge.stamina}）${stormDelay ? "，驟雨慢行 +1 刻" : ""}`,
  );
  applyStopEffect(next, destination, firstVisit);
  next.lastAction = { type: "move", destination, timeCost };
  return next;
}

export function rest(game) {
  if (game.phase !== "playing") throw new Error("本局已結束");
  const next = cloneGame(game);
  next.time += 1;
  const recovery = NODES[next.position].kind === "rest" ? 4 : 3;
  next.stamina = Math.min(next.maxStamina, next.stamina + recovery);
  next.log.push(`在${NODES[next.position].name}歇腳，體力 +${recovery}。`);
  next.lastAction = { type: "rest", recovery };
  return next;
}

export function coordinate(game) {
  if (game.phase !== "playing") throw new Error("本局已結束");
  if (!game.coordination.available) throw new Error("協調隊本局已出動");
  if (game.coordination.prepared) throw new Error("協調隊已在前方待命");
  const next = cloneGame(game);
  next.time += 1;
  next.coordination.prepared = true;
  next.disturbance = Math.max(0, next.disturbance - 1);
  next.log.push("協調隊先行溝通；下一段封路可通過。");
  next.lastAction = { type: "coordinate" };
  return next;
}

export function calculateScore(game) {
  const missingShrines = REQUIRED_SHRINES.filter(
    (id) => !game.visitedShrines.includes(id),
  );
  const overtime = Math.max(0, game.time - MAX_TIME);
  const eligible =
    game.position === "temple" && missingShrines.length === 0 && overtime === 0;
  const incenseCounted =
    game.disturbance >= 6 ? Math.floor(game.incense / 2) : game.incense;
  const raw =
    incenseCounted +
    game.stamina -
    overtime * 3 -
    game.disturbance;
  return {
    eligible,
    missingShrines,
    overtime,
    incenseCounted,
    raw,
    score: eligible ? Math.max(0, raw) : 0,
  };
}

export function finishGame(game) {
  if (game.position !== "temple") throw new Error("必須先回到主壇才能收隊");
  const result = calculateScore(game);
  return {
    ...result,
    phase: "ended",
  };
}
