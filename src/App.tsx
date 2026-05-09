import { useEffect, useState } from "react";
import "./App.css";
import "./pages/TaxSettings.css";
import { useAuthStore } from "./store/auth";
import LoginPage from "./pages/LoginPage";
import AppLayout from "./components/layout/AppLayout";
import i18n from "./i18n";

function App() {
  const user = useAuthStore(s => s.user);

  // Force re-render of the entire tree when language changes.
  // react-i18next's useSyncExternalStore subscription can miss the event
  // when i18next v26 fires languageChanged asynchronously.
  const [, rerender] = useState(0);
  useEffect(() => {
    const handler = () => rerender(n => n + 1);
    i18n.on("languageChanged", handler);
    return () => i18n.off("languageChanged", handler);
  }, []);

  if (!user) return <LoginPage />;
  return <AppLayout />;
}

export default App;
