import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { Music } from '../src/music.js';

test('one source survives pause/resume; seeking replaces it without duplicate playback', async () => {
  let active = 0, maximum = 0;
  class Context {
    state = 'running'; currentTime = 0;
    createGain() { return { gain: { value: 1, setTargetAtTime() {} }, connect() {} }; }
    resume() { this.state = 'running'; return Promise.resolve(); }
    suspend() { this.state = 'suspended'; return Promise.resolve(); }
    close() { this.state = 'closed'; return Promise.resolve(); }
    createBufferSource() { let started = false; return { connect() {}, disconnect() {}, start() { started = true; active++; maximum = Math.max(maximum, active); }, stop() { if (started) { active--; started = false; } }, loop: true }; }
  }
  const browser = { MB: {}, AudioContext: Context };
  vm.runInNewContext(await readFile(new URL('../public/vendor/planet-audio.js', import.meta.url), 'utf8'), { window: browser, MB: browser.MB });
  globalThis.window = browser;
  try {
    const music = new Music(); music.audio.buffer = {}; music.audio.duration = 64; await music.play();
    music.audio.ctx.currentTime = 12.5; assert.equal(music.position, 12.5); const originalSource = music.audio.source;
    music.pause(); assert.equal(music.playing, false); await music.play(); assert.equal(music.audio.source, originalSource); assert.equal(music.position, 12.5);
    await music.seek(.5); assert.equal(music.position, 32); assert.notEqual(music.audio.source, originalSource); assert.equal(music.audio.source.loop, false); assert.equal(maximum, 1);
    music.pause(); await music.seek(.25); assert.equal(music.position, 16); assert.equal(active, 0); await music.play(); assert.equal(music.position, 16); assert.equal(active, 1);
    music.dispose(); assert.equal(active, 0); assert.equal(music.audio.ctx.state, 'closed');
  } finally { delete globalThis.window; }
});
