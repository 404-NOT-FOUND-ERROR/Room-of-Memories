import { ROOMS, clockText } from './data.js';

export const HOURS_PER_SECOND = 0.025;
export const MAX_CATCHUP_HOURS = 48;
const clamp = n => Math.max(0, Math.min(100, n));
export const ACTIONS = {
  sleep: { key: 'sleep', station: 'sleep', label: '休息', text: '已经安静地睡着了', diary: '把被角掖好，给房间留下一点安静。' },
  eat: { key: 'tea', station: 'desk', label: '吃点东西', text: '在桌边吃点东西，捧起热茶', diary: '吃过东西，把杯子留在顺手的位置。' },
  read: { key: 'read', station: 'cushion', label: '阅读', text: '坐下来读还没读完的那一页', diary: '坐在熟悉的位置，又读了几页书。' },
  write: { key: 'write', station: 'desk', label: '写字', text: '回到自己的书桌前写几行字', diary: '桌上多了一页今天写下的小事。' },
  window: { key: 'afternoon', station: 'window', label: '看风景', text: '走到窗边，看一会儿外面的光', diary: '在窗边停了一会儿，看光慢慢移过地面。' },
  water: { key: 'water', station: 'water', label: '照顾绿植', text: '给窗旁的小绿植浇一点水', diary: '给绿植浇了水，又把叶片理顺。' },
  tidy: { key: 'write', station: 'desk', label: '整理', text: '整理桌上的纸张和杯子', diary: '把桌面收拾了一下，熟悉的小物件还在。' },
  social: { key: 'living', station: 'cushion', label: '和室友相聚', text: '在共享空间里，听室友说今天的小事', diary: '和室友在共享空间里坐了一会儿，灯留到了晚一点。' },
  bathroom: { key: 'corridor', station: 'bathroom', label: '洗漱', text: '穿过门外的走廊，去公共卫浴洗漱', diary: '和室友错开时间洗漱，回来时阳台边正好有光。' },
  rest: { key: 'rest', station: 'cushion', label: '小憩', text: '靠着软垫休息，听外面的风', diary: '在软垫上小憩，醒来时房间仍然温暖。' },
};

export function createActors(roomId, simHour) {
  return ROOMS.find(r => r.id === roomId).people.map((name, i) => ({
    id: `${roomId}-${i}`, name, energy: 68 + i * 4, fullness: 60 - i * 5, company: 64 + i * 3, order: 70 - i * 4,
    action: ['window', 'write', 'read', 'water'][i % 4], nextDecision: simHour, station: ['window', 'desk', 'cushion', 'water'][i % 4],
  }));
}

function decide(actor, room, i, hour) {
  const t = (hour % 24 + 24) % 24;
  if (t < 6.5 || t >= 22.5 + i * 0.12) return 'sleep';
  if (room.id === 'dorm' && t >= 7.6 + i * 0.25 && t < 8.1 + i * 0.25) return 'bathroom';
  if (room.id !== 'hotel' && t >= 18.2 && t < 19.5 && actor.energy > 18) return 'social';
  if (actor.energy < 25) return 'rest';
  if (actor.fullness < 30 || ((t >= 12 && t < 13 || t >= 19.5 && t < 20.2) && actor.fullness < 70)) return 'eat';
  if (actor.order < 36) return 'tidy';
  if (actor.company < 35 && room.id !== 'hotel') return 'social';
  const choices = ['window', 'write', 'read', 'water', 'tidy', 'read'];
  return choices[(Math.floor(hour / 1.4) + i * 2 + room.seed.length) % choices.length];
}

function step(room, delta, hour) {
  let bathroomTaken = false;
  room.actors.forEach((a, i) => {
    let forced = decide(a, room, i, hour);
    if (forced === 'bathroom') { if (bathroomTaken) forced = 'window'; else bathroomTaken = true; }
    if (a.action === 'bathroom' && forced !== 'bathroom') a.nextDecision = hour;
    if (hour >= a.nextDecision || forced === 'sleep' || forced === 'bathroom' || forced === 'social' && hour % 24 >= 18.2 && hour % 24 < 19.5) {
      a.action = forced; a.nextDecision = hour + 0.65 + i * 0.07; a.station = ACTIONS[forced].station;
    }
    a.energy = clamp(a.energy + delta * (a.action === 'sleep' ? 24 : a.action === 'rest' ? 16 : -4.6));
    a.fullness = clamp(a.fullness + delta * (a.action === 'eat' ? 62 : -7.5));
    a.company = clamp(a.company + delta * (a.action === 'social' ? 28 : room.id === 'hotel' ? -0.5 : -2.2));
    a.order = clamp(a.order + delta * (a.action === 'tidy' ? 36 : -2.3));
  });
  const slot = Math.floor(hour / 6), key = `${room.id}:${slot}`;
  if (slot > (room.lastEventSlot ?? Math.floor((room.simHour || hour) / 6))) {
    const idx = slot % room.actors.length, actor = room.actors[idx];
    const effectByRoom = { hotel: ['hotel-tea', 'hotel-suitcase', 'hotel-room-card'], turin: ['turin-mug', 'turin-note', 'turin-keys'], dorm: ['dorm-balcony-shirt', 'dorm-mug', 'dorm-timetable'] };
    if (!room.journal.some(e => e.id === key)) room.journal.push({ id: key, origin: 'simulated', day: Math.floor(hour / 24) + 1, time: clockText(hour), actor: actor.name, text: `${actor.name}${ACTIONS[actor.action].diary}`, action: actor.action, item: effectByRoom[room.id][slot % 3] });
    room.journal = room.journal.slice(-40); room.lastEventSlot = slot;
  }
}

// All three clocks stay separate: this module never receives music position or history dates.
// Large absences use at most 48 simulation hours; elapsed wall time is consumed exactly once.
export function advanceRoom(room, now) {
  const elapsedSeconds = Math.max(0, (now - room.lastWallTime) / 1000);
  room.lastWallTime = Math.max(room.lastWallTime, now);
  if (!room.autoTime) return { hours: 0, capped: false, events: 0 };
  const requested = elapsedSeconds * HOURS_PER_SECOND;
  const hours = Math.min(requested, MAX_CATCHUP_HOURS), start = room.simHour, before = room.journal.length;
  let progressed = 0;
  while (progressed < hours - 1e-9) {
    const dt = Math.min(0.25, hours - progressed);
    progressed += dt; step(room, dt, start + progressed);
  }
  room.simHour = start + hours;
  return { hours, capped: requested > hours, events: Math.max(0, room.journal.length - before) };
}
export function advanceWorld(world, now) {
  return Object.fromEntries(Object.values(world.rooms).map(room => [room.id, advanceRoom(room, now)]));
}
export function actionFor(actor) { return ACTIONS[actor.action] || ACTIONS.window; }
export function setRoomHour(room, hour, now) {
  room.simHour = Math.floor(room.simHour / 24) * 24 + Math.max(0, Math.min(23.99, Number(hour) || 0));
  room.lastEventSlot = Math.floor(room.simHour / 6);
  room.lastWallTime = now;
  let bathroomTaken = false;
  room.actors.forEach((a, i) => { a.action = decide(a, room, i, room.simHour); if (a.action === 'bathroom') { if (bathroomTaken) a.action = 'window'; else bathroomTaken = true; } a.station = ACTIONS[a.action].station; a.nextDecision = room.simHour + 0.65; });
}
