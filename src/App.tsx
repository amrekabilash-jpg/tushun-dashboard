import "./App.css";
import "./pages/TaxSettings.css";
import { useState } from "react";
import { useAuthStore } from "./store/auth";
import LoginPage from "./pages/LoginPage";
import TaxSettingsPage from "./pages/TaxSettingsPage";
import ImportBatchPage from "./pages/ImportBatchPage";
import FinanceReportsPage from "./pages/FinanceReportsPage";

export type Page = "tax" | "import" | "reports";

function App() {
  const user = useAuthStore(s => s.user);
  const [page, setPage] = useState<Page>("tax");

  if (!user) return <LoginPage />;

  if (page === "import")  return <ImportBatchPage     onBack={() => setPage("tax")} />;
  if (page === "reports") return <FinanceReportsPage  onBack={() => setPage("tax")} />;
  return (
    <TaxSettingsPage
      onOpenImport={() => setPage("import")}
      onOpenReports={() => setPage("reports")}
    />
  );
}

export default App;
