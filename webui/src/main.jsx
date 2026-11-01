import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { I18nProvider } from "./i18n";
import { dicts } from "./i18n/dicts";
import "@xterm/xterm/css/xterm.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <I18nProvider dicts={dicts}>
        <App />
      </I18nProvider>
    </BrowserRouter>
  </React.StrictMode>
);
