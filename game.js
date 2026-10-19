/* SKY CLASH — original, dependency-free platform arena */
(() => {
'use strict';
const $=s=>document.querySelector(s), canvas=$('#game'),ctx=canvas.getContext('2d');
const W=1280,H=720, platforms=[{x:290,y:505,w:700,h:35},{x:350,y:375,w:190,h:15},{x:740,y:375,w:190,h:15},{x:560,y:265,w:160,h:15}];
const keys={left:false,right:false,jump:false,charge:false,up:false,down:false,attack:false,special:false,guard:false};
let state='menu',fighters=[],particles=[],shots=[],time=180,countdown=3,elapsed=0,shake=0,freeze=0,last=0,acc=0,level='normal',sound=true,announcementTime=0;
let impacts=[];
let items=[],itemClock=8,eventClock=0;
let stats={damage:0,kos:0},view={s:1,x:0,y:0,width:1280,height:720};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),rand=(a,b)=>a+Math.random()*(b-a);
function resize(){const r=canvas.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(r.width*d);canvas.height=Math.round(r.height*d);const portrait=r.height>r.width;view={s:Math.min(r.width/(portrait?940:W),r.height/(portrait?880:H)),x:r.width/2,y:r.height*(portrait?.46:.5),width:r.width,height:r.height,d};}
new ResizeObserver(resize).observe(canvas);
function sfx(name,opts){window.SkyAudio?.play(name,opts);}
function audioScene(scene){window.SkyAudio?.setScene(scene);}
function makeFighter(cpu){return{x:cpu?810:470,y:475,vx:0,vy:0,face:cpu?-1:1,cpu,damage:0,stocks:3,jumps:0,ground:true,stun:0,inv:0,respawn:0,cool:0,specialCool:0,attackTime:0,attackKind:'',hit:new Set(),guard:false,shield:100,aiWait:0,aiJump:0,recovery:false,walk:0,koFlash:0,ledge:0,ledgeCool:0,drop:0,power:0,attackDir:0,dodge:0,dodgeCool:0,charge:0,charging:false,smash:0};}
function start(){window.SkyAudio?.unlock();audioScene('battle');level=$('#difficulty').value;fighters=[makeFighter(false),makeFighter(true)];particles=[];shots=[];items=[];impacts=[];itemClock=8;eventClock=0;stats={damage:0,kos:0};time=180;countdown=3;freeze=0;state='countdown';resetInput();['menu','result','pause-screen'].forEach(id=>$('#'+id).classList.add('hidden'));$('#hud').classList.remove('hidden');$('#touch-controls').classList.remove('hidden');updateHUD();}
function menu(){audioScene('menu');state='menu';resetInput();$('#menu').classList.remove('hidden');['result','pause-screen','hud','touch-controls'].forEach(id=>$('#'+id).classList.add('hidden'));$('#announcement').textContent='';}
let beforePause='play';function pause(){if(state==='play'||state==='countdown'){beforePause=state;state='paused';audioScene('paused');resetInput();$('#pause-screen').classList.remove('hidden');}else if(state==='paused'){state=beforePause;window.SkyAudio?.unlock();audioScene('battle');$('#pause-screen').classList.add('hidden');}}
function resetInput(){resetSimpleControls();for(const f of fighters){f.charging=false;f.charge=0;}Object.keys(keys).forEach(k=>keys[k]=false);pointers.clear();heldCodes.clear();document.querySelectorAll('.held').forEach(e=>e.classList.remove('held'));}
function announce(text,t=1){$('#announcement').textContent=text;announcementTime=t;}
function burst(x,y,color,n=15,power=6){for(let i=0;i<n;i++)particles.push({x,y,vx:rand(-power,power),vy:rand(-power,power),life:rand(.2,.6),max:.6,color,size:rand(2,6)});if(particles.length>400)particles.splice(0,particles.length-400);}
function jump(f){if(f.respawn>0||f.stun>0||f.guard)return;if(f.ledge){f.ledge=0;f.ledgeCool=1;f.jumps=0;}if(f.jumps<2){f.vy=f.jumps===0?-12.4:-11.3;f.jumps++;f.ground=false;burst(f.x,f.y+27,f.cpu?'#ccc0b5':'#bbcacf',10,3);sfx(f.jumps===1?'jump':'doubleJump');}}
function attack(f,special=false){if(f.charging)return;if(f.respawn>0||f.stun>0||f.guard||f.cool>0)return;f.smash=0;if(!f.cpu){const opponent=fighters[1];if(opponent.respawn<=0&&Math.abs(opponent.x-f.x)>6)f.face=Math.sign(opponent.x-f.x);}if(special){if(f.specialCool>0)return;f.attackKind='special';f.attackTime=.36;f.cool=.52;f.specialCool=1.35;f.hit.clear();shots.push({x:f.x+f.face*30,y:f.y-3,vx:f.face*10.5,life:1.1,owner:f});if(!f.ground&&!f.recovery){f.vy=-10;f.recovery=true;}sfx('special');}else{f.attackKind='normal';f.attackDir=f.cpu?(fighters[0].y<f.y-45?-1:0):keys.up?-1:keys.down?1:0;f.attackTime=.25;f.cool=.34;f.hit.clear();sfx('slash');}}
function strike(a,b,power,dx,vertical=0){power*=a.power>0?1.45:1;if(b.inv>0||b.respawn>0)return;if(b.guard){b.shield=Math.max(0,b.shield-24);b.vx+=Math.sign(dx)*2;burst(b.x,b.y,'#c5d3d7',9,3);sfx('guard');if(b.shield<=0){b.stun=1.3;b.guard=false;sfx('break');announce('GUARD BREAK',.6);}return;}b.damage=Math.min(999,b.damage+power);if(!a.cpu)stats.damage+=power;let kb=4.2+b.damage*.095+power*.13;b.vx=Math.sign(dx||a.face)*kb;b.vy=-(4.6+b.damage*.044+power*.09);if(vertical<0){b.vx*=.35;b.vy*=1.55;}if(vertical>0&&!a.ground){b.vx*=.45;b.vy=Math.abs(b.vy)*1.3;}b.ledge=0;b.ledgeCool=1;b.attackTime=0;b.charging=false;b.charge=0;b.smash=0;b.stun=.22+Math.min(.48,b.damage*.0025);b.inv=.17;b.ground=false;b.guard=false;freeze=Math.max(freeze,clamp(.065+power*.002,.08,.135));shake=8+Math.min(10,power*.25);impacts.push({x:b.x,y:b.y-20,life:.22,max:.22,dir:Math.sign(dx||a.face),heavy:power>=20});burst(b.x,b.y,a.cpu?'#ccc0b6':'#b6c7cc',23,8);sfx('hit',{strength:Math.min(1.5,.85+power/32)});}
function releaseSmash(f){if(!f.charging)return;const force=f.charge;f.charging=false;f.charge=0;if(f.stun>0||f.respawn>0)return;f.cool=0;attack(f);f.smash=force;f.attackTime=.32;f.cool=.65;burst(f.x+f.face*30,f.y-20,'#ccc3b6',18,5);sfx('smash');}
function cpuInput(f,p,dt){const dx=p.x-f.x,dy=p.y-f.y;f.aiWait-=dt;f.aiJump-=dt;f.guard=false;if(f.stun>0||f.respawn>0)return;const speed=level==='easy'?3.2:level==='hard'?5:4.3;
 let target=p.x;if(f.x<310||f.x>970||f.y>530)target=640;
 const dist=target-f.x; if(Math.abs(dist)>58){f.vx+=(Math.sign(dist)*speed-f.vx)*.16;f.face=Math.sign(dist);}else{f.vx*=.8;f.face=dx>=0?1:-1;}
 if((f.y>520||f.x<280||f.x>1000)&&f.vy>0){if(f.jumps<2)jump(f);else if(!f.recovery)attack(f,true);}
 if(f.aiJump<=0&&((dy<-65&&Math.abs(dx)<250)||(Math.abs(dx)<170&&Math.random()<dt*.6))){jump(f);f.aiJump=level==='easy'?1.4:.6;}
 if(level!=='easy'&&p.attackTime>0&&Math.abs(dx)<110&&Math.abs(dy)<70&&f.shield>25&&f.ground){f.guard=true;f.vx*=.8;}
 if(f.aiWait<=0){if(Math.abs(dx)<90&&Math.abs(dy)<65)attack(f);else if(Math.abs(dx)<520&&Math.abs(dy)<50&&Math.abs(dx)>110)attack(f,true);f.aiWait=level==='easy'?.65:level==='hard'?.15:.33;}
}
function step(dt){elapsed+=dt;if(state==='paused'||state==='result'||state==='menu')return;
 if(announcementTime>0){announcementTime-=dt;if(announcementTime<=0)$('#announcement').textContent='';}
 if(state==='countdown'){const old=Math.ceil(countdown);countdown-=dt;let n=Math.ceil(countdown);$('#announcement').textContent=n>0?n:'GO!';if(n!==old)sfx(n>0?'count':'go');if(countdown<=0){state='play';announce('GO!',.6);}return;}
 if(freeze>0){freeze-=dt;return;}for(const h of impacts)h.life-=dt;impacts=impacts.filter(h=>h.life>0);time=Math.max(0,time-dt);eventClock+=dt;itemClock-=dt;if(itemClock<=0){items.push({x:rand(400,880),y:70,vy:0,kind:Math.random()<.5?'heal':'power',life:14});itemClock=12;}for(const p of platforms)p.prevY=p.y;platforms[1].y=375+Math.sin(eventClock*.55)*22;platforms[2].y=375-Math.sin(eventClock*.55)*22;shake=Math.max(0,shake-30*dt);
 for(const f of fighters){f.dodge=Math.max(0,f.dodge-dt);f.dodgeCool=Math.max(0,f.dodgeCool-dt);if(f.ground)for(const p of platforms)if(Math.abs(f.y+28-p.prevY)<1&&f.x>p.x-17&&f.x<p.x+p.w+17)f.y+=p.y-p.prevY;f.ledgeCool=Math.max(0,f.ledgeCool-dt);f.drop=Math.max(0,f.drop-dt);f.power=Math.max(0,f.power-dt);f.cool=Math.max(0,f.cool-dt);f.specialCool=Math.max(0,f.specialCool-dt);f.inv=Math.max(0,f.inv-dt);f.stun=Math.max(0,f.stun-dt);f.attackTime=Math.max(0,f.attackTime-dt);
 if(f.respawn>0){f.respawn-=dt;if(f.respawn<=0){f.x=f.cpu?760:520;f.y=110;f.vx=0;f.vy=0;f.inv=2.4;f.jumps=0;f.recovery=false;f.stun=0;}continue;}
 if(f.ledge){f.ledge-=dt;f.vx=0;f.vy=0;if(f.cpu||(!f.cpu&&(keys.jump||keys.up||keys.attack))||f.ledge<=0){f.x=f.x<640?310:970;f.y=477;f.ledge=0;f.ledgeCool=1;f.inv=.45;f.ground=true;}else if(!f.cpu&&keys.down){f.ledge=0;f.ledgeCool=1;}else continue;}
 if(f.cpu)cpuInput(f,fighters[0],dt);else{f.guard=keys.guard&&f.shield>0&&f.stun<=0&&f.ground;if(f.stun<=0){let dir=heldCodes.has('KeyA')||heldCodes.has('ArrowLeft')||heldCodes.has('KeyD')||heldCodes.has('ArrowRight')?Number(keys.right)-Number(keys.left):stickAxis;if(keys.guard&&dir&&f.dodgeCool<=0){f.dodge=.25;f.dodgeCool=.9;f.inv=Math.max(f.inv,.25);f.vx=dir*9;f.guard=false;}if(f.dodge>0){f.guard=false;}else if(!f.guard){if(keys.charge&&f.cool<=0&&f.ground){f.charging=true;f.charge=Math.min(1.2,f.charge+dt);}if(f.charging){f.vx*=.7;if(!keys.charge)releaseSmash(f);}else f.vx+=(dir*5.5-f.vx)*(f.ground?.23:.1);if(dir)f.face=Math.sign(dir);if(keys.attack)attack(f);if(keys.special)attack(f,true);}else f.vx*=.75;}}
 if(f.guard){f.shield=Math.max(0,f.shield-dt*28);if(f.shield===0){f.guard=false;f.stun=1.3;sfx('break');announce('GUARD BREAK',.6);}}else f.shield=Math.min(100,f.shield+dt*19);
 if(!f.cpu&&keys.down&&f.stun<=0){if(f.ground&&f.y<460){f.drop=.22;f.y+=8;f.ground=false;}else if(f.vy>0)f.vy=Math.max(13,f.vy);}
 const oldFeet=f.y+28;f.vy=Math.min(17,f.vy+.49);f.x+=f.vx;f.y+=f.vy;f.ground=false;
 for(const p of platforms){if(!(p!==platforms[0]&&f.drop>0)&&f.vy>=0&&oldFeet<=p.y+5&&f.y+28>=p.y&&f.x+17>p.x&&f.x-17<p.x+p.w){f.y=p.y-28;f.vy=0;f.ground=true;f.jumps=0;f.recovery=false;break;}}
 if(!f.ground&&f.vy>0&&f.stun<=0&&f.ledgeCool<=0&&f.y>475&&f.y<548&&!(!f.cpu&&keys.down)){for(const edge of [290,990]){if(Math.abs(f.x-edge)<24){f.x=edge+(edge<640?-15:15);f.y=523;f.ledge=1.2;f.inv=.55;f.jumps=0;f.recovery=false;burst(edge,505,'#c9d6da',8,2);break;}}}
 if(f.charging&&(!f.ground||f.stun>0)){f.charging=false;f.charge=0;}if(f.stun>0)f.vx*=f.ground?.92:.993;if(!f.ground&&f.jumps===0)f.jumps=1;f.walk+=Math.abs(f.vx)*dt*2;
 if(f.attackTime>.04&&f.attackKind==='normal'){const b=fighters[f.cpu?0:1];if(!f.hit.has(b)&&(f.attackDir===-1?Math.abs(b.x-f.x)<62&&b.y-f.y>-130&&b.y-f.y<5:f.attackDir===1?Math.abs(b.x-f.x)<75&&b.y-f.y>-25&&b.y-f.y<100:Math.abs(b.y-f.y)<58&&(b.x-f.x)*f.face>-12&&(b.x-f.x)*f.face<92)){f.hit.add(b);strike(f,b,(f.attackDir?12:10)+f.smash*16,f.face,f.attackDir);}}
 if(f.x<-130||f.x>W+130||f.y>H+140||f.y<-230){f.stocks--;f.damage=0;f.respawn=1.35;f.vx=0;f.vy=0;shake=18;if(f.cpu)stats.kos++;burst(clamp(f.x,30,W-30),clamp(f.y,30,H-30),f.cpu?'#cdc2b7':'#b5c6cc',65,15);sfx('ko');announce(f.cpu?'KO':'ストック −1',.85);if(f.stocks<=0){finish();return;}}
 }
 for(const item of items){item.life-=dt;const feet=item.y+12;item.vy=Math.min(8,item.vy+.25);item.y+=item.vy;for(const p of platforms)if(item.vy>=0&&feet<=p.y+5&&item.y+12>=p.y&&item.x>p.x&&item.x<p.x+p.w){item.y=p.y-12;item.vy=0;break;}for(const f of fighters)if(f.respawn<=0&&Math.abs(f.x-item.x)<36&&Math.abs(f.y-item.y)<60&&item.life>0){if(item.kind==='heal')f.damage=Math.max(0,f.damage-25);else f.power=8;item.life=0;burst(item.x,item.y,'#cac1b3',20,5);sfx('pickup');announce(item.kind==='heal'?'HEAL −25%':'POWER UP!',.7);}}items=items.filter(i=>i.life>0);
 for(const s of shots){s.x+=s.vx;s.life-=dt;const b=fighters[s.owner.cpu?0:1];if(s.life>0&&b.respawn<=0&&Math.abs(s.x-b.x)<29&&s.y>b.y-69&&s.y<b.y+29){strike(s.owner,b,15,s.vx);s.life=0;burst(s.x,s.y,'#c6d3d7',12,5);}}
 shots=shots.filter(s=>s.life>0&&s.x>-150&&s.x<W+150);
 for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.vy+=.12;p.life-=dt;}particles=particles.filter(p=>p.life>0);
 if(time<=0)finish();updateHUD();
}
function finish(){state='result';resetInput();const [p,c]=fighters;const score=p.stocks-c.stocks;const win=score>0||(score===0&&p.damage<c.damage),draw=score===0&&p.damage===c.damage;$('#result-title').textContent=draw?'DRAW':win?'YOU WIN!':'DEFEAT';$('#result-label').textContent=draw?'EVENLY MATCHED':win?'RESULT':'RESULT';$('#result-copy').textContent=draw?'引き分け':win?'勝利':'敗北';$('#stat-damage').textContent=Math.round(stats.damage)+'%';$('#stat-ko').textContent=stats.kos;$('#result').classList.remove('hidden');$('#touch-controls').classList.add('hidden');$('#announcement').textContent='';updateHUD();audioScene('result');sfx(win?'win':'lose');}
function updateHUD(){fighters.forEach((f,i)=>{const pre=i?'c':'p';$('#'+pre+'-damage').textContent=Math.floor(f.damage);$('#'+pre+'-damage').style.color=f.damage>=100?'#c8bcb0':f.damage>=60?'#c9c0b2':'';$('#'+pre+'-stock').textContent='◆'.repeat(Math.max(0,f.stocks))+'◇'.repeat(3-Math.max(0,f.stocks));});const seconds=Math.ceil(time);$('#timer').textContent=Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
function rr(x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();}
function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function poly(points,color){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();}
function drawImpacts(){for(const h of impacts){const t=1-h.life/h.max,r=(h.heavy?78:56)*(1+t*.65);ctx.save();ctx.translate(h.x,h.y);ctx.scale(h.dir,1);ctx.globalAlpha=1-t;ctx.rotate(-.25);poly([[-r*.8,-7],[-20,-14],[-12,-r*.75],[7,-20],[r,-9],[24,8],[r*.5,r*.45],[4,20],[-14,r*.6],[-22,12]],'#312d26');poly([[-r*.7,-3],[-12,-9],[-8,-r*.6],[9,-10],[r*.85,-4],[17,6],[r*.35,r*.3],[0,11],[-10,r*.4],[-13,5]],'#e1bd66');ellipse(0,0,18*(1-t)+3,11*(1-t)+3,'#fff4da');ctx.restore();}}
function background(){const g=ctx.createLinearGradient(0,-150,0,900);g.addColorStop(0,'#345a6d');g.addColorStop(.65,'#8eaaa9');g.addColorStop(1,'#c6c4aa');ctx.fillStyle=g;ctx.fillRect(-1000,-1000,3300,2800);
 ellipse(1000,105,49,49,'#e1cf94');
 for(let i=0;i<7;i++){const x=(i*310+elapsed*4+2400)%2400-500,y=105+(i%3)*62;ellipse(x,y,83,17,'#d8d7bf');ellipse(x-25,y-13,32,24,'#d8d7bf');ellipse(x+18,y-19,43,28,'#e2dfcb');}
 for(let i=0;i<6;i++){const x=i*290-160,y=350+(i%3)*52;poly([[x-180,780],[x-105,y+55],[x-48,y],[x+18,y+12],[x+95,y+100],[x+180,780]],'#708e88');poly([[x-48,y],[x+18,y+12],[x+95,y+100],[x+180,780],[x-20,780]],'#5c7b76');}
 for(let i=0;i<5;i++){const x=i*350-80;ellipse(x,695+(i%2)*34,230,53,'#aebcac');ellipse(x+60,670+(i%2)*34,110,48,'#bcc6b3');}
}
function floatingRock(x,y,s){ctx.save();ctx.translate(x,y+Math.sin(elapsed*.7+x)*7);ctx.scale(s,s);poly([[-90,0],[90,0],[65,40],[5,130],[-55,65]],'#384144');poly([[-90,0],[90,0],[65,14],[-72,18]],'#7b8183');poly([[5,130],[15,18],[90,0],[65,40]],'#475154');ellipse(0,0,92,12,'#90979a');ctx.restore();}
function stage(){
 for(const x of [369,911]){ctx.fillStyle='#6a7376';ctx.fillRect(x-12,411,24,83);rr(x-18,408,36,9,2,'#b2b8b9');rr(x-19,484,38,9,2,'#b2b8b9');ctx.fillStyle='#b9bec04d';ctx.fillRect(x-7,420,5,60);poly([[x-12,411],[x-8,388],[x+1,397],[x+12,390],[x+12,411]],'#9aa0a2');}
 ctx.save();ctx.translate(640,557);ctx.rotate(elapsed*.3);ctx.strokeStyle='#afc2c89a';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,38,0,Math.PI*2);ctx.stroke();for(let i=0;i<4;i++){ctx.rotate(Math.PI/2);poly([[-5,-45],[0,-58],[5,-45]],'#bacacf');}ctx.restore();
 for(let i=0;i<platforms.length;i++){const p=platforms[i];if(i===0){ellipse(640,646,300,30,'#29231e2a');poly([[p.x,512],[p.x+p.w,512],[925,570],[850,585],[735,655],[665,628],[570,664],[430,576],[340,561]],'#30383b');poly([[640,527],[925,529],[850,585],[735,655],[665,628]],'#3d4649');poly([[430,530],[570,664],[530,577]],'#545e61');poly([[735,655],[790,555],[850,585]],'#485256');for(let j=0;j<6;j++){const x=350+j*115;poly([[x,525],[x+18,528],[x+5,562+(j%3)*17]],'#73797b38');}rr(p.x,500,p.w,19,7,'#5b6163');rr(p.x-5,505,p.w+10,7,6,'#52634a');rr(p.x+5,505,p.w-10,3,3,'#9baf69');rr(p.x+16,517,p.w-32,3,2,'#a9bac063');for(let j=0;j<30;j++){const x=306+j*23;ctx.strokeStyle=j%2?'#aeb5b8':'#748084';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,496);ctx.lineTo(x-2,489-(j%3)*3);ctx.stroke();}for(const x of [315,965]){rr(x-7,465,14,30,3,'#51595b');ellipse(x,462,10,5,'#bcccd1');const g=ctx.createRadialGradient(x,461,1,x,461,30);g.addColorStop(0,'#b1c3c940');g.addColorStop(1,'#b1c3c900');ctx.fillStyle=g;ctx.fillRect(x-30,431,60,60);}}
 else{const bob=0;rr(p.x,p.y,p.w,14,5,'#656c6e');rr(p.x-3,p.y-5,p.w+6,7,3,'#b3a47e');rr(p.x+10,p.y+11,p.w-20,3,2,'#b3c5caa0');poly([[p.x+15,p.y+14],[p.x+p.w-15,p.y+14],[p.x+p.w-38,p.y+33],[p.x+43,p.y+29]],'#3e474a');}}
 // Small island foliage, always behind the fighters.
 for(const x of [337,950]){ctx.strokeStyle='#707b7e';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(x,493);ctx.quadraticCurveTo(x-8,472,x-18,465);ctx.stroke();ellipse(x-12,473,11,4,'#919b9e');ellipse(x-2,480,10,4,'#9faaad');}
}
function fighter(f,hero=false){if(f.respawn>0)return;ctx.save();ctx.translate(f.x,f.y);if(hero)ctx.scale(3.2,3.2);if(f.inv>0&&Math.floor(elapsed*15)%3===0)ctx.globalAlpha=.45;
 const mint=f.cpu?'#c89150':'#77a6ab',armor=f.cpu?'#674937':'#304e60',edge=f.cpu?'#a77d53':'#5d8491',silver=f.cpu?'#e0c69a':'#e1dac4',ink='#282c2c';
 if(f.ground)ellipse(0,29,25,5,'#1b242655');
 ctx.save();ctx.scale(f.face,1);const running=Math.abs(f.vx)>.5;const stride=f.ground?(running?Math.sin(f.walk)*9:1):8;const bob=f.ground?(running?Math.sin(f.walk*2)*1.4:Math.sin(elapsed*2)*.7):0;ctx.translate(0,bob);ctx.rotate(f.stun>0?-.22:running?.08:-.035);
 // Split storm cloak and trailing ribbons, animated independently of the stance.
 const wind=Math.sin(elapsed*5)*5+Math.abs(f.vx)*1.3;
 poly([[-12,-42],[-26,-28],[-40-wind,10],[-24,2],[-20,16],[-5,-3]],ink);
 poly([[-13,-40],[-24,-24],[-38-wind,8],[-26,-1],[-18,-10]],armor);
 poly([[-14,-44],[-35,-40],[-56-wind,-48],[-47-wind,-34],[-29,-33],[-7,-38]],mint);
 poly([[-17,-39],[-40,-31],[-57-wind,-34],[-45,-24],[-18,-32]],f.cpu?'#7f756b':'#5b747b');
 // Long segmented boots and asymmetric greaves.
 ctx.lineCap='round';ctx.strokeStyle=ink;ctx.lineWidth=10;ctx.beginPath();ctx.moveTo(-7,-2);ctx.lineTo(-11-stride,12);ctx.lineTo(-13-stride,25);ctx.moveTo(7,-2);ctx.lineTo(11+stride,11);ctx.lineTo(13+stride,26);ctx.stroke();
 poly([[-16-stride,8],[-7-stride,10],[-9-stride,24],[-18-stride,26]],armor);
 poly([[7+stride,8],[16+stride,6],[18+stride,23],[10+stride,25]],edge);
 poly([[11+stride,10],[14+stride,9],[16+stride,23],[13+stride,23]],mint);
 poly([[-19-stride,23],[-9-stride,23],[-4-stride,29],[-23-stride,29]],ink);
 poly([[9+stride,23],[18+stride,22],[27+stride,28],[10+stride,29]],ink);
 // Tapered armored torso, belt, and angular shoulder plates.
 poly([[-15,-39],[9,-41],[18,-30],[10,-11],[13,0],[1,6],[-12,0],[-10,-15],[-19,-28]],ink);
 poly([[-12,-36],[7,-38],[13,-29],[6,-14],[-7,-15],[-14,-28]],armor);
 poly([[-11,-35],[2,-30],[9,-35],[6,-24],[-3,-20],[-11,-25]],edge);
 poly([[-8,-32],[0,-27],[6,-31],[1,-23]],mint);
 poly([[-11,-13],[9,-13],[10,-8],[-12,-8]],silver);
 poly([[-2,-14],[4,-12],[3,-7],[-3,-8]],mint);
 poly([[-12,-7],[-2,-3],[-8,13],[-18,8]],armor);
 poly([[5,-7],[11,-5],[19,10],[8,6]],ink);
 // Human silhouette: swept silver hair, a narrow glowing visor and a dark mask.
 rr(-6,-47,13,9,2,ink);
 poly([[-11,-61],[4,-65],[14,-57],[13,-46],[5,-39],[-6,-43],[-12,-52]],'#d7b78d');
 poly([[-10,-55],[14,-56],[13,-46],[5,-40],[-5,-44]],'#d7b78d');rr(3,-55,9,7,2,'#f6efda');rr(8,-55,4,7,1,ink);
 poly([[-10,-57],[14,-58],[13,-55],[-8,-54]],ink);
 poly([[2,-53],[13,-54],[11,-52],[4,-52]],'#cdd8dc');
 poly([[-14,-51],[-18,-59],[-11,-59],[-16,-68],[-5,-65],[0,-74],[5,-66],[15,-68],[11,-61],[19,-61],[11,-55],[3,-60],[-4,-54],[-5,-61]],silver);
 poly([[-15,-61],[-8,-60],[-6,-65],[-2,-63],[-4,-55],[-11,-51]],edge);
 if(f.cpu){poly([[-13,-62],[-23,-72],[-18,-53],[-11,-51]],mint);poly([[10,-63],[19,-74],[17,-55],[12,-53]],mint);}
 // Rear hand and plated gauntlet.
 ctx.strokeStyle=ink;ctx.lineWidth=8;ctx.beginPath();ctx.moveTo(-14,-31);ctx.lineTo(-23,-18);ctx.lineTo(-19,-7);ctx.stroke();poly([[-24,-19],[-17,-19],[-14,-8],[-22,-5]],edge);poly([[-24,-20],[-17,-20],[-17,-16],[-23,-16]],mint);
 if(f.power>0){ctx.shadowBlur=16;ctx.shadowColor='#bdb1a0';ellipse(0,-20,33,48,'#bdb1a016');ctx.shadowBlur=0;}
 const attacking=f.attackTime>0&&f.attackKind==='normal';const hx=attacking?31:21,hy=attacking?-28:-12;
 ctx.strokeStyle=armor;ctx.lineWidth=9;ctx.beginPath();ctx.moveTo(12,-31);ctx.lineTo(attacking?23:18,-22);ctx.lineTo(hx,hy);ctx.stroke();poly([[8,-39],[19,-36],[24,-28],[13,-27],[7,-32]],edge);poly([[11,-37],[20,-32],[14,-31]],mint);
 rr(hx-5,hy-5,10,9,2,ink);rr(hx-5,hy-6,9,3,1,edge);
 // Energy katana: a full blade at rest and a wide cutting trail on attack.
 ctx.save();ctx.translate(hx,hy);ctx.rotate((attacking?(f.attackDir===-1?-1.2:f.attackDir===1?1.1:0):0)+(attacking?(-1.35+(1-f.attackTime/.25)*2.2):.42));
 rr(-3,-5,6,17,1,ink);rr(-8,-7,16,3,1,edge);
 ctx.shadowColor=mint;ctx.shadowBlur=hero?7:12;poly([[-2,-7],[-1,-55],[4,-65],[5,-8]],mint);ctx.shadowBlur=0;poly([[1,-9],[2,-54],[4,-61],[3,-9]],'#cbd7db');ctx.restore();
 if(attacking){ctx.save();ctx.globalAlpha*=f.attackTime/.25;ctx.strokeStyle=mint;ctx.lineWidth=7;ctx.shadowBlur=20;ctx.shadowColor=mint;ctx.beginPath();ctx.arc(15,-20,63,-1.25+(f.attackDir||0)*1.2,1.15+(f.attackDir||0)*1.2);ctx.stroke();ctx.lineWidth=2;ctx.strokeStyle='#cbd7db';ctx.beginPath();ctx.arc(15,-20,57,-1.1,1.05);ctx.stroke();poly([[49,-57],[91,-37],[66,-30],[80,-10],[52,-23]],'#c5d2d74d');ctx.restore();}
 ctx.restore();
 if(f.guard){ctx.strokeStyle=mint;ctx.lineWidth=2.5;ctx.globalAlpha*=.4+f.shield/170;ellipse(0,-20,40,57,f.cpu?'#ccc0b523':'#b4c5cb23');ctx.beginPath();ctx.ellipse(0,-20,40,57,0,0,Math.PI*2);ctx.stroke();rr(-22,-85,44,4,2,'#2a3336');rr(-22,-85,44*f.shield/100,4,2,mint);}
 if(f.charging){ctx.save();ctx.strokeStyle='#cbc1b3';ctx.lineWidth=3;ctx.shadowBlur=18;ctx.shadowColor='#cbc1b3';ctx.beginPath();ctx.arc(0,-20,40+f.charge*12,-Math.PI/2,-Math.PI/2+Math.PI*2*f.charge/1.2);ctx.stroke();ctx.restore();}if(!hero){ctx.fillStyle=mint;ctx.font='bold 10px sans-serif';ctx.textAlign='center';ctx.fillText(f.cpu?'CPU':'YOU',0,-90);poly([[-4,-85],[4,-85],[0,-80]],mint);if(f.specialCool>0){rr(-17,39,34,3,2,'#222c2f');rr(-17,39,34*(1-f.specialCool/1.35),3,2,mint);}}
 ctx.restore();}
function render(){const d=view.d||1;ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,view.width,view.height);ctx.save();ctx.translate(view.x,view.y);ctx.scale(view.s,view.s);ctx.translate(-W/2,-H/2);if(shake>0&&state==='play')ctx.translate(rand(-shake,shake)*.5,rand(-shake,shake)*.5);background();stage();for(const item of items){ctx.save();ctx.translate(item.x,item.y);ctx.rotate(Math.sin(elapsed*3)*.2);ctx.shadowColor=item.kind==='heal'?'#abbfc5':'#bdb1a0';ctx.shadowBlur=24;poly([[0,-18],[16,0],[0,18],[-16,0]],item.kind==='heal'?'#abbfc5':'#bdb1a0');ctx.fillStyle='#2e2823';ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.fillText(item.kind==='heal'?'+':'ϟ',0,8);ctx.restore();}
 if(state==='menu'){const hero=makeFighter(false);hero.x=900;hero.y=394;hero.walk=elapsed;fighter(hero,true);ellipse(895,495,85,9,'#22292b45');}else{for(const f of fighters)fighter(f);drawImpacts();for(const s of shots){const color=s.owner.cpu?'#cdc2b7':'#b7c8cd';ctx.save();ctx.shadowBlur=20;ctx.shadowColor=color;ellipse(s.x,s.y,22,10,color);ellipse(s.x-s.vx,s.y,17,5,'#cad6da90');ctx.restore();}for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);rr(p.x,p.y,p.size,p.size,1,p.color);}ctx.globalAlpha=1;
 for(const f of fighters){if(f.respawn>0)continue;const minX=Math.max(25,640-view.width/(2*view.s)+25),maxX=Math.min(1255,640+view.width/(2*view.s)-25);if(f.x<minX||f.x>maxX||f.y<0){let x=clamp(f.x,minX,maxX),y=clamp(f.y,140,650);ellipse(x,y,20,20,'#21292ccc');ctx.fillStyle=f.cpu?'#cdc2b7':'#b7c8cd';ctx.textAlign='center';ctx.font='bold 15px sans-serif';ctx.fillText(f.x<minX?'◀':f.x>maxX?'▶':'▲',x,y+5);}}}
 ctx.restore();}
function frame(ts){let dt=Math.min(.05,(ts-last)/1000||0);last=ts;acc+=dt;while(acc>=1/60){step(1/60);acc-=1/60;}render();requestAnimationFrame(frame);}
const mapping={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyW:'jump',ArrowUp:'jump',Space:'jump',KeyJ:'attack'};
const pointers=new Map(),heldCodes=new Set();
let stickAxis=0,stickId=null,stickOrigin=0,attackStarted=null,attackPointer=null;
const moveZone=$('#move-zone'),stick=$('#stick'),knob=$('#stick-knob'),attackButton=$('#simple-attack');
function resetSimpleControls(){stickAxis=0;stickId=null;attackStarted=null;attackPointer=null;stick.classList.add('hidden');attackButton.classList.remove('held');}
function setKey(k,down){const was=keys[k];keys[k]=down;if(down&&!was&&k==='jump'&&state==='play')jump(fighters[0]);}
function attackPress(){if(state!=='play'||attackStarted!==null)return;window.SkyAudio?.unlock();attackStarted=performance.now();keys.charge=true;attackButton.classList.add('held');}
function attackRelease(cancel=false){if(attackStarted===null)return;const held=performance.now()-attackStarted;attackStarted=null;keys.charge=false;attackButton.classList.remove('held');const f=fighters[0];if(!f)return;if(cancel||state!=='play'){f.charging=false;f.charge=0;return;}if(held>=220&&f.charging){releaseSmash(f);}else{f.charging=false;f.charge=0;attack(f);} }
moveZone.addEventListener('pointerdown',e=>{if(state!=='play'||stickId!==null)return;e.preventDefault();moveZone.setPointerCapture(e.pointerId);stickId=e.pointerId;stickOrigin=e.clientX;stickAxis=0;const r=moveZone.getBoundingClientRect();stick.style.left=(e.clientX-r.left)+'px';stick.style.top=(e.clientY-r.top)+'px';knob.style.transform='translate(-50%,-50%)';stick.classList.remove('hidden');});
moveZone.addEventListener('pointermove',e=>{if(e.pointerId!==stickId)return;e.preventDefault();const dx=clamp(e.clientX-stickOrigin,-52,52);stickAxis=Math.abs(dx)<6?0:Math.sign(dx)*(Math.abs(dx)-6)/46;knob.style.transform=`translate(calc(-50% + ${dx}px),-50%)`;});
function endStick(e){if(e.pointerId===stickId){stickId=null;stickAxis=0;stick.classList.add('hidden');}}
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>moveZone.addEventListener(ev,endStick));
attackButton.addEventListener('pointerdown',e=>{if(attackPointer!==null)return;e.preventDefault();attackButton.setPointerCapture(e.pointerId);attackPointer=e.pointerId;attackPress();});
attackButton.addEventListener('pointerup',e=>{if(e.pointerId!==attackPointer)return;attackPointer=null;attackRelease();});
['pointercancel','lostpointercapture'].forEach(ev=>attackButton.addEventListener(ev,e=>{if(e.pointerId!==attackPointer)return;attackPointer=null;attackRelease(true);}));
document.querySelectorAll('[data-key]').forEach(btn=>{btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);pointers.set(e.pointerId,btn.dataset.key);setKey(btn.dataset.key,true);btn.classList.add('held');});const release=e=>{pointers.delete(e.pointerId);const still=[...pointers.values()].includes(btn.dataset.key)||[...heldCodes].some(c=>mapping[c]===btn.dataset.key);setKey(btn.dataset.key,still);if(!still)btn.classList.remove('held');};['pointerup','pointercancel','lostpointercapture'].forEach(ev=>btn.addEventListener(ev,release));});
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLSelectElement||e.target?.tagName==='INPUT')return;if(e.code==='Escape'){e.preventDefault();if(!e.repeat)pause();return;}const k=mapping[e.code];if(!k)return;e.preventDefault();if(e.repeat)return;heldCodes.add(e.code);if(k==='attack')attackPress();else setKey(k,true);});
window.addEventListener('keyup',e=>{const k=mapping[e.code];if(!k)return;e.preventDefault();heldCodes.delete(e.code);if(k==='attack')attackRelease();else setKey(k,[...heldCodes].some(c=>mapping[c]===k)||[...pointers.values()].includes(k));});
window.addEventListener('blur',()=>{heldCodes.clear();if(state==='play'||state==='countdown')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&(state==='play'||state==='countdown'))pause();});
$('#start').onclick=start;$('#rematch').onclick=start;$('#pause').onclick=pause;$('#resume').onclick=pause;$('#back-menu').onclick=menu;$('#result-menu').onclick=menu;
$('#sound').onclick=()=>{sound=!sound;window.SkyAudio?.setEnabled(sound);if(sound){window.SkyAudio?.unlock();audioScene(state==='menu'?'menu':state==='paused'?'paused':state==='result'?'result':'battle');}$('#sound').textContent='音 '+(sound?'ON':'OFF');$('#sound').setAttribute('aria-label',sound?'サウンドをオフにする':'サウンドをオンにする');};
const volume=()=>{window.SkyAudio?.setVolumes(Number($('#music-volume').value)/100,Number($('#sfx-volume').value)/100);};
$('#music-volume').oninput=volume;$('#sfx-volume').oninput=volume;
volume();

resize();requestAnimationFrame(frame);
})();




