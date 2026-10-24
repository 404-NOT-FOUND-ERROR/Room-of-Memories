import { CITIES, ROOMS, MEMORIES, cityById, roomById, memoryById, clockText, roomDay } from './data.js';
import { WORLD_KEY, LEGACY_BACKUP_KEY, RECOVERY_KEY, routeFromHash, hashFor, validDate } from './model.js';
import { advanceWorld, actionFor, setRoomHour } from './life.js';
import { loadWorld, saveWorld, getMedia, putMedia, preparePhoto, exportBackup, validateBackup, restoreBackup, recoverPreviousWorld, downloadFile } from './storage.js';
import { MusicPlanetScene } from './scene/music-planet.js';
import { journeyAt } from './journey.js';
import { Music } from './music.js';
import { LatestNavigation } from './navigation.js';
import { Motion } from './motion.js';

const $ = id => document.getElementById(id);
const el = (tag, className, content) => { const node = document.createElement(tag); if (className) node.className = className; if (content !== undefined) node.textContent = content; return node; };
const button = (label, className, action) => { const node = el('button', className, label); node.type = 'button'; node.onclick = action; return node; };
const icons = () => window.lucide.createIcons();
const CHANNEL = 'memory-world-room-v1';
const stats = { created: 0, disposed: 0, switches: 0, room: null, errors: [] };
addEventListener('error', event => { if (event.filename) stats.errors.push({ message: event.message, source: event.filename }); });
addEventListener('unhandledrejection', event => stats.errors.push({ message: event.reason?.message || String(event.reason) }));
let world, route, planet = null, frame = null, sceneToken = 0, tour = false, currentMemory = null, journalTab = 'memories', photoUrls = [], photoToken = 0, toastTimer, saveTimer, lastAudioPaint = 0, lastFrame = performance.now(), lastMusicIcon = '', busyMusic = false, mutedVolume = .32, memoryTimer, restoreCandidate;
let sceneReady = false, lastJourneyPaint = 0, renderedRoute = null, pendingRoom = null, seekPreview = null;
const navigation = new LatestNavigation(), motion = new Motion(() => world?.preferences);
const setText = (node, text) => { if (node.textContent !== text) node.textContent = text; };

function toast(message) { $('toast').textContent = message; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 5000); }
function errorMessage(error) { toast(error?.message || String(error)); }
function persist() { try { saveWorld(world); return true; } catch (error) { errorMessage(error); return false; } }
function send(type, payload = {}) { frame?.contentWindow?.postMessage({ channel: CHANNEL, type, ...payload }, location.origin); }
function hostState(id) { return { ...world.rooms[id], memories: Object.fromEntries(roomById(id).memories.map(key => [key, world.memories[key]])), reducedMotion: motion.reduced, quality: world.preferences.quality }; }
function visitRecord(id) { const r = world.rooms[id]; return { seed: r.seed, day: roomDay(r), time: r.simHour % 24, autoTime: r.autoTime, returnCount: r.returnCount, savedAt: r.lastWallTime, memoryState: { notes: {}, discoveries: {}, events: [], eventKeys: [] } }; }
function flushRoom() {
  if (!frame) return;
  try { const result = frame.contentWindow?.roommateIsle?.flush(); if (result && world.rooms[result.roomId]) world.rooms[result.roomId].poses = result.poses; } catch {}
}
function disposeScene() {
  sceneReady = false;
  pendingRoom?.finish(false); pendingRoom = null;
  if (planet) { planet.dispose(); planet = null; stats.disposed++; }
  if (frame) { flushRoom(); try { frame.contentWindow?.roommateIsle?.destroy(); } catch {} frame.remove(); frame = null; stats.disposed++; stats.room = null; }
}
function stopTour(announce = false) { if (!tour) return; tour = false; if (planet) planet.following = false; if (announce) toast('可以自由转动星球，音乐和脚步继续。'); paintMusic(true); }
function navigate(next, { automatic = false, replace = false, force = false } = {}) {
  if (!automatic) stopTour();
  if (!force && route && hashFor(route) === hashFor(next)) return;
  if (location.hash !== hashFor(next)) history[replace || automatic ? 'replaceState' : 'pushState']({}, '', hashFor(next));
  showRoute(next, force).catch(errorMessage);
}
async function showRoute(next, force = false) {
  const ticket = navigation.begin(), token = ++sceneToken, previous = renderedRoute;
  const fullTransition = force || next.kind === 'room' || !!frame || !planet || !sceneReady;
  route = next; stats.switches++;
  $('fatal').hidden = true;
  $('viewport').setAttribute('aria-busy', 'true');
  paintCities();
  if (fullTransition) {
    $('viewport').inert = true;
    const name = next.kind === 'room' ? roomById(next.id).name : next.kind === 'city' ? cityById(next.id).name : '回到回忆的小星球';
    await ticket.wait(motion.cover(name, next.kind === 'room' ? '推开门，生活还在这里。' : '那些走过的地方，都还在。'));
  } else if (previous) {
    await ticket.wait(motion.run(document.querySelector('.world-copy'), [{ opacity: 1 }, { opacity: 0, transform: 'translateY(-6px)' }], 100));
  }
  if (!ticket.current()) return;
  renderedRoute = next;
  $('world-view').hidden = next.kind === 'room'; $('room-view').hidden = next.kind !== 'room';
  document.documentElement.dataset.view = next.kind;
  document.title = `${next.kind === 'world' ? '我的记忆世界' : next.kind === 'city' ? cityById(next.id).name : roomById(next.id).name} · 还住在这里`;
  paintBreadcrumbs();
  if (next.kind === 'room') {
    disposeScene();
    if (!force || previous?.id !== next.id) world.rooms[next.id].returnCount++;
    world.lastRoom = next.id; $('last-room').title = `回到${roomById(next.id).name}`; persist();
    paintRoom(); $('room-view').scrollTop = 0; $('room-info').scrollTop = 0;
    $('room-loading').hidden = false; $('room-loading').textContent = '熟悉的房间正在醒来…';
    $('room-focus').setAttribute('aria-pressed', 'false');
    frame = document.createElement('iframe'); frame.title = `${roomById(next.id).name}的三维房间`; frame.src = `./room/index.html?embedded&room=${next.id}`;
    const ready = new Promise(resolve => {
      const timer = setTimeout(() => {
        if (ticket.current() && !sceneReady) $('room-loading').textContent = '房间连接较慢。可以返回城市，再次推门进入。';
        finish(false);
      }, 16000);
      const finish = value => { clearTimeout(timer); resolve(value); };
      pendingRoom = { token, roomId: next.id, finish };
    });
    $('room-host').append(frame); stats.created++;
    await ticket.wait(ready);
  } else {
    if (frame || force) disposeScene();
    paintCityDetail();
    if (!planet) {
      $('planet-loading').hidden = false;
      const scene = new MusicPlanetScene($('planet-host'), id => navigate({ kind: 'city', id }), { ...world.preferences, reducedMotion: motion.reduced }, id => navigate({ kind: 'room', id }), () => stopTour());
      planet = scene; stats.created++; scene.ready = scene.init();
    }
    const scene = planet;
    try {
      await ticket.wait(scene.ready);
      if (!ticket.current() || planet !== scene || !scene.active) return;
      sceneReady = true; $('planet-loading').hidden = true;
      if (next.kind === 'city') scene.focus(next.id);
      else { scene.overview(); if (tour) scene.follow(); }
    } catch (error) {
      if (!ticket.current() || error.name === 'AbortError' || planet !== scene) return;
      scene.dispose(); planet = null; stats.disposed++;
      $('planet-loading').textContent = '音乐星球暂时没有画出来。仍可使用下方城市入口。'; errorMessage(error);
    }
  }
  if (!ticket.current()) return;
  $('viewport').inert = false; $('viewport').setAttribute('aria-busy', 'false');
  if (!$('scene-curtain').hidden) motion.reveal(ticket);
  motion.enter(next.kind === 'room' ? [$('room-info'), $('room-host')] : [document.querySelector('.world-copy'), document.querySelector('.journey-status')]);
  const heading = next.kind === 'room' ? $('room-title') : document.querySelector(next.kind === 'city' ? '#city-detail h1' : '#world-intro h1');
  if (previous && !document.querySelector('dialog[open]') && heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }); }
  paintDiagnostics();
}

function paintBreadcrumbs() {
  const nav = $('breadcrumbs'); nav.replaceChildren();
  nav.append(button('音乐星球', '', () => navigate({ kind: 'world', id: null })));
  if (route.kind === 'world') { nav.lastElementChild.setAttribute('aria-current', 'page'); return; }
  const city = cityById(route.kind === 'city' ? route.id : roomById(route.id).cityId);
  nav.append(el('span', '', '/'), button(city.name, '', () => navigate({ kind: 'city', id: city.id })));
  if (route.kind === 'room') nav.append(el('span', '', '/'), el('span', '', roomById(route.id).short));
  nav.lastElementChild.setAttribute('aria-current', 'page');
}
function paintCities() {
  $('city-list').replaceChildren(...CITIES.map(city => {
    const b = button('', 'city-tab', () => navigate({ kind: 'city', id: city.id })); b.setAttribute('aria-label', `查看${city.name}`); b.setAttribute('aria-pressed', String(route.kind === 'city' && route.id === city.id));
    const dot = el('span', 'city-dot'); dot.style.background = city.color; const words = el('div'), detail = el('small'); detail.append(el('span', 'city-en', `${city.en} · `), el('span', '', `${city.rooms.length} 处房间`)); words.append(el('strong', '', city.name), detail); b.append(dot, words, el('span', '', '↗')); return b;
  }));
}
function paintCityDetail() {
  document.querySelector('.journey-status').hidden=route.kind==='city';
  const detail = $('city-detail'); detail.hidden = route.kind !== 'city'; $('world-intro').hidden = route.kind === 'city'; if (route.kind !== 'city') return;
  const city = cityById(route.id); detail.replaceChildren(el('span', 'eyebrow', city.en), el('h1', '', city.name), el('p', 'city-description', city.description));
  for (const id of city.rooms) {
    const def = roomById(id), card = el('article', 'place-card'), img = el('img'); img.src = def.image; img.alt = `${def.name}微缩房间预览`;
    const body = el('div', 'place-card-content'); body.append(el('h3', '', def.name), el('p', '', `${def.duration} · ${def.people.length} 位虚拟住户\n${def.subtitle}`), button('推门，回去看看 →', 'primary-button', () => navigate({ kind: 'room', id })));
    card.append(img, body); detail.append(card);
  }
  const knownStays = world.stays.filter(stay => city.rooms.includes(stay.roomId) && (stay.start || stay.end));
  detail.append(el('p', 'city-quiet-note', knownStays.length ? `已记录 ${knownStays.length} 段停留日期 · 在记忆册中查看` : '城市收着房间，房间留着那时的你。'), button('← 继续在星球上走走', 'text-button', () => navigate({ kind: 'world', id: null })));
}
function paintRoom() {
  if (route?.kind !== 'room') return;
  const def = roomById(route.id), room = world.rooms[route.id];
  $('room-city').textContent = `${cityById(def.cityId).en} / ${def.short}`;
  $('room-title').textContent = def.name; $('room-description').textContent = def.description;
  $('room-day').textContent = `模拟生活 · 第 ${roomDay(room)} 天`; $('room-time').textContent = clockText(room.simHour);
  $('room-pause').textContent = room.autoTime ? '让时间停一会儿' : '让生活继续';
  $('room-pause').setAttribute('aria-pressed', String(!room.autoTime));
  if (document.activeElement !== $('room-time-slider')) $('room-time-slider').value = room.simHour % 24;
  if ($('resident-list').dataset.room !== route.id) {
    $('resident-list').dataset.room = route.id;
    $('resident-list').replaceChildren(...room.actors.map(actor => {
      const row = el('div', 'resident'), body = el('div'); row.dataset.actor = actor.id;
      body.append(el('strong'), el('p')); row.append(el('span', 'avatar', actor.name.slice(-1)), body); return row;
    }));
    $('room-memories').replaceChildren(...def.memories.map(id => {
      const b = button('', 'memory-chip', () => openMemory(id)); b.dataset.memory = id; b.append(el('b'), el('span')); return b;
    }));
  }
  for (const row of $('resident-list').children) {
    const actor = room.actors.find(a => a.id === row.dataset.actor);
    setText(row.querySelector('strong'), `${actor.name} · ${actionFor(actor).label}`);
    setText(row.querySelector('p'), `精力 ${Math.round(actor.energy)} · 饱腹 ${Math.round(actor.fullness)}\n陪伴 ${Math.round(actor.company)} · 整理 ${Math.round(actor.order)}`);
  }
  setText($('found-count'), `${def.memories.filter(id => world.memories[id].discovered).length} / ${def.memories.length}`);
  for (const b of $('room-memories').children) {
    const id = b.dataset.memory, m = world.memories[id];
    setText(b.querySelector('b'), m.title || memoryById(id).name);
    setText(b.querySelector('span'), m.note || m.story || m.photos.length ? '已留下记忆' : '打开 →');
  }
}
function openDialog(id) {
  const dialog = $(id); dialog.classList.remove('is-closing');
  if (!dialog.open) dialog.showModal();
  motion.run(dialog, [{ opacity: 0, transform: 'translateY(16px) scale(.985)' }, { opacity: 1, transform: 'translateY(0) scale(1)' }], 360);
}
async function closeDialog(id) {
  const dialog = $(id); if (!dialog.open || dialog.classList.contains('is-closing')) return;
  dialog.classList.add('is-closing');
  await motion.run(dialog, [{ opacity: 1, transform: 'translateY(0)' }, { opacity: 0, transform: 'translateY(8px)' }], 180);
  if (dialog.classList.contains('is-closing')) { dialog.close(); dialog.classList.remove('is-closing'); }
}
async function closeMemory() {
  const id = currentMemory; saveMemory(); currentMemory = null; clearTimeout(memoryTimer);
  if ($('journal-dialog').open) paintJournal();
  await closeDialog('memory-dialog');
  if (!$('memory-dialog').open) {
    clearPhotos();
    $('journal-content').querySelector(`[data-memory="${id}"]`)?.focus({ preventScroll: true });
  }
}

function clearPhotos() { photoToken++; photoUrls.forEach(url => URL.revokeObjectURL(url)); photoUrls = []; }
function openMemory(id) {
  const def = memoryById(id); if (!def) return;
  stopTour();
  if (currentMemory) saveMemory(); currentMemory = id; const memory = world.memories[id]; memory.discovered = true;
  $('memory-room-name').textContent = `${roomById(def.roomId).name} · 我的物件`; $('memory-title').textContent = memory.title || def.title; $('memory-original').textContent = def.story;
  $('memory-custom-title').value = memory.title; $('memory-story').value = memory.story; $('memory-note').value = memory.note; $('memory-save-status').textContent = '只保存在这台设备的当前浏览器';
  persist(); paintRoom(); if (route.kind === 'room') send('state', { state: hostState(route.id) }); openDialog('memory-dialog'); paintPhotos().catch(errorMessage);
}
function saveMemory() {
  clearTimeout(memoryTimer); if (!currentMemory) return;
  const memory = world.memories[currentMemory]; memory.title = $('memory-custom-title').value.slice(0, 80); memory.story = $('memory-story').value.slice(0, 2000); memory.note = $('memory-note').value.slice(0, 600);
  $('memory-title').textContent = memory.title || memoryById(currentMemory).title;
  $('memory-save-status').textContent = persist() ? '这段记忆已经保存在本机。' : '尚未保存，请导出备份。'; paintRoom();
  if (route.kind === 'room') send('state', { state: hostState(route.id) });
}
async function paintPhotos() {
  clearPhotos(); const token = photoToken, id = currentMemory; $('memory-photos').replaceChildren(); if (!id) return;
  for (const mediaId of world.memories[id].photos) {
    const blob = await getMedia(mediaId); if (token !== photoToken || currentMemory !== id) return;
    const item = el('div', 'photo-item');
    if (blob) { const img = el('img'); img.src = URL.createObjectURL(blob); photoUrls.push(img.src); img.alt = world.media[mediaId]?.name || '我留下的照片'; item.append(img); } else item.append(el('p', 'fine', '照片未找到，请从备份恢复'));
    const remove = button('×', '', () => { world.memories[id].photos = world.memories[id].photos.filter(x => x !== mediaId); persist(); paintPhotos().catch(errorMessage); }); remove.setAttribute('aria-label', `移除照片 ${world.media[mediaId]?.name || ''}`); item.append(remove); $('memory-photos').append(item);
  }
}
async function addPhotos(files) {
  const id = currentMemory; if (!id) return;
  if (world.memories[id].photos.length + files.length > 12) throw new Error('每件物品最多保存 12 张照片');
  $('memory-save-status').textContent = '正在整理照片…';
  for (const file of files) { const blob = await preparePhoto(file), mediaId = `photo-${crypto.randomUUID()}`; await putMedia([[mediaId, blob]]); world.media[mediaId] = { id: mediaId, kind: 'photo', name: file.name, size: blob.size, type: blob.type }; world.memories[id].photos.push(mediaId); persist(); }
  if (currentMemory === id) { await paintPhotos(); $('memory-save-status').textContent = '照片已经保存在本机。'; }
}
function openJournal(roomId = world.lastRoom) { $('journal-room').value = roomId; paintJournal(); openDialog('journal-dialog'); }
function paintJournal() {
  const id = $('journal-room').value, def = roomById(id), container = $('journal-content'); container.replaceChildren();
  ['memories', 'life', 'stays'].forEach(name => $(`tab-${name}`).setAttribute('aria-pressed', String(journalTab === name)));
  if (journalTab === 'memories') {
    for (const memoryId of def.memories) { const m = world.memories[memoryId], b = button('', 'journal-memory', () => openMemory(memoryId)); b.dataset.memory = memoryId; b.append(el('strong', '', m.title || memoryById(memoryId).name), el('p', '', m.note || m.story || '还没有写下自己的记忆。'), el('small', '', `我的记录 · ${m.photos.length} 张照片 · 点击编辑`)); container.append(b); }
  } else if (journalTab === 'life') {
    container.append(el('p', 'fine', '下面是程序模拟或原项目创作的片段，不是你当年的真实经历。关闭页面后不在后台运行；回来时最多补算 48 个模拟小时。'));
    const events = world.rooms[id].journal.slice().reverse(); if (!events.length) container.append(el('p', 'empty-note', '生活才刚刚继续。过一会儿，再来看看这里留下的小事。'));
    for (const event of events) { const entry = el('article', 'life-entry'); entry.append(el('small', '', `${event.origin === 'authored' ? '原项目创作' : '模拟生活'} · 第 ${event.day} 天 · ${event.time}`), el('p', '', event.text)); container.append(entry); }
  } else {
    container.append(el('p', 'fine', '日期不知道就留空；只记得月份也可以。这里的日期不会改变房间时间和音乐回访顺序。'));
    for (const stay of world.stays.filter(s => s.roomId === id)) container.append(stayEditor(stay));
    container.append(button('＋ 再记录一次停留', 'text-button', () => { if (world.stays.length >= 300) return toast('最多记录 300 次停留'); world.stays.push({ id: `stay-${crypto.randomUUID()}`, roomId: id, precision: 'unknown', start: null, end: null }); persist(); paintJournal(); }));
  }
}
function stayEditor(stay) {
  const card = el('form', 'stay-card'), precision = el('select'); [['unknown', '暂时不记得'], ['month', '记得月份'], ['day', '记得日期']].forEach(([value, label]) => { const o = el('option', '', label); o.value = value; precision.append(o); }); precision.value = stay.precision;
  const precisionLabel = el('label', '', '日期精度'); precisionLabel.append(precision); const dates = el('div', 'stay-dates'), from = el('input'), to = el('input'); from.setAttribute('aria-label', '入住日期'); to.setAttribute('aria-label', '离开日期');
  const a = el('label', '', '从'), b = el('label', '', '到'); a.append(from); b.append(to); dates.append(a, b);
  const setType = () => { from.type = to.type = precision.value === 'month' ? 'month' : 'date'; dates.hidden = precision.value === 'unknown'; }; setType(); from.value = stay.start || ''; to.value = stay.end || ''; precision.onchange = () => { from.value = to.value = ''; setType(); };
  const row = el('div', 'button-row'), save = el('button', 'soft-button', '保存日期'); save.type = 'submit'; const status = el('span', 'fine'); status.setAttribute('role', 'status');
  row.append(save, button('移除这次记录', 'text-button', () => { world.stays = world.stays.filter(s => s.id !== stay.id); persist(); paintJournal(); }));
  card.onsubmit = event => { event.preventDefault(); const start = precision.value === 'unknown' ? null : from.value || null, end = precision.value === 'unknown' ? null : to.value || null; if (!validDate(start, precision.value) || !validDate(end, precision.value) || start && end && start > end) { status.textContent = '请检查日期，离开日期应在入住之后。'; return; } Object.assign(stay, { precision: precision.value, start, end }); if (persist()) status.textContent = '停留日期已保存。'; };
  card.append(precisionLabel, dates, row, status); return card;
}
const music = new Music(state => { if (state.loading !== undefined) $('tour-state').textContent = `正在听这首歌的节奏… ${Math.round(state.loading * 100)}%`; if (state.ended) { tour = false; toast('这一程走完了。挑一扇窗，回去看看吧。'); } paintMusic(true); });
async function ensureMusic() { await music.load(world.preferences.trackId, world.preferences.volume); }
async function withMusic(action) { if (busyMusic) return; busyMusic = true; $('music-play').disabled = true; try { await action(); } catch (error) { errorMessage(error); } finally { busyMusic = false; $('music-play').disabled = false; paintMusic(true); } }
async function beginTour() {
  await withMusic(async () => { await ensureMusic(); await music.seek(0); tour = true; navigate({kind:'world',id:null}, {automatic:true}); planet?.follow(); await music.play(); });
}
function updateTour() {
  const progress=music.position/music.duration, trip=journeyAt(progress,world.preferences.order);
  planet?.setJourney(progress,music.playing,tour,world.preferences.order);
  if(performance.now()-lastJourneyPaint<160)return;lastJourneyPaint=performance.now();
  const city=cityById(trip.cityId), room=roomById(trip.roomId);
  $('journey-city').textContent = music.ended ? '这一程，走过三个地方' : trip.arrived ? `停一会儿 · ${city.name}` : `下一站 · ${city.name}`;
  $('journey-note').textContent = trip.arrived ? `${room.short}的灯，还为你留着` : music.playing ? '脚步跟着音乐，慢慢回到熟悉的地方' : music.audio.buffer ? '脚步停在这里，点播放继续走' : '戴上耳机，让阿绵陪你走一遍';
  $('journey-enter').hidden = !trip.arrived;
  $('journey-enter').textContent = `走进${room.short} →`;
  $('journey-enter').onclick = () => navigate({kind:'room',id:trip.roomId});
  $('journey-count').textContent = `0${trip.index+1} / 03`;
  $('follow-walker').setAttribute('aria-pressed',String(!!planet?.following));
}
const secondsText = value => `${Math.floor(value / 60)}:${String(Math.floor(value % 60)).padStart(2, '0')}`;
function paintMusic(force = false) {
  if (!world) return;
  const now = performance.now(); if (!force && now - lastAudioPaint < 180) return; lastAudioPaint = now;
  const icon = music.playing ? 'pause' : 'play'; if (icon !== lastMusicIcon) { $('music-play').replaceChildren(); const i = el('i'); i.dataset.lucide = icon; $('music-play').append(i); icons(); lastMusicIcon = icon; }
  $('music-play').setAttribute('aria-label', music.playing ? '暂停音乐' : '播放音乐');
  $('track-title').textContent = world.preferences.trackId ? world.media[world.preferences.trackId]?.name || '我的音乐' : '回去的路';
  if (!music.loading) $('tour-state').textContent = music.playing ? (tour ? '跟着节奏，经过那些城市' : '自由看风景 · 阿绵仍在路上') : music.ended ? '这一程结束 · 房间里的生活继续' : music.audio.buffer ? '脚步已暂停 · 房间里的生活继续' : '64 秒合成演示曲 · 也可以换成你的歌';
  $('tour-toggle').textContent = tour ? '自由看风景' : music.ended ? '再走一遍' : '跟着走一遍'; $('tour-toggle').setAttribute('aria-pressed', String(tour));
  $('music-time').textContent = secondsText(seekPreview ?? music.position); $('music-duration').textContent = secondsText(music.duration);
  if (document.activeElement !== $('music-seek')) $('music-seek').value = Math.round(music.position / music.duration * 1000);
}
function paintSettings() {
  $('reduced-motion').checked = world.preferences.reducedMotion; $('low-quality').checked = world.preferences.quality === 'low'; $('music-volume').value = world.preferences.volume;
  document.documentElement.dataset.reducedMotion = String(motion.reduced);
  $('follow-walker').disabled=motion.reduced;
  $('follow-walker').title=world.preferences.reducedMotion?'减少动态效果已开启':'跟随阿绵';
  $('track-status').textContent = world.preferences.trackId ? `已保存：${world.media[world.preferences.trackId].name}` : '正在使用 64 秒合成演示曲';
  $('undo-restore').hidden = !localStorage.getItem(RECOVERY_KEY); $('export-legacy').hidden = !localStorage.getItem(LEGACY_BACKUP_KEY);
  $('tour-order').replaceChildren(...world.preferences.order.map((id, index, order) => {
    const row = el('li', 'order-row'), actions = el('span'); row.append(el('span', '', `${index + 1}. ${cityById(roomById(id).cityId).name} · ${roomById(id).short}`));
    for (const [offset, label] of [[-1, '↑'], [1, '↓']]) { const b = button(label, '', () => { stopTour(); const next = [...world.preferences.order]; [next[index], next[index + offset]] = [next[index + offset], next[index]]; world.preferences.order = next; persist(); paintSettings(); }); b.disabled = index + offset < 0 || index + offset >= order.length; b.setAttribute('aria-label', `${offset < 0 ? '提前' : '推后'}${roomById(id).name}`); actions.append(b); }
    row.append(actions); return row;
  }));
  $('debug-panel').hidden = !new URLSearchParams(location.search).has('debug'); paintDiagnostics();
}
async function changeTrack(file) {
  if (file && file.size > 40e6) throw new Error('请选择小于 40 MB 的音乐');
  const previous = world.preferences.trackId, previousBuffer = music.audio.buffer, previousAnalysis = music.audio.analysis, previousDuration = music.audio.duration;
  let id = null; stopTour(); music.pause();
  if (file) {
    const extension = file.name.split('.').pop().toLowerCase(), fallback = { mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', m4a: 'audio/mp4', flac: 'audio/flac', webm: 'audio/webm' }[extension];
    const type = file.type.startsWith('audio/') ? file.type : fallback; if (!type) throw new Error('请选择浏览器支持的音频文件');
    id = `audio-${crypto.randomUUID()}`; const blob = new Blob([file], { type }); await putMedia([[id, blob]]); world.media[id] = { id, kind: 'audio', name: file.name, type, size: blob.size };
  }
  $('track-status').textContent = '正在分析这首歌…';
  try { await music.load(id, world.preferences.volume); world.preferences.trackId = id; persist(); paintSettings(); paintMusic(true); toast('音乐准备好了，点击播放即可。'); }
  catch (error) { if (id) delete world.media[id]; music.audio.buffer = previousBuffer; music.audio.analysis = previousAnalysis; music.audio.duration = previousDuration; music.track = previous; music.audio.startOffset = 0; paintSettings(); throw error; }
}
async function replaceWorld(next) {
  stopTour(); music.pause(); if (currentMemory) { $('memory-dialog').close(); currentMemory = null; clearPhotos(); }
  disposeScene(); $('resident-list').dataset.room = ''; world = next; Object.values(world.rooms).forEach(r => r.lastWallTime = Date.now()); persist();
  // Recreate the audio service's buffer on next play, while retaining its single context.
  if (music.audio.source) { try { music.audio.source.stop(); } catch {} music.audio.source.disconnect(); music.audio.source = null; } music.audio.buffer = null; music.audio.analysis = null; music.audio.startOffset = 0; music.track = null; music.ended = false;
  paintSettings(); navigate({ kind: 'room', id: world.lastRoom }, { force: true, replace: true }); paintMusic(true);
}
function paintDiagnostics() {
  if (!world || !route) return;
  const canvases = document.querySelectorAll('canvas').length + (frame?.contentDocument?.querySelectorAll('canvas').length || 0);
  const data = { route: hashFor(route), activeScenes: stats.created - stats.disposed, activeCanvases: canvases, created: stats.created, disposed: stats.disposed, switches: stats.switches, ready: sceneReady, renderer: planet?.diagnostics() || stats.room, audioContexts: music.audio.ctx && music.audio.ctx.state !== 'closed' ? 1 : 0, audioSources: music.audio.source ? 1 : 0, musicPlaying: !!music.playing, musicSeconds: Number(music.position.toFixed(2)), tour, lifeHours: Object.fromEntries(Object.values(world.rooms).map(r => [r.id, Number(r.simHour.toFixed(3))])), notes: Object.values(world.memories).filter(m => m.note).length, photos: Object.values(world.memories).reduce((n, m) => n + m.photos.length, 0), stays: world.stays.length, eventIdsUnique: Object.values(world.rooms).every(r => new Set(r.journal.map(e => e.id)).size === r.journal.length), migrated: !!world.migration };
  data.errors = stats.errors.slice(-10); $('diagnostics').textContent = JSON.stringify(data, null, 2);
}
async function boot() {
  try { const result = loadWorld(); world = result.world; if (result.migrated) toast('原来的房间存档已经带过来了，原始副本也已保留。'); }
  catch (error) {
    $('fatal').hidden = false; $('fatal').append(el('p', '', `存档暂时无法读取：${error.message}。原数据仍然保留。`), button('下载原始数据以便恢复', 'primary-button', () => downloadFile(localStorage.getItem(WORLD_KEY) || localStorage.getItem('room-of-memories-v3') || '{}', 'memory-world-recovery.json'))); return;
  }
  const catchup = advanceWorld(world, Date.now()); if (Object.values(catchup).some(x => x.capped)) toast('你离开的这段时间，已有限补算 48 个模拟小时；新的生活片段在记忆册里。');
  persist();
  $('journal-room').replaceChildren(...ROOMS.map(r => { const o = el('option', '', `${cityById(r.cityId).name} · ${r.name}`); o.value = r.id; return o; }));
  $('home').onclick = () => navigate({ kind: 'world', id: null }); $('last-room').onclick = () => navigate({ kind: 'room', id: world.lastRoom });
  $('last-room').setAttribute('aria-label', '回到上次房间'); $('open-journal').onclick = () => openJournal(); $('room-journal').onclick = () => { journalTab = 'life'; openJournal(route.id); };
  const back = button('← 返回这座城市', 'text-button', () => navigate({ kind: 'city', id: roomById(route.id).cityId })); back.id = 'room-back-city'; $('room-info').prepend(back);
  $('open-settings').onclick = () => { paintSettings(); openDialog('settings-dialog'); };
  const dismiss = id => id === 'memory-dialog' ? closeMemory() : closeDialog(id);
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => dismiss(b.dataset.close));
  document.querySelectorAll('dialog').forEach(dialog => {
    dialog.addEventListener('cancel', event => { event.preventDefault(); dismiss(dialog.id); });
    dialog.addEventListener('click', event => {
      if (event.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) dismiss(dialog.id);
    });
  });
  $('memory-form').onsubmit = event => { event.preventDefault(); saveMemory(); };
  ['memory-custom-title', 'memory-story', 'memory-note'].forEach(id => $(id).addEventListener('input', () => { $('memory-save-status').textContent = '正在保存…'; clearTimeout(memoryTimer); memoryTimer = setTimeout(saveMemory, 500); }));
  $('photo-input').onchange = async event => { try { await addPhotos([...event.target.files]); } catch (error) { errorMessage(error); } finally { event.target.value = ''; } };
  const turnJournal = () => { paintJournal(); motion.enter([$ ('journal-content')], 7); };
  $('journal-room').onchange = turnJournal; ['memories', 'life', 'stays'].forEach(name => $(`tab-${name}`).onclick = () => { if (journalTab === name) return; journalTab = name; turnJournal(); });
  $('room-pause').onclick = () => { stopTour(); const r = world.rooms[route.id]; advanceWorld(world, Date.now()); r.autoTime = !r.autoTime; r.lastWallTime = Date.now(); persist(); paintRoom(); send('state', { state: hostState(route.id) }); };
  $('room-time-slider').oninput = event => { stopTour(); const r = world.rooms[route.id]; setRoomHour(r, event.target.value, Date.now()); r.autoTime = false; paintRoom(); send('state', { state: hostState(route.id) }); }; $('room-time-slider').onchange = persist;
  $('room-focus').onclick = () => { stopTour(); send('focus'); };
  $('start-tour').onclick = beginTour; $('tour-toggle').onclick = () => tour ? stopTour(true) : beginTour();
  $('planet-overview').onclick = () => { stopTour(); navigate({kind:'world',id:null}); planet?.overview(); };
  $('follow-walker').onclick = () => { if(planet?.following){stopTour();planet.following=false;return;}tour=true;navigate({kind:'world',id:null},{automatic:true});planet?.follow(); };
  $('planet-zoom-in').onclick = () => planet?.zoom(.87); $('planet-zoom-out').onclick = () => planet?.zoom(1.15);
  $('music-play').onclick = () => withMusic(async () => { await ensureMusic(); if (music.playing) music.pause(); else await music.play(); });
  $('music-seek').oninput = event => { seekPreview = Number(event.target.value) / 1000 * music.duration; $('music-time').textContent = secondsText(seekPreview); };
  $('music-seek').onchange = event => withMusic(async () => { const progress = Number(event.target.value) / 1000; try { await ensureMusic(); await music.seek(progress); updateTour(); } finally { seekPreview = null; } });
  $('music-seek').addEventListener('pointercancel', () => { seekPreview = null; });
  $('music-volume').oninput = event => { world.preferences.volume = Number(event.target.value); music.audio.setVolume(world.preferences.volume); $('music-mute').setAttribute('aria-label', world.preferences.volume ? '静音' : '取消静音'); persist(); };
  $('music-mute').onclick = () => { if (world.preferences.volume > 0) { mutedVolume = world.preferences.volume; world.preferences.volume = 0; } else world.preferences.volume = mutedVolume || .32; music.audio.setVolume(world.preferences.volume); $('music-volume').value = world.preferences.volume; $('music-mute').setAttribute('aria-label', world.preferences.volume ? '静音' : '取消静音'); persist(); };
  for (const id of ['reduced-motion', 'low-quality']) $(id).onchange = () => { world.preferences.reducedMotion = $('reduced-motion').checked; world.preferences.quality = $('low-quality').checked ? 'low' : 'balanced'; persist(); paintSettings(); navigate(route, { automatic: tour, force: true, replace: true }); };
  $('track-input').onchange = async event => { const file = event.target.files[0]; if (file) await withMusic(() => changeTrack(file)); event.target.value = ''; }; $('default-track').onclick = () => withMusic(() => changeTrack(null));
  $('export-backup').onclick = async () => { const b = $('export-backup'); b.disabled = true; $('backup-status').textContent = '正在把记忆和媒体放进同一个文件…'; try { saveMemory(); flushRoom(); advanceWorld(world, Date.now()); persist(); const backup = await exportBackup(world); downloadFile(backup, `memory-world-${new Date().toISOString().slice(0, 10)}.json`); $('backup-status').textContent = '完整备份已生成，请保管好下载的 JSON 文件。'; } catch (error) { $('backup-status').textContent = error.message; } finally { b.disabled = false; } };
  $('restore-input').onchange = async event => {
    try { const file = event.target.files[0]; if (!file) return; if (file.size > 140e6) throw new Error('备份文件过大'); restoreCandidate = validateBackup(JSON.parse(await file.text())); const box = $('restore-review'); box.hidden = false; box.className = 'review-box'; box.replaceChildren(el('p', '', `这份备份包含 3 个房间、${Object.values(restoreCandidate.world.memories).filter(m => m.note || m.story).length} 件文字记忆、${Object.keys(restoreCandidate.assets).length} 个媒体文件。恢复会替换当前世界，当前版本会保留为可撤回副本。`));
      const confirm = button('恢复这份备份', 'primary-button', async () => { confirm.disabled = true; try { saveMemory(); flushRoom(); persist(); const next = await restoreBackup(restoreCandidate); await replaceWorld(next); box.hidden = true; $('backup-status').textContent = '备份已恢复，生活从保存的时刻继续。可用下方按钮撤回。'; } catch (error) { $('backup-status').textContent = error.message; } finally { confirm.disabled = false; } }); box.append(confirm);
    } catch (error) { $('restore-review').hidden = true; $('backup-status').textContent = error.message; } finally { event.target.value = ''; }
  };
  $('undo-restore').onclick = async () => { try { await replaceWorld(recoverPreviousWorld()); $('backup-status').textContent = '已回到另一个保留版本。'; } catch (error) { errorMessage(error); } };
  $('export-legacy').onclick = () => downloadFile(localStorage.getItem(LEGACY_BACKUP_KEY), 'room-of-memories-original-v3.json');
  addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== frame?.contentWindow || event.data?.channel !== CHANNEL || route.kind !== 'room') return;
    const data = event.data;
    if (data.type === 'awaiting-init') send('init', { roomId: route.id, visit: visitRecord(route.id), state: hostState(route.id) });
    else if (data.type === 'room-ready' && data.roomId === route.id) { sceneReady = true; stats.room = data.diagnostics; $('room-loading').hidden = true; pendingRoom?.finish(true); pendingRoom = null; paintDiagnostics(); }
    else if (data.type === 'room-error') { $('room-loading').textContent = `房间暂时没有打开：${data.message}`; pendingRoom?.finish(false); pendingRoom = null; }
    else if (data.type === 'view-state') { $('room-focus').setAttribute('aria-pressed', String(data.follow)); }
    else if (data.type === 'memory-open') openMemory(data.id);
    else if (data.type === 'navigate' && roomById(data.roomId)) navigate({ kind: 'room', id: data.roomId });
    else if (data.type === 'pose' && data.roomId === route.id) { world.rooms[data.roomId].poses = data.poses; stats.room = data.diagnostics; }
  });
  addEventListener('popstate', () => { stopTour(); const next = routeFromHash(location.hash); if (hashFor(next) !== hashFor(route)) showRoute(next).catch(errorMessage); });
  addEventListener('hashchange', () => { const next = routeFromHash(location.hash); if (hashFor(next) !== hashFor(route)) { stopTour(); showRoute(next).catch(errorMessage); } });
  addEventListener('pagehide', () => { saveMemory(); flushRoom(); advanceWorld(world, Date.now()); persist(); });
  document.addEventListener('visibilitychange', () => { advanceWorld(world, Date.now()); if (document.hidden) { flushRoom(); persist(); } });
  setInterval(() => { advanceWorld(world, Date.now()); paintRoom(); if (route.kind === 'room') send('state', { state: hostState(route.id) }); paintDiagnostics(); }, 1000);
  saveTimer = setInterval(() => { flushRoom(); persist(); }, 5000);
  function animation(now) { const dt = Math.min(.1, (now - lastFrame) / 1000); lastFrame = now; const features = music.update(dt); if (planet) planet.features = world.preferences.reducedMotion ? {} : features; if (frame && now - lastAudioPaint >= 180) send('music', { features: world.preferences.reducedMotion ? {} : features }); updateTour(); paintMusic(); requestAnimationFrame(animation); }
  motion.media.addEventListener('change', () => { paintSettings(); navigate(route, { automatic: tour, force: true, replace: true }); });
  paintSettings(); icons(); await showRoute(routeFromHash(location.hash)); requestAnimationFrame(animation);
}
boot().catch(errorMessage);
