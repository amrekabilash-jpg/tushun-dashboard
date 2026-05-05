import "./App.css";
import { useEffect } from "react";
import { useAuthStore } from "./store/auth";
import LoginPage from "./pages/LoginPage";

function App() {
  const user = useAuthStore(s => s.user);

  useEffect(() => {
    if (user) {
      window.location.href = "/dashboard.html";
    }
  }, [user]);

  return <LoginPage />;
}

export default App;
