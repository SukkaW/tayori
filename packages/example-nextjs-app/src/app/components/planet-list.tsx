'use client';

import { useGetAllPlanets } from '@/lib/tayori';
import { extractErrorMessage } from 'foxts/extract-error-message';
import { isZodError } from 'tayori';
import { prettifyError } from 'zod';

const PLANET_TYPE_LABELS: Record<string, string> = {
  terrestrial: 'Terrestrial',
  gas_giant: 'Gas Giant',
  ice_giant: 'Ice Giant',
  dwarf: 'Dwarf',
  super_earth: 'Super Earth'
};

export function PlanetList() {
  const { data: planets, isLoading, error } = useGetAllPlanets();

  if (isLoading) {
    return <p>Loading planets...</p>;
  }

  if (error) {
    return (
      <p style={{ color: 'red' }}>
        Failed to load planets:{' '}
        {isZodError(error) ? prettifyError(error) : extractErrorMessage(error)}
      </p>
    );
  }

  if (!planets?.data?.length) {
    return <p>No planets found.</p>;
  }

  return (
    <section>
      <ul style={{ listStyle: 'none', display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {planets.data.map((planet) => (
          <li key={planet.id} style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '1rem' }}>
            <h2 style={{ marginBottom: '0.25rem' }}>{planet.name}</h2>
            {planet.type && (
              <p style={{ fontSize: '0.8rem', opacity: 0.6, marginBottom: '0.5rem' }}>
                {PLANET_TYPE_LABELS[planet.type] ?? planet.type}
              </p>
            )}
            {planet.description && (
              <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}>{planet.description}</p>
            )}
            {planet.habitabilityIndex != null && (
              <p style={{ fontSize: '0.8rem' }}>
                Habitability:{' '}
                <strong>{(planet.habitabilityIndex * 100).toFixed(0)}%</strong>
              </p>
            )}
            {planet.physicalProperties?.mass != null && (
              <p style={{ fontSize: '0.8rem' }}>
                Mass: <strong>{planet.physicalProperties.mass} M⊕</strong>
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
