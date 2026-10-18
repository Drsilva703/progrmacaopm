import type { Data } from './store';

export type Snapshot = { payload: Data; revision: number };
export type Change = (data: Data) => Data;
export interface ScheduleTransport {
  read: () => Promise<Snapshot>;
  compareAndSave: (next: Data, revision: number) => Promise<Snapshot | null>;
}

// Replay the requested operation on fresh data, never replace it with a stale snapshot.
export async function saveChange(transport: ScheduleTransport, change: Change): Promise<Snapshot> {
  for (let attempt = 0; attempt < 12; attempt++) {
    const current = await transport.read();
    const next = change(current.payload);
    if (JSON.stringify(next) === JSON.stringify(current.payload)) return current;
    const saved = await transport.compareAndSave(next, current.revision);
    if (saved) return saved;
  }
  throw new Error('A programação está recebendo muitas alterações. Tente novamente.');
}