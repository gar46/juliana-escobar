import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { assistantDevPlugin } from "./server/dev-plugin.mjs";

export default defineConfig({
  plugins: [react(), assistantDevPlugin()],
});
