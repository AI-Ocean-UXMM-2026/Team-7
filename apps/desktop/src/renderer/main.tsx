import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import AssistantApp from "./App";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <AssistantApp />
  </StrictMode>,
);
