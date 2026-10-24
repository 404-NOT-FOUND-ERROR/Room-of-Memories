import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { LatestNavigation } from '../src/navigation.js';
import { STATIONS } from '../src/journey.js';

test('a later navigation wins while the previous room is still loading', async () => {
  const navigation = new LatestNavigation();
  const first = navigation.begin();
  let finishRoom;
  const waiting = first.wait(new Promise(resolve => { finishRoom = resolve; }));
  const latest = navigation.begin();
  assert.equal(await waiting, undefined);
  finishRoom('old room ready');
  assert.equal(first.current(), false);
  assert.equal(latest.current(), true);
  assert.equal(await latest.wait(Promise.resolve('latest city')), 'latest city');
});

test('failed scene loads remain catchable, and a cancelled load cannot commit', async () => {
  const navigation = new LatestNavigation(), first = navigation.begin();
  await assert.rejects(first.wait(Promise.reject(new Error('scene failed'))), /scene failed/);
  navigation.begin();
  assert.equal(await first.wait(Promise.resolve('stale')), undefined);
});

test('cities span both hemispheres and their stops meet the same diagonal footpath', async () => {
  const context = { window: {} };
  vm.runInNewContext(await readFile(new URL('../public/planet/js/scene-manifest.js', import.meta.url), 'utf8'), context);
  const scene = context.window.MB_SCENE, cities = scene.districts.filter(d => d.urban);
  assert.ok(cities.some(d => d.lat < -.3));
  assert.ok(cities.some(d => d.lat > .8));
  const dot = (a,b) => a.reduce((s,x,i) => s+x*b[i],0);
  const norm = v => v.map(x => x/Math.hypot(...v));
  const cross = (a,b) => [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const pole = norm(scene.rings[0].pole), e1 = norm(cross(pole,[0,1,0])), e2 = cross(pole,e1);
  for (const city of cities) {
    const d = [Math.cos(city.lat)*Math.sin(city.lon),Math.sin(city.lat),Math.cos(city.lat)*Math.cos(city.lon)];
    const stop = STATIONS[city.id];
    assert.ok(Math.abs(stop-Math.atan2(dot(d,e2),dot(d,e1))) < 1e-10, `${city.id}: walkway and arrival must agree`);
    assert.ok(Math.abs(Math.asin(dot(d,pole))) > city.r+.06, `${city.id}: walkway must clear buildings`);
  }
});
