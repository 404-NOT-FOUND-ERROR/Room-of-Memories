import * as THREE from '../../vendor/three.module.js';
import { PaintedGeometry, silhouette } from './miniature.js';

// Architecture is a distant view of the rooms: beveled masses, framed panes,
// clay roofs, faceted foliage and the same warm three-band toon material.
export function buildKit(materials,{outlines=true}={}) {
  const U=.62,C={cream:0xe4d5b2,stone:0xbba47d,roof:0xbb896d,edge:0xf0e7d1,ink:0x607368,glass:0x769ba1,leaf:0xa4be89,pine:0x6c947d,wood:0xa18868};
  const model=()=>({solid:new PaintedGeometry(),panes:new PaintedGeometry(),lit:new PaintedGeometry()});
  function pack(m) {
    const root=new THREE.Group();
    for(const [key,material] of [['solid',materials.paint],['panes',materials.glass],['lit',materials.lit]]){
      if(!m[key].positions.length)continue;
      const geo=m[key].build(U),mesh=new THREE.Mesh(geo,material);mesh.castShadow=key==='solid';mesh.receiveShadow=true;root.add(mesh);
      if(key==='solid'&&outlines){const hull=new THREE.Mesh(silhouette(geo,.035),materials.hull);hull.userData.isHull=true;root.add(hull);}
    }
    return root;
  }
  function window(m,x,y,z,w=3,h=4,shutter=false,lit=false){
    m.solid.slab(w+.45,.3,h+.45,C.edge,[x,y-.2,z],.16);
    (lit?m.lit:m.panes).quad([x-w/2,y,z+.25],[x+w/2,y,z+.25],[x+w/2,y+h,z+.25],[x-w/2,y+h,z+.25],lit?0xe4cc98:C.glass);
    if(shutter)for(const side of [-1,1])m.solid.slab(.85,.35,h+.25,0x96ad94,[x+side*(w/2+.65),y-.1,z+.05],.15);
  }
  function door(m,z,y=0){
    m.solid.slab(6,3,.6,C.stone,[0,y,z+1],.65).slab(5,.8,9,C.edge,[0,y+.5,z],.55).slab(3.8,.3,7.8,C.wood,[0,y+.6,z+.5],.35);
    m.lit.quad([-1.4,y+2,z+.7],[1.4,y+2,z+.7],[1.4,y+7.9,z+.7],[-1.4,y+7.9,z+.7],0xd8c6a0);
    m.solid.ball(.23,0xd9be82,[1.2,y+4,z+.8],[1,1,1],0).slab(7,3,.5,C.roof,[0,y+9.6,z+.8],.35);
  }
  function roof(m,w,d,y,h=6,color=C.roof){
    const s=new THREE.Shape();s.moveTo(-w/2,0);s.lineTo(w/2,0);s.lineTo(0,h);s.closePath();
    const g=new THREE.ExtrudeGeometry(s,{depth:d,steps:1,bevelEnabled:true,bevelSize:.15,bevelThickness:.12,bevelSegments:1});g.translate(0,0,-d/2);
    m.solid.add(g,color,[0,y,0]).slab(w+.6,d+.6,.5,0xc59b7c,[0,y-.3,0],.3);
  }
  function house(wall=0xceb299,width=15,height=22){
    const m=model(),d=12;m.solid.slab(width+1.5,d+1.5,.7,C.stone,[0,0,0],.8).slab(width,d,height,wall,[0,.5,0],.85);
    for(const x of [-width*.28,width*.28])window(m,x,14,d/2,3,4,true);
    m.solid.slab(width+.4,.65,.7,C.edge,[0,12,d/2],.2);door(m,d/2);roof(m,width+2,d+2,height+1,6);
    m.solid.slab(2.1,2.3,5.5,C.stone,[width*.28,height+3,-1],.2);return pack(m);
  }
  function apartment(){
    const m=model();m.solid.slab(29,18,.8,C.stone,[0,0,0],1).slab(27,16,29,0xdec49f,[0,.5,0],1.1);
    for(const y of [14.5,24])for(const [i,x] of [-9,0,9].entries())window(m,x,y,8,3.8,4.2,true,i===1&&y===14.5);
    for(const y of [12.4,23,29.5])m.solid.slab(28,17,.65,C.edge,[0,y,0],.65);
    // Open arcades are curved bands with actual space beneath them.
    for(const x of [-9,0,9]){
      for(const side of [-1,1])m.solid.cylinder(.65,.8,8,C.edge,[x+side*3.7,4.2,10],8);
      const arch=new THREE.Shape();arch.absarc(0,0,4.4,0,Math.PI,false);arch.lineTo(-3.3,0);arch.absarc(0,0,3.3,Math.PI,0,true);arch.closePath();
      m.solid.add(new THREE.ExtrudeGeometry(arch,{depth:1,bevelEnabled:true,bevelSize:.08,bevelThickness:.08,bevelSegments:1,curveSegments:8}),C.edge,[x,8,9.5]);
    }
    door(m,8);roof(m,29,18,30,7);m.solid.slab(2.3,2.6,6,C.roof,[8,34,-2],.2);
    m.solid.rod([-10,19.5,10.2],[10,19.5,10.2],.18,C.ink);
    for(let x=-10;x<=10;x+=2.5)m.solid.rod([x,17,10.2],[x,19.5,10.2],.11,C.ink);
    return pack(m);
  }
  function tower(width=15,height=51,color=0x9fb7a3,type='flat'){
    const m=model(),d=type==='hotel'?16:11;
    m.solid.slab(width+2,d+2,1.2,C.stone,[0,0,0],1).slab(width,d,height,color,[0,.6,0],Math.min(1.3,width*.12));
    const columns=Math.max(2,Math.floor(width/4)),floors=Math.floor((height-4)/5.3);
    // All four facades share the harbour room's calm window rhythm.
    for(let row=0;row<floors;row++)for(let col=0;col<columns;col++){
      const x=-width*.37+col*width*.74/(columns-1),y=3+row*(height-6)/floors,w=width*.6/columns,h=3.6;
      const target=(row*3+col)%9===0?m.lit:m.panes,c=target===m.lit?0xdbca9e:C.glass;
      target.quad([x-w/2,y,d/2+.12],[x+w/2,y,d/2+.12],[x+w/2,y+h,d/2+.12],[x-w/2,y+h,d/2+.12],c);
      target.quad([x+w/2,y,-d/2-.12],[x-w/2,y,-d/2-.12],[x-w/2,y+h,-d/2-.12],[x+w/2,y+h,-d/2-.12],c);
      const z=-d*.33+col*d*.66/(columns-1),sw=d*.52/columns;
      for(const side of [-1,1])target.quad([side*(width/2+.12),y,z+side*sw/2],[side*(width/2+.12),y,z-side*sw/2],[side*(width/2+.12),y+h,z-side*sw/2],[side*(width/2+.12),y+h,z+side*sw/2],c);
    }
    for(let y=8;y<height;y+=10.6)m.solid.slab(width+.3,d+.3,.3,C.edge,[0,y,0],1);
    m.solid.slab(width+1,d+1,1.1,C.edge,[0,height,0],1.2).slab(width*.7,d*.68,2.4,color,[0,height+1,0],1);
    if(type==='peak'){m.solid.cylinder(width*.12,width*.38,9,0x91adb1,[0,height+7,0],8).rod([0,height+11,0],[0,height+20,0],.22,C.ink);}
    else m.solid.slab(width*.32,3,1.7,0x9fb7a3,[width*.12,height+3.4,0],.5);
    door(m,d/2);return pack(m);
  }
  function mole(){
    const m=model();m.solid.slab(23,19,1.2,C.stone,[0,0,0],1).slab(21,17,19,C.cream,[0,.7,0],1);
    for(const x of [-7,-2.3,2.3,7])window(m,x,10,8.5,2.5,6);
    m.solid.slab(23,19,1,C.edge,[0,19.5,0],.8).cylinder(2.8,11.8,15,0x7b998a,[0,28,0],8).cylinder(3.2,3.2,8,C.cream,[0,39,0],8).cylinder(4.3,4.3,.7,C.edge,[0,43,0],8).cylinder(.35,4.5,12,0x769184,[0,49,0],8).rod([0,54,0],[0,66,0],.23,C.ink);
    door(m,8.5);return pack(m);
  }
  function pearl(){
    const m=model();m.solid.cylinder(10,10.7,1.2,C.cream,[0,.6,0],16);
    for(const [x,z] of [[-7,5],[7,5],[0,-7]])m.solid.rod([x,1,z],[x/3,30,z/3],.8,0xaeb9b2);
    m.solid.cylinder(1.6,1.9,48,0xb5c4bb,[0,29,0],10).ball(8,0xc69a8f,[0,19,0],[1,.78,1],1).ball(5,0xc69a8f,[0,42,0],[1,.8,1],1);
    for(const [y,r] of [[19,7.9],[42,4.9]])m.panes.cylinder(r,r,1.15,C.glass,[0,y,0],16);
    m.solid.cylinder(.5,1.4,13,C.edge,[0,53,0],8).rod([0,59,0],[0,66,0],.18,C.ink);return pack(m);
  }
  function dorm(){
    const m=model();m.solid.slab(39,17,1.1,C.stone,[0,0,0],1).slab(37,15,29,0xcebfa1,[0,.7,0],1.25);
    for(const y of [6,15,24]){
      for(const [i,x] of [-13.5,-4.5,4.5,13.5].entries())window(m,x,y,7.5,5.3,4.6,false,i===1&&y===15);
      m.solid.slab(37,3,.55,0xc2a183,[0,y-.7,8.3],.4).rod([-18,y+1.7,9.7],[18,y+1.7,9.7],.17,C.ink);
      for(let x=-18;x<=18;x+=3)m.solid.rod([x,y-.5,9.7],[x,y+1.7,9.7],.12,C.ink);
    }
    m.solid.slab(39,17,1,0x8f9f8e,[0,30,0],1).slab(33,12,.5,0xa4b69b,[0,31,0],.8);door(m,7.5);
    m.solid.rod([-13,20.7,11],[-3,20.7,11],.1,C.ink);
    for(const [x,c] of [[-10.5,0xe7e4cd],[-5.5,0x9caebb]])m.solid.slab(2.5,.25,2.5,c,[x,18,11],.22).slab(3.5,.25,.8,c,[x,19.7,11],.22);
    const root=pack(m);addSign(root,'30',[0,13.1,5.11],[3.1,1.5],'#e4d5b2','#607368',materials);return root;
  }
  function gate(){const m=model();for(const x of [-15,15])m.solid.cylinder(.85,1,12,C.cream,[x,6,0],8);m.solid.slab(33,3,1.8,C.wood,[0,11,0],.6);const root=pack(m);addSign(root,'松江 · 校园',[0,7.42,1.02],[10,1.1],'#a18868','#f0e7d1',materials);return root;}
  function ferry(){
    const m=model();m.solid.slab(10,26,2,0x72968b,[0,0,0],3).slab(10.2,25,.7,C.edge,[0,2,0],2.9).slab(8.8,22,4.5,C.cream,[0,2.7,0],2).slab(10,24,.7,0x84a894,[0,7.3,0],2);
    for(let z=-8;z<=8;z+=4)for(const s of [-1,1])m.panes.quad([s*4.5,3.5,z+s],[s*4.5,3.5,z-s],[s*4.5,6,z-s],[s*4.5,6,z+s],C.glass);
    m.solid.slab(6.2,13,3.4,C.edge,[0,8,0],1).slab(7,14,.6,0x84a894,[0,11.5,0],1.2).cylinder(.6,.8,3,C.ink,[0,13,-2],8);return pack(m);
  }
  function tree(){return new PaintedGeometry().cylinder(.75,1.05,12,C.wood,[0,6,0],7).rod([0,8,0],[-3,13,0],.5,C.wood).ball(6.5,C.leaf,[0,16,0],[1,1.1,.92],1).ball(4,0x95b38a,[-4,13,1],[1,1,1],1).ball(3.8,0xb4c695,[3,15,0],[1,1,1],1).build(U);}
  function pine(){const p=new PaintedGeometry().cylinder(.7,.9,11,C.wood,[0,5.5,0],7);for(const [r,h,y,c] of [[7,12,12,C.pine],[5.5,11,17,0x7fa48c],[3.7,9,22,0x97b296]])p.cylinder(0,r,h,c,[0,y,0],8);return p.build(U);}
  function lamp(){return new PaintedGeometry().cylinder(.26,.36,11,C.ink,[0,5.5,0],8).cylinder(1.2,1.05,2.5,0xe6d3a0,[0,11,0],8).cylinder(.3,1.6,1,C.ink,[0,12.8,0],8).build(U);}
  function traveller(){
    const root=new THREE.Group(),body=new THREE.Group();root.add(body);
    const mesh=(g,parent=body)=>{const m=new THREE.Mesh(g.build(),materials.paint);m.castShadow=true;parent.add(m);return m;};
    mesh(new PaintedGeometry().cylinder(.84,1.03,2.2,0xca967e,[0,3.25,0],8).slab(1.2,.65,1.7,0x769184,[0,2.45,-.95],.25).cylinder(.87,.92,.28,0xdfbc73,[0,4.25,0],10));
    mesh(new PaintedGeometry().ball(.92,0xe8c9a2,[0,5.15,0],[.86,1,.86],1).ball(.89,0x81715d,[0,5.48,-.13],[.9,.62,.92],1).ball(.065,0x3f5149,[-.28,5.17,.72],[1,1,.7],0).ball(.065,0x3f5149,[.28,5.17,.72],[1,1,.7],0));
    const legs=[],arms=[];
    for(const s of [-1,1]){
      const leg=new THREE.Group();leg.position.set(s*.48,2.15,0);body.add(leg);mesh(new PaintedGeometry().cylinder(.3,.29,1.65,0x687e78,[0,-.9,0],8).ball(.36,C.cream,[0,-1.85,.15],[1,.6,1.6],1),leg);legs.push(leg);
      const arm=new THREE.Group();arm.position.set(s*1.03,4.02,0);body.add(arm);mesh(new PaintedGeometry().cylinder(.28,.24,1.25,0xca967e,[0,-.62,0],8).ball(.25,0xe8c9a2,[0,-1.38,0],[1,1.2,1],1),arm);arms.push(arm);
    }
    return {root,body,legs,arms};
  }
  return {house,apartment,tower,mole,pearl,dorm,gate,ferry,tree,pine,lamp,traveller,material:materials.paint};
}

function addSign(parent,text,p,size,background,color,materials){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');
  ctx.fillStyle=background;ctx.fillRect(0,0,512,96);ctx.fillStyle=color;ctx.font='bold 57px "Microsoft YaHei", sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,51);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sign=new THREE.Mesh(new THREE.PlaneGeometry(...size),materials.toon(0xffffff,{map:texture,side:THREE.DoubleSide}));sign.position.set(...p);parent.add(sign);
}
