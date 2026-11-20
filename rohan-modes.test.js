import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROHAN_MODES,
  getRohanWinRate,
  loadRohanProfile,
  recordRohanMatch,
  saveRohanProfile,
} from './rohan-modes.js';

test('catálogo dos modos possui os 14 modos solicitados', () => {
  assert.equal(ROHAN_MODES.length, 14);
  assert.equal(new Set(ROHAN_MODES.map((mode) => mode.id)).size, 14);
  assert.ok(ROHAN_MODES.find((mode) => mode.id === 'training'));
  assert.ok(ROHAN_MODES.find((mode) => mode.id === 'chronicles'));
});

test('Crônicas persistem vitória, derrota e desbloqueio de Rohan sem dados fictícios online', () => {
  const values = new Map();
  const storage = {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  };
  const profile = loadRohanProfile(storage);
  assert.equal(profile.wins, 0);
  recordRohanMatch(profile, 'win', 'versus', 'ROHAN');
  saveRohanProfile(profile, storage);
  const restored = loadRohanProfile(storage);
  assert.equal(restored.wins, 1);
  assert.equal(restored.losses, 0);
  assert.equal(restored.rohanUnlocked, true);
  assert.equal(restored.history[0].mode, 'versus');
  assert.equal(getRohanWinRate(restored), 100);
});

test('pontuação não fica negativa após derrota', () => {
  const profile = loadRohanProfile({ getItem: () => null });
  for (let index = 0; index < 100; index += 1) recordRohanMatch(profile, 'loss');
  assert.equal(profile.score, 0);
  assert.equal(profile.losses, 100);
});
