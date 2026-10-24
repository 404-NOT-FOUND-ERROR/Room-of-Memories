import { getMedia } from './storage.js';

// Reuses Voxel Beat Planet's offline FFT/beat analysis. One instance belongs to the shell,
// never to a room, so changing cities cannot create another audio context or source.
export class Music {
  constructor(onState) { this.audio = new window.MB.Audio(); this.onState = onState; this.loading = null; this.track = null; this.ended = false; this.frames = 0; }
  async load(trackId, volume = .32) {
    if (this.track === trackId && this.audio.buffer) return;
    if (this.loading) return this.loading;
    this.loading = (async () => {
      this.audio.pause();
      if (this.audio.source) { try { this.audio.source.stop(); } catch {} this.audio.source.disconnect(); this.audio.source = null; }
      this.audio.startOffset = 0;
      const buffer = trackId ? await (await getMedia(trackId))?.arrayBuffer() : await (await fetch('./assets/return-journey.wav')).arrayBuffer();
      if (!buffer) throw new Error('没有找到保存的音乐，请重新选择');
      await this.audio.load(buffer, trackId ? '我的音乐' : '回去的路 · 合成演示曲', p => this.onState?.({ loading: p }));
      if (this.audio.duration < 5 || this.audio.duration > 1200) throw new Error('请选择 5 秒至 20 分钟的音乐');
      this.audio.setVolume(volume); this.track = trackId; this.ended = false; this.onState?.({ ready: true });
    })().finally(() => { this.loading = null; });
    return this.loading;
  }
  async play() {
    if (this.ended || this.position >= this.duration - .15) { this.audio.seek(0); this.ended = false; }
    // Resuming a suspended context keeps the existing source and its exact offset.
    // Calling the upstream play() after resume() would restart it at startOffset.
    if (this.audio.source && !this.audio.playing) { await this.audio.ensureContext().resume(); this.audio.playing = true; }
    else { await this.audio.ensureContext().resume(); this.audio.play(); }
    this.audio.source.loop = false;
    const source = this.audio.source;
    source.onended = () => { if (this.audio.source === source && this.audio.playing) { this.audio.playing = false; this.ended = true; this.audio.startOffset = this.duration; this.audio.source = null; this.onState?.({ ended: true }); } };
    this.onState?.({ playing: true });
  }
  pause() { this.audio.pause(); this.onState?.({ playing: false }); }
  async seek(fraction) {
    const was = this.playing; this.audio.seek(Math.max(0, Math.min(.999, fraction)) * this.duration); this.ended = false;
    if (was) { this.audio.source.loop = false; const source = this.audio.source; source.onended = () => { if (this.audio.source === source && this.audio.playing) { this.audio.playing = false; this.ended = true; this.audio.startOffset = this.duration; this.audio.source = null; this.onState?.({ ended: true }); } }; }
  }
  get playing() { return this.audio.playing; }
  get duration() { return this.audio.duration || 64; }
  get position() {
    if (this.ended) return this.duration;
    if (!this.audio.source) return this.audio.startOffset || 0;
    return Math.max(0, Math.min(this.duration, this.audio.startOffset + this.audio.ctx.currentTime - this.audio.startCtxTime));
  }
  update(dt) { this.frames++; return this.audio.update(dt); }
  dispose() { if (this.audio.source) { try { this.audio.source.stop(); } catch {} this.audio.source.disconnect(); } this.audio.ctx?.close(); }
}
