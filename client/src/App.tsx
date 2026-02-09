import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import { config } from './config';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import GodConsole from './pages/GodConsole';
import PlayerView from './pages/PlayerView';
import DevRoleSandbox from './pages/DevRoleSandbox';
import ConnectionStatusIndicator from './components/ConnectionStatus';

function App() {
  const { user } = useAuthStore();

  if (!user) {
    return <LoginPage />;
  }

  return (
    <>
      <ConnectionStatusIndicator />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        {user.role === 'admin' && <Route path="/admin" element={<AdminDashboard />} />}
        {config.isDev && user.role === 'admin' && <Route path="/dev/roles" element={<DevRoleSandbox />} />}
        {user.role === 'god' && <Route path="/god" element={<GodConsole />} />}
        {user.role === 'player' && <Route path="/player" element={<PlayerView />} />}
        <Route
          path="*"
          element={
            <Navigate
              to={
                user.role === 'admin'
                  ? '/admin'
                  : user.role === 'god'
                    ? '/god'
                    : '/player'
              }
              replace
            />
          }
        />
      </Routes>
    </>
  );
}

export default App;
