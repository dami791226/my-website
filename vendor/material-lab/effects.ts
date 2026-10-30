export const EFFECTS = [
  ['original','原图','ORIGINAL','保留主体的原始色彩与细节。'],
  ['color','彩色半调','COLOR HALFTONE','将色彩拆成印刷网点，保留复古印刷的错位感。'],
  ['dots','点状半调','DOT HALFTONE','用网点疏密表现明暗，适合海报与拼贴素材。'],
  ['circle','圆形半调','CIRCULAR','同心圆随明暗改变粗细，形成流动的纹理。'],
  ['lines','线状半调','LINE HALFTONE','将物品变成条纹，由线条粗细还原立体感。'],
  ['pen','绘图笔','GRAPHIC PEN','细密的斜线和颗粒，模拟手绘钢笔排线。'],
  ['stamp','图章','STAMP','把明暗压缩成单色印记，轮廓清晰、对比强烈。'],
  ['bitmap','位图','BITMAP','有序抖动把灰度转换为黑白般的单色像素。'],
  ['patchwork','拼贴','PATCHWORK','矩形色块与细小接缝，重组图片的表面质感。'],
  ['mosaic','马赛克','MOSAIC','把物品化成大颗粒像素，保留最鲜明的颜色。'],
  ['stretch','像素拉伸','PIXEL STRETCH','沿水平与垂直方向拉开像素，制造断层和速度感。'],
  ['dissolve','颗粒溶解','DISSOLVE','让主体的右侧散落成微小颗粒，向外逐渐消隐。'],
  ['channels','通道偏移','RGB SHIFT','错开红、绿、蓝通道，形成彩色轮廓。'],
  ['hologram','全息扫描','HOLOGRAM','扫描线、发光色彩与轻微波动，营造全息质感。'],
  ['glitch','故障效果','GLITCH','横向错位、色彩分离与扫描干扰，模拟数字故障。'],
  ['embroidery','刺绣','EMBROIDERY','把明暗和颜色编织成一针一线的立体纹理。'],
] as const;
export type EffectId = typeof EFFECTS[number][0];
export type Options={amount:number;detail:number;color:string};
export function canvas(w:number,h:number){const c=document.createElement('canvas');c.width=Math.max(1,Math.round(w));c.height=Math.max(1,Math.round(h));return c;}
export function ctx(c:HTMLCanvasElement){return c.getContext('2d',{willReadFrequently:true})!;}
export function copy(source:HTMLCanvasElement){const c=canvas(source.width,source.height);ctx(c).drawImage(source,0,0);return c;}
export function resized(source:CanvasImageSource,w:number,h:number,max=1400){const s=Math.min(1,max/Math.max(w,h));const c=canvas(w*s,h*s);ctx(c).drawImage(source,0,0,c.width,c.height);return c;}
const clamp=(v:number,l=0,h=1)=>Math.max(l,Math.min(h,v));
const noise=(x:number,y:number,seed=0)=>{let n=Math.imul(x+seed*373,374761393)^Math.imul(y,668265263);n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295;};
export function hasAlpha(source:HTMLCanvasElement){const d=ctx(source).getImageData(0,0,source.width,source.height).data;let count=0;for(let i=3;i<d.length;i+=4)if(d[i]<250)count++;return count>d.length/4*.005;}
// Border-connected colour removal; this is explicitly a fallback, not semantic AI segmentation.
export function simpleCutout(source:HTMLCanvasElement,tolerance=47){
 const c=copy(source),w=c.width,h=c.height,d=ctx(c).getImageData(0,0,w,h),a=d.data;const corners=[[0,0],[w-1,0],[0,h-1],[w-1,h-1]];
 const bg=corners.map(([x,y])=>{const p=(y*w+x)*4;return [a[p],a[p+1],a[p+2]]});const q=new Int32Array(w*h),seen=new Uint8Array(w*h);let head=0,tail=0;
 const match=(p:number)=>{const i=p*4;return a[i+3]<30||bg.some(c=>Math.hypot(a[i]-c[0],a[i+1]-c[1],a[i+2]-c[2])<tolerance)};
 const add=(p:number)=>{if(!seen[p]){seen[p]=1;if(match(p))q[tail++]=p;}};
 for(let x=0;x<w;x++){add(x);add((h-1)*w+x)}for(let y=0;y<h;y++){add(y*w);add(y*w+w-1)}
 while(head<tail){const p=q[head++];a[p*4+3]=0;const x=p%w,y=(p/w)|0;if(x>0)add(p-1);if(x<w-1)add(p+1);if(y>0)add(p-w);if(y<h-1)add(p+w)}
 ctx(c).putImageData(d,0,0);return {image:c,removed:tail/(w*h)};
}
export function renderEffect(source:HTMLCanvasElement,id:EffectId,opt:Options,maxSize=1400){
 const src=resized(source,source.width,source.height,maxSize),w=src.width,h=src.height,out=canvas(w,h),g=ctx(out),s=ctx(src).getImageData(0,0,w,h),d=s.data;
 const amount=opt.amount/100;const unit=Math.max(w,h)/800;const size=Math.max(2,(3+opt.detail*.9)*unit);const col=opt.color.match(/\w\w/g)!.map(x=>parseInt(x,16));
 const pixel=(x:number,y:number)=>{x=clamp(Math.round(x),0,w-1);y=clamp(Math.round(y),0,h-1);return (y*w+x)*4;};
 const light=(i:number)=>(d[i]*.299+d[i+1]*.587+d[i+2]*.114)/255;
 const dark=(i:number)=>clamp((1-light(i))*(.5+amount*1.35));
 const clip=()=>{g.globalCompositeOperation='destination-in';g.drawImage(src,0,0);g.globalCompositeOperation='source-over';};
 if(id==='original'){g.drawImage(src,0,0);return out;}
 if(id==='mosaic'||id==='patchwork'){
  const step=Math.max(3,size*(id==='mosaic'?1.9:1.1)),sx=step,sy=id==='patchwork'?Math.max(3,step*.44):step;
  const tiny=canvas(Math.ceil(w/sx),Math.ceil(h/sy));ctx(tiny).drawImage(src,0,0,tiny.width,tiny.height);g.imageSmoothingEnabled=false;g.drawImage(tiny,0,0,w,h);
  if(id==='patchwork'){g.lineWidth=Math.max(.6,unit*.65);for(let y=0;y<h;y+=sy)for(let x=0;x<w;x+=sx){g.strokeStyle='rgba(30,15,4,.45)';g.strokeRect(x+.5,y+.5,sx,sy);g.strokeStyle='rgba(255,245,210,.32)';g.beginPath();g.moveTo(x+1,y+sy-1);g.lineTo(x+sx-1,y+sy-1);g.stroke();}}
  clip();return out;
 }
 if(id==='dots'){
  g.fillStyle=opt.color;for(let y=size/2;y<h;y+=size)for(let x=size/2;x<w;x+=size){const i=pixel(x,y);if(!d[i+3])continue;const r=size*.71*Math.sqrt(dark(i));g.beginPath();g.arc(x,y,r,0,Math.PI*2);g.fill();}clip();return out;
 }
 if(id==='embroidery'){
  g.drawImage(src,0,0);g.globalCompositeOperation='source-atop';g.fillStyle='rgba(20,10,0,.5)';g.fillRect(0,0,w,h);g.globalCompositeOperation='source-over';
  const st=Math.max(3,size*.65);g.lineCap='round';for(let y=st/2;y<h;y+=st)for(let x=st/2;x<w;x+=st){const i=pixel(x,y);if(d[i+3]<30)continue;const angle=(Math.sin(x/w*8)+Math.cos(y/h*7))*.4+Math.PI/4;const dx=Math.cos(angle)*st*.58,dy=Math.sin(angle)*st*.58;
   g.strokeStyle=`rgb(${d[i]},${d[i+1]},${d[i+2]})`;g.lineWidth=st*.75;g.beginPath();g.moveTo(x-dx,y-dy);g.lineTo(x+dx,y+dy);g.stroke();
   g.strokeStyle=`rgba(255,245,215,${.18+amount*.27})`;g.lineWidth=Math.max(.5,st*.12);g.beginPath();g.moveTo(x-dx-st*.12,y-dy);g.lineTo(x+dx-st*.12,y+dy);g.stroke();
   g.strokeStyle='rgba(45,15,0,.28)';g.beginPath();g.moveTo(x-dx+st*.23,y-dy);g.lineTo(x+dx+st*.23,y+dy);g.stroke();
  }clip();return out;
 }
 if(id==='stretch'){
  g.drawImage(src,0,0);const y=Math.floor(h*.47),bh=Math.max(3,h*(.08+amount*.18)),x=Math.floor(w*.48);g.drawImage(src,x,y,1,bh,w*.1,y,w*.7,bh);const sx=Math.floor(w*.66);g.drawImage(src,sx,Math.floor(h*.27),Math.max(1,w*.17),1,sx,h*.17,w*.17,h*(.08+amount*.18));clip();return out;
 }
 if(id==='dissolve'){
  const data=g.createImageData(w,h),a=data.data;for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4;if(!d[i+3])continue;const fade=clamp((x/w-(.86-amount*.42))/(.32+amount*.2));if(noise(x,y,42)<fade*.93){const xx=Math.round(x+noise(x,y,88)*w*.18*amount),yy=Math.round(y+(noise(x,y,76)-.5)*h*.15*amount);if(xx>=0&&xx<w&&yy>=0&&yy<h&&noise(x,y,64)>.3){const j=(yy*w+xx)*4;a[j]=d[i];a[j+1]=d[i+1];a[j+2]=d[i+2];a[j+3]=d[i+3]*(1-fade*.6);}}else{a[i]=d[i];a[i+1]=d[i+1];a[i+2]=d[i+2];a[i+3]=d[i+3];}}g.putImageData(data,0,0);return out;
 }
 if(['channels','hologram','glitch'].includes(id)){
  const data=g.createImageData(w,h),a=data.data;const shift=Math.max(1,Math.round((3+amount*22)*unit));
  const at=(x:number,y:number)=>x<0||x>=w||y<0||y>=h?-1:(Math.round(y)*w+Math.round(x))*4;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
   const i=(y*w+x)*4,row=Math.floor(y/Math.max(2,size*.5));let dx=0;
   if(id==='glitch'){dx=noise(row,5)>.64?Math.round((noise(row,11)-.5)*w*.18*amount):Math.round(Math.sin(y*.5)*amount*3*unit)}
   if(id==='hologram')dx=Math.round(Math.sin(y/(size*1.6))*amount*4*unit);
   const offs=id==='channels'?shift:id==='glitch'?Math.round(shift*.65):Math.max(1,Math.round(shift*.25));
   const ir=at(x-dx-offs,y),ib=at(x-dx+offs,y),ig=at(x-dx,y);
   const ar=ir<0?0:d[ir+3],ag=ig<0?0:d[ig+3],ab=ib<0?0:d[ib+3];
   a[i]=ir<0?0:d[ir]*ar/255;a[i+1]=ig<0?0:d[ig+1]*ag/255;a[i+2]=ib<0?0:d[ib+2]*ab/255;a[i+3]=Math.max(ar,ag,ab);
   if(id==='hologram'){const scan=(y%Math.max(3,Math.round(size*.45)))<Math.max(1,unit);const f=scan?.35:1;a[i]=clamp(a[i]*f+20*amount,0,255);a[i+1]=clamp(a[i+1]*f+28*amount,0,255);a[i+2]=clamp(a[i+2]*f+45*amount,0,255);if(scan)a[i+3]*=.65;}
   if(id==='glitch'&&row%7===0){a[i]*=.7;a[i+1]*=.6;a[i+2]*=.75;}
  }g.putImageData(data,0,0);return out;
 }
 const data=g.createImageData(w,h),a=data.data;const bayer=[0,8,2,10,12,4,14,6,3,11,1,9,15,7,13,5];
 for(let y=0;y<h;y++)for(let x=0;x<w;x++){
  const i=(y*w+x)*4;if(!d[i+3])continue;const l=light(i),k=dark(i);let ink=1;
  if(id==='color'){
   const channels=[0,0,0];for(let c=0;c<3;c++){const angle=[.26,1.31,0][c],u=x*Math.cos(angle)+y*Math.sin(angle),v=-x*Math.sin(angle)+y*Math.cos(angle);const rx=((u%size)+size)%size-size/2,ry=((v%size)+size)%size-size/2;const tone=clamp((1-d[i+c]/255)*(.6+amount*.8));const coverage=clamp((size*.72*Math.sqrt(tone)-Math.hypot(rx,ry))/Math.max(.6,unit)+.5);channels[c]=255*(1-coverage);}
   a[i]=channels[0];a[i+1]=channels[1];a[i+2]=channels[2];a[i+3]=d[i+3];continue;
  }
  if(id==='lines'){const wave=((y/size)%1);ink=clamp((k*.5-Math.abs(wave-.5))*size/Math.max(.7,unit)+.5);}
  if(id==='circle'){const r=Math.hypot(x-w*.3,y-h*.29),wave=(r/size)%1;ink=clamp((k*.5-Math.abs(wave-.5))*size/Math.max(.7,unit)+.5);}
  if(id==='pen'){const wave=((x+y*.7)%(size*.3))/(size*.3);ink=clamp((k*.82-wave+noise(x,y,1)*.27)*3);}
  if(id==='stamp'){ink=l<(.25+amount*.5)?1:0;}
  if(id==='bitmap'){const bs=Math.max(1,Math.round(size*.25)),bx=Math.floor(x/bs)%4,by=Math.floor(y/bs)%4;ink=k>(bayer[by*4+bx]+.5)/16?1:0;}
  a[i]=col[0];a[i+1]=col[1];a[i+2]=col[2];a[i+3]=d[i+3]*ink;
 }
 g.putImageData(data,0,0);return out;
}
export function trimmed(source:HTMLCanvasElement,padding=.06){const w=source.width,h=source.height,d=ctx(source).getImageData(0,0,w,h).data;let x0=w,y0=h,x1=0,y1=0;for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>12){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y)}if(x1<=x0||y1<=y0)return copy(source);const pad=Math.round(Math.max(x1-x0,y1-y0)*padding);const c=canvas(x1-x0+1+pad*2,y1-y0+1+pad*2);ctx(c).drawImage(source,x0,y0,x1-x0+1,y1-y0+1,pad,pad,x1-x0+1,y1-y0+1);return c;}
export function blobOf(c:HTMLCanvasElement){return new Promise<Blob>((resolve,reject)=>c.toBlob(b=>b?resolve(b):reject(new Error('无法导出图片')),'image/png'));}
