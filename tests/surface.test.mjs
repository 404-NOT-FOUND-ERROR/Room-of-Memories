import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { surfaceWave } from '../src/scene/surface-wave.js';

const source0=[0,1,0],source1=[0,0,1],loud={bass:1,mid:1,beat:1};
const dir=(lat,lon)=>[Math.cos(lat)*Math.sin(lon),Math.sin(lat),Math.cos(lat)*Math.cos(lon)];

test('continuous musical waves remain bounded at poles and across the longitude seam',()=>{
  for(let lat=-Math.PI/2;lat<=Math.PI/2;lat+=Math.PI/40)for(let lon=-Math.PI;lon<=Math.PI;lon+=Math.PI/40){
    const value=surfaceWave(...dir(lat,lon),1,4.3,loud,source0,source1);
    assert.ok(Number.isFinite(value));assert.ok(Math.abs(value)<8.2);
  }
  for(const lat of [-1,-.4,0,.7,1]){
    const a=surfaceWave(...dir(lat,-Math.PI+1e-8),1,4.3,loud,source0,source1),b=surfaceWave(...dir(lat,Math.PI-1e-8),1,4.3,loud,source0,source1);
    assert.ok(Math.abs(a-b)<1e-5);
  }
  for(const pole of [-1,1]){
    const peak=surfaceWave(0,pole,0,1,4.3,loud,source0,source1);
    for(let lon=0;lon<6.28;lon+=.3)assert.ok(Math.abs(surfaceWave(...dir(pole*(Math.PI/2-1e-6),lon),1,4.3,loud,source0,source1)-peak)<1e-4);
  }
});

test('terrain waves evolve continuously instead of jumping between voxel heights',()=>{
  const point=dir(.35,.8);let previous=surfaceWave(...point,.85,0,loud,source0,source1),changes=0;
  for(let i=1;i<1000;i++){
    const next=surfaceWave(...point,.85,i/10000,loud,source0,source1),difference=Math.abs(next-previous);
    assert.ok(difference<.003);if(difference>1e-7)changes++;previous=next;
  }
  assert.ok(changes>990);
  assert.equal(surfaceWave(...point,0,1,loud,source0,source1),0);
  assert.equal(surfaceWave(...point,1,1,{bass:0,mid:0,beat:0},source0,source1),0);
});

test('the whole walking ribbon and its pavers remain level under maximum music energy',async()=>{
  const context={MB:{}};context.window=context;vm.createContext(context);
  for(const file of ['js/scene-manifest','js/config','engine/terrain-core','js/terrain'])vm.runInContext(await readFile(new URL(`../public/planet/${file}.js`,import.meta.url),'utf8'),context);
  const T=context.MB.Terrain,sample={};
  for(let i=0;i<384;i++)for(const side of [-3.8,-2.675,0,2.675,3.8]){
    const point=T.ringPoint('way',i/384*Math.PI*2,side,[0,0,0]);T.sample(...point,sample);
    assert.ok(Math.abs(sample.h)<1e-10);assert.equal(surfaceWave(...point,sample.react,3,loud,source0,source1),0);
    assert.equal(sample.water,0);
  }
  for(const city of ['hongkong','turin','shanghai']){
    T.sample(...T.districts[city].c,sample);assert.ok(Math.abs(sample.h-1)<1e-10);assert.ok(sample.react<.07);
  }
});
