import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

import {
  bestScoreKey,
  readBestScore,
  recordScore,
} from '../../src/systems/progress/bestScore';

/** A localStorage that behaves. */
function workingStorage(): Storage {
  const data = new Map<string, string>();
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    clear: () => data.clear(),
    key: () => null,
    get length() {
      return data.size;
    },
  } as Storage;
}

/** A localStorage that throws on everything, as a private window can. */
function hostileStorage(): Storage {
  const boom = (): never => {
    throw new DOMException('denied', 'SecurityError');
  };
  return {
    getItem: boom,
    setItem: boom,
    removeItem: boom,
    clear: boom,
    key: boom,
    length: 0,
  } as unknown as Storage;
}

function useStorage(storage: Storage | undefined): void {
  vi.stubGlobal('localStorage', storage);
}

afterEach(() => vi.unstubAllGlobals());

describe('recording a run', () => {
  beforeEach(() => useStorage(workingStorage()));

  it('starts with no record', () => {
    expect(readBestScore('endless', 'map01')).toBe(0);
  });

  it('remembers a finished run', () => {
    expect(recordScore('endless', 'map01', 14)).toBe(true);
    expect(readBestScore('endless', 'map01')).toBe(14);
  });

  it('only replaces a record that was actually beaten', () => {
    recordScore('endless', 'map01', 20);

    expect(recordScore('endless', 'map01', 19)).toBe(false);
    expect(recordScore('endless', 'map01', 20)).toBe(false);
    expect(readBestScore('endless', 'map01')).toBe(20);

    expect(recordScore('endless', 'map01', 21)).toBe(true);
    expect(readBestScore('endless', 'map01')).toBe(21);
  });

  it('ignores a run that got nowhere', () => {
    expect(recordScore('endless', 'map01', 0)).toBe(false);
    expect(recordScore('endless', 'map01', -3)).toBe(false);
    expect(readBestScore('endless', 'map01')).toBe(0);
  });

  it('keeps modes and maps apart', () => {
    // Eight waves of campaign is not the same achievement as eight of
    // endless, and map03 is not map01.
    recordScore('endless', 'map01', 30);

    expect(readBestScore('campaign', 'map01')).toBe(0);
    expect(readBestScore('endless', 'map03')).toBe(0);
    expect(readBestScore('endless', 'map01')).toBe(30);
  });

  it('namespaces and versions its key', () => {
    const key = bestScoreKey('endless', 'map01');

    expect(key).toContain('endless');
    expect(key).toContain('map01');
    // Versioned so a future change to the difficulty curve abandons old
    // records instead of showing one that is no longer comparable.
    expect(key).toMatch(/v\d+/);
  });
});

describe('storage that will not cooperate', () => {
  it('reads 0 rather than throwing when storage is blocked', () => {
    useStorage(hostileStorage());
    expect(() => readBestScore('endless', 'map01')).not.toThrow();
    expect(readBestScore('endless', 'map01')).toBe(0);
  });

  it('swallows a failed write — a lost score is not worth ending a run', () => {
    useStorage(hostileStorage());
    expect(() => recordScore('endless', 'map01', 12)).not.toThrow();
  });

  it('copes with no localStorage at all', () => {
    useStorage(undefined);
    expect(readBestScore('endless', 'map01')).toBe(0);
    expect(() => recordScore('endless', 'map01', 12)).not.toThrow();
  });

  it('treats junk in storage as no record', () => {
    // Storage is shared with the rest of the origin and is not ours to trust.
    const storage = workingStorage();
    useStorage(storage);
    for (const junk of ['', 'banana', '{}', 'NaN', '-5', 'Infinity']) {
      storage.setItem(bestScoreKey('endless', 'map01'), junk);
      expect(readBestScore('endless', 'map01'), junk).toBe(0);
    }
  });
});
