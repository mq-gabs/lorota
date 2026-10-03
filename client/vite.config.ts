import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const SERVER = `http://localhost:${process.env.PORT ?? 3000}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/socket.io": { target: SERVER, ws: true },
    },
  },
});
