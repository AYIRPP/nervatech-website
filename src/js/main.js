const hd=document.getElementById('hd'),ln=document.getElementById('ln');
addEventListener('scroll',()=>hd.classList.toggle('sc',scrollY>30),{passive:true});
document.getElementById('mb').onclick=()=>ln.classList.toggle('o');
ln.addEventListener('click',()=>ln.classList.remove('o'));
const RM=matchMedia('(prefers-reduced-motion:reduce)').matches,G=!!window.gsap&&!RM;
if(G)gsap.registerPlugin(ScrollTrigger);
function initGL(){
const box=document.getElementById('gl');
if(!window.THREE){box.classList.add('orb');return}
let r;try{r=new THREE.WebGLRenderer({antialias:true,alpha:true})}catch(e){box.classList.add('orb');return}
r.setPixelRatio(Math.min(devicePixelRatio,2));box.appendChild(r.domElement);
const sc=new THREE.Scene(),cam=new THREE.PerspectiveCamera(42,1,.1,100);cam.position.z=11;
const outer=new THREE.Group(),mid=new THREE.Group(),g=new THREE.Group();outer.add(mid);mid.add(g);sc.add(outer);
sc.add(new THREE.AmbientLight(0x5577bb,.7));
const l1=new THREE.PointLight(0x28B9E8,3,40);l1.position.set(5,4,6);sc.add(l1);
const l2=new THREE.PointLight(0x2a6cf0,3,40);l2.position.set(-6,-3,5);sc.add(l2);
const cv=document.createElement('canvas');cv.width=cv.height=128;const cx=cv.getContext('2d'),gr=cx.createRadialGradient(64,64,0,64,64,64);
gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.25,'rgba(255,255,255,.35)');gr.addColorStop(1,'rgba(255,255,255,0)');cx.fillStyle=gr;cx.fillRect(0,0,128,128);
const gt=new THREE.CanvasTexture(cv);
const glow=(c,s,o)=>{const m=new THREE.Sprite(new THREE.SpriteMaterial({map:gt,color:c,transparent:true,opacity:o,blending:THREE.AdditiveBlending,depthWrite:false}));m.scale.set(s,s,1);return m};
g.add(glow(0x2a6cf0,8,.5));
const crystal=new THREE.Mesh(new THREE.IcosahedronGeometry(1.5,1),new THREE.MeshStandardMaterial({color:0x123B82,metalness:.7,roughness:.2,flatShading:true,emissive:0x0a2a7a,emissiveIntensity:.5,transparent:true,opacity:.62,depthWrite:false}));g.add(crystal);
const edges=new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(1.52,1)),new THREE.LineBasicMaterial({color:0x7fe3ff,transparent:true,opacity:.85}));g.add(edges);
const ns=new THREE.Shape();[[-.6,-.75],[-.6,.75],[-.3,.75],[.3,-.2],[.3,.75],[.6,.75],[.6,-.75],[.3,-.75],[-.3,.2],[-.3,-.75]].forEach(([x,y],i)=>i?ns.lineTo(x,y):ns.moveTo(x,y));
const ng=new THREE.ExtrudeGeometry(ns,{depth:.3,bevelEnabled:true,bevelSize:.025,bevelThickness:.025,bevelSegments:2});ng.center();
const heart=new THREE.Mesh(ng,new THREE.MeshStandardMaterial({color:0xffffff,emissive:0x28B9E8,emissiveIntensity:.55,metalness:.3,roughness:.25}));heart.scale.setScalar(1.15);g.add(heart);g.add(glow(0x28B9E8,3,.55));
const shell=new THREE.Mesh(new THREE.IcosahedronGeometry(2.3,1),new THREE.MeshBasicMaterial({color:0x28B9E8,wireframe:true,transparent:true,opacity:.16}));g.add(shell);
const spins=[];
[[2.6,.3,0],[3.5,-.6,.9],[3.9,1.1,-.4]].forEach(([R,rx,rz],i)=>{const p=new THREE.Group();p.rotation.set(rx+1.2,0,rz);
p.add(new THREE.Mesh(new THREE.TorusGeometry(R,.012,8,180),new THREE.MeshBasicMaterial({color:i?0xffffff:0x28B9E8,transparent:true,opacity:i?.2:.6})));
const s=new THREE.Group(),d=glow(0x9ff1fa,.45,1);d.position.set(R,0,0);s.add(d);p.add(s);g.add(p);spins.push(s)});
const net=new THREE.Group(),N=90,P=[],pa=[];
for(let i=0;i<N;i++){const y=1-2*(i+.5)/N,q=Math.sqrt(1-y*y),a=i*2.39996,R=3.1;P.push(new THREE.Vector3(Math.cos(a)*q*R,y*R,Math.sin(a)*q*R));pa.push(P[i].x,P[i].y,P[i].z)}
const la=[];for(let i=0;i<N;i++)for(let j=i+1;j<N;j++)if(P[i].distanceTo(P[j])<1.6)la.push(P[i].x,P[i].y,P[i].z,P[j].x,P[j].y,P[j].z);
const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.Float32BufferAttribute(pa,3));
net.add(new THREE.Points(pg,new THREE.PointsMaterial({map:gt,color:0x28B9E8,size:.5,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false})));
const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(la,3));
net.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0x2a6cf0,transparent:true,opacity:.35})));
const arcs=[];for(let k=0;k<22&&arcs.length<14;k++){const a=P[Math.floor(Math.random()*N)],b=P[Math.floor(Math.random()*N)];if(a.distanceTo(b)<3.2)continue;
const c=a.clone().add(b).normalize().multiplyScalar(4.6),cu=new THREE.QuadraticBezierCurve3(a,c,b);
net.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(cu.getPoints(48)),new THREE.LineBasicMaterial({color:0x28B9E8,transparent:true,opacity:.22})));
const p=glow(0xdaf8ff,.7,1);net.add(p);arcs.push({cu,p,t:Math.random(),v:.003+Math.random()*.004})}
mid.add(net);
const D=300,da=[];for(let i=0;i<D;i++){const u=Math.random()*2-1,t=Math.random()*6.283,q=Math.sqrt(1-u*u),R=2.5+Math.random()*3.5;da.push(q*Math.cos(t)*R,u*R,q*Math.sin(t)*R)}
const dg=new THREE.BufferGeometry();dg.setAttribute('position',new THREE.Float32BufferAttribute(da,3));
const dust=new THREE.Points(dg,new THREE.PointsMaterial({map:gt,color:0xaee6ff,size:.16,transparent:true,opacity:.6,blending:THREE.AdditiveBlending,depthWrite:false}));mid.add(dust);
function rs(){const w=box.clientWidth,h=box.clientHeight;if(!w||!h)return;r.setSize(w,h,false);cam.aspect=w/h;cam.updateProjectionMatrix()}
new ResizeObserver(rs).observe(box);rs();
const m={x:0,y:0};addEventListener('pointermove',e=>{m.x=e.clientX/innerWidth-.5;m.y=e.clientY/innerHeight-.5},{passive:true});
const waves=[];box.style.cursor='pointer';box.addEventListener('pointerdown',()=>{const w=new THREE.Mesh(new THREE.TorusGeometry(1.5,.03,8,120),new THREE.MeshBasicMaterial({color:0x28B9E8,transparent:true,opacity:1}));w.lookAt(cam.position);sc.add(w);waves.push(w)});
let vis=true,t=0;new IntersectionObserver(es=>vis=es[0].isIntersecting).observe(box);
(function tick(){requestAnimationFrame(tick);if(!vis)return;
if(!RM){t+=.01;g.rotation.y=t*.3;g.rotation.x=Math.sin(t*.5)*.15;crystal.rotation.set(t*.4,t*.6,0);edges.rotation.copy(crystal.rotation);heart.rotation.y=Math.sin(t*.9)*.8;heart.rotation.x=Math.sin(t*.6)*.15;shell.rotation.y=-t*.4;
net.rotation.y=-t*.12;dust.rotation.y=t*.03;spins.forEach((s,i)=>s.rotation.z+=.006*(i+1));
arcs.forEach(a=>{a.t+=a.v;if(a.t>1)a.t=0;a.p.position.copy(a.cu.getPoint(a.t));a.p.material.opacity=Math.sin(Math.PI*a.t)});
mid.rotation.y+=(m.x*.9-mid.rotation.y)*.05;mid.rotation.x+=(m.y*.6-mid.rotation.x)*.05}
for(let i=waves.length-1;i>=0;i--){const w=waves[i];w.scale.multiplyScalar(1.05);w.material.opacity-=.012;if(w.material.opacity<=0){sc.remove(w);waves.splice(i,1)}}
r.render(sc,cam)})();
if(G){const st={trigger:'.hero',start:'top top',end:'bottom top',scrub:1};
gsap.to(outer.rotation,{y:Math.PI*1.5,x:.5,ease:'none',scrollTrigger:st});
gsap.to(outer.position,{y:1.4,ease:'none',scrollTrigger:st});
gsap.to(outer.scale,{x:.6,y:.6,z:.6,ease:'none',scrollTrigger:st});
gsap.to(crystal.material.color,{r:.157,g:.5,b:.9,ease:'none',scrollTrigger:st})}
}
initGL();
{const stg=document.querySelector('.stage');if(!RM)addEventListener('pointermove',e=>{stg.style.setProperty('--mx',((e.clientX/innerWidth-.5)*2).toFixed(3));stg.style.setProperty('--my',((e.clientY/innerHeight-.5)*2).toFixed(3))},{passive:true});
if(G){gsap.from('.fc',{opacity:0,duration:1,stagger:.2,delay:.9});gsap.from('.chips span',{opacity:0,y:12,stagger:.1,duration:.7,delay:1.2})}}
{const mt=document.getElementById('mt'),gp=['Innovation-driven development','Practical problem-solving','Security-conscious technology','Scalable digital solutions','Customer-focused engineering','Continuous improvement'].map(x=>'<span>'+x+'</span><i>✦</i>').join('');mt.innerHTML='<div>'+gp+'</div><div>'+gp+'</div>'}
if(G){
const h=document.querySelector('.hero h1');
const wrapWord=(w,extra)=>{const cls=extra?'w '+extra:'w';return '<span class="hero-word"><span class="'+cls+'">'+w+'</span></span>'};
h.querySelectorAll('.hero-line').forEach(line=>{
  const parts=[];
  line.childNodes.forEach(n=>{
    if(n.nodeType===1&&n.classList.contains('hero-accent')){
      n.textContent.trim().split(/\s+/).filter(Boolean).forEach(w=>parts.push(wrapWord(w,'hero-accent')));
    }else if(n.nodeType===3){
      n.textContent.trim().split(/\s+/).filter(Boolean).forEach(w=>parts.push(wrapWord(w,'')));
    }
  });
  line.innerHTML=parts.join(' ');
});
gsap.timeline({defaults:{ease:'power4.out'}}).from('.hero .eye',{y:20,opacity:0,duration:.8}).from('.hero .w',{yPercent:110,rotationZ:6,stagger:.09,duration:1.1},'-=.4').from('.hero .hero-lead',{y:24,opacity:0,duration:.9},'-=.6').from('.hero .btn',{y:20,opacity:0,stagger:.12,duration:.7},'-=.6').from('#gl',{scale:.6,opacity:0,duration:1.6,ease:'expo.out'},.2);
gsap.set('.rv,.card',{transformPerspective:900});
ScrollTrigger.batch('.rv',{start:'top 88%',once:true,onEnter:els=>gsap.fromTo(els,{opacity:0,y:60,rotationX:-18},{opacity:1,y:0,rotationX:0,stagger:.12,duration:1,ease:'power3.out',overwrite:true})});
gsap.from('.steps div',{y:40,opacity:0,stagger:.15,duration:.8,ease:'power3.out',scrollTrigger:{trigger:'.steps',start:'top 85%'}});
document.querySelectorAll('.ic path,.ic circle').forEach(p=>{const L=p.getTotalLength();gsap.fromTo(p,{strokeDasharray:L,strokeDashoffset:L},{strokeDashoffset:0,duration:1.6,ease:'power2.out',scrollTrigger:{trigger:p,start:'top 92%'}})});
if(matchMedia('(hover:hover)').matches)document.querySelectorAll('.card').forEach(c=>{
const rx=gsap.quickTo(c,'rotationX',{duration:.5,ease:'power3'}),ry=gsap.quickTo(c,'rotationY',{duration:.5,ease:'power3'});
c.addEventListener('pointermove',e=>{const b=c.getBoundingClientRect();c.style.setProperty('--mx',e.clientX-b.left+'px');c.style.setProperty('--my',e.clientY-b.top+'px');ry((e.clientX-b.left)/b.width*16-8);rx(-((e.clientY-b.top)/b.height*16-8))});
c.addEventListener('pointerleave',()=>{rx(0);ry(0)})});
const ct=document.querySelector('.ctas');
[[8,12,90],[78,58,64],[88,10,36]].forEach(([l,tp,s],i)=>{const d=document.createElement('div');d.className='fs';d.style.cssText='left:'+l+'%;top:'+tp+'%;width:'+s+'px;height:'+s+'px';ct.prepend(d);
gsap.to(d,{rotation:i%2?200:-200,y:i%2?-80:80,ease:'none',scrollTrigger:{trigger:ct,start:'top bottom',end:'bottom top',scrub:1}})});
const mq=document.getElementById('mt');gsap.to(mq,{xPercent:-50,repeat:-1,duration:28,ease:'none'});
const sk=gsap.quickTo(mq,'skewX',{duration:.4});let sw;
ScrollTrigger.create({onUpdate:s=>{sk(gsap.utils.clamp(-12,12,s.getVelocity()/-200));clearTimeout(sw);sw=setTimeout(()=>sk(0),100)}});
gsap.to('.pb',{scaleX:1,ease:'none',scrollTrigger:{start:0,end:'max',scrub:.3}});
document.querySelectorAll('section:not(.hero) h2').forEach(h=>{h.innerHTML=h.textContent.split(' ').map(w=>'<span style="display:inline-block;overflow:hidden;vertical-align:top;padding-bottom:.12em"><span class="w" style="display:inline-block">'+w+'</span></span>').join(' ');gsap.from(h.querySelectorAll('.w'),{yPercent:115,rotationZ:5,stagger:.06,duration:1,ease:'power4.out',scrollTrigger:{trigger:h,start:'top 90%'}})});
const sb=document.getElementById('solutions'),bt=document.createElement('div');bt.className='bgt';bt.textContent='NERVAGUARD';bt.setAttribute('aria-hidden','true');sb.prepend(bt);
gsap.fromTo(bt,{xPercent:10,yPercent:-50},{xPercent:-45,yPercent:-50,ease:'none',scrollTrigger:{trigger:sb,start:'top bottom',end:'bottom top',scrub:1}});
if(matchMedia('(hover:hover)').matches){const cu=document.querySelector('.cur'),cx=gsap.quickTo(cu,'x',{duration:.25,ease:'power3'}),cy=gsap.quickTo(cu,'y',{duration:.25,ease:'power3'});
addEventListener('pointermove',()=>cu.style.opacity=1,{once:true});addEventListener('pointermove',e=>{cx(e.clientX);cy(e.clientY)},{passive:true});
document.querySelectorAll('a,button,.card,input,select,textarea').forEach(el=>{el.addEventListener('pointerenter',()=>gsap.to(cu,{scale:3.2,opacity:.35,duration:.3}));el.addEventListener('pointerleave',()=>gsap.to(cu,{scale:1,opacity:1,duration:.3}))});
document.querySelectorAll('.btn').forEach(b=>{const mx=gsap.quickTo(b,'x',{duration:.4,ease:'power3'}),my=gsap.quickTo(b,'y',{duration:.4,ease:'power3'});b.addEventListener('pointermove',e=>{const r=b.getBoundingClientRect();mx((e.clientX-r.left-r.width/2)*.3);my((e.clientY-r.top-r.height/2)*.4)});b.addEventListener('pointerleave',()=>{mx(0);my(0)})})}
}else document.querySelectorAll('.rv').forEach(e=>{e.style.opacity=1;e.style.transform='none'});

(function(){const c=document.querySelector('#innovation canvas'),x=c.getContext('2d');let W,H,P=[];
function rs(){W=c.width=c.offsetWidth;H=c.height=c.offsetHeight;P=Array.from({length:Math.round(W*H/16000)},()=>({x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.3,vy:(Math.random()-.5)*.3}))}
new ResizeObserver(rs).observe(c);rs();let vis=true;new IntersectionObserver(e=>vis=e[0].isIntersecting).observe(c);
(function f(){requestAnimationFrame(f);if(!vis)return;x.clearRect(0,0,W,H);
P.forEach(p=>{if(!RM){p.x+=p.vx;p.y+=p.vy;if(p.x<0||p.x>W)p.vx*=-1;if(p.y<0||p.y>H)p.vy*=-1}});
for(let i=0;i<P.length;i++){const a=P[i];x.fillStyle='#28B9E8';x.beginPath();x.arc(a.x,a.y,i%7?1.6:3,0,7);x.fill();
for(let j=i+1;j<P.length;j++){const b=P[j],d=Math.hypot(a.x-b.x,a.y-b.y);if(d<130){x.strokeStyle='rgba(40,185,232,'+(1-d/130)*.35+')';x.beginPath();x.moveTo(a.x,a.y);x.lineTo(b.x,b.y);x.stroke()}}}})()})();
{const f=document.getElementById('cf'),m=document.getElementById('fm'),btn=f.querySelector('button[type=submit]'),t0=performance.now();
f.addEventListener('submit',async e=>{e.preventDefault();
if(f.website.value)return;
if(!f.n.value.trim()||!/\S+@\S+\.\S+/.test(f.e.value)||!f.m.value.trim()){m.textContent='Please add your name, a valid email and a message.';return}
btn.disabled=true;f.setAttribute('aria-busy','true');m.textContent='Sending…';
try{
const r=await fetch('/api/contact',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:f.n.value,company:f.o.value,email:f.e.value,phone:f.p.value,kind:f.k.value,message:f.m.value,website:f.website.value,elapsed:Math.round(performance.now()-t0)})});
const d=await r.json().catch(()=>({}));
if(r.ok){m.textContent='Thank you. Your enquiry has been sent.';f.reset()}
else m.textContent=d.error||'Sorry, we could not send your enquiry. Please email info@nerva-tech.com instead.';
}catch(_){m.textContent='Sorry, we could not send your enquiry. Please email info@nerva-tech.com instead.'}
finally{btn.disabled=false;f.removeAttribute('aria-busy')}});}
