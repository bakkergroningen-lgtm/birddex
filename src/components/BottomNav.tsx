import { NavLink } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Kaart', emoji: '🗺️' },
  { to: '/soorten', label: 'BirdDex', emoji: '📱' },
  { to: '/badges', label: 'Badges', emoji: '🏅' },
  { to: '/logboek', label: 'Logboek', emoji: '📖' },
  { to: '/instellingen', label: 'Instellingen', emoji: '⚙️' },
];

export default function BottomNav() {
  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-around',
        background: 'white',
        borderTop: '2px solid #eef2f1',
        padding: '8px 0 max(8px, env(safe-area-inset-bottom))',
        zIndex: 1000,
        overflowX: 'auto',
      }}
    >
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === '/'}
          style={({ isActive }) => ({
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            textDecoration: 'none',
            color: isActive ? 'var(--color-primary)' : '#9aa5a2',
            fontFamily: 'var(--font-heading)',
            fontWeight: 700,
            fontSize: 10,
            padding: '4px 10px',
            whiteSpace: 'nowrap',
          })}
        >
          <span style={{ fontSize: 20 }}>{item.emoji}</span>
          {item.label}
        </NavLink>
      ))}
    </nav>
  );
}
