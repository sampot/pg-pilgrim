import { describe, expect, it } from "vitest";
import {
  EDGES,
  EVENT_WINDOWS,
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

describe("pilgrimage route rules", () => {
  it("builds a connected twelve-node street graph from the main temple", () => {
    expect(Object.keys(NODES)).toHaveLength(12);
    expect(NODES.temple.kind).toBe("temple");
    expect(EDGES.every((edge) => NODES[edge.from] && NODES[edge.to])).toBe(true);

    const reached = new Set(["temple"]);
    while (true) {
      const next = EDGES.find(
        ({ from, to }) => reached.has(from) !== reached.has(to),
      );
      if (!next) break;
      reached.add(reached.has(next.from) ? next.to : next.from);
    }
    expect(reached.size).toBe(12);
  });

  it("only offers adjacent streets from the current stop", () => {
    const game = createGame();
    expect(availableMoves(game).map((choice) => choice.to).sort()).toEqual([
      "gate",
      "plaza",
    ]);
    expect(() => move(game, "riverShrine")).toThrow(/相鄰/);
  });

  it("activates traffic, parade clash, and storm in their time windows", () => {
    expect(activeEvents(2)).toEqual([]);
    expect(activeEvents(EVENT_WINDOWS.traffic.start)).toContain("traffic");
    expect(activeEvents(EVENT_WINDOWS.clash.start)).toContain("clash");
    expect(activeEvents(EVENT_WINDOWS.storm.start)).toContain("storm");
    expect(activeEvents(18)).toEqual([]);
  });

  it("blocks event roads unless one-time coordination is prepared", () => {
    const game = createGame();
    game.position = "market";
    game.time = 4;
    expect(() => move(game, "bridge")).toThrow(/車潮/);

    const prepared = coordinate(game);
    const passed = move(prepared, "bridge");
    expect(passed.position).toBe("bridge");
    expect(passed.coordination.available).toBe(false);
    expect(passed.coordination.prepared).toBe(false);
  });

  it("visiting all three designated shrines is required", () => {
    const game = createGame();
    expect(REQUIRED_SHRINES).toHaveLength(3);
    expect(finishGame(game).eligible).toBe(false);

    game.visitedShrines = [...REQUIRED_SHRINES];
    const result = finishGame(game);
    expect(result.eligible).toBe(true);
    expect(result.missingShrines).toEqual([]);
  });

  it("cannot finish away from the main temple", () => {
    const game = createGame();
    game.position = "gate";
    game.visitedShrines = [...REQUIRED_SHRINES];
    expect(() => finishGame(game)).toThrow(/主壇/);
  });

  it("marks a return after slot eighteen as overtime and ineligible", () => {
    const game = createGame();
    game.time = 19;
    game.visitedShrines = [...REQUIRED_SHRINES];
    const result = finishGame(game);
    expect(result.overtime).toBe(1);
    expect(result.eligible).toBe(false);
    expect(result.score).toBe(0);
  });

  it("scores incense and stamina minus disturbance for an eligible return", () => {
    const game = createGame();
    Object.assign(game, {
      incense: 18,
      stamina: 6,
      disturbance: 3,
      visitedShrines: [...REQUIRED_SHRINES],
    });
    expect(calculateScore(game)).toMatchObject({
      eligible: true,
      incenseCounted: 18,
      score: 21,
    });
  });

  it("high disturbance cuts counted incense before penalties", () => {
    const game = createGame();
    Object.assign(game, {
      incense: 18,
      stamina: 5,
      disturbance: 7,
      visitedShrines: [...REQUIRED_SHRINES],
    });
    expect(calculateScore(game)).toMatchObject({
      incenseCounted: 9,
      score: 7,
    });
  });

  it("rest restores stamina while spending a slot", () => {
    const game = createGame();
    game.stamina = 3;
    const rested = rest(game);
    expect(rested.time).toBe(1);
    expect(rested.stamina).toBe(6);
    expect(rested.log.at(-1)).toMatch(/歇腳/);
  });

  it("street movement spends time and stamina and records shrine visits", () => {
    let game = createGame();
    game = move(game, "gate");
    game = move(game, "market");
    game = move(game, "northShrine");
    expect(game.time).toBeGreaterThan(0);
    expect(game.stamina).toBeLessThan(10);
    expect(game.visitedShrines).toContain("northShrine");
    expect(game.incense).toBeGreaterThan(0);
  });

  it("has a complete three-shrine route that returns within eighteen slots", () => {
    let game = createGame();
    for (const stop of [
      "gate",
      "market",
      "northShrine",
      "school",
      "eastShrine",
      "bridge",
      "riverShrine",
      "supply",
      "gate",
      "temple",
    ]) {
      game = move(game, stop);
    }

    const result = finishGame(game);
    expect(game.time).toBeLessThanOrEqual(18);
    expect(game.visitedShrines.sort()).toEqual([...REQUIRED_SHRINES].sort());
    expect(result.eligible).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });
});
