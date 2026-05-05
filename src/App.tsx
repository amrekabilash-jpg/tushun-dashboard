import "./App.css";
import { useAuthStore } from "./store/auth";
import LoginPage from "./pages/LoginPage";
import Sidebar from "./components/layout/Sidebar";
import Module1 from "./modules/module1/Module1";
import { useAppStore } from "./store";

function renderModule(id: number) {
  switch (id) {
    case 1: return <Module1 />;
    default: return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--tm)', fontFamily: 'var(--mono)', fontSize: 13 }}>
        Модуль {String(id).padStart(2, '0')} — в разработке
      </div>
    );
  }
}

function Dashboard() {
  const { activeModule } = useAppStore();
  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        {renderModule(activeModule)}
      </main>
    </div>
  );
}

function App() {
  const user = useAuthStore(s => s.user);
  return user ? <Dashboard /> : <LoginPage />;
}

export default App;
