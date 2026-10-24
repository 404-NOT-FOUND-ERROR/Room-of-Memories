import { CITIES, ROOMS, MEMORIES, DEFAULT_ORDER, roomById, memoryById } from './data.js';
import { createActors, ACTIONS } from './life.js';

export const WORLD_KEY = 'room-of-memories-world-v1';
export const LEGACY_KEY = 'room-of-memories-v3';
export const LEGACY_BACKUP_KEY = 'room-of-memories-v3-before-world';
export const RECOVERY_KEY = 'room-of-memories-before-restore';
const text = (v, n = 600) => typeof v === 'string' ? v.slice(0, n) : '';
const finite = (v, fallback, min, max) => Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : fallback;

export function newWorld(now = Date.now()) {
  return {
    version: 1, created: now, updated: now, lastRoom: 'hotel',
    preferences: { reducedMotion: false, quality: 'balanced', volume: 0.32, order: [...DEFAULT_ORDER], trackId: null },
    rooms: Object.fromEntries(ROOMS.map(r => [r.id, { id: r.id, seed: r.seed, simHour: 16.25, lastWallTime: now, autoTime: true, returnCount: 0, actors: createActors(r.id, 16.25), journal: [], lastEventSlot: 2, poses: [] }])),
    memories: Object.fromEntries(MEMORIES.map(m => [m.id, { id: m.id, note: '', story: '', title: '', discovered: false, photos: [] }])),
    stays: ROOMS.map(r => ({ id: `stay-${r.id}`, roomId: r.id, start: null, end: null, precision: 'unknown' })),
    media: {}, migration: null,
  };
}

export function migrateLegacy(raw, now = Date.now()) {
  const world = newWorld(now);
  if (!raw) return world;
  const legacy = typeof raw === 'string' ? JSON.parse(raw) : raw;
  if (!legacy || typeof legacy !== 'object') throw new Error('旧存档不是有效对象');
  const visits = { ...(legacy.visits || {}) };
  if (roomById(legacy.place) && !visits[legacy.place]) visits[legacy.place] = legacy;
  world.lastRoom = roomById(legacy.place)?.id || 'hotel';
  for (const def of ROOMS) {
    const v = visits[def.id]; if (!v || typeof v !== 'object') continue;
    const room = world.rooms[def.id];
    room.seed = text(v.seed, 48) || def.seed;
    room.simHour = (finite(v.day, 1, 1, 1e6) - 1) * 24 + finite(v.time, 16.25, 0, 23.99);
    room.lastWallTime = finite(v.savedAt, now, 0, now);
    room.autoTime = v.autoTime !== false; room.returnCount = finite(v.returnCount, 0, 0, 1e8);
    room.actors = createActors(def.id, room.simHour); room.lastEventSlot = Math.floor(room.simHour / 6);
    const memory = v.memoryState || {};
    for (const id of def.memories) {
      world.memories[id].note = text(memory.notes?.[id]);
      world.memories[id].discovered = !!memory.discoveries?.[id];
    }
    room.journal = (Array.isArray(memory.events) ? memory.events : []).slice(-24).map((e, i) => ({ id: `legacy-${def.id}-${i}-${text(e.key, 80)}`, origin: 'authored', day: finite(e.day, 1, 1, 1e6), time: text(e.time, 8), text: text(e.text), actor: '', item: memoryById(e.item)?.id || null, action: 'tidy' }));
  }
  world.migration = { from: LEGACY_KEY, at: now };
  return world;
}

export function validDate(value, precision) {
  if (value === null || value === '') return true;
  if (typeof value !== 'string') return false;
  if (precision === 'month') return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
  if (precision !== 'day' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(`${value}T12:00:00Z`); return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

export function validateWorld(value) {
  if (!value || value.version !== 1 || !value.rooms || !value.memories) throw new Error('这不是支持的记忆世界存档');
  const result = newWorld(finite(value.created, Date.now(), 0, 1e15));
  result.updated = finite(value.updated, Date.now(), 0, 1e15);
  result.lastRoom = roomById(value.lastRoom)?.id || 'hotel';
  const p = value.preferences || {};
  result.preferences = { reducedMotion: !!p.reducedMotion, quality: p.quality === 'low' ? 'low' : 'balanced', volume: finite(p.volume, .32, 0, 1), order: Array.isArray(p.order) && p.order.length === 3 && new Set(p.order).size === 3 && p.order.every(id => roomById(id)) ? [...p.order] : [...DEFAULT_ORDER], trackId: typeof p.trackId === 'string' ? p.trackId : null };
  for (const def of ROOMS) {
    const r = value.rooms[def.id];
    if (!r || !Number.isFinite(r.simHour) || r.simHour < 0 || !Number.isFinite(r.lastWallTime)) throw new Error(`房间 ${def.name} 的时间数据无效`);
    const dest = result.rooms[def.id];
    Object.assign(dest, { seed: text(r.seed, 48) || def.seed, simHour: finite(r.simHour, 16.25, 0, 24e6), lastWallTime: finite(r.lastWallTime, Date.now(), 0, 1e15), autoTime: r.autoTime !== false, returnCount: finite(r.returnCount, 0, 0, 1e8), lastEventSlot: finite(r.lastEventSlot, Math.floor(r.simHour / 6), 0, 4e6) });
    if (Array.isArray(r.actors)) dest.actors = dest.actors.map((a, i) => { const old = r.actors[i] || {}; return { ...a, energy: finite(old.energy, a.energy, 0, 100), fullness: finite(old.fullness, a.fullness, 0, 100), company: finite(old.company, a.company, 0, 100), order: finite(old.order, a.order, 0, 100), action: ACTIONS[old.action] ? old.action : a.action, station: ACTIONS[old.action]?.station || a.station, nextDecision: finite(old.nextDecision, r.simHour, 0, 24e6) }; });
    dest.journal = (Array.isArray(r.journal) ? r.journal : []).slice(-40).map(e => ({ id: text(e.id, 150), origin: e.origin === 'authored' ? 'authored' : 'simulated', day: finite(e.day, 1, 1, 1e6), time: text(e.time, 8), actor: text(e.actor, 30), text: text(e.text), item: memoryById(e.item)?.id || null, action: ACTIONS[e.action] ? e.action : 'tidy' }));
    dest.poses = (Array.isArray(r.poses) ? r.poses : []).slice(0, def.people.length).filter(x => [x.x, x.y, x.z, x.yaw].every(Number.isFinite) && Math.max(Math.abs(x.x), Math.abs(x.y), Math.abs(x.z)) < 200).map(x => ({ x: x.x, y: x.y, z: x.z, yaw: x.yaw, station: ['sleep', 'desk', 'window', 'water', 'cushion', 'bathroom'].includes(x.station) ? x.station : 'window' }));
  }
  for (const def of MEMORIES) {
    const m = value.memories[def.id]; if (!m) throw new Error('存档缺少记忆物件');
    result.memories[def.id] = { id: def.id, note: text(m.note), title: text(m.title, 80), story: text(m.story, 2000), discovered: !!m.discovered, photos: (Array.isArray(m.photos) ? m.photos : []).filter(id => typeof id === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(id)).slice(0, 12) };
  }
  result.stays = (Array.isArray(value.stays) ? value.stays : []).slice(0, 300).map((s, i) => {
    if (!roomById(s.roomId) || !['day', 'month', 'unknown'].includes(s.precision) || !validDate(s.start, s.precision) || !validDate(s.end, s.precision) || s.start && s.end && s.start > s.end) throw new Error('停留日期无效');
    return { id: text(s.id, 90) || `stay-${i}`, roomId: s.roomId, start: s.start || null, end: s.end || null, precision: s.precision };
  });
  for (const [id, meta] of Object.entries(value.media || {})) {
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id) || !meta || !['photo', 'audio'].includes(meta.kind)) throw new Error('媒体记录无效');
    result.media[id] = { id, kind: meta.kind, name: text(meta.name, 160), type: text(meta.type, 80), size: finite(meta.size, 0, 0, 80e6) };
  }
  for (const m of Object.values(result.memories)) if (m.photos.some(id => result.media[id]?.kind !== 'photo')) throw new Error('照片引用不完整');
  if (result.preferences.trackId && result.media[result.preferences.trackId]?.kind !== 'audio') throw new Error('音乐引用不完整');
  result.migration = value.migration?.from === LEGACY_KEY ? { from: LEGACY_KEY, at: finite(value.migration.at, Date.now(), 0, 1e15) } : null;
  return result;
}

export function routeFromHash(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/');
  if (parts[0] === 'city' && CITIES.some(c => c.id === parts[1])) return { kind: 'city', id: parts[1] };
  if (parts[0] === 'room' && roomById(parts[1])) return { kind: 'room', id: parts[1] };
  return { kind: 'world', id: null };
}
export const hashFor = route => route.kind === 'world' ? '#world' : `#${route.kind}/${route.id}`;
