// Continuous counterpart of the reference planet's travelling musical waves.
// Shared constants keep GPU terrain, shadow depth and CPU object anchors aligned.
export const WAVE={swell:.42,first:.62,second:.38,mid:.18,bass:4.1,pulse:2.5,firstFrequency:10,secondFrequency:8};
export function surfaceWave(x,y,z,react,phase,f,c0,c1) {
  if(react<=.05)return 0;
  const clamp=v=>Math.max(-1,Math.min(1,v));
  const lat=Math.asin(clamp(y)),lon=Math.atan2(x,z),d0=Math.acos(clamp(x*c0[0]+y*c0[1]+z*c0[2])),d1=Math.acos(clamp(x*c1[0]+y*c1[1]+z*c1[2]));
  const latitudeWeight=Math.sqrt(Math.max(0,1-y*y));
  const swell=(Math.sin(lat*3+lon*2-phase)*.5+Math.sin(lon*3-lat*2.5-phase*.77+1.7)*.35)*latitudeWeight;
  const wave=swell*WAVE.swell+Math.sin(d0*WAVE.firstFrequency-phase*2.4)*Math.exp(-d0*.6)*WAVE.first+Math.sin(d1*WAVE.secondFrequency-phase*1.9+2.1)*Math.exp(-d1*.5)*WAVE.second+f.mid*WAVE.mid*Math.sin((lat-lon)*8+phase*1.6)*latitudeWeight;
  const pulse=f.beat*(.5+.5*Math.sin(d0*WAVE.firstFrequency-phase*2.4))*Math.exp(-d0*.35);
  return react*(f.bass*WAVE.bass*wave+WAVE.pulse*pulse);
}
const gl=n=>Number(n).toFixed(8);
export const WAVE_GLSL=`
attribute vec3 surfaceDir;
attribute float restRadius;
attribute float surfaceReact;
uniform float uPhase;
uniform float uBass;
uniform float uMid;
uniform float uBeat;
uniform vec3 uWaveC0;
uniform vec3 uWaveC1;
float memoryWave(vec3 d, float react) {
  if(react<=0.05)return 0.0;
  float lat=asin(clamp(d.y,-1.0,1.0)),lon=atan(d.x,d.z);
  float d0=acos(clamp(dot(d,uWaveC0),-1.0,1.0)),d1=acos(clamp(dot(d,uWaveC1),-1.0,1.0));
  float latitudeWeight=sqrt(max(0.0,1.0-d.y*d.y));
  float swell=(sin(lat*3.0+lon*2.0-uPhase)*0.5+sin(lon*3.0-lat*2.5-uPhase*0.77+1.7)*0.35)*latitudeWeight;
  float wave=swell*${gl(WAVE.swell)}+sin(d0*${gl(WAVE.firstFrequency)}-uPhase*2.4)*exp(-d0*0.6)*${gl(WAVE.first)}+sin(d1*${gl(WAVE.secondFrequency)}-uPhase*1.9+2.1)*exp(-d1*0.5)*${gl(WAVE.second)}+uMid*${gl(WAVE.mid)}*sin((lat-lon)*8.0+uPhase*1.6)*latitudeWeight;
  float pulse=uBeat*(0.5+0.5*sin(d0*${gl(WAVE.firstFrequency)}-uPhase*2.4))*exp(-d0*0.35);
  return react*(uBass*${gl(WAVE.bass)}*wave+${gl(WAVE.pulse)}*pulse);
}`;
