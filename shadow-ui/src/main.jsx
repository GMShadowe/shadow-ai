import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import { applyAppearance, loadAppearance } from "./theme.js";
import "./index.css";

applyAppearance(loadAppearance());

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
