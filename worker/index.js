import { handleAssistant, handleTranscribe, handleVoice } from "../server/logic.mjs";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/api/assistant") return handleAssistant(request, env);
    if (url.pathname === "/api/voice") return handleVoice(request, env);
    if (url.pathname === "/api/transcribe") return handleTranscribe(request, env);
    return new Response("No encontrado.", { status: 404 });
  },
};
