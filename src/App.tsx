import "./App.css";
import "./pages/TaxSettings.css";
import { useAuthStore } from "./store/auth";
import LoginPage from "./pages/LoginPage";
import AppLayout from "./components/layout/AppLayout";

function App() {
  const user = useAuthStore(s => s.user);
  if (!user) return <LoginPage />;
  return <AppLayout />;
}

export default App;
