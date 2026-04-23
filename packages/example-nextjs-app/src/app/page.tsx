import { PlanetList } from './components/planet-list';
import { PlanetForm } from './components/planet-form';

export default function Home() {
  return (
    <main>
      <h1 style={{ marginBottom: '1.5rem' }}>Tayori Next.js Example</h1>
      <PlanetForm />
      <hr style={{ marginBottom: '1.5rem', border: 'none', borderTop: '1px solid #e5e7eb' }} />
      <PlanetList />
    </main>
  );
}
