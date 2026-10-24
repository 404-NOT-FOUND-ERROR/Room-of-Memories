import * as THREE from '../../vendor/three.module.js';
import { surfaceWave, WAVE_GLSL } from './surface-wave.js';

export class SoftPlanet {
  constructor(materials) {
    this.group=new THREE.Group();this.group.name='continuous-miniature-planet';this.materials=materials;this.phase=0;this.kick=0;this._f={bass:0,mid:0,beat:0};
    [this.waveC0,this.waveC1]=window.MB_SCENE.waveSources.map(id=>MB.Terrain.districts[id].c);
    this.uniforms={uPhase:{value:0},uBass:{value:0},uMid:{value:0},uBeat:{value:0},uWaveC0:{value:new THREE.Vector3(...this.waveC0)},uWaveC1:{value:new THREE.Vector3(...this.waveC1)}};
  }
  async build() {
    const T=MB.Terrain,R=MB.CONFIG.R,g=new THREE.IcosahedronGeometry(1,31),p=g.attributes.position,count=p.count;
    const dirs=new Float32Array(count*3),radii=new Float32Array(count),react=new Float32Array(count),colors=new Float32Array(count*3),d=new THREE.Vector3(),center=new THREE.Vector3(),sample={},color=new THREE.Color();
    for(let i=0;i<count;i++){
      d.fromBufferAttribute(p,i).normalize();dirs.set(d.toArray(),i*3);T.sample(d.x,d.y,d.z,sample);
      radii[i]=R+sample.h*MB.CONFIG.VOX;react[i]=sample.react;p.setXYZ(i,d.x*radii[i],d.y*radii[i],d.z*radii[i]);
    }
    for(let i=0;i<count;i+=3){
      center.set(0,0,0);for(let j=0;j<3;j++)center.add(d.fromArray(dirs,(i+j)*3));center.normalize();T.sample(center.x,center.y,center.z,sample);
      color.setRGB(sample.r/255,sample.g/255,sample.b/255,THREE.SRGBColorSpace);
      for(let j=0;j<3;j++)colors.set([color.r,color.g,color.b],(i+j)*3);
    }
    g.setAttribute('surfaceDir',new THREE.BufferAttribute(dirs,3));g.setAttribute('restRadius',new THREE.BufferAttribute(radii,1));g.setAttribute('surfaceReact',new THREE.BufferAttribute(react,1));g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.computeVertexNormals();g.boundingSphere=new THREE.Sphere(new THREE.Vector3(),R+20);
    const material=this.materials.toon(0xffffff,{vertexColors:true});material.flatShading=true;
    const deform=m=>{m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,this.uniforms);shader.vertexShader=WAVE_GLSL+'\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','vec3 transformed = surfaceDir * (restRadius + memoryWave(surfaceDir, surfaceReact));');};m.customProgramCacheKey=()=> 'memory-continuous-wave-v1';};
    deform(material);this.terrain=new THREE.Mesh(g,material);this.terrain.name='faceted-meadow';this.terrain.receiveShadow=true;this.terrain.castShadow=true;
    this.terrain.customDepthMaterial=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking});deform(this.terrain.customDepthMaterial);
    this.group.add(this.terrain);this.surfaceTriangles=count/3;
    this.ribbon(7.6,.08,this.materials.edge);this.ribbon(5.35,.19,this.materials.road);
    return this.group;
  }
  ribbon(width,alt,material) {
    const R=MB.CONFIG.R,segments=384,positions=[],normals=[],indices=[],d=new THREE.Vector3();
    for(let i=0;i<=segments;i++)for(const side of [-1,1]){
      d.fromArray(MB.Terrain.ringPoint('way',i/segments*Math.PI*2,side*width/2,[0,0,0]));positions.push(d.x*(R+alt),d.y*(R+alt),d.z*(R+alt));normals.push(d.x,d.y,d.z);
    }
    for(let i=0;i<segments;i++){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));g.setIndex(indices);
    // Both sides are intentional: the ring frame's handedness is independent of city frames.
    const mat=material.clone();mat.side=THREE.DoubleSide;const mesh=new THREE.Mesh(g,mat);mesh.receiveShadow=true;mesh.name='continuous-footpath';this.group.add(mesh);
  }
  waveAt(x,y,z,react){return surfaceWave(x,y,z,react,this.phase,this._f,this.waveC0,this.waveC1);}
  update(dt,f,time,climate,reduced=false) {
    this.phase+=dt*(.7+1.6*f.tempo*(.35+.9*f.energy)+f.beat);this.kick*=Math.exp(-dt*4);
    const target={bass:f.bass+(f.active?0:.20),mid:f.mid,beat:Math.max(f.beat,this.kick)},k=1-Math.exp(-dt*10);
    for(const name of ['bass','mid','beat'])this._f[name]=reduced?0:this._f[name]+(target[name]-this._f[name])*k;
    Object.assign(this.uniforms.uPhase,{value:this.phase});this.uniforms.uBass.value=this._f.bass;this.uniforms.uMid.value=this._f.mid;this.uniforms.uBeat.value=this._f.beat;
    this.materials.lit.emissiveIntensity=.04+climate.lights*.48;
  }
}

export class MiniatureLighting {
  constructor(scene,shadows=true) {
    this.sun=new THREE.DirectionalLight(0xfff5df,1.55);this.ambient=new THREE.AmbientLight(0xfffdf4,1.05);this.fill=new THREE.HemisphereLight(0xd9e4df,0xb5baa0,.28);
    this.viewFill=new THREE.DirectionalLight(0xf6f0df,.65);
    this.sun.castShadow=shadows;this.sun.shadow.mapSize.set(2048,2048);Object.assign(this.sun.shadow.camera,{left:-170,right:170,top:170,bottom:-170,near:10,far:650});this.sun.shadow.bias=-.00015;this.sun.shadow.normalBias=.16;this.sun.shadow.radius=3;
    scene.add(this.sun,this.sun.target,this.ambient,this.fill,this.viewFill,this.viewFill.target);
  }
  update(dt,f,time,cl,camera) {
    this.sun.position.set(-170,170+cl.sunElev*130,220);this.sun.color.setRGB(...cl.sunCol);this.sun.intensity=1.08+cl.sunElev*.6;
    this.ambient.color.set(0xfffdf4).lerp(new THREE.Color(0xc9d3e2),cl.lights*.4);this.ambient.intensity=.96;
    this.viewFill.position.copy(camera.position);
  }
}
