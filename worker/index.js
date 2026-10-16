import { handleAssistant } from "../server/logic.mjs";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== "/api/assistant") {
      return new Response("No encontrado.", { status: 404 });
    }
    return handleAssistant(request, env);
  },
};
