'use no memo';

'use client';

import { useCreatePlanet } from '@/lib/tayori';
import { isZodError } from 'tayori';
import { prettifyError } from 'zod';
import { extractErrorMessage } from 'foxts/extract-error-message';

const PLANET_TYPES = [
  { value: 'terrestrial', label: 'Terrestrial' },
  { value: 'gas_giant', label: 'Gas Giant' },
  { value: 'ice_giant', label: 'Ice Giant' },
  { value: 'dwarf', label: 'Dwarf' },
  { value: 'super_earth', label: 'Super Earth' }
] as const;

export function PlanetForm() {
  'use no memo';

  const { trigger, isMutating, data, error } = useCreatePlanet();

  console.log({ isMutating, data, error });

  async function action(fd: FormData) {
    // You'd typically use a form library like react-hook-form for this
    // For the sake of the example, we simply use `as` to do the trick
    const name = fd.get('name') as string;
    const type = (fd.get('type') as string) || undefined;
    const description = (fd.get('description') as string) || undefined;

    try {
      await trigger({
        // you pass request options to the trigger function.
        // and yes, all the options are fully typed and have autocompletion!
        body: {
          name,
          type: type as any,
          description
        }
      });
    } catch {
      // useMutation already stores the error in its own state.
    }
  }

  return (
    <section style={{ marginBottom: '2rem' }}>
      <h2 style={{ marginBottom: '1rem' }}>Add a Planet</h2>
      <form
        action={action}
        style={{ display: 'grid', gap: '0.75rem', maxWidth: 480 }}
      >
        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Name *</span>
          <input
            name="name"
            required
            placeholder="e.g. Kepler-22b"
            style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem' }}
          />
        </label>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Type</span>
          <select
            name="type"
            defaultValue=""
            style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem' }}
          >
            <option value="">— select —</option>
            {PLANET_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label style={{ display: 'grid', gap: '0.25rem' }}>
          <span>Description</span>
          <textarea
            name="description"
            rows={3}
            placeholder="Short description…"
            style={{ padding: '0.5rem', borderRadius: 6, border: '1px solid #d1d5db', fontSize: '0.9rem', resize: 'vertical' }}
          />
        </label>

        <button
          type="submit"
          disabled={isMutating}
          style={{ padding: '0.5rem 1rem', borderRadius: 6, border: 'none', background: '#2563eb', color: '#fff', fontWeight: 600, cursor: isMutating ? 'not-allowed' : 'pointer', opacity: isMutating ? 0.7 : 1, fontSize: '0.9rem' }}
        >
          {isMutating ? 'Creating...' : 'Create Planet (Demo Only, the API will just fail)'}
        </button>

        {!!error && (
          <p style={{ color: 'red', fontSize: '0.85rem' }}>
            {isZodError(error) ? prettifyError(error) : extractErrorMessage(error)}
          </p>
        )}

        {data && !error && (
          <p style={{ color: 'green', fontSize: '0.85rem' }}>
            ✓ Created <strong>{data.name}</strong> (id: {data.id})
          </p>
        )}
      </form>
    </section>
  );
}
