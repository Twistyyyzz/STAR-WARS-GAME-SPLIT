const canvas=document.getElementById('gameCanvas'),ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id);
let W,H;
function resize(){W=canvas.width=innerWidth;H=canvas.height=innerHeight;player.y=Math.min(player.y||H/2,H-80)} addEventListener('resize',resize);

const ui={score:$('score'),high:$('highScore'),combo:$('combo'),missed:$('missed'),shield:$('shield'),health:$('health'),special:$('special')};
let settings={difficulty:'easy',weapon:'double',map:'milkyway',skin:'xwing',music:'industrial'};
document.querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{document.querySelectorAll(`[data-group="${b.dataset.group}"]`).forEach(x=>x.classList.remove('active'));b.classList.add('active');settings[b.dataset.group]=b.dataset.value});

let audio=null,musicTimer=null,isPlaying=false,last=0,enemyClock=0,bossClock=0,shake=0;
const keys={}; addEventListener('keydown',e=>{keys[e.code]=true;if(e.code==='Space'&&!e.repeat&&isPlaying)shoot();if(e.code==='ShiftLeft'||e.code==='ShiftRight')dash();if(e.code==='KeyE'&&!e.repeat&&isPlaying)specialAttack()});
addEventListener('keyup',e=>keys[e.code]=false);
canvas.onpointerdown=()=>{if(isPlaying)shoot()};

const player={x:100,y:300,w:74,h:42,speed:7,health:100,shield:100,special:100,dash:0,invuln:0,cool:0};
let bullets=[],enemyBullets=[],enemies=[],bosses=[],particles=[],powerups=[];
let score=0,missed=0,combo=1,comboTimer=0,high=+localStorage.getItem('starfrontier_high')||0;
ui.high.textContent=high;

const stars=Array.from({length:190},()=>({x:Math.random()*innerWidth,y:Math.random()*innerHeight,z:Math.random()*2+0.4,s:Math.random()*1.8+.3}));
const enemyTypes=['interceptor','bomber','shuttle','corvette','hunter'];
let enemyIndex=0;

function initAudio(){if(!audio)audio=new (AudioContext||webkitAudioContext)();audio.resume()}
function tone(f,d=.1,type='sawtooth',gain=.035){if(!audio||settings.music==='silent')return;let o=audio.createOscillator(),g=audio.createGain();o.type=type;o.frequency.value=f;g.gain.setValueAtTime(gain,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+d);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+d)}
function music(){if(!isPlaying||settings.music==='silent')return;const seq=settings.music==='industrial'?[82,82,98,110,82]:[147,220,175,196,147];seq.forEach((f,i)=>setTimeout(()=>tone(f,.22,'sawtooth',.018),i*250));musicTimer=setTimeout(music,1250)}
function stopMusic(){clearTimeout(musicTimer)}

function reset(){
 score=0;missed=0;combo=1;comboTimer=0;enemyClock=0;bossClock=0;enemyIndex=0;
 bullets=[];enemyBullets=[];enemies=[];bosses=[];particles=[];powerups=[];
 Object.assign(player,{x:90,y:H/2-20,health:100,shield:100,special:100,dash:0,invuln:0,cool:0});
 updateUI();
}
function updateUI(){ui.score.textContent=score;ui.combo.textContent='x'+combo;ui.missed.textContent=missed;ui.shield.textContent=Math.max(0,Math.floor(player.shield));ui.health.textContent=Math.max(0,Math.floor(player.health));ui.special.textContent=Math.floor(player.special)}
function start(){initAudio();reset();$('startScreen').classList.add('hidden');$('gameOverScreen').classList.add('hidden');isPlaying=true;music();last=performance.now();requestAnimationFrame(loop)}
$('startBtn').onclick=start;$('restartBtn').onclick=start;$('resultMenu').onclick=menu;$('exitBtn').onclick=menu;
function menu(){isPlaying=false;stopMusic();$('startScreen').classList.remove('hidden');$('gameOverScreen').classList.add('hidden')}

function shoot(){
 if(player.cool>0)return;
 player.cool=settings.weapon==='laser'?10:7;
 if(settings.weapon==='double'){bullet(0,-.08);bullet(0,.08)}
 else if(settings.weapon==='laser'){bullet(0,0,2.2)}
 else {bullet(-.12,-.35);bullet(-.05,-.18);bullet(0,0);bullet(.05,.18);bullet(.12,.35)}
 tone(settings.weapon==='laser'?650:880,.12,'square',.028)
}
function bullet(vy=0,extra=0,mult=1){bullets.push({x:player.x+player.w-2,y:player.y+player.h/2,w:settings.weapon==='laser'?34:18,h:settings.weapon==='laser'?6:4,s:settings.weapon==='laser'?17:14,vy:vy*10,type:settings.weapon,damage:(settings.weapon==='laser'?4:2)*mult})}
function dash(){if(!isPlaying||player.dash>0)return;player.dash=55;player.invuln=38;player.x=Math.min(W-player.w-8,player.x+115);for(let i=0;i<18;i++)particle(player.x,player.y+player.h/2,(Math.random()-.5)*2,(Math.random()-.5)*2,'dash');tone(180,.18,'triangle',.05)}
function specialAttack(){
 if(!isPlaying||player.special<100)return;
 player.special=0;tone(120,.3,'sawtooth',.06);
 for(let i=-4;i<=4;i++)bullets.push({x:player.x+player.w,y:player.y+player.h/2,w:34,h:7,s:15,vy:i*1.1,type:'special',damage:8});
 for(let i=0;i<30;i++)particle(player.x+player.w,player.y+player.h/2,(Math.random()*3+1),Math.random()*4-2,'ion');
}

function spawnEnemy(){
 const type=enemyTypes[enemyIndex++%enemyTypes.length], base=settings.difficulty==='extreme'?1.35:settings.difficulty==='normal'?1.1:1;
 const cfg={
 interceptor:{w:70,h:34,hp:2,s:3.8,score:20,shot:105,behavior:'zig'},
 bomber:{w:88,h:50,hp:5,s:2.2,score:35,shot:80,behavior:'heavy'},
 shuttle:{w:82,h:46,hp:3,s:2.8,score:28,shot:135,behavior:'sine'},
 corvette:{w:112,h:54,hp:8,s:1.8,score:55,shot:65,behavior:'tank'},
 hunter:{w:76,h:38,hp:3,s:4.5,score:32,shot:95,behavior:'hunter'}
 }[type];
 enemies.push({type,x:W+30,y:35+Math.random()*(H-105),w:cfg.w,h:cfg.h,hp:cfg.hp,s:cfg.s*base,score:cfg.score,shot:cfg.shot,lastShot:0,t:Math.random()*10,phase:Math.random()*6});
}
function spawnBoss(){
 bosses.push({x:W+80,y:H/2-110,w:230,h:145,hp:420,max:420,s:1.6,lastShot:0,phase:0});
 tone(55,.5,'sawtooth',.08);
}
function particle(x,y,vx,vy,type='spark'){particles.push({x,y,vx,vy,life:1,size:Math.random()*3+2,type})}
function explosion(x,y,big=false){for(let i=0;i<(big?70:24);i++){let a=Math.random()*Math.PI*2,s=Math.random()*(big?6:3)+1;particle(x,y,Math.cos(a)*s,Math.sin(a)*s,big?'blast':'spark')}shake=Math.max(shake,big?18:7);tone(big?48:130,big?.45:.12,'sawtooth',big?.08:.025)}
function dropPowerup(x,y){if(Math.random()>.16)return;powerups.push({x,y,r:11,type:['shield','repair','charge'][Math.floor(Math.random()*3)],t:0})}

function drawBackground(dt){
 ctx.fillStyle=settings.map==='deep'?'#010208':settings.map==='earth'?'#020914':'#070311';ctx.fillRect(0,0,W,H);
 if(settings.map==='earth'){ctx.fillStyle='#123b73';ctx.beginPath();ctx.arc(W*.86,H*.72,180,0,7);ctx.fill();ctx.fillStyle='#2b7845';ctx.beginPath();ctx.arc(W*.82,H*.68,115,0,7);ctx.fill()}
 else if(settings.map==='milkyway'){let g=ctx.createRadialGradient(W*.5,H*.5,40,W*.5,H*.5,520);g.addColorStop(0,'#55208033');g.addColorStop(1,'#0000');ctx.fillStyle=g;ctx.fillRect(0,0,W,H)}
 stars.forEach(s=>{s.x-=s.z*(1+dt*.04);if(s.x<0){s.x=W;s.y=Math.random()*H}s.alpha=.3+s.z/3;ctx.fillStyle=`rgba(220,235,255,${s.alpha})`;ctx.fillRect(s.x,s.y,s.z,s.z)})
}
function shipPath(x,y,w,h,type,flip=false){
 ctx.save();ctx.translate(x,y);if(flip)ctx.scale(-1,1);
 const m=h/2;
 ctx.beginPath();
 if(type==='interceptor'){ctx.moveTo(0,m);ctx.lineTo(w*.42,2);ctx.lineTo(w*.72,m*.55);ctx.lineTo(w,0);ctx.lineTo(w*.82,m);ctx.lineTo(w,h);ctx.lineTo(w*.72,m*1.45);ctx.lineTo(w*.42,h-2);ctx.closePath()}
 if(type==='bomber'){ctx.moveTo(0,m);ctx.lineTo(w*.2,5);ctx.lineTo(w*.58,8);ctx.lineTo(w,m*.45);ctx.lineTo(w*.82,m);ctx.lineTo(w,m*1.55);ctx.lineTo(w*.58,h-8);ctx.lineTo(w*.2,h-5);ctx.closePath()}
 if(type==='shuttle'){ctx.moveTo(0,m);ctx.lineTo(w*.18,4);ctx.lineTo(w*.72,10);ctx.lineTo(w,h*.35);ctx.lineTo(w*.82,m);ctx.lineTo(w,h*.65);ctx.lineTo(w*.72,h-10);ctx.lineTo(w*.18,h-4);ctx.closePath()}
 if(type==='corvette'){ctx.moveTo(0,m);ctx.lineTo(w*.12,5);ctx.lineTo(w*.65,8);ctx.lineTo(w,20);ctx.lineTo(w*.82,m);ctx.lineTo(w,h-20);ctx.lineTo(w*.65,h-8);ctx.lineTo(w*.12,h-5);ctx.closePath()}
 if(type==='hunter'){ctx.moveTo(0,m);ctx.lineTo(w*.35,0);ctx.lineTo(w*.56,m*.45);ctx.lineTo(w,m*.12);ctx.lineTo(w*.72,m);ctx.lineTo(w,m*.88);ctx.lineTo(w*.56,m*1.55);ctx.lineTo(w*.35,h);ctx.closePath()}
 ctx.fill();ctx.stroke();ctx.restore()
}
function drawEnemy(e){
 ctx.save();ctx.fillStyle={interceptor:'#e24b55',bomber:'#c27a31',shuttle:'#45b7c9',corvette:'#a94de2',hunter:'#6bd36b'}[e.type];ctx.strokeStyle='#dce9ff';ctx.lineWidth=1.5;shipPath(e.x,e.y,e.w,e.h,e.type,true);
 ctx.fillStyle='#ffe81f';ctx.fillRect(e.x+e.w-10,e.y+e.h/2-2,10,4);ctx.restore()
}
function drawPlayer(){
 ctx.save();if(player.invuln%6<3)ctx.globalAlpha=.55;ctx.fillStyle=settings.skin==='phantom'?'#65e6ff':settings.skin==='ember'?'#ff6338':'#d9e2ec';ctx.strokeStyle='#ffe81f';ctx.lineWidth=2;
 shipPath(player.x,player.y,player.w,player.h,'interceptor');ctx.fillStyle=settings.skin==='ember'?'#ff2515':'#49a6ff';ctx.fillRect(player.x+player.w-12,player.y+player.h/2-3,12,6);
 if(player.shield>0){ctx.strokeStyle='#56d9ff77';ctx.lineWidth=4;ctx.beginPath();ctx.ellipse(player.x+player.w/2,player.y+player.h/2,player.w*.62,player.h*.7,0,0,7);ctx.stroke()}ctx.restore()
}
function drawBoss(b){
 ctx.save();ctx.fillStyle='#651b2a';ctx.strokeStyle='#ff5964';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(b.x,b.y+b.h/2);ctx.lineTo(b.x+35,b.y+8);ctx.lineTo(b.x+125,b.y);ctx.lineTo(b.x+b.w,b.y+28);ctx.lineTo(b.x+b.w-25,b.y+b.h/2);ctx.lineTo(b.x+b.w,b.y+b.h-28);ctx.lineTo(b.x+125,b.y+b.h);ctx.lineTo(b.x+35,b.y+b.h-8);ctx.closePath();ctx.fill();ctx.stroke();
 ctx.fillStyle='#ff9d2e';for(let i=0;i<5;i++)ctx.fillRect(b.x+b.w-35,b.y+18+i*26,25,6);
 ctx.fillStyle='#05050a';ctx.fillRect(b.x,b.y-18,b.w,9);ctx.fillStyle='#ef4444';ctx.fillRect(b.x,b.y-18,b.w*(b.hp/b.max),9);ctx.restore()
}
function hit(a,b){return a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function damagePlayer(d){
 if(player.invuln>0)return;
 let absorb=Math.min(player.shield,d);player.shield-=absorb;d-=absorb;player.health-=d;shake=5;
 if(player.health<=0)gameOver('Корабль уничтожен в бою!');
}
function killEnemy(i){
 const e=enemies[i];score+=Math.round(e.score*combo);combo=Math.min(8,combo+1);comboTimer=180;player.special=Math.min(100,player.special+5);dropPowerup(e.x,e.y);explosion(e.x+e.w/2,e.y+e.h/2);enemies.splice(i,1)
}
function gameOver(reason){isPlaying=false;stopMusic();if(score>high){high=score;localStorage.setItem('starfrontier_high',high)}$('finalScore').textContent=score;$('finalHigh').textContent=high;$('gameOverReason').textContent=reason;$('gameOverScreen').classList.remove('hidden')}

function loop(now){
 if(!isPlaying)return;let dt=Math.min(2,(now-last)/16.67);last=now;
 drawBackground(dt);
 player.cool=Math.max(0,player.cool-dt);player.dash=Math.max(0,player.dash-dt);player.invuln=Math.max(0,player.invuln-dt);player.special=Math.min(100,player.special+.012*dt);
 if(comboTimer>0)comboTimer-=dt;else combo=1;
 if(keys.KeyW||keys.ArrowUp)player.y-=player.speed*dt;if(keys.KeyS||keys.ArrowDown)player.y+=player.speed*dt;if(keys.KeyA||keys.ArrowLeft)player.x-=player.speed*dt;if(keys.KeyD||keys.ArrowRight)player.x+=player.speed*dt;
 player.x=Math.max(8,Math.min(W-player.w-8,player.x));player.y=Math.max(35,Math.min(H-player.h-10,player.y));drawPlayer();

 enemyClock+=dt;bossClock+=dt;
 const rate=settings.difficulty==='extreme'?29:settings.difficulty==='normal'?42:56;
 if(enemyClock>rate){enemyClock=0;spawnEnemy()}
 if(score>=200&&bosses.length===0&&bossClock>1){bossClock=0;spawnBoss()}
 if(score>=600&&bosses.length===0&&Math.random()<.0015*dt)spawnBoss();

 bullets.forEach((b,i)=>{b.x+=b.s*dt;b.y+=b.vy*dt;ctx.fillStyle=b.type==='laser'?'#b86cff':b.type==='special'?'#ffe81f':'#4be7ff';ctx.shadowBlur=12;ctx.shadowColor=ctx.fillStyle;ctx.fillRect(b.x,b.y,b.w,b.h);ctx.shadowBlur=0;if(b.x>W+40||b.y<-40||b.y>H+40)bullets.splice(i,1)});
 enemies.forEach((e,i)=>{
   e.x-=e.s*dt;e.t+=dt;e.lastShot+=dt;
   if(e.behavior==='zig')e.y+=Math.sin(e.t*.12+e.phase)*2.4*dt;
   if(e.behavior==='sine')e.y+=Math.sin(e.t*.055+e.phase)*3*dt;
   if(e.behavior==='hunter')e.y+=(player.y-e.y)*.012*dt;
   if(e.behavior==='heavy')e.y+=(H/2-e.y)*.004*dt;
   e.y=Math.max(28,Math.min(H-e.h-8,e.y));drawEnemy(e);
   if(e.lastShot>e.shot){e.lastShot=0;enemyBullets.push({x:e.x-5,y:e.y+e.h/2,w:11,h:5,s:5.5+(e.type==='hunter'?2:0),vy:(player.y-e.y)*.01})}
   for(let j=bullets.length-1;j>=0;j--)if(hit(bullets[j],e)){e.hp-=bullets[j].damage;bullets.splice(j,1);particle(e.x,e.y+e.h/2,1,0,'spark');if(e.hp<=0){killEnemy(i);break}}
   if(enemies[i]&&hit(player,e)){damagePlayer(18);explosion(e.x,e.y);enemies.splice(i,1)}
   else if(enemies[i]&&e.x+e.w<0){enemies.splice(i,1);missed++;score=Math.max(0,score-5);if(missed>=10)gameOver('Слишком много кораблей прорвались к линии обороны!')}
 });
 bosses.forEach((b,i)=>{
  b.phase+=dt;b.lastShot+=dt;b.x=Math.max(W-b.w-55,b.x-b.s*dt);b.y=H/2-b.h/2+Math.sin(b.phase*.035)*Math.min(130,H*.18);
  drawBoss(b);
  if(b.lastShot>42){b.lastShot=0;for(let k=-1;k<=1;k++)enemyBullets.push({x:b.x-5,y:b.y+b.h/2+k*38,w:18,h:7,s:8,vy:k*1.5});tone(75,.12,'sawtooth',.03)}
  for(let j=bullets.length-1;j>=0;j--)if(hit(bullets[j],b)){b.hp-=bullets[j].damage;bullets.splice(j,1);particle(b.x,b.y+b.h/2,-1,0,'spark');if(b.hp<=0){score+=500;player.special=Math.min(100,player.special+40);explosion(b.x+b.w/2,b.y+b.h/2,true);bosses.splice(i,1);break}}
 });
 enemyBullets.forEach((b,i)=>{b.x-=b.s*dt;b.y+=b.vy*dt;ctx.fillStyle='#ff7043';ctx.shadowBlur=9;ctx.shadowColor='#ff3d00';ctx.fillRect(b.x,b.y,b.w,b.h);ctx.shadowBlur=0;if(hit(b,player)){damagePlayer(8);enemyBullets.splice(i,1)}else if(b.x<0)enemyBullets.splice(i,1)});
 powerups.forEach((p,i)=>{p.x-=2*dt;p.t+=dt;ctx.strokeStyle=p.type==='shield'?'#56d9ff':p.type==='repair'?'#68e56d':'#ffe81f';ctx.lineWidth=3;ctx.beginPath();ctx.arc(p.x,p.y,p.r+Math.sin(p.t*.15)*3,0,7);ctx.stroke();ctx.fillStyle=ctx.strokeStyle;ctx.font='bold 11px sans-serif';ctx.textAlign='center';ctx.fillText(p.type==='shield'?'S':p.type==='repair'?'+':'E',p.x,p.y+4);if(hit({x:p.x-10,y:p.y-10,w:20,h:20},player)){if(p.type==='shield')player.shield=Math.min(100,player.shield+35);if(p.type==='repair')player.health=Math.min(100,player.health+25);if(p.type==='charge')player.special=100;tone(520,.12,'sine',.04);powerups.splice(i,1)}});
 particles.forEach((p,i)=>{p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=.025*dt;ctx.globalAlpha=Math.max(0,p.life);ctx.fillStyle=p.type==='blast'?'#ff6a2a':p.type==='ion'?'#ffe81f':p.type==='dash'?'#55dfff':'#fff';ctx.fillRect(p.x,p.y,p.size,p.size);ctx.globalAlpha=1;if(p.life<=0)particles.splice(i,1)});
 shake*=.9;updateUI();requestAnimationFrame(loop)
}
resize();
