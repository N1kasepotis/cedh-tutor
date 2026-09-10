'use strict';
const crypto = require('crypto');
const domain = require('./contracts');
const { poll } = require('./catalog');
const hash = (...parts) =>
  crypto.createHash('sha256').update(parts.join('\0')).digest('hex');
const safeId = (value) =>
  typeof value === 'string' && /^[a-zA-Z0-9-]{1,80}$/.test(value);
function createService({ repository, moderate, resolveCard, now = Date.now }) {
  return async (event, identity) => {
    if (!identity || !identity.openid) domain.fail('FORBIDDEN');
    if (!event || typeof event.action !== 'string')
      domain.fail('INVALID_INPUT');
    const owner = hash(identity.openid);
    const stamp = now();
    // Trusted identity, bounded one-minute bucket. No user identifiers in public responses.
    await repository.transaction(async (tx) => {
      const key = `limit-${owner}`;
      const old = await tx.get(key);
      const minute = Math.floor(stamp / 60000);
      const count = old && old.minute === minute ? old.count : 0;
      if (count >= 90) domain.fail('RATE_LIMIT');
      await tx.set(key, { minute, count: count + 1 });
    });
    if (event.action === 'poll' || event.action === 'vote') {
      const definition = poll(event.pollId);
      if (!definition) domain.fail('INVALID_VOTE');
      const next =
        event.action === 'vote' && !event.retract
          ? domain.ballot(event.vote, definition.choices)
          : null;
      const key = hash(definition.id);
      return repository.transaction(async (tx) => {
        const summary = await tx.get(`poll-${key}`);
        const ballotKey = `vote-${hash(key, owner)}`;
        const old = await tx.get(ballotKey);
        let counts =
          (summary && summary.counts) || domain.emptyCounts(definition.choices);
        let mine = (old && old.vote) || null;
        if (event.action === 'vote') {
          counts = domain.replaceBallot(counts, mine, next, definition.choices);
          await tx.set(`poll-${key}`, {
            pollId: definition.id,
            counts,
            updatedAt: stamp,
          });
          // Retraction retains an empty ballot document: deterministic, safe on retry.
          await tx.set(ballotKey, { vote: next, updatedAt: stamp });
          mine = next;
        }
        return { counts, mine, updatedAt: stamp };
      });
    }
    if (event.action === 'publish') {
      if (!safeId(event.draftId) || !['passport', 'table'].includes(event.kind))
        domain.fail('INVALID_INPUT');
      const expected = event.version === undefined ? 0 : event.version;
      if (!Number.isInteger(expected) || expected < 0)
        domain.fail('INVALID_INPUT');
      let content;
      if (event.kind === 'passport') {
        const validated = domain.passport(event.content);
        // No unmoderated public text; network calls stay outside retryable transactions.
        if (
          !(await moderate(
            [
              validated.nickname,
              validated.deckName,
              ...validated.slots.map((slot) => slot.reason),
            ].join('\n'),
            identity.openid,
          ))
        )
          domain.fail('MODERATION');
        const slots = [];
        const resolved = new Map();
        for (const slot of validated.slots) {
          if (!resolved.has(slot.printId)) {
            const card = domain.card(await resolveCard(slot.printId));
            if (card.printId !== slot.printId) domain.fail('INVALID_CARD');
            resolved.set(slot.printId, card);
          }
          slots.push({ ...resolved.get(slot.printId), reason: slot.reason });
        }
        content = { ...validated, slots };
      } else content = domain.table(event.content);
      const publicId = hash('share', owner, event.kind, event.draftId);
      return repository.transaction(async (tx) => {
        const old = await tx.get(`share-${publicId}`);
        const version = old ? old.version : 0;
        if (old && old.owner !== owner) domain.fail('FORBIDDEN');
        // A response lost in transit may safely retry the same exact publication.
        if (
          old &&
          !old.revoked &&
          JSON.stringify(old.content) === JSON.stringify(content)
        )
          return { id: publicId, version, content };
        if (version !== expected) domain.fail('CONFLICT');
        const next = {
          owner,
          kind: event.kind,
          content,
          version: version + 1,
          updatedAt: stamp,
          revoked: false,
        };
        await tx.set(`share-${publicId}`, next);
        return { id: publicId, version: next.version, content };
      });
    }
    if (['getShare', 'revoke', 'report', 'agree'].includes(event.action)) {
      if (typeof event.id !== 'string' || !/^[a-f0-9]{64}$/.test(event.id))
        domain.fail('NOT_FOUND');
      return repository.transaction(async (tx) => {
        const key = `share-${event.id}`;
        const entry = await tx.get(key);
        if (!entry || entry.revoked) domain.fail('NOT_FOUND');
        if (event.action === 'revoke') {
          if (entry.owner !== owner) domain.fail('FORBIDDEN');
          // Erase published content while keeping revision history needed for safe retry.
          await tx.set(key, {
            ...entry,
            content: null,
            revoked: true,
            version: entry.version + 1,
            updatedAt: stamp,
          });
          return { version: entry.version + 1 };
        }
        if (event.action === 'report') {
          if (!['inappropriate', 'misleading', 'other'].includes(event.reason))
            domain.fail('INVALID_INPUT');
          await tx.set(`report-${hash(event.id, owner)}`, {
            shareId: event.id,
            reason: event.reason,
            updatedAt: stamp,
          });
          return { received: true };
        }
        let agreement = null;
        if (entry.kind === 'table') {
          const agreementKey = `agree-${hash(event.id, String(entry.version), owner)}`;
          const own = await tx.get(agreementKey);
          const tallyKey = `table-${event.id}-${entry.version}`;
          const tally = await tx.get(tallyKey);
          let count = (tally && tally.count) || 0;
          let agreed = Boolean(own && own.agreed);
          if (event.action === 'agree') {
            if (
              event.version !== entry.version ||
              typeof event.agreed !== 'boolean'
            )
              domain.fail('CONFLICT');
            count += Number(event.agreed) - Number(agreed);
            agreed = event.agreed;
            await tx.set(agreementKey, { agreed });
            await tx.set(tallyKey, { count });
          }
          agreement = { count, agreed };
        } else if (event.action === 'agree') domain.fail('INVALID_INPUT');
        return {
          id: event.id,
          kind: entry.kind,
          content: entry.content,
          version: entry.version,
          updatedAt: entry.updatedAt,
          isOwner: entry.owner === owner,
          agreement,
        };
      });
    }
    domain.fail('INVALID_INPUT');
  };
}
module.exports = { createService };
