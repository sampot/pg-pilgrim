/** Optional Playgrounds functions entry; game KV uses the host /api/kv API. */
export default {
  async fetch(request) {
    return Response.json({
      ok: true,
      name: "pg-pilgrim",
      path: new URL(request.url).pathname,
    });
  },
};
