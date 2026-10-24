import { readFile, writeFile } from 'node:fs/promises';
const file = new URL('../public/room/index.html', import.meta.url);
let html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
function change(from, to) { if (!html.includes(from)) throw new Error('Room source anchor not found: ' + from.slice(0, 100)); html = html.replace(from, to); }
change('https://cdn.jsdelivr.net/npm/lucide@0.468.0/dist/umd/lucide.min.js', '../vendor/lucide.min.js');
change('https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js', '../vendor/three.module.js');
change('</style>', `</style><link rel="stylesheet" href="../theme.css"><link rel="stylesheet" href="../room-theme.css">`);
change('const $=id=>document.getElementById(id);', `const $=id=>document.getElementById(id);
const embedded=window.parent!==window&&new URLSearchParams(location.search).has('embedded');
if(embedded)document.documentElement.dataset.embedded='true';
let hostState=null,musicFrame={},disposed=false,raf=0,saveTimer=0,lastPoseAt=0;
const channel='memory-world-room-v1';
const send=(type,payload={})=>{if(embedded)parent.postMessage({channel,type,...payload},location.origin)};
const initial=embedded?await new Promise((resolve,reject)=>{
 const timer=setTimeout(()=>reject(new Error('房间连接超时，请返回城市后重试')),15000);
 const receive=e=>{if(e.source===parent&&e.origin===location.origin&&e.data?.channel===channel&&e.data.type==='init'){clearTimeout(timer);removeEventListener('message',receive);resolve(e.data)}};
 addEventListener('message',receive);send('awaiting-init');
}):null;
hostState=initial?.state||null;
const {ACTIONS}=await import('../src/life.js');`);
change('  function schedule(t,index=0){', `  function schedule(t,index=0){
   if(embedded&&hostState?.actors?.[index]){const a=hostState.actors[index];return ACTIONS[a.action]||ACTIONS.window}`);
change(' function openMemory(item){', ` function openMemory(item){
  if(embedded){send('memory-open',{id:item.id});return}`);
change(' function persist(){', ` function persist(){
   if(embedded)return;`);
change("const local=state.time<0?state.time+24:state.time,event=LIFE_EVENTS[state.place].find(item=>local>=item.from&&local<item.to),currentKey=event?state.day+'-'+event.id:'none';", "const local=state.time<0?state.time+24:state.time,event=embedded?null:LIFE_EVENTS[state.place].find(item=>local>=item.from&&local<item.to),currentKey=event?state.day+'-'+event.id:'none';");
change('  function selectPlace(id){', `  function selectPlace(id){
   if(embedded){send('navigate',{roomId:id});return}`);
change("const free=mobile()?{left:12,right:width-12,top:145,bottom:height-115}:{left:332,right:width-32,top:70,bottom:height-75};", "const free=embedded?{left:12,right:width-12,top:20,bottom:height-60}:mobile()?{left:12,right:width-12,top:145,bottom:height-115}:{left:332,right:width-32,top:70,bottom:height-75};");
change('  sun.intensity=.12+daylight*2.1;ambient.intensity=.4+daylight*.7;', '  sun.intensity=(.22+daylight*1.55)*(1+(musicFrame.energy||0)*.04);ambient.intensity=.8+daylight*.3;');
change("scene.background.copy(night).lerp(day,daylight);", "scene.background.copy(night).lerp(day,daylight);if(musicFrame.active)scene.background.lerp(new THREE.Color('#e1c6a2'),(musicFrame.warm||0)*.12);");
change("function band(y){return new THREE.Color(state.place==='hotel'&&y<-.7?'#45bfd1':state.place==='hotel'&&y>2.2?'#63a998':y<.25?(state.place==='hotel'?'#ffe04e':'#d4cba2'):state.place==='turin'?'#a9c77d':'#87d751')}", "function band(y){return new THREE.Color(state.place==='hotel'&&y<-.7?'#8ab9bd':state.place==='hotel'&&y>2.2?'#95b39b':y<.25?(state.place==='hotel'?'#e7d7b3':'#cdd2b2'):state.place==='turin'?'#adc595':'#aec58f')}");
change("function roomLabel(text,x,y,z,accent=false,detail=false){label(text,x+HOME.x,y+room.position.y,z+HOME.z,accent,detail)}", "function roomLabel(text,x,y,z,accent=false,detail=false){label(text,x+HOME.x,y+room.position.y,z+HOME.z,accent,detail);labels.at(-1).interior=true}");
change("&&(!mobile()||camera.zoom>1.35||!item.detail);", "&&(!mobile()||camera.zoom>1.35||!item.detail)&&(!embedded||!item.interior||camera.zoom>1.3);");
change("function toggleFocus(value){state.follow=value;$('focus').setAttribute('aria-pressed',String(value))}", "function toggleFocus(value){state.follow=value;$('focus').setAttribute('aria-pressed',String(value));send('view-state',{follow:value})}");
// Bring the original room materials into the planet's quiet, warm palette.
change("const materialSet=new Set(Object.values(mat));", `const palette={sea:'#88b6b9',floor:'#decca5',base:'#bba47d',wall:'#9fb7a3',leaf:'#a4be89',pine:'#6c947d',trunk:'#a18868',petal:'#dfbc73',pink:'#d2a1a2',cushion:'#d0a082',blanket:'#96b9aa',desk:'#bb946e',agent:'#ca967e',ink:'#3f5149',pot:'#c7a07b',hull:'#607368',cream:'#e4d5b2',terracotta:'#bb896d',road:'#91a298',blue:'#9caebb',lilac:'#b5abb8',mint:'#a6c0a9',brick:'#ceb299'};
 for(const [name,color] of Object.entries(palette))mat[name].color.set(color);
 const materialSet=new Set(Object.values(mat));`);
change("const width=Math.min(.055,.022+g.boundingSphere.radius*.007);", "const width=Math.min(.025,.010+g.boundingSphere.radius*.003);");
change("const night=new THREE.Color('#56677c'),day=new THREE.Color(place().sky);", "const night=new THREE.Color('#b2c2c8'),day=new THREE.Color('#e8eee1');");
change("ambient.color.set(daylight<.3?'#7e9dd1':'#ffffff');", "ambient.color.set(daylight<.3?'#b6c5d5':'#fffdf4');");
change('lampLight.intensity=glow*(sleeping?1.6:12);', 'lampLight.intensity=glow*(sleeping?1.6:12)*(1+(musicFrame.beat||0)*.12);');
change('trees.forEach((tree,i)=>tree.rotation.z=Math.sin(elapsed*.7+i*.6)*.012);', 'trees.forEach((tree,i)=>tree.rotation.z=hostState?.reducedMotion?0:Math.sin(elapsed*.7+i*.6)*(.012+(musicFrame.mid||0)*.008));');
change('const expansion=Math.sin(elapsed*1.5+wave.userData.phase)*.12;', 'const expansion=Math.sin(elapsed*1.5+wave.userData.phase)*(.12+(musicFrame.bass||0)*.06);');
change(' setInterval(persist,5000);', ` if(!embedded)saveTimer=setInterval(persist,5000);
 function applyHost(data){
  hostState=data;state.time=data.simHour%24;state.day=Math.floor(data.simHour/24)+1;state.autoTime=data.autoTime;document.documentElement.dataset.reducedMotion=String(data.reducedMotion);
  if(data.memories){memoryState.notes={};memoryState.discoveries={};foundMemories.clear();for(const [id,m] of Object.entries(data.memories)){if(m.note)memoryState.notes[id]=m.note;if(m.discovered){memoryState.discoveries[id]=true;foundMemories.add(id)}}}
  memoryState.events=(data.journal||[]).map(e=>({...e,key:e.id,id:e.item?.includes('tea')?'tea':e.item?.includes('note')?'note':e.item?.includes('timetable')?'class':e.action}));
  updateUI(true);updateMemoryUI();updateLife();
 }
 function poseSnapshot(){return residents.map(a=>({x:a.position.x,y:a.position.y,z:a.position.z,yaw:a.rotation.y,station:a.userData.station}))}
 addEventListener('message',e=>{if(!embedded||e.source!==parent||e.origin!==location.origin||e.data?.channel!==channel)return;
  const data=e.data;if(data.type==='state'&&data.state?.id===state.place)applyHost(data.state);
  if(data.type==='music')musicFrame=hostState?.reducedMotion?{}:data.features||{};
  if(data.type==='focus')toggleFocus(!state.follow);
  if(data.type==='reset')resetCamera();
 });`);
change(" restore();state.returnCount+=1;buildWorld();persist();layout();updateCamera(1);updateLabels();renderer.render(scene,camera);$('loading').hidden=true;", ` if(initial){applyVisit(initial.roomId,initial.visit,false)}else{restore();state.returnCount+=1}
 buildWorld();if(hostState){applyHost(hostState);(hostState.poses||[]).forEach((p,i)=>{const actor=residents[i];if(actor){actor.position.set(p.x,p.y,p.z);actor.rotation.y=p.yaw;actor.userData.station=p.station}});
 if(hostState.quality==='low'){renderer.setPixelRatio(1);renderer.shadowMap.enabled=false;outlines.forEach(o=>o.visible=false)}}
 persist();layout();updateCamera(1);updateLabels();renderer.render(scene,camera);$('loading').hidden=true;`);
change('  focusPoint.lerp(target,1-Math.exp(-dt*4));', '  focusPoint.lerp(target,hostState?.reducedMotion?1:1-Math.exp(-dt*4));');
change('  visualZoom=THREE.MathUtils.damp(visualZoom,zoom*(state.follow?1.95:1),5,dt);', '  visualZoom=hostState?.reducedMotion?zoom*(state.follow?1.95:1):THREE.MathUtils.damp(visualZoom,zoom*(state.follow?1.95:1),5,dt);');
change(' function updateEnvironment(dt){', ' function updateEnvironment(dt){\n  if(hostState?.reducedMotion)return;');
change(' function animate(now){', ' function animate(now){\n  if(disposed)return;');
change('  if(state.autoTime){const hours=', '  if(!embedded&&state.autoTime){const hours=');
change('  renderer.render(scene,camera);requestAnimationFrame(animate);', `  renderer.render(scene,camera);
  if(embedded&&now-lastPoseAt>2000){lastPoseAt=now;send('pose',{roomId:state.place,poses:poseSnapshot(),diagnostics:{drawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures}})}
  raf=requestAnimationFrame(animate);`);
change(' lastFrame=performance.now();requestAnimationFrame(animate);', ' lastFrame=performance.now();raf=requestAnimationFrame(animate);');
change(' window.roommateIsle={', ` window.roommateIsle={
  flush:()=>({roomId:state.place,poses:poseSnapshot()}),
  destroy:()=>{if(disposed)return;disposed=true;cancelAnimationFrame(raf);clearInterval(saveTimer);disposeWorld();gradientMap.dispose();Object.values(mat).forEach(m=>m.dispose?.());renderer.renderLists.dispose();renderer.dispose();renderer.forceContextLoss();canvas.remove()},`);
change("}catch(error){\n $('loading').hidden=false;", " send('room-ready',{roomId:state.place,diagnostics:{drawCalls:renderer.info.render.calls,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures}});\n}catch(error){\n send('room-error',{message:error.message});\n $('loading').hidden=false;");
await writeFile(file, html);
console.log('Room adapted for a single host-owned world and music clock.');
