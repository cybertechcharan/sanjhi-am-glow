import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initCustomization } from "./hooks/useCustomization";

initCustomization();
createRoot(document.getElementById("root")!).render(<App />);