import { NavLink, Outlet } from 'react-router-dom';
import { IconCar, IconChart, IconDashboard, IconKey, IconUsers } from './icons';

const LINKS = [
  { to: '/', label: 'Dashboard', icon: <IconDashboard /> },
  { to: '/fleet', label: 'Fleet', icon: <IconCar /> },
  { to: '/rentals', label: 'Rentals', icon: <IconKey /> },
  { to: '/customers', label: 'Customers', icon: <IconUsers /> },
  { to: '/analytics', label: 'Analytics', icon: <IconChart /> },
];

export function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">R</div>
          <div className="brand-text">
            <span className="brand-name">ROVE</span>
            <span className="brand-sub">Fleet intelligence</span>
          </div>
        </div>
        <nav className="nav">
          <span className="nav-section">Workspace</span>
          {LINKS.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
            >
              {link.icon}
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div className="live-card">
            <span className="pulse-dot" />
            <div>
              <strong>Live dataset</strong>
              <span>18 months of history</span>
            </div>
          </div>
          <div className="user-row">
            <div className="avatar">OP</div>
            <div className="user-meta">
              <strong>Ops team</strong>
              <span>ops@rove.app</span>
            </div>
          </div>
        </div>
      </aside>
      <main className="main">
        <div className="page">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
