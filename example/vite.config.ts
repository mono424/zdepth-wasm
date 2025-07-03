import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/zdepth-wasm/" : "/",
  plugins: [solidPlugin()],
  server: {
    port: 3000,
  },
  build: {
    target: "esnext",
  },
  optimizeDeps: {
    exclude: ["@mono424/zdepth-wasm"],
  },
  assetsInclude: ["**/*.wasm"],
  publicDir: "public",
}));
