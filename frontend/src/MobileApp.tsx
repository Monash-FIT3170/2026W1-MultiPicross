import { AppRoutes } from './App';
import { NavLink } from 'react-router-dom';
import { Home, Gamepad2, LineChart, Settings } from 'lucide-react';

export function MobileApp() {
  return (
    <div style={{
      width: '100vw',
      height: '100vh',
      backgroundColor: 'var(--color-paper)',
      display: 'flex',
      flexDirection: 'column',
    }}>
      <div style={{
        flex: 1,
        overflowY: 'auto',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <AppRoutes />
      </div>
      
      {/* Mobile Bottom Navigation */}
      <div style={{
        height: '65px',
        backgroundColor: 'var(--color-surface)',
        borderTop: '1px solid var(--color-line)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingBottom: 'env(safe-area-inset-bottom)'
      }}>
        <MobileNavLink to="/" label="Home">
          <Home size={24} />
        </MobileNavLink>
        <MobileNavLink to="/singleplayer" label="Play">
          <Gamepad2 size={24} />
        </MobileNavLink>
        <MobileNavLink to="/statistics" label="Stats">
          <LineChart size={24} />
        </MobileNavLink>
        <MobileNavLink to="/settings" label="Settings">
          <Settings size={24} />
        </MobileNavLink>
      </div>
    </div>
  );
}

function MobileNavLink({ to, label, children }: { to: string; label: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        textDecoration: 'none',
        color: isActive ? 'var(--color-blue-500)' : 'var(--color-ink-muted)',
        fontWeight: isActive ? 600 : 400,
        fontSize: '12px'
      })}
    >
      {children}
      <span>{label}</span>
    </NavLink>
  );
}