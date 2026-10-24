import * as THREE from '../../vendor/three.module.js';
import { CITIES, roomById } from '../data.js';
import { journeyAt, STATIONS } from '../journey.js';
import { buildKit } from './planet-kit.js';
import { miniatureMaterials, slabGeometry } from './miniature.js';
import { SoftPlanet, MiniatureLighting } from './soft-planet.js';

let engineTask;
function loadEngine() {
  if (engineTask) return engineTask;
  window.THREE=THREE;
  engineTask=(async()=>{
    for(const file of ['js/scene-manifest','js/config','engine/terrain-core','js/terrain','engine/voxelmodel','engine/placement','engine/climate']) {
      await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=`./planet/${file}.js`;s.onload=resolve;s.onerror=()=>reject(new Error('音乐星球资源未加载：'+file));document.head.append(s);});
    }
  })().catch(error=>{engineTask=null;throw error;});
  return engineTask;
}
const ZERO={bass:0,mid:0,treble:0,beat:0,energy:0,tempo:0,beatPhase:0,active:false};
const UP=new THREE.Vector3(0,1,0), TAU=Math.PI*2;
const roomForCity={hongkong:'hotel',turin:'turin',shanghai:'dorm'};
const nearAngle=(angle,from)=>from+Math.atan2(Math.sin(angle-from),Math.cos(angle-from));

export class MusicPlanetScene {
  constructor(host,onCity,preferences,onRoom,onExplore) {
    Object.assign(this,{host,onCity,onRoom,onExplore,preferences,active:true,features:ZERO,objects:[],sets:[],labels:[],picks:[],progress:0,playing:false,touring:false,following:false,selected:null,time:0,frames:0,fps:0,fpsFrames:0,fpsTime:0,lowSeconds:0});
    this.trip=journeyAt(0,preferences.order);this.theta=0;this.phi=1.50;this.distance=505;this.targetTheta=0;this.targetPhi=1.50;this.targetDistance=505;
    this.look=new THREE.Vector3();this.targetLook=new THREE.Vector3();this.tmp=new THREE.Vector3();this.projected=new THREE.Vector3();this.surface=new THREE.Vector3();this.quat=new THREE.Quaternion();this.cameraDirection=new THREE.Vector3();
    this.events=new AbortController();
  }
  async init() {
    await loadEngine(); if(!this.active) return;
    this.root=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(40,1,.5,2000);
    this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,stencil:false,powerPreference:'high-performance'});
    this.renderer.setClearColor(0,0);this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,this.preferences.quality==='low'?1:1.6));
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.NoToneMapping;
    this.renderer.shadowMap.enabled=this.preferences.quality!=='low';this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    const canvas=this.renderer.domElement;canvas.setAttribute('aria-label','音乐星球：拖动转动，滚轮缩放，点击城市或房子');canvas.tabIndex=0;this.host.append(canvas);
    this.materials=miniatureMaterials();this.planet=new SoftPlanet(this.materials);this.root.add(this.planet.group);await this.planet.build();
    if(!this.active){this.release();return;}
    this.lighting=new MiniatureLighting(this.root,this.preferences.quality!=='low');MB.Climate.snap();
    this.kit=buildKit(this.materials,{outlines:this.preferences.quality!=='low'});this.buildWorld();this.bindControls();
    this.resizeObserver=new ResizeObserver(()=>this.resize());this.resizeObserver.observe(this.host);this.resize();
    this.camera.position.set(0,36,504);this.camera.lookAt(0,0,0);
    this.last=performance.now();this.tick(this.last);
  }
  add(object,anchor,city,room) {
    object.quaternion.copy(anchor.q);MB.Place.ride(this.planet,anchor,object);this.planet.group.add(object);this.objects.push({object,anchor});
    if(city) object.traverse(child=>{if(child.isMesh&&!child.userData.isHull){child.userData.city=city;child.userData.room=room;this.picks.push(child);}});
    return object;
  }
  local(model,city,x,z,heading=0,room) {return this.add(model,MB.Place.anchorLocal(city,x,z,heading),city,room);}
  instance(geo,anchors,material=this.kit.material,dynamic=true) {
    const set=new MB.Place.InstSet(this.planet.group,[{geo,mat:material}],anchors,dynamic);set.meshes.forEach(m=>{m.castShadow=true;m.receiveShadow=true;});set.write(this.planet);this.sets.push(set);return set;
  }
  buildWorld() {
    const K=this.kit,P=MB.Place,T=MB.Terrain;
    this.local(K.tower(24,37,0x9fb7a3,'hotel'),'hongkong',-2,9,0,'hotel');
    this.local(K.tower(12,61,0x91b0b3,'peak'),'hongkong',-14,-6);
    this.local(K.tower(11,37,0xb0beb3),'hongkong',0,-11);
    this.local(K.tower(9,30,0xcac4ae),'hongkong',-17,9);
    this.local(K.mole(),'turin',-8,-9);
    this.local(K.apartment(),'turin',7,11,0,'turin');
    this.local(K.house(0xd4ba92),'turin',-16,7);
    this.local(K.house(0xe5b696),'turin',12,-7);
    this.local(K.house(0xdbc7a2,11,17),'turin',-5,15);
    this.local(K.dorm(),'shanghai',-7,3,0,'dorm');
    this.local(K.pearl(),'shanghai',12,-12);
    this.local(K.gate(),'shanghai',3,18);
    this.local(K.house(0xc7c9b0,13,15),'shanghai',16,3);

    this.boat=K.ferry();this.boatAnchor=P.anchorLocal('hongkong',16,5,1.1);this.boatDirection=[0,0,0];this.add(this.boat,this.boatAnchor);
    const treeAnchors=[],pineAnchors=[],res={};
    for(let i=0;i<270;i++) {
      const y=1-2*(i+.5)/270,r=Math.sqrt(1-y*y),a=i*2.399963,dir=[r*Math.cos(a),y,r*Math.sin(a)];T.sample(...dir,res);
      if(res.water||res.zone==='way'||T.DL.some(d=>d.urban && dir.reduce((s,n,k)=>s+n*d.c[k],0)>Math.cos(d.r+.075)))continue;
      const ring=T.rings.way,dist=Math.abs(dir.reduce((s,n,k)=>s+n*ring.p[k],0));if(dist<.18)continue;
      if(i%2 && !res.zone)continue;
      (i%3?treeAnchors:pineAnchors).push(P.anchorDir(dir,null,i*.7,0,.78+(i%7)*.065));
    }
    for(const city of CITIES) for(const [x,z] of (city.id==='hongkong'?[[-19,-16],[-4,23],[-20,19],[3,-22]]:[[-19,-16],[18,15],[-20,19],[3,-22]]))treeAnchors.push(P.anchorLocal(city.id,x,z));
    this.instance(K.tree(),treeAnchors);this.instance(K.pine(),pineAnchors);
    const lamps=[],stones=[];
    for(let i=0;i<150;i++) {
      const a=i/150*TAU;
      stones.push(P.anchorRing('way',a,0,.36));
      if(i%5===0)lamps.push(P.anchorRing('way',a,i%10?-4.6:4.6,0));
    }
    // Narrow connecting paths physically lead from the walk to the remembered building.
    for(const city of CITIES) {
      const start=new THREE.Vector3().fromArray(T.ringPoint('way',STATIONS[city.id],0,[0,0,0]));
      const end=new THREE.Vector3().fromArray(T.districts[city.id].c);
      for(let j=1;j<19;j++){const d=start.clone().lerp(end,j/21).normalize();stones.push(P.anchorDir(d.toArray(),null,0,.35));}
    }
    this.instance(slabGeometry(1.3,2.1,.1,.3,.025),stones,this.materials.toon(0xc5b58f),true);
    this.instance(K.lamp(),lamps);
    this.walker=K.traveller();this.walker.root.scale.setScalar(1.3);this.planet.group.add(this.walker.root);
    const halo=new THREE.Mesh(new THREE.RingGeometry(2.4,3.2,32),new THREE.MeshBasicMaterial({color:0xf8d38a,transparent:true,opacity:.7,side:THREE.DoubleSide}));halo.rotation.x=-Math.PI/2;halo.position.y=.18;this.walker.root.add(halo);this.halo=halo;
    this.clouds=[];const cloudMaterial=this.materials.cloud;
    const cloudGeo=new THREE.IcosahedronGeometry(1,1);cloudGeo.computeVertexNormals();
    for(const [x,y,z,s] of [[-136,75,-20,1],[115,87,-35,.8],[-37,148,-52,.7],[18,-54,-145,1]]) {
      const g=new THREE.Group();for(let j=0;j<4;j++){const m=new THREE.Mesh(cloudGeo,cloudMaterial);m.position.set((j-1.5)*6.6,(j%2)*2.2,Math.sin(j)*1.4);m.scale.set(6.8,5.2+(j%2)*1.6,5.6);g.add(m);}g.position.set(x,y,z);g.scale.setScalar(s);this.root.add(g);this.clouds.push({g,x});
    }
    for(const city of CITIES) {
      const node=document.createElement('button');node.className='planet-city-label';node.type='button';node.setAttribute('aria-label',`走近${city.name}`);
      const name=document.createElement('strong');name.textContent=city.name;const sub=document.createElement('span');sub.textContent={hongkong:'海港 · 一扇窗',turin:'街巷 · 一串钥匙',shanghai:'校园 · 一间宿舍'}[city.id];node.append(name,sub);node.onclick=()=>this.onCity(city.id);this.host.append(node);
      const anchor=P.anchorLocal(city.id,0,-8,0,city.id==='shanghai'?32:44);this.labels.push({node,anchor,city:city.id});
    }
    this.walkerLabel=document.createElement('span');this.walkerLabel.className='traveller-label';this.walkerLabel.textContent='阿绵 · 陪你走一遍';this.host.append(this.walkerLabel);
    this.doorLabel=document.createElement('button');this.doorLabel.type='button';this.doorLabel.className='planet-door-label';this.doorLabel.hidden=true;this.host.append(this.doorLabel);
  }
  bindControls() {
    const canvas=this.renderer.domElement,signal=this.events.signal;
    let drag=null,pinch=0;
    const pointers=new Map(),spacing=()=>{const [a,b]=[...pointers.values()];return Math.hypot(a.x-b.x,a.y-b.y);};
    canvas.addEventListener('pointerdown',e=>{
      if(e.pointerType==='mouse'&&e.button!==0)return;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});canvas.setPointerCapture(e.pointerId);
      if(pointers.size===2){pinch=spacing();drag=null;}else drag={x:e.clientX,y:e.clientY,moved:0};
    },{signal});
    canvas.addEventListener('pointermove',e=>{
      if(!pointers.has(e.pointerId))return;
      pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(pointers.size===2){const next=spacing();if(pinch>0&&next>0)this.zoom(pinch/next);pinch=next;return;}
      if(!drag)return;
      const dx=e.clientX-drag.x,dy=e.clientY-drag.y;drag.moved+=Math.abs(dx)+Math.abs(dy);drag.x=e.clientX;drag.y=e.clientY;
      if(drag.moved>4){this.following=false;this.onExplore?.();this.targetLook.set(0,0,0);this.targetTheta-=dx*.005;this.targetPhi=Math.max(.25,Math.min(2.8,this.targetPhi-dy*.005));}
    },{signal});
    const end=e=>{
      const moved=drag?.moved??Infinity; pointers.delete(e.pointerId);drag=null;pinch=0;
      if(canvas.hasPointerCapture(e.pointerId))canvas.releasePointerCapture(e.pointerId);
      if(e.type==='pointerup'&&moved<6)this.pick(e);
    };
    canvas.addEventListener('pointerup',end,{signal});canvas.addEventListener('pointercancel',end,{signal});
    canvas.addEventListener('wheel',e=>{e.preventDefault();this.following=false;this.zoom(Math.exp(e.deltaY*.001));},{passive:false,signal});
    canvas.addEventListener('keydown',e=>{if(e.key.startsWith('Arrow')){this.following=false;this.onExplore?.();}if(e.key==='ArrowLeft'||e.key==='ArrowRight'){this.targetTheta+=e.key==='ArrowLeft'?-.16:.16;e.preventDefault();}else if(e.key==='ArrowUp'||e.key==='ArrowDown'){this.targetPhi=Math.max(.25,Math.min(2.8,this.targetPhi+(e.key==='ArrowUp'?-.1:.1)));e.preventDefault();}else if(e.key==='+'||e.key==='=')this.zoom(.9);else if(e.key==='-')this.zoom(1.1);},{signal});
  }
  pick(event) {
    const rect=this.renderer.domElement.getBoundingClientRect(),pointer=new THREE.Vector2((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1),ray=new THREE.Raycaster();ray.setFromCamera(pointer,this.camera);
    const hit=ray.intersectObjects(this.picks,false).find(h=>h.point.dot(this.camera.position)>110*110);
    if(!hit)return;const {city,room}=hit.object.userData;this.planet.kick=.75;
    if(room && this.selected===city)this.onRoom(room);else this.onCity(city);
  }
  focus(id) {
    this.selected=id;this.following=false;
    const d=MB.Terrain.districts[id];this.targetTheta=nearAngle(d.lon,this.theta);this.targetPhi=Math.min(2.85,Math.PI/2-d.lat+.48);this.targetDistance=this.width<650?350:330;
    this.targetLook.fromArray(d.c).multiplyScalar(70);
    this.doorLabel.textContent=`走进${roomById(roomForCity[id]).short} →`;this.doorLabel.onclick=()=>this.onRoom(roomForCity[id]);
    this.planet.kick=.65;
  }
  overview() {this.selected=null;this.following=false;this.targetTheta=nearAngle(0,this.theta);this.targetPhi=1.50;this.targetDistance=this.overviewDistance();this.targetLook.set(0,0,0);}
  follow() {this.selected=null;this.following=!this.preferences.reducedMotion;}
  zoom(factor) {this.following=false;this.onExplore?.();this.targetDistance=Math.max(245,Math.min(Math.max(660,this.overviewDistance()*1.45),this.targetDistance*factor));}
  setJourney(progress,playing,touring,order) {this.progress=progress;this.playing=playing;this.touring=touring;this.trip=journeyAt(progress,order);}
  overviewDistance(){return (this.width<650?440:505)*Math.max(1,this.height/this.width);}
  resize() {
    if(!this.active)return;const rect=this.host.getBoundingClientRect();this.width=rect.width;this.height=rect.height;
    const controls=this.host.closest('#world-view').querySelector('.planet-controls').getBoundingClientRect();this.controlsBox={left:controls.left-rect.left,right:controls.right-rect.left,top:controls.top-rect.top,bottom:controls.bottom-rect.top};
    this.camera.aspect=this.width/this.height;this.camera.updateProjectionMatrix();this.renderer.setSize(this.width,this.height);
    if(!this.selected&&!this.following)this.targetDistance=this.overviewDistance();
  }
  tick(now) {
    if(!this.active)return;this.raf=requestAnimationFrame(t=>this.tick(t));
    const dt=Math.min(.05,(now-this.last)/1000);this.last=now;this.time+=dt;this.frames++;
    const reduced=this.preferences.reducedMotion,f={...ZERO,...this.features},cl=MB.Climate.update(this.progress*64,dt);
    this.planet.update(reduced?0:dt,reduced?{...ZERO,active:true}:f,this.time,cl,reduced);
    for(const item of this.objects)MB.Place.ride(this.planet,item.anchor,item.object);
    for(const set of this.sets)if(set.dynamic)set.write(this.planet);
    if(!reduced) {
      MB.Terrain.fromLocal('hongkong',16+Math.sin(this.time*.12)*1.4,5+Math.cos(this.time*.12)*2.4,this.boatDirection);
      this.boatAnchor.d.fromArray(this.boatDirection);MB.Place.ride(this.planet,this.boatAnchor,this.boat,Math.sin(this.time*.8)*.22);
      for(const {g,x} of this.clouds)g.position.x=x+Math.sin(this.time*.04+x)*5;
    }
    this.updateWalker(f,reduced);
    if(this.following&&!reduced) {
      this.targetTheta=nearAngle(Math.atan2(this.surface.x,this.surface.z),this.theta);this.targetPhi=Math.min(2.85,Math.acos(this.surface.y)+.45);this.targetDistance=this.width<650?390:365;this.targetLook.copy(this.surface).multiplyScalar(66);this.tmp.fromArray(MB.Terrain.districts[this.trip.cityId].c).multiplyScalar(70);this.targetLook.lerp(this.tmp,.22);
    }
    const smooth=reduced?1:1-Math.exp(-dt*3.6);
    this.theta+=(this.targetTheta-this.theta)*smooth;this.phi+=(this.targetPhi-this.phi)*smooth;this.distance+=(this.targetDistance-this.distance)*smooth;this.look.lerp(this.targetLook,smooth);
    this.camera.position.set(Math.sin(this.theta)*Math.sin(this.phi)*this.distance,Math.cos(this.phi)*this.distance,Math.cos(this.theta)*Math.sin(this.phi)*this.distance);this.camera.lookAt(this.look);this.camera.updateMatrixWorld();
    this.planet.group.updateMatrixWorld(true);this.lighting.update(dt,f,this.time,cl,this.camera);
    this.host.closest('#world-view').style.setProperty('--sky-wash',`rgb(${cl.skyHor.map(n=>Math.round(n*255)).join(' ')})`);
    this.renderer.render(this.root,this.camera);this.paintLabels();
    this.fpsFrames++;this.fpsTime+=dt;
    if(this.fpsTime>=1){this.fps=Math.round(this.fpsFrames/this.fpsTime);this.lowSeconds=this.fps<26?this.lowSeconds+this.fpsTime:0;if(this.lowSeconds>3&&this.renderer.getPixelRatio()>1)this.renderer.setPixelRatio(1);this.fpsFrames=0;this.fpsTime=0;}
  }
  updateWalker(f,reduced) {
    const t=this.trip.angle,r=MB.Terrain.rings.way,d=MB.Terrain.ringPoint('way',t,0,[0,0,0]);this.surface.fromArray(d);
    this.tmp.set(-Math.sin(t)*r.e1[0]+Math.cos(t)*r.e2[0],-Math.sin(t)*r.e1[1]+Math.cos(t)*r.e2[1],-Math.sin(t)*r.e1[2]+Math.cos(t)*r.e2[2]).multiplyScalar(this.trip.direction);
    MB.Place.quatFwd(this.surface,this.tmp,this.walker.root.quaternion);this.walker.root.position.copy(this.surface).multiplyScalar(110.45);
    const walking=this.playing&&this.trip.walking&&!reduced;
    // Continuous phase from the audio time, with an alternating step per beat.
    const phase=((Number.isFinite(f.beatIndex)?f.beatIndex:0)+(Number.isFinite(f.beatPhase)?f.beatPhase:0))*Math.PI;
    const stride=walking?Math.sin(phase)*.68:0;
    this.walker.legs[0].rotation.x=stride;this.walker.legs[1].rotation.x=-stride;this.walker.arms[0].rotation.x=-stride*.8;this.walker.arms[1].rotation.x=stride*.8;
    this.walker.body.position.y=walking?Math.abs(Math.sin(phase))*.22:0;this.halo.material.opacity=this.trip.arrived?.75:.35;
  }
  project(node,position,normal,offset=0) {
    this.cameraDirection.copy(this.camera.position);if(normal)this.cameraDirection.addScaledVector(normal,-110);else this.cameraDirection.sub(position);this.cameraDirection.normalize();
    if(normal && normal.dot(this.cameraDirection)<.08){node.hidden=true;return;}
    this.projected.copy(position).project(this.camera);
    const x=(this.projected.x*.5+.5)*this.width,y=(-this.projected.y*.5+.5)*this.height-offset;
    node.hidden=this.projected.z>1||x< -36||x>this.width+36||y<12||y>this.height-12;
    if(!node.hidden){
      const w=node.offsetWidth,h=node.offsetHeight,c=this.controlsBox;
      let px=Math.max(w/2+8,Math.min(this.width-w/2-8,x));
      if(c&&px+w/2>c.left-8&&px-w/2<c.right+8&&y>c.top-8&&y-h<c.bottom+8)px=Math.max(w/2+8,c.left-w/2-12);
      node.style.left=`${px}px`;node.style.top=`${y}px`;
    }
  }
  paintLabels() {
    for(const label of this.labels){if(this.selected&&label.city!==this.selected){label.node.hidden=true;continue;}this.tmp.copy(label.anchor.d).multiplyScalar(110+label.anchor.alt);this.project(label.node,this.tmp,label.anchor.d);label.node.classList.toggle('is-current',this.trip.arrived&&this.trip.cityId===label.city&&this.touring);label.node.classList.toggle('is-selected',this.selected===label.city);}
    this.project(this.walkerLabel,this.walker.root.position,this.surface,-27);
    if(this.selected) {
      // Let the camera settle before offering a moving door as a pointer target.
      if(Math.abs(this.phi-this.targetPhi)>.012||Math.abs(this.theta-this.targetTheta)>.012||Math.abs(this.distance-this.targetDistance)>1.2||this.look.distanceTo(this.targetLook)>.8){this.doorLabel.hidden=true;return;}
      const item=this.objects.find(x=>x.object.children.some(c=>c.userData.room===roomForCity[this.selected]));
      if(item){this.tmp.set(0,1,6).applyQuaternion(item.anchor.q).add(item.object.position);this.project(this.doorLabel,this.tmp,item.anchor.d,-30);}
    } else this.doorLabel.hidden=true;
  }
  diagnostics() {return this.renderer?{engine:'miniature-music-planet',style:'room-matched-low-poly',calls:this.renderer.info.render.calls,triangles:this.renderer.info.render.triangles,geometries:this.renderer.info.memory.geometries,textures:this.renderer.info.memory.textures,surfaceTriangles:this.planet?.surfaceTriangles,city:this.trip.cityId,arrived:this.trip.arrived,walking:this.playing&&this.trip.walking&&!this.preferences.reducedMotion,walkerAngle:Number(this.trip.angle.toFixed(4)),progress:Number(this.progress.toFixed(4)),following:this.following,frames:this.frames,fps:this.fps,pixelRatio:this.renderer.getPixelRatio()}:null;}
  release() {
    const geos=new Set(),mats=new Set(),textures=new Set();this.root?.traverse(o=>{if(o.geometry)geos.add(o.geometry);o.shadow?.dispose();for(const m of [o.material,o.customDepthMaterial].flat()){if(!m)continue;mats.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
    geos.forEach(g=>g.dispose());textures.forEach(t=>t.dispose());mats.forEach(m=>m.dispose());this.renderer?.dispose();this.renderer?.forceContextLoss();
  }
  dispose() {this.active=false;cancelAnimationFrame(this.raf);this.events.abort();this.resizeObserver?.disconnect();this.release();this.host.replaceChildren();}
}
