import Dexie, { Table } from 'dexie';

export interface GenerationSession {
  id?: number;
  timestamp: Date;
  type: string;
  name: string;
  data: any;
}

export class MyDatabase extends Dexie {
  sessions!: Table<GenerationSession>;

  constructor() {
    super('GenerationHistory');
    this.version(1).stores({
      sessions: '++id, timestamp, type'
    });
  }
}

export const historyDb = new MyDatabase();
