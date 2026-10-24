import * as THREE from '../../vendor/three.module.js';

// The room dioramas and the planet use the same three light bands and soft edges.
export function miniatureMaterials() {
  const gradient=new THREE.DataTexture(new Uint8Array([104,104,104,255,184,184,184,255,255,255,255,255]),3,1,THREE.RGBAFormat);
  gradient.minFilter=gradient.magFilter=THREE.NearestFilter;gradient.generateMipmaps=false;gradient.needsUpdate=true;
  const toon=(color,extra={})=>new THREE.MeshToonMaterial({color,gradientMap:gradient,...extra});
  return {gradient,toon,paint:toon(0xffffff,{vertexColors:true}),glass:toon(0xffffff,{vertexColors:true}),
    lit:toon(0xffffff,{vertexColors:true,emissive:0xe1b875,emissiveIntensity:0}),
    hull:toon(0x607368,{side:THREE.BackSide}),cloud:toon(0xfcfaf1),road:toon(0xe4d5b2),edge:toon(0xb7bda0)};
}

export function slabGeometry(w,d,h,r=.45,bevel=.08) {
  r=Math.max(.01,Math.min(r,w/2-.01,d/2-.01));const s=new THREE.Shape(),x=-w/2,z=-d/2;
  s.moveTo(x+r,z);s.lineTo(x+w-r,z);s.quadraticCurveTo(x+w,z,x+w,z+r);
  s.lineTo(x+w,z+d-r);s.quadraticCurveTo(x+w,z+d,x+w-r,z+d);
  s.lineTo(x+r,z+d);s.quadraticCurveTo(x,z+d,x,z+d-r);
  s.lineTo(x,z+r);s.quadraticCurveTo(x,z,x+r,z);
  const g=new THREE.ExtrudeGeometry(s,{depth:h,steps:1,bevelEnabled:bevel>0,bevelSegments:1,bevelSize:bevel,bevelThickness:bevel,curveSegments:3});
  g.rotateX(-Math.PI/2);return g;
}

// Bake every building into a few meshes, including its many facade windows.
export class PaintedGeometry {
  constructor(){this.positions=[];this.normals=[];this.colors=[];}
  add(source,color,p=[0,0,0],scale=[1,1,1],rotation=null) {
    const g=source.index?source.toNonIndexed():source;if(g!==source)source.dispose();
    if(rotation)g.applyQuaternion(rotation);g.scale(...scale);g.translate(...p);
    const pos=g.attributes.position,n=g.attributes.normal,c=new THREE.Color(color);
    for(let i=0;i<pos.count;i++){this.positions.push(pos.getX(i),pos.getY(i),pos.getZ(i));this.normals.push(n.getX(i),n.getY(i),n.getZ(i));this.colors.push(c.r,c.g,c.b);}
    g.dispose();return this;
  }
  slab(w,d,h,color,p=[0,0,0],r=.45){return this.add(slabGeometry(w,d,h,r),color,p);}
  ball(r,color,p,scale=[1,1,1],detail=1){const g=new THREE.IcosahedronGeometry(r,detail);g.computeVertexNormals();return this.add(g,color,p,scale);}
  cylinder(top,bottom,h,color,p,segments=10){return this.add(new THREE.CylinderGeometry(top,bottom,h,segments),color,p);}
  rod(a,b,r,color,segments=8){const from=new THREE.Vector3(...a),to=new THREE.Vector3(...b),d=to.clone().sub(from),q=new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());return this.add(new THREE.CylinderGeometry(r,r,d.length(),segments),color,from.add(to).multiplyScalar(.5).toArray(),[1,1,1],q);}
  quad(a,b,c,d,color){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute([...a,...b,...c,...a,...c,...d],3));g.computeVertexNormals();return this.add(g,color);}
  build(scale=1){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(this.positions,3));g.setAttribute('normal',new THREE.Float32BufferAttribute(this.normals,3));g.setAttribute('color',new THREE.Float32BufferAttribute(this.colors,3));g.scale(scale,scale,scale);g.computeBoundingSphere();return g;}
}

export function silhouette(geometry,width=.045) {
  const g=geometry.clone(),p=g.attributes.position,n=g.attributes.normal,averages=new Map(),key=i=>`${Math.round(p.getX(i)*1e4)},${Math.round(p.getY(i)*1e4)},${Math.round(p.getZ(i)*1e4)}`;
  for(let i=0;i<p.count;i++){const k=key(i),a=averages.get(k)||new THREE.Vector3();a.x+=n.getX(i);a.y+=n.getY(i);a.z+=n.getZ(i);averages.set(k,a);}
  for(let i=0;i<p.count;i++){const a=averages.get(key(i)).clone().normalize().multiplyScalar(width);p.setXYZ(i,p.getX(i)+a.x,p.getY(i)+a.y,p.getZ(i)+a.z);}
  g.deleteAttribute('color');g.computeBoundingSphere();return g;
}
