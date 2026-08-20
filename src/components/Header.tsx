import { supabase } from '../lib/supabaseClient';

export default function Header() {
  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '14px 20px',
        background: 'var(--color-secondary)',
        color: 'white',
      }}
    >
      <h1 style={{ fontSize: 20, margin: 0, color: 'white' }}>🐦 VogelApp</h1>
      <button className="btn btn-outline btn-sm" onClick={() => supabase.auth.signOut()}>
        Uitloggen
      </button>
    </header>
  );
}
