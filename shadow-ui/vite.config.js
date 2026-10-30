import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/* The brain needs an access token on every request, and the browser never
   gets it: this dev server reads it off disk and attaches it as the request
   is proxied through. A bug in the UI therefore can't leak it, and nobody
   has to type it.

   Read fresh (on mtime change) rather than once at startup, so the brain can
   be started after the UI and a regenerated token doesn't need a restart. */

const TOKEN_PATH = path.resolve(__dirname, "../shadow-brain/data/auth_token");

let cached = { mtime: 0, value: "" };

function token() {
  try {
    const { mtimeMs } = fs.statSync(TOKEN_PATH);
    if (mtimeMs !== cached.mtime) {
      cached = { mtime: mtimeMs, value: fs.readFileSync(TOKEN_PATH, "utf8").trim() };
    }
    return cached.value;
  } catch {
    // The brain hasn't run yet, so there is no token. Forward without one and
    // let the brain's own 401 explain it.
    return "";
  }
}

/* A page on another origin can still reach this dev server, and a simple POST
   is sent without a preflight, so CORS alone wouldn't stop one. Refuse to
   attach the token to anything that didn't come from Shadow's own page. */
function sameOrigin(req, origin) {
  // Required: a same-origin GET has no Origin, so this is the only signal.
  const site = (req.headers["sec-fetch-site"] || "").toLowerCase();
  if (site !== "same-origin" && site !== "none") return false;
  const from = req.headers.origin;
  return !from || from === origin;
}

// DNS rebinding sends the attacker's name as Host; only these are accepted.
function localHost(req, port) {
  const host = (req.headers.host || "").toLowerCase();
  return host === `localhost:${port}` || host === `127.0.0.1:${port}`;
}

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Vite otherwise answers with Access-Control-Allow-Origin: *, which would
    // let any other local app's page drive this proxy.
    cors: false,
    // Explicit: allowedHosts: true would turn the DNS-rebinding check off.
    allowedHosts: ["localhost", "127.0.0.1"],
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8765",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
        configure: (proxy, options) => {
          proxy.on("proxyReq", (proxyReq, req) => {
            const port = req.socket.localPort;
            const expected = `http://localhost:${port}`;
            const alt = `http://127.0.0.1:${port}`;
            const from = req.headers.origin;
            const ok =
              localHost(req, port) &&
              (sameOrigin(req, expected) || (from && from === alt && sameOrigin(req, alt)));

            if (!ok) {
              // Don't forward it at all, and don't lend it the token.
              proxyReq.destroy();
              return;
            }
            const value = token();
            if (value) proxyReq.setHeader("x-shadow-token", value);
            // The brain allows no origin by default, and a same-origin POST
            // still carries one. It is this server's own origin, which the
            // brain has no list of, so drop it: the checks above already
            // established the request came from Shadow's own page.
            proxyReq.removeHeader("origin");
          });
        },
      },
    },
  },
});
