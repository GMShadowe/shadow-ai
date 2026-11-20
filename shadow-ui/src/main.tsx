import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/app/App";
import { applyAppearance, loadAppearance } from "@/theme/appearance";
import "@/styles/index.css";

// Before the first render, so the page never flashes the wrong theme.
applyAppearance(loadAppearance());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
