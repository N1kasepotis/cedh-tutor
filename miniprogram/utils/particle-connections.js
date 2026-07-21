function insertNearest(list, edge, limit) {
  let insertAt = list.length;

  for (let index = 0; index < list.length; index += 1) {
    if (edge.distanceSquared < list[index].distanceSquared) {
      insertAt = index;
      break;
    }
  }

  list.splice(insertAt, 0, edge);
  if (list.length > limit) list.pop();
}

function buildNearestConnectionCandidates(particles, maxDistance, maxLinksPerParticle) {
  const source = Array.isArray(particles) ? particles : [];
  const distanceLimit = Number(maxDistance || 0);
  const linkLimit = Math.max(1, Math.floor(Number(maxLinksPerParticle || 1)));

  if (source.length < 2 || !Number.isFinite(distanceLimit) || distanceLimit <= 0) return [];

  // 每个粒子只保留少量最近候选。最终绘制层仍负责 maxLinks/maxLines，
  // 这里的 2x 余量用于避免双方候选槽被同一簇粒子抢满。
  const nearestLimit = Math.max(linkLimit + 2, linkLimit * 2);
  const maxDistanceSquared = distanceLimit * distanceLimit;
  const nearestByParticle = source.map(() => []);
  const coordinates = source.map((particle) => ({
    x: Number(particle.x) || 0,
    y: Number(particle.y) || 0,
  }));

  for (let index = 0; index < coordinates.length; index += 1) {
    const particle = coordinates[index];
    for (let nextIndex = index + 1; nextIndex < coordinates.length; nextIndex += 1) {
      const candidate = coordinates[nextIndex];
      const dx = particle.x - candidate.x;
      const dy = particle.y - candidate.y;
      const distanceSquared = dx * dx + dy * dy;
      if (distanceSquared > maxDistanceSquared) continue;

      const edge = {
        from: index,
        to: nextIndex,
        distanceSquared,
      };
      insertNearest(nearestByParticle[index], edge, nearestLimit);
      insertNearest(nearestByParticle[nextIndex], edge, nearestLimit);
    }
  }

  // 按“每个粒子的第 1 近、第 2 近……”轮询，避免全局距离排序，
  // 同时让不同区域的粒子都有机会进入最终的 maxLines 配额。
  const seen = new Uint8Array(source.length * source.length);
  const candidates = [];
  for (let rank = 0; rank < nearestLimit; rank += 1) {
    for (let particleIndex = 0; particleIndex < nearestByParticle.length; particleIndex += 1) {
      const edge = nearestByParticle[particleIndex][rank];
      if (!edge) continue;
      const edgeKey = edge.from * source.length + edge.to;
      if (seen[edgeKey]) continue;

      seen[edgeKey] = 1;
      candidates.push({
        from: edge.from,
        to: edge.to,
        distance: Math.sqrt(edge.distanceSquared),
      });
    }
  }

  return candidates;
}

module.exports = {
  buildNearestConnectionCandidates,
};
