const qs = (s)=>document.querySelector(s);
const qsa = (s)=>Array.from(document.querySelectorAll(s));
const screens = {home: qs('#screen-home'), spell: qs('#screen-spell'), shout: qs('#screen-shout')};
const audio = {ok: qs('#sfxSuccess'), bad: qs('#sfxError'), whoosh: qs('#sfxWhoosh')};
let captionsOn=false; let reduced=false;
// AIML runtime state
let aiml = {categories: []};

function showScreen(name){
  Object.values(screens).forEach(x=>x.classList.remove('active'));
  screens[name].classList.add('active');
  audio.whoosh.currentTime=0; audio.whoosh.play().catch(()=>{});
}

qs('#btnHome').addEventListener('click',()=>showScreen('home'));
qs('#btnSpellHome').addEventListener('click',()=>showScreen('home'));
qs('#btnShoutHome').addEventListener('click',()=>showScreen('home'));

qs('#btnReducedMotion').addEventListener('click', (e)=>{
  reduced=!reduced; document.body.classList.toggle('reduce-motion', reduced);
  e.currentTarget.setAttribute('aria-pressed', String(reduced));
});
qs('#btnCaptions').addEventListener('click', (e)=>{
  captionsOn=!captionsOn; e.currentTarget.setAttribute('aria-pressed', String(captionsOn));
});
// Chat panel toggle
const chatBtn=qs('#btnChat'); const chatPanel=qs('#chatPanel'); const chatClose=qs('#btnChatClose');
if(chatBtn && chatPanel){ chatBtn.onclick=()=>{ chatPanel.style.display = chatPanel.style.display==='none'?'flex':'none'; }; }
if(chatClose && chatPanel){ chatClose.onclick=()=>{ chatPanel.style.display='none'; }; }

function say(text){ if(!captionsOn) return; const cap=document.createElement('div'); cap.className='caption'; cap.textContent=text; document.body.appendChild(cap); setTimeout(()=>cap.remove(), 1500); }


qs('#startSpell').addEventListener('click',()=>{startSpellGame(); showScreen('spell');});
qs('#startShout').addEventListener('click',()=>{startShoutGame(); showScreen('shout');});

function confettiBurst(){
  const root=qs('#confetti');
  for(let i=0;i<120;i++){
    const d=document.createElement('div');
    const size=6+Math.random()*8; const hue=(Math.random()*360)|0;
    d.style.cssText=`position:absolute;width:${size}px;height:${size}px;background:hsl(${hue} 90% 60%);left:${Math.random()*100}vw;top:-10px;border-radius:4px;transform:rotate(${Math.random()*360}deg)`;
    root.appendChild(d);
    const fall=()=>{d.animate([{transform:`translateY(0) rotate(0deg)`},{transform:`translateY(${110+Math.random()*40}vh) rotate(${180+Math.random()*360}deg)`}],{duration:1000+Math.random()*1200, easing:'cubic-bezier(.21,1,.22,1)'}).onfinish=()=>d.remove()}
    fall();
  }
}

// Minimal AIML parser and matcher
async function loadAIML(){
  try{
    const res = await fetch('brain.aiml'); const xmlText = await res.text();
    const parser = new DOMParser(); const xml = parser.parseFromString(xmlText, 'text/xml');
    const cats=[...xml.getElementsByTagName('category')].map(cat=>{
      const pat = cat.getElementsByTagName('pattern')[0]?.textContent?.trim()?.toUpperCase()||'';
      const tmplNode = cat.getElementsByTagName('template')[0];
      return {pattern: pat, templateNode: tmplNode};
    });
    aiml.categories=cats;
  }catch{}
}

function aimlRespond(input, vars){
  const say = input.toUpperCase().trim();
  for(const c of aiml.categories){
    const p = c.pattern.replace(/\s+/g,' ').trim();
    const regex = new RegExp('^'+p.split('*').map(s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('.*')+'$');
    if(regex.test(say)){
      // Serialize template: support <random><li>..</li></random> and plain text
      let out = '';
      if(c.templateNode){
        const rnd = c.templateNode.getElementsByTagName('random')[0];
        if(rnd){
          const items=[...rnd.getElementsByTagName('li')].map(n=>n.textContent);
          out = items.length? items[Math.floor(Math.random()*items.length)] : '';
        } else {
          out = c.templateNode.textContent || '';
        }
      }
      // Substitute variables like {word}
      out = out.replaceAll('{word}', vars.word||'')
               .replaceAll('{streak}', String(vars.streak||0))
               .replaceAll('{first_letter}', (vars.word||'').charAt(0)||'')
               .replaceAll('{last_letter}', (vars.word||'').slice(-1)||'')
               .replaceAll('{rhyme}', vars.rhyme||'time');
      return out;
    }
  }
  return "I'm here to help. Try HINT, ENCOURAGE, or NEXT WORD.";
}

function chatAppend(role, text){ const log=qs('#chatLog'); if(!log) return; const d=document.createElement('div'); d.className=`msg ${role}`; d.textContent=text; log.appendChild(d); log.scrollTop=log.scrollHeight; }
function chatSend(){ const inp=qs('#chatText'); if(!inp||!inp.value.trim()) return; const msg=inp.value.trim(); chatAppend('me', msg); inp.value=''; const vars={word:spellState.current||'', streak:spellState.streak||0, rhyme: pickRhyme(spellState.current)}; const reply=aimlRespond(msg, vars); chatAppend('bot', reply); if(/NEXT WORD/i.test(msg)){ loadWord(); }
}
const chatSendBtn=qs('#chatSend'); if(chatSendBtn){ chatSendBtn.onclick=chatSend; }
const chatText=qs('#chatText'); if(chatText){ chatText.addEventListener('keydown', (e)=>{ if(e.key==='Enter') chatSend(); }); }

function pickRhyme(word){ if(!word) return 'time'; const list=['time','bright','bee','fun','sun','light','blue','star']; return list[(word.length+list.length)%list.length]; }

let spellState={streak:0, level:'Beginner', current:'', chips:[], listening:false, rec:null, score:0, best:0};

async function loadWord(){
  const res=await fetch('wordbank.json'); const all=await res.json();
  const pool=[...all.beginner,...all.easy];
  const w=pool[Math.floor(Math.random()*pool.length)];
  spellState.current=w; renderSpellWord(w);
}
function renderSpellWord(w){
  qs('#targetWord').textContent=w;
  const chips=qs('#chips'); chips.innerHTML='';
  w.split('').forEach(l=>{ const c=document.createElement('div'); c.className='chip'; c.textContent=l.toUpperCase(); chips.appendChild(c); });
}
function updateSpellHUD(){
  qs('#spellStreak').textContent=spellState.streak;
  qs('#spellLevel').textContent=spellState.level;
  const scEl=qs('#spellScore'); if(scEl) scEl.textContent=String(spellState.score||0);
  const beEl=qs('#spellBest'); if(beEl) beEl.textContent=String(spellState.best||0);
}

function levenshtein(a,b){
  const m=[]; const al=a.length, bl=b.length; for(let i=0;i<=al;i++){m[i]=[i]} for(let j=0;j<=bl;j++){m[0][j]=j}
  for(let i=1;i<=al;i++){ for(let j=1;j<=bl;j++){ m[i][j]=a[i-1]===b[j-1]?m[i-1][j-1]:1+Math.min(m[i-1][j],m[i][j-1],m[i-1][j-1]); }}
  return m[al][bl];
}
function similarity(a,b){ const dist=levenshtein(a,b); const max=Math.max(a.length,b.length); return 1 - dist/max; }

function speakListenToggle(){ if(spellState.listening){ stopSpellListen(); } else { startSpellListen(); } }

function ensureRec(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR){ alert('SpeechRecognition not supported in this browser. Try Chrome.'); return null; }
  if(!spellState.rec){ const r=new SR(); r.lang='en-US'; r.interimResults=false; r.maxAlternatives=1; spellState.rec=r; }
  return spellState.rec;
}

function startSpellListen(){
  const rec=ensureRec(); if(!rec) return; spellState.listening=true; qs('#btnSpellListen').textContent='Stop Listening'; qs('#micStatusSpell').textContent='Mic: on'; say('Listening');
  rec.onresult=(e)=>{
    const txt=e.results[0][0].transcript.toLowerCase().replace(/[^a-z]/g,'');
    const target=spellState.current.toLowerCase();
    const score=similarity(txt,target);

    const dist=levenshtein(txt,target);
    let ok=false;
    if(target.length<=4){
      ok = dist<=1 || score>=0.75;
    } else if(target.length<=7){
      ok = dist<=2 || score>=0.8;
    } else {
      ok = score>=0.85;
    }
    if(ok){
      audio.ok.currentTime=0; audio.ok.play().catch(()=>{});
      qs('#spellFeedback').textContent='Great!'; qs('#spellFeedback').className='feedback ok';
      qs('#wall').classList.add('crack');
      confettiBurst();
      spellState.streak++;
      spellState.score++; updateSpellHUD();
      setTimeout(()=>{ qs('#wall').classList.remove('crack'); loadWord(); }, 900);
    } else {
      audio.bad.currentTime=0; audio.bad.play().catch(()=>{});
   
      const lastScore = spellState.score;
      if(spellState.score>spellState.best){ spellState.best=spellState.score; }
      qs('#spellFeedback').textContent='';
      spellState.streak=0; spellState.score=0; updateSpellHUD();
 
      stopSpellListen();
      const rb=qs('#btnSpellRestart'); if(rb){ rb.style.display='inline-block'; rb.onclick=()=>{ rb.style.display='none'; loadWord(); } }
      const overlay=qs('#spellOverlay'); const finalEl=qs('#spellFinalScore'); const centerBtn=qs('#btnSpellRestartCenter');
      if(overlay){ overlay.style.display='flex'; if(finalEl) finalEl.textContent=String(lastScore); if(centerBtn){ centerBtn.onclick=()=>{ overlay.style.display='none'; loadWord(); startSpellListen(); }; } }
    }
  };
  rec.onend=()=>{ if(spellState.listening){ rec.start(); } };
  try{ rec.start(); }catch{}
}
function stopSpellListen(){ const rec=spellState.rec; spellState.listening=false; qs('#btnSpellListen').textContent='Start Listening'; qs('#micStatusSpell').textContent='Mic: off'; if(rec){ try{rec.stop();}catch{} } }

qs('#btnSpellListen').addEventListener('click', speakListenToggle);
qs('#btnSpellNext').addEventListener('click', loadWord);

async function startSpellGame(){ updateSpellHUD(); await loadWord(); }


let shout={ctx:null, analyser:null, data:null, raf:0, smoothing:.85, mic:false, height:0, canvas:null, birdY:0, passed:0, best:0};

function rms(buf){ let sum=0; for(let i=0;i<buf.length;i++){ const v=(buf[i]-128)/128; sum+=v*v; } return Math.sqrt(sum/buf.length); }

async function startMic(){
  const stream=await navigator.mediaDevices.getUserMedia({audio:true});
  const ctx=new (window.AudioContext||window.webkitAudioContext)();
  const src=ctx.createMediaStreamSource(stream);
  const analyser=ctx.createAnalyser(); analyser.fftSize=1024; const data=new Uint8Array(analyser.fftSize);
  src.connect(analyser);
  shout.ctx=ctx; shout.analyser=analyser; shout.data=data; shout.mic=true; qs('#micStatusShout').textContent='Mic: on';
}

function stopMic(){ if(shout.ctx){ shout.ctx.close(); } shout.mic=false; qs('#micStatusShout').textContent='Mic: off'; cancelAnimationFrame(shout.raf); }

function drawSkySetup(){
  const c=qs('#sky'); const ctx=c.getContext('2d');
  const clouds=[{x:0,y:80,s:1.2},{x:300,y:130,s:0.8},{x:700,y:60,s:1.0}];
  
  let walls=[]; let spawnTimer=0; const SPAWN_EVERY=140; const SPEED=3.2;
  const GAP_MIN=110, GAP_MAX=180; const W_MIN=28, W_MAX=62;
  let t=0; let birdY=300; shout.passed=0; let gameOver=false; qs('#scoreVal').textContent='0'; qs('#bestVal').textContent=String(shout.best||0);
  const restartBtn = qs('#btnShoutRestart'); if(restartBtn) restartBtn.style.display='none';
  const overlay = qs('#shoutOverlay'); const finalScoreEl = qs('#finalScore'); const restartCenter = qs('#btnShoutRestartCenter'); if(overlay){ overlay.style.display='none'; }
  function draw(){
    const w=c.width, h=c.height; ctx.clearRect(0,0,w,h);
    const grad=ctx.createLinearGradient(0,0,0,h); grad.addColorStop(0,'#7dd3fc'); grad.addColorStop(1,'#e0f2fe'); ctx.fillStyle=grad; ctx.fillRect(0,0,w,h);
    clouds.forEach(cl=>{ cl.x=(cl.x+cl.s*0.6)%(w+200)-200; ctx.fillStyle='rgba(255,255,255,.9)'; ctx.beginPath(); ctx.ellipse(cl.x,cl.y,60,26,0,0,Math.PI*2); ctx.fill(); });

    let vol=0; if(shout.mic){ shout.analyser.getByteTimeDomainData(shout.data); vol=rms(shout.data); }
    // Freeze bird on gameOver (no new target blend)
    if(!gameOver){
      const targetY=(1 - Math.min(1, Math.pow(vol*10, 0.6))) * (h-120) + 60; birdY = birdY*0.88 + targetY*0.12;
    }

    ctx.save(); ctx.translate(w*0.25, birdY);
    ctx.fillStyle='#f59e0b'; ctx.beginPath(); ctx.ellipse(0,0,26,18,0,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='#1f2937'; ctx.beginPath(); ctx.arc(8,-4,3,0,Math.PI*2); ctx.fill();
    const flap=Math.sin(t*0.2)*10; ctx.fillStyle='#fde68a'; ctx.beginPath(); ctx.ellipse(-10,flap,18,8,0,0,Math.PI*2); ctx.fill();
    ctx.restore();

    
    spawnTimer++; if(spawnTimer>=SPAWN_EVERY){
      spawnTimer=0;
      const gapH = GAP_MIN + Math.random()*(GAP_MAX-GAP_MIN);
      const gapY = 80 + Math.random()*(h-160-gapH);
      const wWidth = W_MIN + Math.random()*(W_MAX-W_MIN);
      walls.push({x:w+60, gapY, gapH, w:wWidth, scored:false});
    }
   
    ctx.save();
    if(!gameOver){ walls.forEach(wl=>{ wl.x-=SPEED; }); }
    walls = walls.filter(wl=> wl.x>-Math.max(60, wl.w+20));
    walls.forEach(wl=>{
      ctx.fillStyle='#cbd5e1';
      
      ctx.fillRect(wl.x,0,wl.w,wl.gapY);
 
      ctx.fillRect(wl.x, wl.gapY+wl.gapH, wl.w, h-(wl.gapY+wl.gapH));
      ctx.fillStyle='#94a3b8'; ctx.fillRect(wl.x,0,Math.min(6, wl.w*0.35),h);
    
      const birdX = w*0.25;
      if(!wl.scored && wl.x < birdX && wl.x+wl.w > birdX-1){
        const within = birdY > wl.gapY && birdY < wl.gapY+wl.gapH;
        if(within){
          wl.scored=true; shout.passed++; qs('#scoreVal').textContent=String(shout.passed); audio.ok.currentTime=0; audio.ok.play().catch(()=>{}); qs('#shoutFeedback').textContent='Wall passed!'; qs('#shoutFeedback').className='feedback ok'; confettiBurst();
        } else if(!gameOver){
          gameOver=true; audio.bad.currentTime=0; audio.bad.play().catch(()=>{});
          if(shout.passed>shout.best){ shout.best=shout.passed; qs('#bestVal').textContent=String(shout.best); }
          qs('#shoutFeedback').textContent='';
          // Show centered overlay
          if(overlay){ overlay.style.display='flex'; if(finalScoreEl) finalScoreEl.textContent=String(shout.passed); if(restartCenter){ restartCenter.onclick=()=>{ overlay.style.display='none'; drawSkySetup(); }; } }
          // Also offer footer restart for convenience
          if(restartBtn){ restartBtn.style.display='inline-block'; restartBtn.textContent='Restart'; restartBtn.onclick=()=>{ if(overlay) overlay.style.display='none'; restartBtn.style.display='none'; drawSkySetup(); }; }
        }
      }
    });
    ctx.restore();

    // Show height percent for feedback
    const progress=Math.max(0, (h-birdY)/h);
    qs('#heightVal').textContent=Math.round(progress*100);

    t+=1; shout.raf=requestAnimationFrame(draw);
  }
  draw();
}

qs('#btnShoutStart').addEventListener('click', async ()=>{
  if(!shout.mic){ try{ await startMic(); say('Mic started'); }catch(e){ alert('Mic permission needed.'); return; } drawSkySetup(); } else { stopMic(); say('Mic stopped'); }
});

async function startShoutGame(){ shout.height=0; }

// Home init
showScreen('home'); loadAIML();
