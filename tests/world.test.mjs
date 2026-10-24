import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, migrateLegacy, validateWorld, validDate, routeFromHash, hashFor } from '../src/model.js';
import { journeyAt, STATIONS } from '../src/journey.js';
import { advanceWorld, advanceRoom, setRoomHour, MAX_CATCHUP_HOURS } from '../src/life.js';
import { validateBackup } from '../src/storage.js';

test('legacy notes, discoveries, visits and paused time survive migration without changing the input', () => {
  const legacy = { place: 'turin', visits: { turin: { seed: 'my-seed', time: 9.25, day: 4, autoTime: false, returnCount: 8, savedAt: 1234, memoryState: { notes: { 'turin-note': '那年窗边的日子 <script>不应执行</script>' }, discoveries: { 'turin-note': true }, events: [{ key: 'old', day: 4, time: '09:00', text: '旧的片段', item: 'turin-note' }] } } } };
  const raw = JSON.stringify(legacy), world = migrateLegacy(raw, 2000), copy = validateWorld(JSON.parse(JSON.stringify(world)));
  assert.equal(JSON.stringify(legacy), raw); assert.equal(copy.lastRoom, 'turin'); assert.equal(copy.memories['turin-note'].note, legacy.visits.turin.memoryState.notes['turin-note']);
  assert.equal(copy.memories['turin-note'].discovered, true); assert.equal(copy.rooms.turin.simHour, 81.25); assert.equal(copy.rooms.turin.autoTime, false); assert.equal(copy.rooms.turin.returnCount, 8); assert.equal(copy.rooms.turin.journal[0].origin, 'authored');
  advanceWorld(copy, 1e9); assert.equal(copy.rooms.turin.simHour, 81.25); assert.equal(copy.rooms.turin.seed, 'my-seed');
});
test('single-room legacy top-level storage is also migrated', () => {
  const world = migrateLegacy({ place: 'hotel', time: 12, day: 2, memoryState: { notes: { 'hotel-tea': '热茶' } } }, 100);
  assert.equal(world.rooms.hotel.simHour, 36); assert.equal(world.memories['hotel-tea'].note, '热茶');
});
test('unknown dates remain unknown and month/day accuracy is validated', () => {
  assert.equal(validDate(null, 'unknown'), true); assert.equal(validDate('2024-02-29', 'day'), true); assert.equal(validDate('2025-02-29', 'day'), false); assert.equal(validDate('2020-13', 'month'), false); assert.equal(validDate('2020-12', 'month'), true); assert.equal(validDate('2020-12', 'unknown'), false);
  const w = newWorld(0); assert.equal(validateWorld(w).stays[0].start, null); w.stays[0] = { ...w.stays[0], precision: 'day', start: '2023-02-01', end: '2023-01-01' }; assert.throws(() => validateWorld(w), /停留日期/);
});
test('offline time is bounded, consumed once, and generated events have stable unique ids', () => {
  const world = newWorld(0), note = '自己的原话'; world.memories['hotel-tea'].note = note;
  const result = advanceWorld(world, 10 * 24 * 3600e3); const room = world.rooms.hotel;
  assert.equal(result.hotel.hours, MAX_CATCHUP_HOURS); assert.equal(result.hotel.capped, true); assert.equal(room.simHour, 16.25 + 48); assert.equal(room.journal.length, 8);
  const snapshot = JSON.stringify(world); advanceWorld(world, 10 * 24 * 3600e3); assert.equal(JSON.stringify(world), snapshot);
  assert.equal(new Set(room.journal.map(e => e.id)).size, room.journal.length); assert.equal(world.memories['hotel-tea'].note, note); assert.ok(room.journal.every(e => e.origin === 'simulated'));
});
test('paused life consumes wall time without a catch-up jump when resumed', () => {
  const r = newWorld(1000).rooms.dorm; r.autoTime = false; advanceRoom(r, 1001000); assert.equal(r.simHour, 16.25); r.autoTime = true; advanceRoom(r, 1002000); assert.equal(r.simHour, 16.275);
});
test('needs remain within bounds, evening gathers roommates, and night restores energy', () => {
  const r = newWorld(0).rooms.turin; setRoomHour(r, 18.5, 0); assert.ok(r.actors.every(a => a.action === 'social')); const company = r.actors[0].company; advanceRoom(r, 10000); assert.ok(r.actors[0].company > company);
  setRoomHour(r, 23, 10000); const energy = r.actors[0].energy; advanceRoom(r, 50000); assert.ok(r.actors[0].energy > energy);
  advanceRoom(r, 1e8); for (const a of r.actors) for (const key of ['energy', 'fullness', 'company', 'order']) assert.ok(a[key] >= 0 && a[key] <= 100);
});
test('rewinding a room cannot duplicate already recorded life events', () => {
  const r = newWorld(0).rooms.hotel; advanceRoom(r, 160000); const ids = r.journal.map(e => e.id); setRoomHour(r, 16, 160000); advanceRoom(r, 320000); assert.deepEqual(r.journal.map(e => e.id), ids);
});
test('dorm roommates use the shared washing station one at a time', () => {
  const r = newWorld(0).rooms.dorm; setRoomHour(r, 7.5, 0); const users = new Set();
  for (let now = 1000; now < 80000; now += 1000) { advanceRoom(r, now); const washing = r.actors.filter(a => a.action === 'bathroom'); assert.ok(washing.length <= 1); washing.forEach(a => users.add(a.id)); }
  assert.equal(users.size, 4);
});
test('journey stops, seek and custom order do not change life or real dates', () => {
  const w = newWorld(0), before = JSON.stringify(w); const expected = ['#world', '#city/hongkong', '#room/hotel', '#city/turin', '#room/turin', '#city/shanghai', '#room/dorm'];
  assert.deepEqual([.16,.50,.84].map(p => journeyAt(p).roomId), ['hotel','turin','dorm']);
  assert.equal(journeyAt(.2, ['dorm', 'hotel', 'turin']).roomId, 'dorm'); assert.equal(JSON.stringify(w), before);
  for (const hash of expected) assert.equal(hashFor(routeFromHash(hash)), hash); assert.equal(routeFromHash('#room/missing').kind, 'world');
});
test('traveller position is continuous at arrival and departure, including a reversed itinerary', () => {
  for(const order of [['hotel','turin','dorm'],['dorm','hotel','turin']]) {
    for(const boundary of [.12,.22,.45,.55,.78,.9]) assert.ok(Math.abs(journeyAt(boundary-1e-8,order).angle-journeyAt(boundary+1e-8,order).angle)<1e-6);
    assert.equal(journeyAt(.15,order).angle,journeyAt(.21,order).angle);
  }
  assert.equal(journeyAt(.5).angle,STATIONS.turin);
  assert.equal(journeyAt(Infinity).progress,0);assert.equal(journeyAt(-1).progress,0);assert.equal(journeyAt(2).progress,1);
});
test('full backup validates notes, photo and music references without remote URLs', () => {
  const w = newWorld(0); w.memories['hotel-tea'].note = '回来的时候还想看到你。'; w.media.p = { kind: 'photo', type: 'image/png', name: 'test.png', size: 3 }; w.memories['hotel-tea'].photos = ['p']; w.media.a = { kind: 'audio', type: 'audio/wav', name: 'test.wav', size: 3 }; w.preferences.trackId = 'a';
  const payload = { format: 'room-of-memories', version: 1, world: w, assets: { p: 'data:image/png;base64,AQID', a: 'data:audio/wav;base64,AQID' } };
  const checked = validateBackup(JSON.parse(JSON.stringify(payload))); assert.equal(checked.world.memories['hotel-tea'].note, w.memories['hotel-tea'].note); assert.equal(checked.bytes, 6);
  payload.assets.p = 'https://example.com/private-photo'; assert.throws(() => validateBackup(payload), /媒体格式/);
  delete payload.assets.p; assert.throws(() => validateBackup(payload), /缺少/);
  payload.assets.p = 'data:audio/wav;base64,AQID'; assert.throws(() => validateBackup(payload), /不一致/);
});
test('invalid storage cannot silently erase missing rooms or broken media', () => {
  const w = newWorld(0); w.rooms.hotel.simHour = NaN; assert.throws(() => validateWorld(w), /时间数据/); w.rooms.hotel.simHour = 1; w.memories['hotel-tea'].photos = ['missing']; assert.throws(() => validateWorld(w), /照片引用/);
});
