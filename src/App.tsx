import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './lib/supabaseClient';
import Auth from './components/Auth';
import SightingsMap from './components/SightingsMap';
import SpeciesOverview from './components/SpeciesOverview';
import SpeciesDetailPage from './components/SpeciesDetailPage';
import BadgesPage from './components/BadgesPage';
import AlertSettings from './components/AlertSettings';
import Logbook from './components/Logbook';
import SightingDetailPage from './components/SightingDetailPage';
import Header from './components/Header';
import BottomNav from './components/BottomNav';

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', height: '100vh', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ fontFamily: 'var(--font-heading)', fontSize: 18 }}>Laden...</p>
      </div>
    );
  }
  if (!session) return <Auth />;

  return (
    <BrowserRouter>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header />
        <main style={{ flex: 1, paddingBottom: 80 }}>
          <Routes>
            <Route path="/" element={<SightingsMap />} />
            <Route path="/soorten" element={<SpeciesOverview />} />
            <Route path="/soorten/:id" element={<SpeciesDetailPage />} />
            <Route path="/badges" element={<BadgesPage />} />
            <Route path="/logboek" element={<Logbook />} />
            <Route path="/logboek/:id" element={<SightingDetailPage />} />
            <Route path="/instellingen" element={<AlertSettings />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

export default App;
