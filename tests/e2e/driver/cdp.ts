// The Chrome DevTools Protocol over --remote-debugging-pipe: fd 3 carries
// requests, fd 4 responses and events, each message terminated by a NUL
// byte. Every message is JSON the driver narrows before it reads it.
import type { Readable, Writable } from 'node:stream';

export type CdpRecord = Record<string, unknown>;

export function isRecord(value: unknown): value is CdpRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// A record field, or an empty record.
export function recordAt(record: unknown, key: string): CdpRecord {
  const value = isRecord(record) ? record[key] : undefined;
  return isRecord(value) ? value : {};
}

export function stringAt(record: unknown, key: string): string {
  const value = isRecord(record) ? record[key] : undefined;
  return typeof value === 'string' ? value : '';
}

export function numberAt(record: unknown, key: string): number | null {
  const value = isRecord(record) ? record[key] : undefined;
  return typeof value === 'number' ? value : null;
}

export function arrayAt(record: unknown, key: string): unknown[] {
  const value = isRecord(record) ? record[key] : undefined;
  return Array.isArray(value) ? value : [];
}

// A protocol event: its method, its parameters and the session it came from.
export interface CdpEvent {
  method: string;
  params: CdpRecord;
  sessionId: string;
}

export interface CdpConnection {
  send(method: string, params?: CdpRecord, sessionId?: string): Promise<CdpRecord>;
  onEvent(listener: (event: CdpEvent) => void): void;
}

interface Pending {
  resolve(result: CdpRecord): void;
  reject(error: Error): void;
  method: string;
}

export function createPipeConnection(writer: Writable, reader: Readable): CdpConnection {
  const pending = new Map<number, Pending>();
  const listeners: Array<(event: CdpEvent) => void> = [];
  let nextId = 1;
  let buffer = '';

  const receive = (message: unknown) => {
    const id = numberAt(message, 'id');
    const waiting = id === null ? undefined : pending.get(id);
    if (id !== null && waiting) {
      pending.delete(id);
      const error = recordAt(message, 'error');
      if (Object.keys(error).length) {
        waiting.reject(new Error(`${waiting.method}: ${stringAt(error, 'message')}`));
      } else {
        waiting.resolve(recordAt(message, 'result'));
      }
      return;
    }
    const event = { method: stringAt(message, 'method'), params: recordAt(message, 'params'), sessionId: stringAt(message, 'sessionId') };
    listeners.forEach((listener) => listener(event));
  };

  reader.on('data', (chunk: Buffer) => {
    buffer += chunk.toString();
    let end = buffer.indexOf('\0');
    while (end >= 0) {
      const text = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      receive(JSON.parse(text));
      end = buffer.indexOf('\0');
    }
  });

  return {
    send(method, params = {}, sessionId) {
      const id = nextId;
      nextId += 1;
      writer.write(`${JSON.stringify({ id, method, params, sessionId })}\0`);
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject, method }));
    },
    onEvent(listener) {
      listeners.push(listener);
    }
  };
}
