import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';

const $ = (s) => document.querySelector(s);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(42, innerWidth / innerHeight, .1, 180);
camera.position.set(0, 23, 28); camera.lookAt(0, 0, 0);
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.7)); renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.16;
$('#game').appendChild(renderer.domElement);
scene.background = new THREE.Color('#a9c8b1'); scene.fog = new THREE.Fog('#a9c8b1', 42, 84);
scene.add(new THREE.HemisphereLight('#e4f2dc', '#53675b', 2.0));
const sun = new THREE.DirectionalLight('#fff0d3', 3.2); sun.position.set(-12, 24, 10); sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024); sun.shadow.camera.left = -28; sun.shadow.camera.right = 28; sun.shadow.camera.top = 28; sun.shadow.camera.bottom = -28; sun.shadow.bias = -.00025; scene.add(sun);
const world = new THREE.Group(); scene.add(world);
let era = '1971', started = false, delivered = 0, items = [], goal = null, player = null, playerParts = {}, gameWon = false;
const held = new Set(); let toastTimer = 0, soundOn = false, audioCtx = null;
function mat(color, extra = {}) { return new THREE.MeshStandardMaterial({ color, roughness: .88, ...extra }); }
function box(parent,x,y,z,sx,sy,sz,color,opts={}) { const mesh=new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz),mat(color,opts));mesh.position.set(x,y,z);mesh.castShadow=opts.castShadow!==false;mesh.receiveShadow=true;parent.add(mesh);return mesh; }
function cylinder(parent,x,y,z,rt,rb,h,color,sides=8){const mesh=new THREE.Mesh(new THREE.CylinderGeometry(rt,rb,h,sides),mat(color));mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;}
function cone(parent,x,y,z,r,h,color,sides=7){const m=new THREE.Mesh(new THREE.ConeGeometry(r,h,sides),mat(color));m.position.set(x,y,z);m.castShadow=true;parent.add(m);return m;}
function addLabel(text,x,z,color='#f3dfae'){
 const c=document.createElement('canvas');c.width=512;c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='rgba(20,43,40,.76)';ctx.beginPath();ctx.roundRect(10,12,492,104,14);ctx.fill();ctx.font='600 42px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillStyle=color;ctx.fillText(text,256,64);
 const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;const m=new THREE.Mesh(new THREE.PlaneGeometry(4.5,1.15),new THREE.MeshBasicMaterial({map:texture,transparent:true,depthWrite:false,side:THREE.DoubleSide}));m.position.set(x,3.8,z);m.rotation.x=-.24;world.add(m);return m;
}
function building(x,z,color,roof,w=4,d=3.3,style='hut'){
 const g=new THREE.Group();g.position.set(x,0,z);world.add(g);
 if(style==='modern'){box(g,0,.92,0,w,1.84,d,color);box(g,0,1.92,0,w+.18,.18,d+.18,'#d7d0bc');box(g,-.7,.7,d/2+.015,.78,1.25,.06,'#547d7a');box(g,.8,.67,d/2+.02,.65,1.1,.07,'#b5d3c4');box(g,0,1.02,-d/2-.06,1.15,.72,.08,'#b9d1c5');}
 else{box(g,0,.83,0,w,1.66,d,color);const r=new THREE.Mesh(new THREE.ConeGeometry(w*.83,1.38,4),mat(roof));r.rotation.y=Math.PI/4;r.position.y=2.15;r.scale.z=d/w;r.castShadow=true;g.add(r);box(g,0,.55,d/2+.02,.78,1.05,.08,'#634934');box(g,-1,.88,d/2+.03,.55,.42,.08,'#789b8c');box(g,1,.88,d/2+.03,.55,.42,.08,'#789b8c');}
 return g;
}
function tree(x,z,kind='palm'){
 const g=new THREE.Group();g.position.set(x,0,z);world.add(g);
 if(kind==='palm'){cylinder(g,0,1.4,0,.22,.33,2.8,'#846243',7);for(let i=0;i<7;i++){const a=i*Math.PI*2/7;const leaf=box(g,Math.cos(a)*.75,2.85+Math.sin(i*2)*.13,Math.sin(a)*.75,1.8,.12,.34,'#3f7951');leaf.rotation.y=-a;leaf.rotation.z=-Math.cos(a)*.28;}cylinder(g,0,2.85,0,.26,.26,.45,'#4e8a55',7);}
 else{cylinder(g,0,.75,0,.22,.32,1.5,'#725637',7);cone(g,0,1.8,0,1.3,1.9,'#47784f',7);cone(g,0,2.55,0,.96,1.65,'#59865a',7);}
 return g;
}
function createPlayer(){
 player=new THREE.Group();player.position.set(7,0,8);world.add(player);const body=new THREE.Group();player.add(body);
 cylinder(body,0,.95,0,.32,.4,.85,'#d7a85e',8);const shirt=box(body,0,1.05,0,.76,.76,.48,era==='1971'?'#f0e2bf':'#f1eee0');
 const head=new THREE.Mesh(new THREE.SphereGeometry(.31,10,8),mat('#9a6748'));head.position.set(0,1.72,0);head.castShadow=true;body.add(head);
 const hair=new THREE.Mesh(new THREE.SphereGeometry(.32,8,6,0,Math.PI*2,0,Math.PI/2),mat('#282d28'));hair.position.set(0,1.84,0);body.add(hair);
 const scarf=box(body,0,1.38,.05,.79,.13,.51,era==='1971'?'#3e795f':'#bd4a3e');const legL=box(body,-.19,.3,0,.22,.6,.25,'#4b5543'),legR=box(body,.19,.3,0,.22,.6,.25,'#4b5543');playerParts={body,shirt,scarf,legL,legR,head};
}
function createItem(item,i){
 const g=new THREE.Group();g.position.set(item.x,0,item.z);world.add(g);item.group=g;item.collected=false;
 const halo=new THREE.Mesh(new THREE.TorusGeometry(.58,.035,6,24),new THREE.MeshBasicMaterial({color:'#f5d276'}));halo.rotation.x=Math.PI/2;halo.position.y=.12;g.add(halo);
 const ring=new THREE.Mesh(new THREE.TorusGeometry(.7,.018,5,24),new THREE.MeshBasicMaterial({color:'#f1cf82',transparent:true,opacity:.48}));ring.rotation.x=Math.PI/2;ring.position.y=.07;g.add(ring);
 if(era==='1971'){
  if(i===0){box(g,0,.35,0,.78,.62,.65,'#c49b60');box(g,0,.68,0,.8,.12,.68,'#dfbf7d');}
  if(i===1){box(g,0,.32,0,.52,.56,.45,'#eee2bf');box(g,0,.34,.25,.25,.28,.05,'#b65e4d');}
  if(i===2){box(g,0,.3,0,.68,.48,.52,'#d8c99e');box(g,0,.56,0,.72,.1,.56,'#5e7660');}
 }else{
  if(i===0){box(g,0,.35,0,.7,.5,.5,'#d5bb78');box(g,0,.67,0,.42,.18,.38,'#b64f43');}
  if(i===1){cylinder(g,0,.35,0,.3,.3,.65,'#79a8a2',10);cylinder(g,0,.69,0,.32,.32,.08,'#d5ddd0',10);}
  if(i===2){box(g,0,.34,0,.68,.48,.5,'#dfded0');box(g,0,.34,.28,.38,.32,.04,'#ba5144');}
 }
 const orb=new THREE.PointLight('#f0c66f',.55,3);orb.position.y=.8;g.add(orb);return item;
}
function clearWorld(){while(world.children.length){const o=world.children[0];world.remove(o);o.traverse?.(n=>{n.geometry?.dispose();if(n.material){if(Array.isArray(n.material))n.material.forEach(m=>m.dispose());else n.material.dispose();}});}items=[];goal=null;player=null;}
function buildWorld(){
 clearWorld();scene.background.set(era==='1971'?'#a7c7ae':'#b8c5b5');scene.fog.color.set(era==='1971'?'#a7c7ae':'#b8c5b5');
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(110,90),mat(era==='1971'?'#8fac7b':'#9aaa82'));ground.rotation.x=-Math.PI/2;ground.position.y=-.12;ground.receiveShadow=true;world.add(ground);
 const water=new THREE.Mesh(new THREE.PlaneGeometry(15,100),new THREE.MeshStandardMaterial({color:era==='1971'?'#559d9b':'#5a9c98',roughness:.26,metalness:.1}));water.rotation.x=-Math.PI/2;water.position.set(-21,-.04,0);world.add(water);
 for(let i=0;i<15;i++){const x=-14.3+Math.random()*1.7,z=-43+i*6+Math.random()*2;const m=new THREE.Mesh(new THREE.BoxGeometry(.8+Math.random(),.025,.07),mat('#9bd0b6'));m.position.set(x,.015,z);m.rotation.y=(Math.random()-.5)*.2;world.add(m);}
 const road=new THREE.Mesh(new THREE.PlaneGeometry(4.2,46),mat('#bba47a'));road.rotation.x=-Math.PI/2;road.rotation.z=.13;road.position.set(-1.5,-.025,0);world.add(road);
 for(const [x,z,r] of [[-8,-7,.2],[6,6,-.16],[8,-6,.3]]){const p=new THREE.Mesh(new THREE.PlaneGeometry(2.2,17),mat('#d1ba8c'));p.rotation.x=-Math.PI/2;p.rotation.z=r;p.position.set(x,-.018,z);world.add(p);}
 if(era==='1971'){
  building(-9,-7,'#d4bd91','#8b6045',4.2,3.6,'hut');building(9,-7,'#d2b88b','#956a4e',4,3.5,'hut');building(10,5,'#ddc69b','#8b6045',4,3.4,'hut');building(-8,7,'#d6c295','#906247',4.1,3.6,'hut');
  const shelter=building(-10,-7,'#d5bc8d','#846047',4.4,3.7,'hut');box(shelter,0,.18,0,4.6,.24,3.9,'#806c4e');
  for(let j=0;j<7;j++)cylinder(world,-14,.45,-2+j*.82,.045,.045,1.45,'#a67f4a',6);
  tree(-16,4);tree(14,-2);tree(14,10);tree(-14,12);tree(3,-11);tree(-3,10);for(let i=0;i<6;i++)tree(-18+Math.random()*2,-12+i*4);
  const canoe=box(world,-17,.16,-8,2.8,.24,.8,'#744d35');canoe.rotation.y=.18;addLabel('RIVERSIDE SHELTER',-10,-9,'#f1d9a1');goal={x:-10,z:-7,mesh:shelter};
  items=[{x:6,z:8,label:'Rice bundle'},{x:-1,z:-5,label:'First-aid kit'},{x:8,z:-2,label:'Family letters'}];
 }else{
  building(-9,-7,'#d5d4c7','#777b6e',5,4,'modern');building(9,-7,'#dad8cd','#778579',4.6,4,'modern');building(10,6,'#cfcec1','#777f71',4.5,3.8,'modern');building(-9,7,'#d9d4c6','#727e74',4.7,3.8,'modern');
  box(world,0,.025,0,14,.05,12,'#b6ad91');for(let i=0;i<8;i++){const colors=['#d0a15e','#56857b','#bd6650','#d3c28d'];box(world,-7+i*2,.68,-12,.22,1.36,.18,colors[i%4]);}
  tree(-15,3,'leaf');tree(14,-2,'leaf');tree(14,10,'leaf');tree(-15,11,'leaf');tree(4,-11,'leaf');tree(-3,10,'leaf');
  for(const [x,z] of [[-4,-6],[5,4],[12,-10]]){cylinder(world,x,1.45,z,.055,.07,2.9,'#555a4f',8);const lamp=new THREE.Mesh(new THREE.SphereGeometry(.18,8,6),mat('#f3d38a',{emissive:'#d69a44',emissiveIntensity:.8}));lamp.position.set(x,2.9,z);world.add(lamp);}
  const cart=new THREE.Group();cart.position.set(4,0,8);world.add(cart);cylinder(cart,-.8,.25,0,.42,.42,.1,'#293632',12).rotation.z=Math.PI/2;cylinder(cart,.8,.25,0,.42,.42,.1,'#293632',12).rotation.z=Math.PI/2;box(cart,0,.78,0,1.65,.14,.8,'#bd5546');box(cart,0,1.16,-.05,1.45,.08,.72,'#daa957');
  addLabel('COMMUNITY COMMONS',-9,-9,'#f4e3bf');goal={x:-9,z:-7,mesh:null};items=[{x:6,z:8,label:'Shared books'},{x:-1,z:-5,label:'Clean water'},{x:8,z:-2,label:'Community notice'}];
 }
 for(let i=0;i<20;i++){const x=-13+Math.random()*27,z=-19+Math.random()*38;if(Math.abs(x)<6&&Math.abs(z)<5)continue;if(Math.random()>.45){const r=new THREE.Mesh(new THREE.SphereGeometry(.38+Math.random()*.38,6,5),mat(i%2?'#638860':'#77966d'));r.position.set(x,.25,z);r.scale.y=.7;world.add(r);}}
 items.forEach(createItem);createPlayer();$('#progress-count').textContent='0 / 3';$('#progress-fill').style.width='0%';
}

function setEra(next, reset=true){
  era=next;gameWon=false;delivered=0;updateCopy();
  document.querySelectorAll('.era-button').forEach(b=>b.classList.toggle('active',b.dataset.era===era));
  document.querySelectorAll('.start-era').forEach(b=>b.classList.toggle('selected',b.dataset.startEra===era));
  if(reset)buildWorld();
  $('#end-screen').classList.add('hidden');$('#end-screen').setAttribute('aria-hidden','true');
  if(started){$('#start-screen').classList.add('hidden');}
}
function updateCopy(){
  if(era==='1971'){
    $('#mission-kicker').textContent='THE DELTA, 1971';$('#mission-title').innerHTML='A journey<br>of care.';
    $('#mission-copy').textContent='Carry essential supplies across the village to the riverside shelter. Every small act helps a community endure.';
    $('#location-name').textContent='SONAR GAON · RIVER DELTA';$('#objective-hint').textContent='Find the glowing supply bundles';
  }else{
    $('#mission-kicker').textContent='DHAKA, 2024';$('#mission-title').innerHTML='Make room<br>for every voice.';
    $('#mission-copy').textContent='Gather books, clean water and a community notice for the neighborhood commons. Listen, share, and make space for one another.';
    $('#location-name').textContent='OLD DHAKA · NEIGHBORHOOD COMMONS';$('#objective-hint').textContent='Find the glowing community items';
  }
}
function showToast(message){const el=$('#toast');el.textContent=message;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2100);}
function playTone(freq=560,duration=.13){if(!soundOn)return;try{audioCtx??=new AudioContext();if(audioCtx.state==='suspended')audioCtx.resume();const o=audioCtx.createOscillator(),g=audioCtx.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.055,audioCtx.currentTime);g.gain.exponentialRampToValueAtTime(.001,audioCtx.currentTime+duration);o.connect(g);g.connect(audioCtx.destination);o.start();o.stop(audioCtx.currentTime+duration);}catch{}}
function nearestItem(){let nearest=null,dist=2.05;for(const it of items){if(it.collected)continue;const d=Math.hypot(player.position.x-it.x,player.position.z-it.z);if(d<dist){dist=d;nearest=it;}}return nearest;}
function nearGoal(){return goal&&Math.hypot(player.position.x-goal.x,player.position.z-goal.z)<2.9;}
function interact(){
  if(!started||gameWon)return;
  const item=nearestItem();
  if(item){item.collected=true;world.remove(item.group);delivered++;$('#progress-count').textContent=`${delivered} / 3`;$('#progress-fill').style.width=`${delivered/3*100}%`;
    showToast(`${item.label} collected · ${delivered}/3`);playTone(540+delivered*90,.17);
    if(delivered===3){$('#objective-hint').textContent='Return to the marked community shelter';showToast('All gathered. Bring them to the marked shelter.');}
    return;
  }
  if(nearGoal()){
    if(delivered<3){showToast(`The shelter needs all three items · ${delivered}/3`);playTone(220,.15);}
    else{completeJourney();}
    return;
  }
  showToast('Move closer to a glowing item or the destination.');
}
function completeJourney(){
  gameWon=true;playTone(660,.2);setTimeout(()=>playTone(820,.24),160);
  if(era==='1971'){$('#end-title').innerHTML='Care travels<br>farther.';$('#end-copy').textContent='The supplies reached the riverside shelter. In difficult times, a community’s strength is found in the care people share.';}
  else{$('#end-title').innerHTML='A future built<br>together.';$('#end-copy').textContent='The commons is ready for everyone. Listening, learning and making room for one another can change a neighborhood.';}
  $('#end-screen').classList.remove('hidden');$('#end-screen').setAttribute('aria-hidden','false');
}
function resetMission(){delivered=0;gameWon=false;buildWorld();if(started)$('#start-screen').classList.add('hidden');$('#end-screen').classList.add('hidden');showToast('Your journey begins again.');}
function startGame(){started=true;$('#start-screen').classList.add('hidden');$('#start-screen').setAttribute('aria-hidden','true');showToast(era==='1971'?'Find three supplies, then visit the riverside shelter.':'Gather three shared items, then visit the community commons.');}

// A clear, steady camera keeps movement readable in the isometric village.
const clock=new THREE.Clock();let elapsed=0,firstFrame=true;
function animate(){requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.045);elapsed+=dt;
  if(player){
    const speed=5.1;let dx=0,dz=0;
    if(held.has('w')||held.has('arrowup')||held.has('up'))dz-=1;
    if(held.has('s')||held.has('arrowdown')||held.has('down'))dz+=1;
    if(held.has('a')||held.has('arrowleft')||held.has('left'))dx-=1;
    if(held.has('d')||held.has('arrowright')||held.has('right'))dx+=1;
    const moving=dx!==0||dz!==0;
    if(moving){const len=Math.hypot(dx,dz);dx/=len;dz/=len;player.position.x=THREE.MathUtils.clamp(player.position.x+dx*speed*dt,-18,17);player.position.z=THREE.MathUtils.clamp(player.position.z+dz*speed*dt,-16,16);player.rotation.y=Math.atan2(dx,dz);}
    const stride=moving?Math.sin(elapsed*12)*.17:Math.sin(elapsed*2)*.018;
    playerParts.legL.position.z=stride;playerParts.legR.position.z=-stride;
    playerParts.body.position.y=moving?Math.abs(Math.sin(elapsed*12))*.055:Math.sin(elapsed*2)*.015;
    for(const it of items){if(!it.collected){it.group.position.y=.08+Math.sin(elapsed*2.7+it.x)*.13;it.group.rotation.y=elapsed*.3;}}
    const close=nearestItem();
    if(close){$('#objective-hint').textContent=`E  ·  Collect ${close.label}`;}
    else if(delivered===3){$('#objective-hint').textContent=nearGoal()?'E  ·  Deliver everything':'Return to the marked destination';}
    else if(nearGoal()){$('#objective-hint').textContent=`${delivered}/3 gathered · Find the glowing items`;}
    else $('#objective-hint').textContent=era==='1971'?'Find the glowing supply bundles':'Find the glowing community items';
  }
  if(firstFrame){firstFrame=false;$('#loading-screen').classList.add('done');}
  renderer.render(scene,camera);
}

window.addEventListener('keydown',e=>{
  const k=e.key.toLowerCase();if([' ','arrowup','arrowdown','arrowleft','arrowright'].includes(k))e.preventDefault();
  held.add(k);if(k==='e'||k===' '){if(!e.repeat)interact();}if(k==='enter'&&!started)startGame();
});
window.addEventListener('keyup',e=>held.delete(e.key.toLowerCase()));window.addEventListener('blur',()=>held.clear());
$('.era-switch').addEventListener('click',e=>{const b=e.target.closest('[data-era]');if(b)setEra(b.dataset.era);});
document.querySelectorAll('.start-era').forEach(b=>b.addEventListener('click',()=>setEra(b.dataset.startEra)));
$('#play-button').addEventListener('click',startGame);
$('#restart-button').addEventListener('click',resetMission);
$('#continue-button').addEventListener('click',()=>setEra(era==='1971'?'2024':'1971'));
$('#replay-button').addEventListener('click',resetMission);
$('#sound-toggle').addEventListener('click',()=>{soundOn=!soundOn;$('#sound-toggle').innerHTML=`♫ <span>Sound ${soundOn?'on':'off'}</span>`;if(soundOn)playTone(580,.12);});
$('#mobile-interact').addEventListener('pointerdown',e=>{e.preventDefault();interact();});
document.querySelectorAll('.mobile-pad button').forEach(button=>{
  const dir=button.dataset.dir;
  button.addEventListener('pointerdown',e=>{e.preventDefault();button.setPointerCapture(e.pointerId);held.add(dir);});
  const release=()=>held.delete(dir);button.addEventListener('pointerup',release);button.addEventListener('pointercancel',release);button.addEventListener('lostpointercapture',release);
});
renderer.domElement.addEventListener('pointerdown',e=>{if(e.detail===2)interact();});
window.addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));});
updateCopy();buildWorld();animate();
