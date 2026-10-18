import { describe, expect, it } from 'vitest';
import { saveChange, type ScheduleTransport, type Snapshot } from './cloud-sync';
import type { Data } from './store';

const base = (): Data => ({ routes: [], drivers: [{ id: 'd', name: 'ALEX' }], vehicles: [{ id: 'v', plate: 'AQT2B77' }], trips: [], shifts: [], filled: [] });

describe('shared Cloud scheduling', () => {
  it('retries revision conflicts without losing another user’s independent change', async () => {
    let current: Snapshot = { payload: base(), revision: 0 };
    let attempts = 0;
    const transport: ScheduleTransport = {
      read: async () => structuredClone(current),
      compareAndSave: async (payload, revision) => {
        attempts++;
        if (attempts === 1) { current = { payload: { ...current.payload, vehicles: [{ id: 'v', plate: 'OWC9532' }] }, revision: 1 }; return null; }
        if (revision !== current.revision) return null;
        current = { payload, revision: revision + 1 };
        return current;
      },
    };
    const saved = await saveChange(transport, d => ({ ...d, drivers: d.drivers.map(x => ({ ...x, name: 'TIAGO' })) }));
    expect(saved.payload.drivers[0]?.name).toBe('TIAGO');
    expect(saved.payload.vehicles[0]?.plate).toBe('OWC9532');
    expect(saved.revision).toBe(2);
  });

  it('does not save a no-op operation', async () => {
    let writes = 0;
    await saveChange({ read: async () => ({ payload: base(), revision: 2 }), compareAndSave: async () => { writes++; return null; } }, d => d);
    expect(writes).toBe(0);
  });

  it('reports connection failure instead of reporting a save', async () => {
    await expect(saveChange({ read: async () => { throw new Error('offline'); }, compareAndSave: async () => null }, d => d)).rejects.toThrow('offline');
  });
});