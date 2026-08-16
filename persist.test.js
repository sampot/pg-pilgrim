import { describe, expect, it, vi } from "vitest";
import {
  loadBest,
  loadRoutes,
  saveBest,
  saveRoute,
} from "./persist.js";

describe("Playgrounds KV persistence", () => {
  it("loads the best score from pilgrim:best", async () => {
    const fetcher = vi.fn(async () => new Response("27"));
    expect(await loadBest(fetcher)).toBe(27);
    expect(fetcher).toHaveBeenCalledWith("/api/kv/pilgrim:best");
  });

  it("only writes a genuinely higher best score", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 204 }));
    expect(await saveBest(24, 19, fetcher)).toBe(24);
    expect(fetcher).toHaveBeenCalledWith("/api/kv/pilgrim:best", {
      method: "PUT",
      body: "24",
    });
    fetcher.mockClear();
    expect(await saveBest(12, 24, fetcher)).toBe(24);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("loads and stores recent successful routes through pilgrim:routes", async () => {
    const routes = [{ score: 20, time: 17, path: ["主壇", "迎福門"] }];
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(routes)))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));

    expect(await loadRoutes(fetcher)).toEqual(routes);
    expect(fetcher).toHaveBeenNthCalledWith(1, "/api/kv/pilgrim:routes");
    expect(await saveRoute(routes[0], [], fetcher)).toEqual(routes);
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/kv/pilgrim:routes", {
      method: "PUT",
      body: JSON.stringify(routes),
    });
  });

  it("falls back safely when the host KV API is unavailable", async () => {
    const broken = vi.fn(async () => {
      throw new Error("offline");
    });
    expect(await loadBest(broken)).toBe(0);
    expect(await loadRoutes(broken)).toEqual([]);
    expect(await saveRoute({ score: 1 }, [], broken)).toEqual([{ score: 1 }]);
  });
});
