/* SKY CLASH — original, dependency-free platform arena */
(() => {
'use strict';
const $=s=>document.querySelector(s), canvas=$('#game');let ctx=canvas.getContext('2d');
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

const roster={
 boxing:{name:'レオ',art:'ボクシング',color:'#e53c3b',cloth:'#e53c3b',range:82,power:8,cool:.25,speed:5.8,jump:1,normal:'ジャブ',strong:'アッパーカット',kind:'punch',note:'短い間合いで素早く連打。溜め攻撃は上へ吹き飛ばす。'},
 karate:{name:'カイ',art:'空手',color:'#f3eee0',cloth:'#f3eee0',range:94,power:11,cool:.36,speed:5.5,jump:1,normal:'正拳突き',strong:'踏み込み蹴り',kind:'punch',note:'間合いと威力のバランス型。白い道着と黒帯。'},
 taekwondo:{name:'ユン',art:'テコンドー',color:'#3399ed',cloth:'#edf3f5',range:119,power:10,cool:.43,speed:5.7,jump:1.08,normal:'横蹴り',strong:'回転蹴り',kind:'kick',note:'長いリーチと高いジャンプ。青い襟の道着。'},
 martial:{name:'リン',art:'マーシャルアーツ',color:'#f2b929',cloth:'#f2b929',range:103,power:9,cool:.31,speed:6.1,jump:1.05,normal:'掌打',strong:'飛び蹴り',kind:'palm',note:'軽快な移動と素早い掌打。黄色のトレーニングウェア。'},
 judo:{name:'ゴウ',art:'柔道',color:'#2562c3',cloth:'#2562c3',range:60,power:14,cool:.58,speed:4.8,jump:.96,normal:'大外刈り',strong:'背負い投げ',kind:'throw',note:'近距離の投げが強力。溜めると背後へ投げる。青い柔道着。'}
};
let selectSeat='p';const selectionTimes={p:-2,c:-2};
function selectedStyle(cpu=false){const v=$(cpu?'#cpu-character':'#character').value;return roster[v]?v:cpu?'boxing':'karate';}
function refreshRoster(){const a=roster[selectedStyle()],b=roster[selectedStyle(true)];$('#character-detail').textContent=a.normal+' ／ 長押し：'+a.strong+'。'+a.note;$('#hero-name').textContent=a.name+' / '+a.art;$('#p-name').textContent=a.name;$('#c-name').textContent=b.name;$('#p-avatar').src='fighter-'+selectedStyle()+'.svg?v=pose2';$('#c-avatar').src='fighter-'+selectedStyle(true)+'.svg?v=pose2';$('#p-avatar').alt=a.name+'の肖像';$('#c-avatar').alt=b.name+'の肖像';refreshArcade();}


function refreshArcade(){
 for(const seat of ['p','c']){const key=selectedStyle(seat==='c'),f=roster[key];$('#preview-'+seat).setAttribute('aria-label',f.name+'のファイティングポーズ');$('#preview-'+seat+'-name').textContent=f.name;$('#preview-'+seat+'-art').textContent=f.art;$('#seat-'+seat).setAttribute('aria-pressed',String(selectSeat===seat));}
 const chosen=selectedStyle(selectSeat==='c'),f=roster[chosen];
 for(const key of Object.keys(roster)){const el=$('#pick-'+key);el.setAttribute('aria-pressed',String(key===chosen));el.dataset.player=String(key===selectedStyle());el.dataset.cpu=String(key===selectedStyle(true));}
 $('#selection-prompt').textContent=(selectSeat==='p'?'1P':'CPU')+' のキャラクターを選択';$('#move-style').textContent=f.art;$('#move-normal').textContent='通常：'+f.normal;$('#move-strong').textContent='長押し：'+f.strong;
}
function chooseFighter(key){if(!roster[key])return;selectionTimes[selectSeat]=elapsed;$(selectSeat==='p'?'#character':'#cpu-character').value=key;refreshRoster();window.SkyAudio?.unlock();sfx('ui');}

function makeFighter(cpu){const style=selectedStyle(cpu);return{style,throwTime:0,x:cpu?810:470,y:475,vx:0,vy:0,face:cpu?-1:1,cpu,damage:0,stocks:3,jumps:0,ground:true,stun:0,inv:0,respawn:0,cool:0,specialCool:0,attackTime:0,attackKind:'',hit:new Set(),guard:false,shield:100,aiWait:0,aiJump:0,recovery:false,walk:0,koFlash:0,ledge:0,ledgeCool:0,drop:0,power:0,attackDir:0,dodge:0,dodgeCool:0,charge:0,charging:false,smash:0};}
let tutorial=null;
const lessons=[
 ['左右に動こう','A / D・← / →、スマホは左側をスライド。左右それぞれへ移動しよう。'],
 ['空中でもう一度ジャンプ','Space / W / ↑、スマホは ↑。着地する前にもう一度押そう。'],
 ['通常攻撃を当てよう','相手に近づいて J を短押し。スマホは「攻撃」をタップ。'],
 ['溜め攻撃を当てよう','地上で J または「攻撃」を長押しして離そう。少し溜めて相手に当てよう。'],
 ['相手を場外へ','ダメージが高いほど遠くへ飛ぶ。90%の相手を攻撃して場外へ押し出そう。']
];
function tutorialPanel(){if(!tutorial)return;$('#lesson-title').textContent=`${tutorial.step+1} / ${lessons.length}　${lessons[tutorial.step][0]}`;$('#lesson-copy').textContent=lessons[tutorial.step][1]+(tutorial.step===2?' 技：'+roster[fighters[0].style].normal:tutorial.step===3?' 技：'+roster[fighters[0].style].strong:'');$('#lesson-feedback').textContent='';}
function tutorialSetup(){resetInput();fighters=[makeFighter(false),makeFighter(true)];const [p,c]=fighters;p.x=tutorial.step>=2?640:470;c.x=tutorial.step===4?940:690;p.y=c.y=477;c.damage=tutorial.step===4?90:0;particles=[];shots=[];items=[];impacts=[];freeze=0;shake=0;tutorial.left=0;tutorial.right=0;tutorial.lastX=p.x;tutorial.hit=false;tutorial.double=false;tutorial.ko=false;tutorial.pending=0;tutorialPanel();updateHUD();}
function tutorialTick(dt){if(!tutorial)return;const t=tutorial,p=fighters[0];if(t.pending>0){t.pending-=dt;if(t.pending<=0){if(t.step===lessons.length-1){state='training-complete';resetInput();$('#tutorial-panel').classList.add('hidden');$('#touch-controls').classList.add('hidden');$('#tutorial-done').classList.remove('hidden');audioScene('result');}else{t.step++;tutorialSetup();}}return;}
 const dx=p.x-t.lastX;t.lastX=p.x;if(p.stun<=0){if(dx<0)t.left-=dx;else t.right+=dx;}
 const done=t.step===0?t.left>=60&&t.right>=60:t.step===1?t.double:t.step===4?t.ko:t.hit;
 if(done){t.pending=.85;$('#lesson-feedback').textContent='クリア！';sfx('pickup');}
}
function tutorialRescue(f){const cpu=f.cpu;Object.assign(f,makeFighter(cpu));f.x=cpu?(tutorial.step===4?940:710):640;f.y=477;if(cpu&&tutorial.step===4)f.damage=90;if(!cpu){tutorial.lastX=f.x;$('#lesson-feedback').textContent='大丈夫。何度でも練習できます。';}}
function beginTutorial(){start(true);}

function start(training=false){refreshRoster();tutorial=training===true?{step:0}:null;$('#tutorial-done').classList.add('hidden');$('#tutorial-panel').classList.add('hidden');window.SkyAudio?.unlock();audioScene('battle');level=$('#difficulty').value;fighters=[makeFighter(false),makeFighter(true)];particles=[];shots=[];items=[];impacts=[];itemClock=8;eventClock=0;stats={damage:0,kos:0};time=180;countdown=3;freeze=0;state='countdown';resetInput();['menu','result','pause-screen'].forEach(id=>$('#'+id).classList.add('hidden'));$('#hud').classList.remove('hidden');$('#touch-controls').classList.remove('hidden');updateHUD();if(tutorial){state='play';announcementTime=0;$('#announcement').textContent='';$('#tutorial-panel').classList.remove('hidden');tutorialSetup();}}
function menu(){tutorial=null;$('#tutorial-panel').classList.add('hidden');$('#tutorial-done').classList.add('hidden');audioScene('menu');state='menu';resetInput();$('#menu').classList.remove('hidden');['result','pause-screen','hud','touch-controls'].forEach(id=>$('#'+id).classList.add('hidden'));$('#announcement').textContent='';}
let beforePause='play';function pause(){if(state==='play'||state==='countdown'){beforePause=state;state='paused';audioScene('paused');resetInput();$('#pause-screen').classList.remove('hidden');}else if(state==='paused'){state=beforePause;window.SkyAudio?.unlock();audioScene('battle');$('#pause-screen').classList.add('hidden');}}
function resetInput(){resetSimpleControls();for(const f of fighters){f.charging=false;f.charge=0;}Object.keys(keys).forEach(k=>keys[k]=false);pointers.clear();heldCodes.clear();document.querySelectorAll('.held').forEach(e=>e.classList.remove('held'));}
function announce(text,t=1){$('#announcement').textContent=text;announcementTime=t;}
function burst(x,y,color,n=15,power=6){for(let i=0;i<n;i++)particles.push({x,y,vx:rand(-power,power),vy:rand(-power,power),life:rand(.2,.6),max:.6,color,size:rand(2,6)});if(particles.length>400)particles.splice(0,particles.length-400);}
function jump(f){if(f.respawn>0||f.stun>0||f.guard)return;if(f.ledge){f.ledge=0;f.ledgeCool=1;f.jumps=0;}if(f.jumps<2){f.vy=(f.jumps===0?-12.4:-11.3)*roster[f.style].jump;f.jumps++;if(tutorial&&!f.cpu&&f.jumps===2)tutorial.double=true;f.ground=false;burst(f.x,f.y+27,f.cpu?'#ccc0b5':'#bbcacf',10,3);sfx(f.jumps===1?'jump':'doubleJump');return true;}return false;}
function attack(f,special=false){if(f.charging)return;if(f.respawn>0||f.stun>0||f.guard||f.cool>0)return;f.smash=0;if(!f.cpu){const opponent=fighters[1];if(opponent.respawn<=0&&Math.abs(opponent.x-f.x)>6)f.face=Math.sign(opponent.x-f.x);}if(special){if(f.specialCool>0)return;f.attackKind='special';f.attackTime=.36;f.cool=.52;f.specialCool=1.35;f.hit.clear();shots.push({x:f.x+f.face*30,y:f.y-3,vx:f.face*10.5,life:1.1,owner:f});if(!f.ground&&!f.recovery){f.vy=-10;f.recovery=true;}sfx('special');}else{f.attackKind='normal';f.attackDir=f.cpu?(fighters[0].y<f.y-45?-1:0):keys.up?-1:keys.down?1:0;f.attackTime=.25;f.cool=roster[f.style].cool;f.hit.clear();sfx('slash');}}
function strike(a,b,power,dx,vertical=0){power*=a.power>0?1.45:1;if(b.inv>0||b.respawn>0)return;if(b.guard){b.shield=Math.max(0,b.shield-24);b.vx+=Math.sign(dx)*2;burst(b.x,b.y,'#c5d3d7',9,3);sfx('guard');if(b.shield<=0){b.stun=1.3;b.guard=false;sfx('break');announce('GUARD BREAK',.6);}return;}if(tutorial&&!a.cpu&&((tutorial.step===2&&a.smash===0)||(tutorial.step===3&&a.smash>=.35)))tutorial.hit=true;b.damage=Math.min(999,b.damage+power);if(!a.cpu)stats.damage+=power;const profile=roster[a.style];let kb=4.2+b.damage*.095+power*.13;b.vx=Math.sign(dx||a.face)*kb;b.vy=-(4.6+b.damage*.044+power*.09);if(vertical<0){b.vx*=.35;b.vy*=1.55;}if(vertical>0&&!a.ground){b.vx*=.45;b.vy=Math.abs(b.vy)*1.3;}if(profile.kind==='throw'){b.throwTime=.3;b.vx=Math.sign(dx||a.face)*kb*(a.smash>.2?-1.15:1);b.vy=-(a.smash>.2?12:7);b.x=a.x+(a.smash>.2?-a.face:a.face)*35;}else if(a.style==='boxing'&&a.smash>.2){b.vx*=.5;b.vy*=1.6;}b.ledge=0;b.ledgeCool=1;b.attackTime=0;b.charging=false;b.charge=0;b.smash=0;b.stun=.22+Math.min(.48,b.damage*.0025);b.inv=.17;b.ground=false;b.guard=false;freeze=Math.max(freeze,clamp(.065+power*.002,.08,.135));shake=8+Math.min(10,power*.25);impacts.push({x:b.x,y:b.y-20,life:.22,max:.22,dir:Math.sign(dx||a.face),heavy:power>=20});burst(b.x,b.y,a.cpu?'#ccc0b6':'#b6c7cc',23,8);sfx('hit',{strength:Math.min(1.5,.85+power/32)});}
function releaseSmash(f){if(!f.charging)return;const force=f.charge;f.charging=false;f.charge=0;if(f.stun>0||f.respawn>0)return;f.cool=0;attack(f);f.smash=force;f.attackTime=.32;f.cool=.65;burst(f.x+f.face*30,f.y-20,'#ccc3b6',18,5);sfx('smash');}
function cpuInput(f,p,dt){if(tutorial){f.guard=false;if(f.stun<=0)f.vx*=.8;return;}const dx=p.x-f.x,dy=p.y-f.y;f.aiWait-=dt;f.aiJump-=dt;f.guard=false;if(f.stun>0||f.respawn>0)return;const speed=level==='easy'?3.2:level==='hard'?5:4.3;
 let target=p.x;if(f.x<310||f.x>970||f.y>530)target=640;
 const dist=target-f.x; if(Math.abs(dist)>Math.min(58,roster[f.style].range-14)){f.vx+=(Math.sign(dist)*speed-f.vx)*.16;f.face=Math.sign(dist);}else{f.vx*=.8;f.face=dx>=0?1:-1;}
 if((f.y>520||f.x<280||f.x>1000)&&f.vy>0){if(f.jumps<2)jump(f);else if(!f.recovery)attack(f,true);}
 if(f.aiJump<=0&&((dy<-65&&Math.abs(dx)<250)||(Math.abs(dx)<170&&Math.random()<dt*.6))){jump(f);f.aiJump=level==='easy'?1.4:.6;}
 if(level!=='easy'&&p.attackTime>0&&Math.abs(dx)<110&&Math.abs(dy)<70&&f.shield>25&&f.ground){f.guard=true;f.vx*=.8;}
 if(f.aiWait<=0){if(Math.abs(dx)<roster[f.style].range&&Math.abs(dy)<65){if(Math.random()<.22&&f.cool<=0){f.charging=true;f.charge=.65;releaseSmash(f);}else attack(f);}f.aiWait=level==='easy'?.65:level==='hard'?.15:.33;}
}
function step(dt){elapsed+=dt;if(state==='paused'||state==='result'||state==='menu'||state==='training-complete')return;
 if(announcementTime>0){announcementTime-=dt;if(announcementTime<=0)$('#announcement').textContent='';}
 if(state==='countdown'){const old=Math.ceil(countdown);countdown-=dt;let n=Math.ceil(countdown);$('#announcement').textContent=n>0?n:'GO!';if(n!==old)sfx(n>0?'count':'go');if(countdown<=0){state='play';announce('GO!',.6);}return;}
 if(freeze>0){freeze-=dt;return;}for(const h of impacts)h.life-=dt;impacts=impacts.filter(h=>h.life>0);if(!tutorial)time=Math.max(0,time-dt);eventClock+=dt;if(!tutorial)itemClock-=dt;if(itemClock<=0){items.push({x:rand(400,880),y:70,vy:0,kind:Math.random()<.5?'heal':'power',life:14});itemClock=12;}for(const p of platforms)p.prevY=p.y;platforms[1].y=375+Math.sin(eventClock*.55)*22;platforms[2].y=375-Math.sin(eventClock*.55)*22;shake=Math.max(0,shake-30*dt);
 if(attackStarted!==null)attackHeld+=dt;for(const f of fighters){f.throwTime=Math.max(0,f.throwTime-dt);f.dodge=Math.max(0,f.dodge-dt);f.dodgeCool=Math.max(0,f.dodgeCool-dt);if(f.ground)for(const p of platforms)if(Math.abs(f.y+28-p.prevY)<1&&f.x>p.x-17&&f.x<p.x+p.w+17)f.y+=p.y-p.prevY;f.ledgeCool=Math.max(0,f.ledgeCool-dt);f.drop=Math.max(0,f.drop-dt);f.power=Math.max(0,f.power-dt);f.cool=Math.max(0,f.cool-dt);f.specialCool=Math.max(0,f.specialCool-dt);f.inv=Math.max(0,f.inv-dt);f.stun=Math.max(0,f.stun-dt);f.attackTime=Math.max(0,f.attackTime-dt);
 if(f.respawn>0){if(!f.cpu){jumpBuffer=0;attackBuffer=0;}f.respawn-=dt;if(f.respawn<=0){f.x=f.cpu?760:520;f.y=110;f.vx=0;f.vy=0;f.inv=2.4;f.jumps=0;f.recovery=false;f.stun=0;}continue;}
 if(!f.cpu){if(jumpBuffer>0){if(jump(f))jumpBuffer=0;else jumpBuffer=Math.max(0,jumpBuffer-dt);}if(attackBuffer>0){if(f.cool<=0&&f.stun<=0&&!f.charging){attack(f);attackBuffer=0;}else attackBuffer=Math.max(0,attackBuffer-dt);}}if(f.ledge){f.ledge-=dt;f.vx=0;f.vy=0;if(f.cpu||(!f.cpu&&(keys.jump||keys.up||keys.attack))||f.ledge<=0){f.x=f.x<640?310:970;f.y=477;f.ledge=0;f.ledgeCool=1;f.inv=.45;f.ground=true;}else if(!f.cpu&&keys.down){f.ledge=0;f.ledgeCool=1;}else continue;}
 if(f.cpu)cpuInput(f,fighters[0],dt);else{f.guard=keys.guard&&f.shield>0&&f.stun<=0&&f.ground;if(f.stun<=0){let dir=heldCodes.has('KeyA')||heldCodes.has('ArrowLeft')||heldCodes.has('KeyD')||heldCodes.has('ArrowRight')?Number(keys.right)-Number(keys.left):stickAxis;if(keys.guard&&dir&&f.dodgeCool<=0){f.dodge=.25;f.dodgeCool=.9;f.inv=Math.max(f.inv,.25);f.vx=dir*9;f.guard=false;}if(f.dodge>0){f.guard=false;}else if(!f.guard){if(keys.charge&&attackHeld>=.18&&f.cool<=0&&f.ground){f.charging=true;f.charge=Math.min(1.2,f.charge+dt);}if(f.charging){f.vx*=.7;if(!keys.charge)releaseSmash(f);}else f.vx+=(dir*roster[f.style].speed-f.vx)*(f.ground?.23:.1);if(dir&&f.attackTime<=0&&!f.charging)f.face=Math.sign(dir);if(keys.attack)attack(f);if(keys.special)attack(f,true);}else f.vx*=.75;}}
 if(f.guard){f.shield=Math.max(0,f.shield-dt*28);if(f.shield===0){f.guard=false;f.stun=1.3;sfx('break');announce('GUARD BREAK',.6);}}else f.shield=Math.min(100,f.shield+dt*19);
 if(!f.cpu&&keys.down&&f.stun<=0){if(f.ground&&f.y<460){f.drop=.22;f.y+=8;f.ground=false;}else if(f.vy>0)f.vy=Math.max(13,f.vy);}
 const oldFeet=f.y+28;f.vy=Math.min(17,f.vy+.49);f.x+=f.vx;f.y+=f.vy;f.ground=false;
 for(const p of platforms){if(!(p!==platforms[0]&&f.drop>0)&&f.vy>=0&&oldFeet<=p.y+5&&f.y+28>=p.y&&f.x+17>p.x&&f.x-17<p.x+p.w){f.y=p.y-28;f.vy=0;f.ground=true;f.jumps=0;f.recovery=false;break;}}
 if(!f.ground&&f.vy>0&&f.stun<=0&&f.ledgeCool<=0&&f.y>475&&f.y<548&&!(!f.cpu&&keys.down)){for(const edge of [290,990]){if(Math.abs(f.x-edge)<24){f.x=edge+(edge<640?-15:15);f.y=523;f.ledge=1.2;f.inv=.55;f.jumps=0;f.recovery=false;burst(edge,505,'#c9d6da',8,2);break;}}}
 if(f.charging&&(!f.ground||f.stun>0)){f.charging=false;f.charge=0;}if(f.stun>0)f.vx*=f.ground?.92:.993;if(!f.ground&&f.jumps===0)f.jumps=1;f.walk+=Math.abs(f.vx)*dt*2;
 if(f.attackTime>.04&&f.attackKind==='normal'){const b=fighters[f.cpu?0:1];if(!f.hit.has(b)&&(f.attackDir===-1?Math.abs(b.x-f.x)<62&&b.y-f.y>-130&&b.y-f.y<5:f.attackDir===1?Math.abs(b.x-f.x)<75&&b.y-f.y>-25&&b.y-f.y<100:Math.abs(b.y-f.y)<58&&(b.x-f.x)*f.face>-12&&(b.x-f.x)*f.face<roster[f.style].range+(f.smash>.2?12:0))){f.hit.add(b);strike(f,b,roster[f.style].power+(f.attackDir?2:0)+f.smash*16,f.face,f.attackDir);}}
 if(f.x<-130||f.x>W+130||f.y>H+140||f.y<-230){if(tutorial){if(f.cpu&&tutorial.step===4)tutorial.ko=true;tutorialRescue(f);continue;}f.stocks--;f.damage=0;f.respawn=1.35;f.vx=0;f.vy=0;shake=18;if(f.cpu)stats.kos++;burst(clamp(f.x,30,W-30),clamp(f.y,30,H-30),f.cpu?'#cdc2b7':'#b5c6cc',65,15);sfx('ko');announce(f.cpu?'KO':'ストック −1',.85);if(f.stocks<=0){finish();return;}}
 }
 for(const item of items){item.life-=dt;const feet=item.y+12;item.vy=Math.min(8,item.vy+.25);item.y+=item.vy;for(const p of platforms)if(item.vy>=0&&feet<=p.y+5&&item.y+12>=p.y&&item.x>p.x&&item.x<p.x+p.w){item.y=p.y-12;item.vy=0;break;}for(const f of fighters)if(f.respawn<=0&&Math.abs(f.x-item.x)<36&&Math.abs(f.y-item.y)<60&&item.life>0){if(item.kind==='heal')f.damage=Math.max(0,f.damage-25);else f.power=8;item.life=0;burst(item.x,item.y,'#cac1b3',20,5);sfx('pickup');announce(item.kind==='heal'?'HEAL −25%':'POWER UP!',.7);}}items=items.filter(i=>i.life>0);
 for(const s of shots){s.x+=s.vx;s.life-=dt;const b=fighters[s.owner.cpu?0:1];if(s.life>0&&b.respawn<=0&&Math.abs(s.x-b.x)<29&&s.y>b.y-69&&s.y<b.y+29){strike(s.owner,b,15,s.vx);s.life=0;burst(s.x,s.y,'#c6d3d7',12,5);}}
 shots=shots.filter(s=>s.life>0&&s.x>-150&&s.x<W+150);
 for(const p of particles){p.x+=p.vx;p.y+=p.vy;p.vy+=.12;p.life-=dt;}particles=particles.filter(p=>p.life>0);
 if(time<=0&&!tutorial)finish();tutorialTick(dt);updateHUD();
}
function finish(){state='result';resetInput();const [p,c]=fighters;const score=p.stocks-c.stocks;const win=score>0||(score===0&&p.damage<c.damage),draw=score===0&&p.damage===c.damage;$('#result-title').textContent=draw?'DRAW':win?'YOU WIN!':'DEFEAT';$('#result-label').textContent=draw?'EVENLY MATCHED':win?'RESULT':'RESULT';$('#result-copy').textContent=draw?'引き分け':win?'勝利':'敗北';$('#stat-damage').textContent=Math.round(stats.damage)+'%';$('#stat-ko').textContent=stats.kos;$('#result').classList.remove('hidden');$('#touch-controls').classList.add('hidden');$('#announcement').textContent='';updateHUD();audioScene('result');sfx(win?'win':'lose');}
function updateHUD(){fighters.forEach((f,i)=>{const pre=i?'c':'p';$('#'+pre+'-damage').textContent=Math.floor(f.damage);$('#'+pre+'-damage').style.color=f.damage>=100?'#c8bcb0':f.damage>=60?'#c9c0b2':'';$('#'+pre+'-stock').textContent='◆'.repeat(Math.max(0,f.stocks))+'◇'.repeat(3-Math.max(0,f.stocks));});const seconds=Math.ceil(time);$('#timer').textContent=tutorial?'練習':Math.floor(seconds/60)+':'+String(seconds%60).padStart(2,'0');}
function rr(x,y,w,h,r,fill){ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fillStyle=fill;ctx.fill();}
function ellipse(x,y,rx,ry,color){ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();}
function poly(points,color){ctx.beginPath();points.forEach(([x,y],i)=>i?ctx.lineTo(x,y):ctx.moveTo(x,y));ctx.closePath();ctx.fillStyle=color;ctx.fill();}
function drawImpacts(){for(const h of impacts){const t=1-h.life/h.max,r=(h.heavy?78:56)*(1+t*.65);ctx.save();ctx.translate(h.x,h.y);ctx.scale(h.dir,1);ctx.globalAlpha=1-t;ctx.rotate(-.25);poly([[-r*.8,-7],[-20,-14],[-12,-r*.75],[7,-20],[r,-9],[24,8],[r*.5,r*.45],[4,20],[-14,r*.6],[-22,12]],'#312d26');poly([[-r*.7,-3],[-12,-9],[-8,-r*.6],[9,-10],[r*.85,-4],[17,6],[r*.35,r*.3],[0,11],[-10,r*.4],[-13,5]],'#e1bd66');ellipse(0,0,18*(1-t)+3,11*(1-t)+3,'#fff4da');ctx.restore();}}
function background(){
 const sky=ctx.createLinearGradient(0,-100,0,650);sky.addColorStop(0,'#163d78');sky.addColorStop(.6,'#e46d43');sky.addColorStop(1,'#ffbd59');ctx.fillStyle=sky;ctx.fillRect(-1000,-1000,3300,2800);ellipse(960,240,67,67,'#ffd174');
 for(let i=0;i<14;i++){const x=i*112-120,h=130+(i*71)%180;ctx.fillStyle=i%2?'#384266':'#454365';ctx.fillRect(x,430-h,90,h+250);ctx.fillRect(x+25,410-h,40,20);for(let row=0;row<8;row++)for(let col=0;col<3;col++){ctx.fillStyle=(row+col+i)%3?'#f1ae5b':'#555a76';ctx.fillRect(x+12+col*25,450-h+row*29,10,13);}}
 // Brick warehouses, rooftop railings and hanging cables establish the district.
 for(const [x,w,col] of [[-160,370,'#7a4245'],[1030,390,'#2d526b']]){rr(x,285,w,700,0,col);rr(x-8,278,w+16,15,2,'#23344b');for(let y=307;y<730;y+=30){ctx.strokeStyle='#202e4338';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+w,y);ctx.stroke();}for(let j=0;j<3;j++){rr(x+28+j*105,324,65,110,3,'#172e48');rr(x+34+j*105,330,53,66,1,'#dd9156');rr(x+58+j*105,330,5,100,0,'#2e3d51');}}
 ctx.strokeStyle='#1c2f48';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-100,185);ctx.quadraticCurveTo(620,350,1400,170);ctx.stroke();
 rr(50,360,130,57,4,'#192c48');ctx.fillStyle='#ffcd59';ctx.font='900 25px sans-serif';ctx.textAlign='center';ctx.fillText('ARCADE',115,397);rr(1080,335,105,112,4,'#d13c45');ctx.fillStyle='#fff1bd';ctx.font='900 23px sans-serif';ctx.fillText('港',1132,376);ctx.fillText('通り',1132,408);
 ctx.fillStyle='#243b52';ctx.fillRect(-1000,620,3300,2200);for(let i=0;i<9;i++){poly([[i*190-300,620],[i*260-500,1200],[i*260-498,1200],[i*190-298,620]],'#496077');}ctx.fillStyle='#182b40';ctx.fillRect(-1000,620,3300,12);
}
function stage(){
 ellipse(640,654,320,23,'#13273b80');
 // Raised demolition deck: the original ring-out boundaries stay intact.
 poly([[290,505],[990,505],[970,547],[310,547]],'#182b40');rr(290,504,700,35,3,'#4b6074');rr(290,496,700,10,2,'#b2bdc4');rr(300,498,680,3,1,'#e4e9e8');
 ctx.save();ctx.beginPath();ctx.rect(290,517,700,14);ctx.clip();ctx.fillStyle='#e5ac37';ctx.fillRect(290,517,700,14);for(let i=0;i<35;i++)poly([[280+i*24,517],[292+i*24,517],[306+i*24,531],[294+i*24,531]],'#233047');ctx.restore();
 for(const x of [330,880]){poly([[x,539],[x+50,539],[x+34,610],[x+12,610]],'#24374c');rr(x-2,603,56,10,2,'#52667b');}for(let i=0;i<8;i++)ellipse(320+i*90,512,3,3,'#182b40');
 for(let i=1;i<platforms.length;i++){const p=platforms[i];rr(p.x,p.y-5,p.w,20,3,'#20344b');rr(p.x-3,p.y-7,p.w+6,7,2,'#c2ced1');rr(p.x+8,p.y+2,p.w-16,8,1,i===3?'#d6443b':'#237fbb');for(let j=0;j<3;j++)ellipse(p.x+25+j*50,p.y+6,2,2,'#e9ddbc');}
}
function fighter(f,hero=false){
 if(f.respawn>0)return;ctx.save();ctx.translate(f.x,f.y);if(hero)ctx.scale(2.7,2.7);if(f.inv>0&&Math.floor(elapsed*15)%3===0)ctx.globalAlpha=.5;
 const pose=f.pose??1,rest=1-pose;const profile=roster[f.style],gi=['karate','taekwondo','judo'].includes(f.style);const appearance={boxing:['#b77b59','#dfae82','#754b39'],karate:['#d5a17d','#edc9a4','#9b6e54'],taekwondo:['#d9ad8b','#f0ceb0','#9d735b'],martial:['#c79772','#e9c2a0','#8b5d44'],judo:['#c18e68','#e2b48a','#86583e']}[f.style];const ink='#252b32',skin=appearance[0],shine=appearance[1],shadow=appearance[2],team=profile.color,dark=f.style==='boxing'?'#9e2839':f.style==='judo'?'#173b78':gi?'#b9c7d6':'#ad7b1e';
 const attacking=f.attackTime>0&&f.attackKind==='normal',phase=clamp(1-f.attackTime/(f.smash>0?.32:.25),0,1),reach=attacking?Math.sin(Math.PI*phase):0,kick=attacking&&(profile.kind==='kick'||(f.smash>.2&&['karate','martial'].includes(f.style)));const grabbing=attacking&&profile.kind==='throw';
 if(f.ground)ellipse(0,29,31,6,'#12263e65');ctx.scale(f.face,1);if(f.throwTime>0)ctx.rotate(-f.throwTime*7);const running=Math.abs(f.vx)>.7,stride=f.ground?(running?Math.sin(f.walk)*8:0):6;
 ctx.translate(reach*5-rest*5,(f.ground?Math.sin(elapsed*2.6)*.6:0)-(f.style==='martial'&&kick?reach*15:0));if(f.style==='taekwondo'&&kick)ctx.rotate(-reach*(f.smash>.2?.45:.18));ctx.rotate(f.stun>0?-.28:attacking?.1:running?.12:-.06);
 const limb=(x,y,ex,ey,color,w)=>{ctx.strokeStyle=ink;ctx.lineWidth=w+2;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(ex,ey);ctx.stroke();const grad=ctx.createLinearGradient(x-w/2,y,ex+w/2,ey);grad.addColorStop(0,ink);grad.addColorStop(.23,color);grad.addColorStop(.55,color===skin?shine:color);grad.addColorStop(1,color===skin?shadow:ink);ctx.strokeStyle=grad;ctx.lineWidth=w;ctx.stroke();};
 // Wide stance, heavyweight boots and cropped training trousers.
 limb(-10,-9,grabbing?-18+reach*44:-18-stride,grabbing?15-reach*8:15,dark,17);limb(9,-8,kick?35+reach*(profile.range-50):20+stride,kick?-23-reach*12:17,profile.cloth,18);
 rr(-31-stride,16,28,13,4,ink);rr(-28-stride,17,23,7,2,'#ece9d8');
 if(kick){rr(34+reach*(profile.range-50),-36-reach*12,16,27,4,ink);rr(36+reach*(profile.range-50),-35-reach*12,10,19,3,'#eee8d8');}else{rr(10+stride,18,30,12,4,ink);rr(12+stride,18,25,6,2,'#ece9d8');}
 // Trapezius, chest and shoulder masses are shaded as separate anatomical forms.
 poly([[-12,-69],[10,-68],[24,-55],[19,-31],[11,-11],[-15,-12],[-23,-44],[-24,-56]],ink);
 poly([[-11,-65],[8,-65],[21,-54],[16,-33],[9,-16],[-12,-16],[-19,-42],[-20,-54]],skin);
 poly([[-17,-55],[-3,-60],[0,-45],[-14,-43]],shine);poly([[2,-60],[16,-56],[17,-44],[3,-43]],shine);poly([[-12,-39],[0,-38],[-1,-19],[-10,-19]],shadow);poly([[3,-39],[13,-38],[8,-20],[2,-21]],shadow);
 // Distinct uniforms: boxing shorts, belted gi, or striped training suit.
 if(gi||f.style==='martial'){poly([[-20,-64],[-9,-70],[0,-58],[9,-69],[22,-58],[17,-16],[-17,-16]],ink);poly([[-17,-62],[-9,-66],[0,-53],[9,-65],[18,-57],[14,-18],[-14,-18]],profile.cloth);poly([[-9,-66],[5,-35],[9,-65],[3,-48]],gi?'#fff6df':'#262d35');ctx.strokeStyle=f.style==='taekwondo'?'#1678d4':'#253448';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(-9,-66);ctx.lineTo(5,-37);ctx.lineTo(9,-65);ctx.stroke();rr(-17,-19,34,7,2,'#202735');poly([[1,-14],[8,-14],[12,2],[5,0]],'#202735');}
 if(f.style==='boxing'){rr(-17,-18,34,9,2,'#fff4dd');poly([[-17,-9],[0,-9],[-5,5],[-20,3]],team);poly([[1,-9],[17,-9],[21,3],[6,5]],team);}
 // Asymmetric shoulder strap and waist sash identify each fighter at a glance.
 
 limb(-19,-52,-30,-39,gi||f.style==='martial'?profile.cloth:skin,17);limb(-30,-39,-20-rest*7,-65+rest*43,skin,12);ellipse(-19-rest*7,-66+rest*43,9,10,ink);ellipse(-19-rest*7,-67+rest*43,7,8,f.style==='boxing'?team:skin);rr(-27-rest*7,-61+rest*43,15,5,2,'#ddd9cf');
 // Smaller skull, rounded jaw and restrained facial features.
 rr(-6,-78,13,14,4,shadow);ctx.save();ctx.translate(1,-87);ctx.scale(.83,1);
 const face=ctx.createLinearGradient(-13,-10,14,10);face.addColorStop(0,shadow);face.addColorStop(.42,skin);face.addColorStop(.7,shine);face.addColorStop(1,shadow);
 ctx.beginPath();ctx.moveTo(-11,-8);ctx.bezierCurveTo(-12,-23,12,-23,13,-9);ctx.lineTo(12,3);ctx.quadraticCurveTo(9,14,2,15);ctx.quadraticCurveTo(-9,11,-10,3);ctx.closePath();ctx.fillStyle=face;ctx.fill();ctx.strokeStyle=shadow;ctx.lineWidth=1;ctx.stroke();ellipse(-10,0,3,5,skin);
 ctx.beginPath();ctx.moveTo(-11,-2);ctx.bezierCurveTo(-16,-23,14,-25,14,-10);ctx.quadraticCurveTo(5,-15,-2,-10);ctx.lineTo(-8,-8);ctx.closePath();ctx.fillStyle=f.style==='boxing'?'#46342b':'#242323';ctx.fill();
 ctx.strokeStyle='#4c352a';ctx.lineWidth=1.7;ctx.beginPath();ctx.moveTo(1,-4);ctx.lineTo(8,-3);ctx.stroke();ellipse(5,-1,2.7,1,'#eee5d5');ellipse(6,-1,1,1,'#242323');ctx.strokeStyle=shadow;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(10,4);ctx.lineTo(6,5);ctx.moveTo(2,9);ctx.quadraticCurveTo(5,10,8,8);ctx.stroke();ctx.restore();
 const hx=attacking&&!kick?25+reach*(grabbing?27:profile.range-28):26,hy=attacking&&!kick?(f.style==='boxing'&&f.smash>.2?-40-reach*50:-53-reach*5):-65+rest*44;
 limb(18,-53,attacking&&!kick?36+reach*18:32,-43,gi||f.style==='martial'?profile.cloth:skin,18);limb(attacking&&!kick?36+reach*18:32,-43,hx,hy,skin,14);ellipse(hx,hy,f.style==='boxing'?13:9,f.style==='boxing'?13:10,ink);ellipse(hx+1,hy-1,f.style==='boxing'?11:7,f.style==='boxing'?11:8,f.style==='boxing'?team:skin);if(profile.kind==='palm'||grabbing){for(let n=0;n<3;n++)rr(hx+3,hy-10+n*5,10,3,1,skin);}rr(hx-9,hy+5,17,6,2,'#f4eee2');ellipse(19,-54,9,10,shine);
 if(attacking&&reach>.25){ctx.save();ctx.globalAlpha=.8*reach;ctx.strokeStyle='#fff2bc';ctx.lineWidth=4;for(let i=0;i<3;i++){ctx.beginPath();ctx.moveTo(34,-66+i*12);ctx.lineTo((kick?75:hx)-10,-66+i*12);ctx.stroke();}ctx.restore();}ctx.restore();
 if(f.guard||f.charging){ctx.save();ctx.translate(f.x,f.y-32);ctx.strokeStyle=f.guard?'#76d4ff':'#ffcd34';ctx.lineWidth=4;ctx.beginPath();ctx.arc(0,0,51,-Math.PI/2,f.guard?Math.PI*1.5:-Math.PI/2+Math.PI*2*f.charge/1.2);ctx.stroke();ctx.restore();}
 if(!hero&&!f.preview){ctx.fillStyle=team;ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(f.x-6,f.y-122);ctx.lineTo(f.x+6,f.y-122);ctx.lineTo(f.x,f.y-114);ctx.closePath();ctx.stroke();ctx.fill();}
}

function render(){const d=view.d||1;ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,view.width,view.height);ctx.save();ctx.translate(view.x,view.y);ctx.scale(view.s,view.s);ctx.translate(-W/2,-H/2);if(shake>0&&state==='play')ctx.translate(rand(-shake,shake)*.5,rand(-shake,shake)*.5);background();stage();for(const item of items){ctx.save();ctx.translate(item.x,item.y);ctx.rotate(Math.sin(elapsed*3)*.2);ctx.shadowColor=item.kind==='heal'?'#abbfc5':'#bdb1a0';ctx.shadowBlur=24;poly([[0,-18],[16,0],[0,18],[-16,0]],item.kind==='heal'?'#abbfc5':'#bdb1a0');ctx.fillStyle='#2e2823';ctx.font='bold 22px sans-serif';ctx.textAlign='center';ctx.fillText(item.kind==='heal'?'+':'ϟ',0,8);ctx.restore();}
 if(state==='menu'){const hero=makeFighter(false);hero.x=900;hero.y=394;hero.walk=elapsed;fighter(hero,true);ellipse(895,495,85,9,'#22292b45');}else{for(const f of fighters)fighter(f);drawImpacts();for(const s of shots){const color=s.owner.cpu?'#cdc2b7':'#b7c8cd';ctx.save();ctx.shadowBlur=20;ctx.shadowColor=color;ellipse(s.x,s.y,22,10,color);ellipse(s.x-s.vx,s.y,17,5,'#cad6da90');ctx.restore();}for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);rr(p.x,p.y,p.size,p.size,1,p.color);}ctx.globalAlpha=1;
 for(const f of fighters){if(f.respawn>0)continue;const minX=Math.max(25,640-view.width/(2*view.s)+25),maxX=Math.min(1255,640+view.width/(2*view.s)-25);if(f.x<minX||f.x>maxX||f.y<0){let x=clamp(f.x,minX,maxX),y=clamp(f.y,140,650);ellipse(x,y,20,20,'#21292ccc');ctx.fillStyle=f.cpu?'#cdc2b7':'#b7c8cd';ctx.textAlign='center';ctx.font='bold 15px sans-serif';ctx.fillText(f.x<minX?'◀':f.x>maxX?'▶':'▲',x,y+5);}}}
 ctx.restore();}

function renderSelection(){if(state!=='menu')return;const old=ctx;try{for(const seat of ['p','c']){const preview=$('#preview-'+seat),box=preview.getBoundingClientRect();if(!box.width||!box.height)continue;const d=Math.min(devicePixelRatio||1,2),w=Math.round(box.width*d),h=Math.round(box.height*d);if(preview.width!==w||preview.height!==h){preview.width=w;preview.height=h;}ctx=preview.getContext('2d');ctx.setTransform(d,0,0,d,0,0);ctx.clearRect(0,0,box.width,box.height);const scale=box.height/145;ctx.translate(box.width/2,box.height*.78);ctx.scale(scale,scale);const f=makeFighter(seat==='c');f.x=0;f.y=0;f.face=seat==='c'?-1:1;f.ground=true;const t=clamp((elapsed-selectionTimes[seat])/.65,0,1);f.pose=1-Math.pow(1-t,3);f.preview=true;fighter(f);}}finally{ctx=old;}}

function frame(ts){let dt=Math.min(.05,(ts-last)/1000||0);last=ts;acc+=dt;while(acc>=1/60){step(1/60);acc-=1/60;}render();renderSelection();requestAnimationFrame(frame);}
const mapping={KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right',KeyW:'jump',ArrowUp:'jump',Space:'jump',KeyJ:'attack'};
const pointers=new Map(),heldCodes=new Set();
let stickAxis=0,stickId=null,stickOrigin=0,attackStarted=null,attackPointer=null,jumpBuffer=0,attackBuffer=0,attackHeld=0;
const moveZone=$('#move-zone'),stick=$('#stick'),knob=$('#stick-knob'),attackButton=$('#simple-attack');
function resetSimpleControls(){jumpBuffer=0;attackBuffer=0;attackHeld=0;stickAxis=0;stickId=null;attackStarted=null;attackPointer=null;stick.classList.add('hidden');attackButton.classList.remove('held');}
function setKey(k,down){const was=keys[k];keys[k]=down;if(down&&!was&&k==='jump'&&state==='play'){jumpBuffer=.14;if(jump(fighters[0]))jumpBuffer=0;}}
function attackPress(){if(state!=='play'||attackStarted!==null)return;window.SkyAudio?.unlock();attackStarted=performance.now();attackHeld=0;attackBuffer=0;keys.charge=true;attackButton.classList.add('held');}
function attackRelease(cancel=false){if(attackStarted===null)return;const held=attackHeld*1000;attackStarted=null;keys.charge=false;attackButton.classList.remove('held');const f=fighters[0];if(!f)return;if(cancel||state!=='play'){attackBuffer=0;f.charging=false;f.charge=0;return;}if(held>=220&&f.charging){releaseSmash(f);}else{f.charging=false;f.charge=0;attackBuffer=.18;if(f.cool<=0&&f.stun<=0&&f.respawn<=0){attack(f);attackBuffer=0;}} }
moveZone.addEventListener('pointerdown',e=>{if(state!=='play'||stickId!==null)return;e.preventDefault();moveZone.setPointerCapture(e.pointerId);stickId=e.pointerId;stickOrigin=e.clientX;stickAxis=0;const r=moveZone.getBoundingClientRect();stick.style.left=(e.clientX-r.left)+'px';stick.style.top=(e.clientY-r.top)+'px';knob.style.transform='translate(-50%,-50%)';stick.classList.remove('hidden');});
moveZone.addEventListener('pointermove',e=>{if(e.pointerId!==stickId)return;e.preventDefault();const raw=e.clientX-stickOrigin;if(Math.abs(raw)>38){stickOrigin=e.clientX-Math.sign(raw)*38;stick.style.left=(stickOrigin-moveZone.getBoundingClientRect().left)+'px';}const dx=clamp(e.clientX-stickOrigin,-38,38);stickAxis=Math.abs(dx)<=6?0:Math.sign(dx)*Math.min(1,Math.sqrt((Math.abs(dx)-6)/22));knob.style.transform=`translate(calc(-50% + ${dx}px),-50%)`;});
function endStick(e){if(e.pointerId===stickId){stickId=null;stickAxis=0;stick.classList.add('hidden');}}
['pointerup','pointercancel','lostpointercapture'].forEach(ev=>moveZone.addEventListener(ev,endStick));
attackButton.addEventListener('pointerdown',e=>{if(attackPointer!==null)return;e.preventDefault();attackButton.setPointerCapture(e.pointerId);attackPointer=e.pointerId;attackPress();});
attackButton.addEventListener('pointerup',e=>{if(e.pointerId!==attackPointer)return;attackPointer=null;attackRelease();});
['pointercancel','lostpointercapture'].forEach(ev=>attackButton.addEventListener(ev,e=>{if(e.pointerId!==attackPointer)return;attackPointer=null;attackRelease(true);}));
document.querySelectorAll('[data-key]').forEach(btn=>{btn.addEventListener('pointerdown',e=>{e.preventDefault();btn.setPointerCapture(e.pointerId);pointers.set(e.pointerId,btn.dataset.key);setKey(btn.dataset.key,true);btn.classList.add('held');});const release=e=>{pointers.delete(e.pointerId);const still=[...pointers.values()].includes(btn.dataset.key)||[...heldCodes].some(c=>mapping[c]===btn.dataset.key);setKey(btn.dataset.key,still);if(!still)btn.classList.remove('held');};['pointerup','pointercancel','lostpointercapture'].forEach(ev=>btn.addEventListener(ev,release));});
window.addEventListener('keydown',e=>{if(e.target instanceof HTMLSelectElement||e.target?.tagName==='INPUT')return;if(e.code==='Escape'){e.preventDefault();if(!e.repeat)pause();return;}const k=mapping[e.code];if(!k)return;e.preventDefault();if(e.repeat)return;heldCodes.add(e.code);if(k==='attack')attackPress();else setKey(k,true);});
window.addEventListener('keyup',e=>{const k=mapping[e.code];if(!k)return;e.preventDefault();heldCodes.delete(e.code);if(k==='attack')attackRelease();else setKey(k,[...heldCodes].some(c=>mapping[c]===k)||[...pointers.values()].includes(k));});
window.addEventListener('blur',()=>{heldCodes.clear();if(state==='play'||state==='countdown')pause();});document.addEventListener('visibilitychange',()=>{if(document.hidden&&(state==='play'||state==='countdown'))pause();});
$('#tutorial-start').onclick=beginTutorial;$('#tutorial-exit').onclick=menu;$('#tutorial-retry').onclick=beginTutorial;$('#tutorial-battle').onclick=()=>start();$('#tutorial-home').onclick=menu;$('#start').onclick=start;$('#rematch').onclick=start;$('#pause').onclick=pause;$('#resume').onclick=pause;$('#back-menu').onclick=menu;$('#result-menu').onclick=menu;
$('#sound').onclick=()=>{sound=!sound;window.SkyAudio?.setEnabled(sound);if(sound){window.SkyAudio?.unlock();audioScene(state==='menu'?'menu':state==='paused'?'paused':state==='result'?'result':'battle');}$('#sound').textContent='音 '+(sound?'ON':'OFF');$('#sound').setAttribute('aria-label',sound?'サウンドをオフにする':'サウンドをオンにする');};
const volume=()=>{window.SkyAudio?.setVolumes(Number($('#music-volume').value)/100,Number($('#sfx-volume').value)/100);};
$('#music-volume').oninput=volume;$('#sfx-volume').oninput=volume;
volume();
for(const key of Object.keys(roster))$('#pick-'+key).onclick=()=>chooseFighter(key);for(const seat of ['p','c'])$('#seat-'+seat).onclick=()=>{selectSeat=seat;refreshArcade();sfx('ui');};$('#character').onchange=refreshRoster;$('#cpu-character').onchange=refreshRoster;refreshRoster();

resize();requestAnimationFrame(frame);
})();




