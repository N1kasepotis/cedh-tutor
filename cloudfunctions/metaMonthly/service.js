const crypto = require('crypto');
const engine = require('./engine');
const network = require('./network');
const COLLECTION = 'community';
const PREFIX = 'meta_monthly_';
const jobId = (period) => `${PREFIX}job_${period}`;
const eventId = (period, id) => `${PREFIX}event_${period}_${engine.hash(id).slice(0, 20)}`;

function createService({ db, key, seed = null, now = Date.now, api = network }) {
  const collection = db.collection(COLLECTION);
  async function read(id, transaction) {
    try { const result = await (transaction ? transaction.collection(COLLECTION) : collection).doc(id).get(); return result.data || null; }
    catch (error) {
      if (/document.*(not exist|not found)|does not exist|DATABASE_DOCUMENT_NOT_EXIST/i.test(error.message || error.errMsg || '')) return null;
      throw error;
    }
  }
  const write = (id, data) => {
    // CloudBase reads add _id; it is immutable and must not be sent back in set.data.
    const { _id, ...fields } = data;
    return collection.doc(id).set({ data: { ...fields, kind: 'meta_monthly', updatedAt: now() } });
  };
  async function current(period) {
    const pointer = await read(`${PREFIX}current`);
    if (period && (!/^20\d{2}-(0[1-9]|1[0-2])$/.test(period))) throw new Error('INVALID_PERIOD');
    const version = period ? await read(`${PREFIX}period_${period}`) : pointer;
    const stored = version && await read(version.snapshotId);
    const snapshot = stored && stored.snapshot || (!period || seed && period === seed.period ? seed : null);
    const periods = [...new Set([...(pointer && pointer.periods || []), ...(seed ? [seed.period] : [])])].sort().reverse().slice(0, 12);
    const publishedAt = stored && version && Number.isFinite(version.publishedAt) ? version.publishedAt : null;
    return { snapshot, periods, latestPeriod: pointer && pointer.period || seed && seed.period || null, publishedAt };
  }
  // 首页只要知道最新一期什么时候发布，不用拉整份月报
  async function latest() {
    const pointer = await read(`${PREFIX}current`);
    return {
      latestPeriod: pointer && pointer.period || seed && seed.period || null,
      publishedAt: pointer && Number.isFinite(pointer.publishedAt) ? pointer.publishedAt : null,
    };
  }
  async function publish(snapshot) {
    const { hash, ...payload } = snapshot;
    if (engine.hash(payload) !== hash) throw new Error('INVALID_SNAPSHOT_HASH');
    const serialized = JSON.stringify(snapshot);
    if (Buffer.byteLength(serialized) > 800000) throw new Error('SNAPSHOT_TOO_LARGE');
    const id = `${PREFIX}snapshot_${snapshot.period}_${snapshot.hash.slice(0, 16)}`;
    await write(id, { snapshot });
    // Read back before switching the pointer. Existing monthly snapshots remain addressable.
    const saved = await read(id);
    if (!saved || saved.snapshot.hash !== snapshot.hash) throw new Error('PUBLISH_VERIFY_FAILED');
    await db.runTransaction(async (transaction) => {
      const pointer = await read(`${PREFIX}current`, transaction);
      // 同一份内容重新发布（比如重跑 seed）不算更新，首页显示的更新日期不跟着变
      const previous = await read(`${PREFIX}period_${snapshot.period}`, transaction);
      const unchanged = previous && previous.hash === snapshot.hash && Number.isFinite(previous.publishedAt);
      const next = { period: snapshot.period, snapshotId: id, hash: snapshot.hash, publishedAt: unchanged ? previous.publishedAt : now() };
      await transaction.collection(COLLECTION).doc(`${PREFIX}period_${snapshot.period}`).set({ data: { ...next, kind: 'meta_monthly' } });
      const periods = [...new Set([snapshot.period, ...(pointer && pointer.periods || [])])].sort().reverse().slice(0, 12);
      const current = !pointer || snapshot.period >= pointer.period ? next : pointer;
      const { _id, ...safeCurrent } = current;
      await transaction.collection(COLLECTION).doc(`${PREFIX}current`).set({ data: { ...safeCurrent, periods, kind: 'meta_monthly' } });
    });
  }
  // Per-player checkpoints exist only to compute one report (TopDeck Developer Terms 8.2).
  // Failure here must never touch the published report, so it is swallowed and retried on the next tick.
  async function cleanup(job) {
    if (!job || job.cleaned) return;
    try {
      const ids = job.candidateIds || [];
      for (let offset = 0; offset < ids.length; offset += 10) {
        await Promise.all(ids.slice(offset, offset + 10).map((id) => collection.doc(eventId(job.period, id)).remove()));
      }
      job.cleaned = true;
      await write(jobId(job.period), job);
    } catch (_) { /* Retried on the next tick. */ }
  }
  const priorPeriod = (period) => engine.previousPeriod(Date.parse(`${period}-01T00:00:00Z`));
  async function tick({ force = false } = {}) {
    const started = now(); const owner = crypto.randomBytes(12).toString('hex');
    const period = engine.previousPeriod(started);
    if (new Date(started).getUTCDate() < 3) return { status: 'grace_period', period };
    const acquired = await db.runTransaction(async (transaction) => {
      const lease = await read(`${PREFIX}lease`, transaction);
      if (lease && lease.until > started) return false;
      await transaction.collection(COLLECTION).doc(`${PREFIX}lease`).set({ data: { owner, until: started + 120000, kind: 'meta_monthly' } });
      return true;
    });
    if (!acquired) return { status: 'busy', period };
    let job;
    try {
      job = await read(jobId(period));
      if (job && job.phase === 'published' && job.modelVersion === engine.MODEL.version && !force) {
        const published = await current(period);
        if (published.snapshot) {
          await cleanup(job);
          return { status: 'up_to_date', period, hash: published.snapshot.hash };
        }
        job = null;
      }
      if (!job || job.modelVersion !== engine.MODEL.version || force) {
        // A job that never finished last month can no longer resume, so its checkpoints go too.
        await cleanup(await read(jobId(priorPeriod(period))));
        const window = engine.periodWindow(period);
        const raw = await api.fetchEvents(key, window);
        const excluded = {}; const candidateIds = [];
        const unique = new Set();
        for (let offset = 0; offset < raw.length; offset += 10) {
          await Promise.all(raw.slice(offset, offset + 10).map(async (event) => {
            if (unique.has(event.TID)) throw new Error('DUPLICATE_EVENTS');
            unique.add(event.TID);
            // Early structural projection only. Actual completion date is verified in the next phase.
            const projected = engine.normalizeEvent(event, { status: 'Complete', endDate: window.end - 1 }, window);
            if (!projected.ok) { excluded[projected.reason] = (excluded[projected.reason] || 0) + 1; return; }
            candidateIds.push(event.TID);
            await write(eventId(period, event.TID), { event: projected.event, verified: false });
          }));
        }
        candidateIds.sort();
        job = { period, modelVersion: engine.MODEL.version, phase: 'info', candidateIds, cursor: 0, includedIds: [], excluded,
          fetchedAt: new Date(started).toISOString(), attempts: 0, scanned: raw.length };
        await write(jobId(period), job);
        return { status: 'collecting', period, candidates: candidateIds.length, scanned: raw.length };
      }
      if (job.phase === 'info') {
        let processed = 0;
        while (job.cursor < job.candidateIds.length && processed < 4 && now() - started < 11000) {
          const id = job.candidateIds[job.cursor];
          const stored = await read(eventId(period, id));
          if (!stored || !stored.event) throw new Error('MISSING_CHECKPOINT');
          const info = await api.fetchInfo(key, id);
          let reason = null;
          if (info.status !== 'Complete' || !Number.isFinite(info.endDate)) reason = 'missing_completion';
          else if (info.endDate >= engine.periodWindow(period).end || info.endDate < stored.event.start) reason = 'finished_after_cutoff';
          else if (info.isTeamEvent) reason = 'unsupported_format';
          if (reason) job.excluded[reason] = (job.excluded[reason] || 0) + 1;
          else {
            stored.event.end = info.endDate;
            await write(eventId(period, id), { event: stored.event, verified: true });
            job.includedIds.push(id);
          }
          job.cursor += 1; processed += 1;
          // Commit after every event: a timeout cannot count it twice on retry.
          job.lastError = null;
          await write(jobId(period), job);
          await api.sleep(1350);
        }
        if (job.cursor === job.candidateIds.length) job.phase = 'publish';
        await write(jobId(period), job);
        return { status: 'verifying', period, processed: job.cursor, candidates: job.candidateIds.length };
      }
      if (job.phase === 'publish') {
        const events = [];
        for (let offset = 0; offset < job.includedIds.length; offset += 10) {
          const docs = await Promise.all(job.includedIds.slice(offset, offset + 10).map((id) => read(eventId(period, id))));
          if (docs.some((doc) => !doc || !doc.verified)) throw new Error('UNVERIFIED_EVENT');
          events.push(...docs.map((doc) => doc.event));
        }
        const cardDoc = await read(`${PREFIX}cards`);
        const cards = await api.fetchCards(events.flatMap((event) => event.records.map((record) => record.leader)), cardDoc && cardDoc.cards || {});
        await write(`${PREFIX}cards`, { cards });
        const prior = await current(priorPeriod(period));
        const snapshot = engine.buildSnapshot({ period, events, cards, excluded: job.excluded, fetchedAt: job.fetchedAt, previous: prior.snapshot });
        await publish(snapshot);
        job.phase = 'published'; job.hash = snapshot.hash; job.lastError = null;
        await write(jobId(period), job);
        await cleanup(job);
        return { status: 'published', period, hash: snapshot.hash, events: events.length, entries: snapshot.coverage.entries };
      }
      throw new Error('INVALID_JOB_PHASE');
    } catch (error) {
      if (job) { job.attempts = (job.attempts || 0) + 1; job.lastError = /^[A-Z0-9_]+$/.test(error.message) ? error.message : 'WORKER_FAILED'; await write(jobId(period), job); }
      throw error;
    } finally {
      await db.runTransaction(async (transaction) => {
        const lease = await read(`${PREFIX}lease`, transaction);
        if (lease && lease.owner === owner) await transaction.collection(COLLECTION).doc(`${PREFIX}lease`).set({ data: { until: 0, owner: '', kind: 'meta_monthly' } });
      });
    }
  }
  async function recordTrigger() { await write(`${PREFIX}scheduler`, { lastTriggeredAt: now(), source: 'wx_trigger' }); }
  async function status() {
    const period = engine.previousPeriod(now());
    const job = await read(jobId(period)); const scheduler = await read(`${PREFIX}scheduler`);
    return { period, phase: job && job.phase || 'not_started', processed: job && job.cursor || 0,
      candidates: job && job.candidateIds && job.candidateIds.length || 0,
      lastError: job && job.lastError || null, attempts: job && job.attempts || 0, cleaned: Boolean(job && job.cleaned),
      lastTriggeredAt: scheduler && scheduler.lastTriggeredAt || null };
  }
  return { current, latest, tick, publish, status, recordTrigger };
}
module.exports = { createService, COLLECTION, PREFIX };
