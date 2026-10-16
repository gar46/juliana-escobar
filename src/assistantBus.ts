export const OPEN_ASSISTANT_EVENT = "juliana:open-assistant";

export function openAssistant() {
  window.dispatchEvent(new Event(OPEN_ASSISTANT_EVENT));
}
