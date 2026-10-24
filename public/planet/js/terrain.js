(() => {
  const T=MB.Terrain,loc=[0,0],mix=(a,b,t)=>a+(b-a)*t;
  // Continuous heights and broad color fields, like the room's faceted ground.
  T.sample=(x,y,z,out)=>{
    const n=T.fbm(x*2.2+5,y*2.2,z*2.2+4,3);
    let c=[mix(158,183,n),mix(181,198,n),mix(139,157,n)],h=(T.fbm(x*2,y*2,z*2,3)-.45)*7,react=.85,water=0,zone=null;
    for(const d of T.DL){
      const dot=x*d.c[0]+y*d.c[1]+z*d.c[2];if(dot<Math.cos(d.r+.045))continue;
      const a=Math.acos(Math.min(1,dot)),m=1-T.sstep(d.r-.04,d.r+.045,a);
      T.toLocal(d,x,y,z,loc);let targetH=h*(1-d.flat),targetColor=c;
      if(d.urban){
        targetH=1;targetColor=d.id==='hongkong'?[183,199,178]:d.id==='turin'?[218,207,175]:[174,195,145];
        if(Math.abs(loc[0])<2.3||Math.abs(loc[1]+8)<1.5)targetColor=[228,217,185];
        if(d.id==='hongkong'){
          const shore=T.sstep(8,10.5,loc[0])*T.sstep(-9,-6,loc[1]);
          targetH=mix(1,-1.25,shore);targetColor=targetColor.map((v,i)=>mix(v,[136,182,185][i],shore));water=shore>.6?1:0;
        }
      }else if(d.water){
        const shore=1-T.sstep(d.water-.025,d.water+.025,a+.009*Math.sin(loc[0]*.2)*Math.cos(loc[1]*.16));
        targetH=mix(targetH,-1.3,shore);targetColor=c.map((v,i)=>mix(v,[138,185,189][i],shore));water=shore>.6?1:0;
      }else if(d.id==='fields')targetColor=[205,196,146];
      else if(d.id==='pines'||d.id==='hill')targetColor=[151,177,149];
      h=mix(h,targetH,m);react=mix(react,d.react,m);c=c.map((v,i)=>mix(v,targetColor[i],m));if(a<d.r)zone=d.id;
    }
    const ring=T.rings.way,off=Math.abs(Math.asin(Math.max(-1,Math.min(1,x*ring.p[0]+y*ring.p[1]+z*ring.p[2]))));
    const road=1-T.sstep(.057,.09,off);h*=1-road;react*=1-road;
    if(off<.05){water=0;zone='way';}
    Object.assign(out,{h,r:T.byte(c[0]),g:T.byte(c[1]),b:T.byte(c[2]),react,water,snowable:0,zone,forest:n,rand:n});
  };
})();
