import { createRoot } from "react-dom/client";
import "./index.css";
import MissingEnvScreen from "@/components/MissingEnvScreen";

const REQUIRED_ENV_VARS = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"] as const;

const missingVars = REQUIRED_ENV_VARS.filter((envVar) => !import.meta.env[envVar]);

const root = createRoot(document.getElementById("root")!);

if (missingVars.length > 0) {
  root.render(<MissingEnvScreen missingVars={missingVars} />);
} else {
  import("./App.tsx").then(({ default: App }) => {
    root.render(<App />);
  });
}
