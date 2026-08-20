import { useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export default function Auth() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } =
      mode === 'signup'
        ? await supabase.auth.signUp({ email, password })
        : await supabase.auth.signInWithPassword({ email, password });

    if (error) setError(error.message);
    setLoading(false);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(180deg, var(--color-light) 0%, var(--color-bg) 60%)',
        padding: 20,
      }}
    >
      <div className="card" style={{ maxWidth: 360, width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 48 }}>🐦</div>
          <h1 style={{ color: 'var(--color-dark)' }}>VogelApp</h1>
          <p style={{ color: '#6b7a75', margin: 0 }}>Spot ze allemaal!</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input
            className="input"
            type="email"
            placeholder="E-mailadres"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className="input"
            type="password"
            placeholder="Wachtwoord"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <p style={{ color: 'var(--color-danger)', fontSize: 14, margin: 0 }}>{error}</p>}
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ marginTop: 8 }}>
            {loading ? 'Bezig...' : mode === 'signup' ? 'Account aanmaken' : 'Inloggen'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 16, fontSize: 14, color: '#6b7a75' }}>
          {mode === 'login' ? (
            <>
              Nog geen account?{' '}
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setMode('signup'); }}
                style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none' }}
              >
                Registreer hier
              </a>
            </>
          ) : (
            <>
              Al een account?{' '}
              <a
                href="#"
                onClick={(e) => { e.preventDefault(); setMode('login'); }}
                style={{ color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none' }}
              >
                Log hier in
              </a>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
