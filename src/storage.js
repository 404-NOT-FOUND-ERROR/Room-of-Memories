import { WORLD_KEY, LEGACY_KEY, LEGACY_BACKUP_KEY, RECOVERY_KEY, newWorld, migrateLegacy, validateWorld } from './model.js';

let connection;
function db() {
  connection ||= new Promise((resolve, reject) => {
    const request = indexedDB.open('room-of-memories-media', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('assets');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('无法打开本机照片存储'));
  });
  return connection;
}
export async function getMedia(id) {
  const database = await db();
  return new Promise((resolve, reject) => { const r = database.transaction('assets').objectStore('assets').get(id); r.onsuccess = () => resolve(r.result || null); r.onerror = () => reject(r.error); });
}
export async function putMedia(entries) {
  const database = await db();
  return new Promise((resolve, reject) => {
    const tx = database.transaction('assets', 'readwrite');
    entries.forEach(([id, blob]) => tx.objectStore('assets').put(blob, id));
    tx.oncomplete = resolve;
    tx.onerror = () => reject(new Error('照片或音乐没有保存成功，可能是浏览器空间不足'));
    tx.onabort = () => reject(new Error('保存被中止，原来的记忆仍然保留'));
  });
}

export function loadWorld() {
  const saved = localStorage.getItem(WORLD_KEY);
  if (saved) return { world: validateWorld(JSON.parse(saved)), migrated: false };
  const legacy = localStorage.getItem(LEGACY_KEY);
  const world = legacy ? migrateLegacy(legacy) : newWorld();
  if (legacy && !localStorage.getItem(LEGACY_BACKUP_KEY)) localStorage.setItem(LEGACY_BACKUP_KEY, legacy);
  saveWorld(world);
  return { world, migrated: !!legacy };
}
export function saveWorld(world) {
  world.updated = Date.now();
  try { localStorage.setItem(WORLD_KEY, JSON.stringify(world)); }
  catch { throw new Error('本机存档写入失败。请先导出备份，避免关闭页面后丢失这次修改。'); }
}
export function recoverPreviousWorld() {
  const text = localStorage.getItem(RECOVERY_KEY);
  if (!text) throw new Error('还没有导入前的版本');
  const previous = validateWorld(JSON.parse(text));
  const current = localStorage.getItem(WORLD_KEY);
  saveWorld(previous); if (current) localStorage.setItem(RECOVERY_KEY, current);
  return previous;
}

export async function preparePhoto(file) {
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 20e6) throw new Error('请选择不超过 20 MB 的 JPG、PNG 或 WebP 照片');
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => { throw new Error('浏览器无法读取这张照片'); });
  try {
    const factor = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * factor)); canvas.height = Math.max(1, Math.round(bitmap.height * factor));
    canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/webp', .84));
    if (!blob) throw new Error('照片转换失败');
    return blob;
  } finally { bitmap.close(); }
}
const asDataURL = blob => new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(blob); });

export async function exportBackup(world) {
  const clean = validateWorld(world), assets = {};
  const needed = new Set(Object.values(clean.memories).flatMap(m => m.photos));
  if (clean.preferences.trackId) needed.add(clean.preferences.trackId);
  clean.media = Object.fromEntries([...needed].map(id => [id, clean.media[id]]));
  for (const id of needed) { const blob = await getMedia(id); if (!blob) throw new Error(`备份中有媒体缺失：${clean.media[id].name}`); assets[id] = await asDataURL(blob); }
  return { format: 'room-of-memories', version: 1, exportedAt: new Date().toISOString(), world: clean, assets };
}

export function validateBackup(payload) {
  if (!payload || payload.format !== 'room-of-memories' || payload.version !== 1) throw new Error('这不是记忆世界备份文件');
  const world = validateWorld(payload.world), assets = {}, needed = new Set(Object.values(world.memories).flatMap(m => m.photos));
  if (world.preferences.trackId) needed.add(world.preferences.trackId);
  let bytes = 0;
  for (const id of needed) {
    const value = payload.assets?.[id];
    if (typeof value !== 'string') throw new Error('备份缺少照片或音乐');
    const match = /^data:(image\/(?:png|jpeg|webp)|audio\/(?:mpeg|wav|x-wav|wave|ogg|mp4|webm|flac|x-flac));base64,([A-Za-z0-9+/]*={0,2})$/.exec(value);
    if (!match || match[2].length % 4 !== 0) throw new Error('备份的媒体格式无效');
    const kind = world.media[id]?.kind;
    if (kind === 'photo' && !match[1].startsWith('image/') || kind === 'audio' && !match[1].startsWith('audio/')) throw new Error('媒体类型与记录不一致');
    bytes += match[2].length * .75; if (bytes > 100e6) throw new Error('备份中的媒体超过 100 MB');
    assets[id] = { type: match[1], base64: match[2] };
  }
  return { world, assets, bytes };
}
export async function restoreBackup(checked) {
  // Imported media gets a new namespace; the recovery snapshot continues to reference untouched old blobs.
  const next = structuredClone(checked.world), mapping = {}, entries = [], media = {};
  for (const [oldId, data] of Object.entries(checked.assets)) {
    const id = `restore-${crypto.randomUUID()}`; mapping[oldId] = id;
    const bytes = Uint8Array.from(atob(data.base64), c => c.charCodeAt(0));
    const blob = new Blob([bytes], { type: data.type });
    if (next.media[oldId].kind === 'photo') { const bitmap = await createImageBitmap(blob).catch(() => { throw new Error('备份中有无法打开的照片'); }); bitmap.close(); }
    else {
      const decoder = new OfflineAudioContext(1, 1, 44100);
      const audio = await decoder.decodeAudioData(await blob.arrayBuffer()).catch(() => { throw new Error('备份中有无法打开的音乐'); });
      if (audio.duration < 5 || audio.duration > 1200) throw new Error('备份中的音乐时长超出支持范围');
    }
    entries.push([id, blob]); media[id] = { ...next.media[oldId], id, type: data.type, size: blob.size };
  }
  await putMedia(entries);
  for (const m of Object.values(next.memories)) m.photos = m.photos.map(id => mapping[id]);
  if (next.preferences.trackId) next.preferences.trackId = mapping[next.preferences.trackId];
  next.media = media;
  const old = localStorage.getItem(WORLD_KEY);
  if (old) localStorage.setItem(RECOVERY_KEY, old);
  saveWorld(next);
  return next;
}
export function downloadFile(value, name, type = 'application/json') {
  const blob = value instanceof Blob ? value : new Blob([typeof value === 'string' ? value : JSON.stringify(value)], { type });
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
}
