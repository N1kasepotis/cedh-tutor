const test = require('node:test');
const assert = require('node:assert/strict');

const {
  buildNearestConnectionCandidates,
} = require('../miniprogram/utils/particle-connections');

test('particle connection candidates stay inside the configured distance', () => {
  const particles = [
    { x: 0, y: 0 },
    { x: 8, y: 0 },
    { x: 20, y: 0 },
    { x: 200, y: 200 },
  ];
  const candidates = buildNearestConnectionCandidates(particles, 12, 2);

  assert.deepEqual(candidates.map(({ from, to }) => [from, to]), [[0, 1], [1, 2]]);
  assert.ok(candidates.every((candidate) => candidate.distance <= 12));
});

test('particle connection candidates prefer nearby edges and remain bounded', () => {
  const particles = Array.from({ length: 80 }, (_, index) => ({
    x: (index % 10) * 8,
    y: Math.floor(index / 10) * 8,
  }));
  const maxLinks = 4;
  const candidates = buildNearestConnectionCandidates(particles, 320, maxLinks);
  const pairKeys = candidates.map(({ from, to }) => `${from}:${to}`);

  assert.equal(new Set(pairKeys).size, pairKeys.length);
  assert.ok(candidates.length <= particles.length * maxLinks * 2);
  assert.ok(candidates.length < (particles.length * (particles.length - 1)) / 2);
  particles.forEach((particle, particleIndex) => {
    const nearestDistance = particles.reduce((minimum, candidate, candidateIndex) => {
      if (candidateIndex === particleIndex) return minimum;
      return Math.min(minimum, Math.hypot(particle.x - candidate.x, particle.y - candidate.y));
    }, Infinity);
    assert.ok(candidates.some((candidate) => (
      (candidate.from === particleIndex || candidate.to === particleIndex)
        && Math.abs(candidate.distance - nearestDistance) < 0.0001
    )));
  });
});

test('particle connection candidate builder handles disabled and sparse inputs', () => {
  assert.deepEqual(buildNearestConnectionCandidates([], 100, 3), []);
  assert.deepEqual(buildNearestConnectionCandidates([{ x: 0, y: 0 }], 100, 3), []);
  assert.deepEqual(buildNearestConnectionCandidates([
    { x: 0, y: 0 },
    { x: 500, y: 500 },
  ], 100, 3), []);
});
