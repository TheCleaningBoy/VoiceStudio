/* =========================================================
   VOICER STUDIO — a mic party game (Studio / Dub / Freestyle)
   All files & recordings stay in the browser. No uploads.
   ========================================================= */
"use strict";

/* ---------------- tiny helpers ---------------- */
const $  = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const rand = n => Math.floor(Math.random() * n);
const pick = a => a[rand(a.length)];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function showScreen(id){
  $$(".screen").forEach(s => s.classList.add("hidden"));
  document.getElementById(id).classList.remove("hidden");
  window.scrollTo(0,0);
  speechSynthesis && speechSynthesis.cancel();
  stopCurrentAudio();
}
function toast(msg, ms=3200){
  const t = $("#toast");
  t.textContent = msg;
  t.classList.remove("hidden");
  clearTimeout(t._h);
  t._h = setTimeout(()=> t.classList.add("hidden"), ms);
}
/* surface media load failures instead of a silent black screen */
function mediaErrName(code){
  return {1:"aborted", 2:"network error", 3:"decode error", 4:"format not supported"}[code] || ("error " + code);
}
function watchMedia(el, label){
  if(!el || el._watched) return el;
  el._watched = true;
  el.addEventListener("error", () => {
    const e = el.error;
    const src = (el.currentSrc || el.src || "").replace(/^file:\/\/\//, "").replace(/^pack:\/\/\//, "packs_voice/");
    toast(`⚠️ Couldn't play ${label || "media"} (code ${e ? e.code : "?"}: ${e ? mediaErrName(e.code) : "unknown"}) — ${decodeURIComponent(src)} — app v1.0.2`, 9000);
  });
  return el;
}
async function overlayCountdown(go="🎬 GO!"){
  const o = $("#overlay"), tx = $("#overlay-text");
  o.classList.remove("hidden");
  for(const n of ["3","2","1"]){
    tx.textContent = n;
    tx.style.animation = "none"; void tx.offsetWidth; tx.style.animation = "";
    await sleep(640);
  }
  tx.textContent = go;
  tx.style.animation = "none"; void tx.offsetWidth; tx.style.animation = "";
  await sleep(520);
  o.classList.add("hidden");
}

/* ---------------- mic & recording engine ---------------- */
let micStream = null, audioCtx = null;

async function ensureMic(){
  if(micStream) return micStream;
  if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia)
    throw new Error("This browser can't access a microphone (try Chrome/Edge over https).");
  micStream = await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true, noiseSuppression:true}});
  const st = $("#mic-status"); st.textContent = "🎤 mic ready"; st.classList.add("ok");
  return micStream;
}
function getCtx(){
  if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if(audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
function pickMime(){
  if(!window.MediaRecorder) return "";
  for(const t of ["audio/webm;codecs=opus","audio/webm","audio/mp4","audio/ogg;codecs=opus"])
    if(MediaRecorder.isTypeSupported(t)) return t;
  return "";
}

/** Start recording. Returns { stop(): Promise<{blob,url,avgLevel,speechRatio}> } */
function startRecording(stream, meterEl){
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? {mimeType:mime} : undefined);
  const chunks = [];
  rec.ondataavailable = e => { if(e.data && e.data.size) chunks.push(e.data); };

  // live level analysis
  const ctx = getCtx();
  const src = ctx.createMediaStreamSource(stream);
  const an  = ctx.createAnalyser(); an.fftSize = 1024;
  src.connect(an);
  const data = new Uint8Array(an.fftSize);
  let levelSum=0, levelN=0, active=0, frames=0, raf=0;
  function tick(){
    an.getByteTimeDomainData(data);
    let s=0;
    for(let i=0;i<data.length;i++){ const d=(data[i]-128)/128; s+=d*d; }
    const rms = Math.sqrt(s/data.length);
    levelSum+=rms; levelN++; if(rms>0.02) active++; frames++;
    if(meterEl) meterEl.style.width = Math.min(100, rms*460) + "%";
    raf = requestAnimationFrame(tick);
  }
  rec.start(100);
  tick();

  return {
    recorder: rec,
    stop(){
      return new Promise(res => {
        rec.onstop = () => {
          cancelAnimationFrame(raf);
          try{ src.disconnect(); }catch(e){}
          const blob = new Blob(chunks, {type: rec.mimeType || "audio/webm"});
          res({ blob, url: URL.createObjectURL(blob),
                avgLevel: levelN ? levelSum/levelN : 0,
                speechRatio: frames ? active/frames : 0 });
        };
        if(rec.state !== "inactive") rec.stop(); else rec.onstop();
      });
    },
    cancel(){
      cancelAnimationFrame(raf);
      try{ src.disconnect(); }catch(e){}
      rec.ondataavailable = null; rec.onstop = null;
      if(rec.state !== "inactive") rec.stop();
    }
  };
}

/* synced audio playback — supports several overlapping tracks */
let currentAudios = [], currentTimers = [];
function stopCurrentAudio(){
  for(const a of currentAudios){ try{ a.pause(); }catch(e){} }
  currentAudios = [];
  for(const t of currentTimers){ clearTimeout(t); }
  currentTimers = [];
}
function playTakeAudio(url){
  stopCurrentAudio();
  const a = new Audio(url); a.play().catch(()=>{});
  currentAudios.push(a); return a;
}

/* ---------------- built-in content ---------------- */
const LINES = [
  ["I told you NOT to press the red button!", "Panicked Inventor"],
  ["This bakery is now under new management. Mine.", "Smug Villain"],
  ["We're not lost. The map is just… creative.", "Unsure Explorer"],
  ["One does not simply walk into my kitchen.", "Dramatic Chef"],
  ["I have been training my whole life for this… spelling bee.", "Intense Competitor"],
  ["The pigeons are watching us. They always have been.", "Conspiracy Theorist"],
  ["Congratulations! You've won a lifetime supply of socks.", "Cheesy Gameshow Host"],
  ["I regret nothing. Except the soup.", "Mysterious Stranger"],
  ["In case of emergency, remain absolutely fabulous.", "Safety Instructor"],
  ["The spaceship is fine. Why does nobody believe me?", "Nervous Captain"],
  ["You call this a haunting? I've seen scarier toast.", "Unimpressed Ghost"],
  ["My lawyer is a seagull, and he's very good.", "Confident Client"],
  ["Somewhere out there, a cat is judging you.", "Nature Narrator"],
  ["I came, I saw, I forgot why I was there.", "Forgetful Hero"],
  ["Do NOT feed the printer after midnight.", "IT Wizard"],
  ["Legend says the WiFi password is whispered by the wind.", "Village Elder"],
  ["This elevator only goes sideways. It's a lifestyle.", "Building Guide"],
  ["I'm not yelling. I'm just extremely enthusiastic.", "Passionate Coach"],
  ["The moon is a lamp, and somebody forgot to pay the bill.", "Deep Thinker"],
  ["Attention shoppers: the cheese has become sentient.", "Supermarket Announcer"]
];
const AUTO_CAPTIONS = [
  "Wait… do you hear that?", "(ominous silence)", "This is fine. Totally fine.",
  "LOOK OUT!", "I have a bad feeling about this.", "(dramatic gasp)",
  "Whatever you do, don't press the—", "Oh. Oh no.", "So long, everyone!",
  "It's behind me, isn't it?", "Trust me, I'm a professional.", "(explosion)",
  "That's not supposed to do that.", "Quick, act natural!", "We did it! ...didn't we?"
];
const JUDGES = [
  {name:"Judge Boom",  face:"🔊", label:"Power",  key:"power"},
  {name:"Madame Echo", face:"🎭", label:"Timing", key:"timing"},
  {name:"Sir Reginald Volume III", face:"👑", label:"Drama", key:"drama"}
];
function verdictFor(total){
  if(total>=26) return "“A masterclass. Somebody call an animation studio.”";
  if(total>=21) return "“Genuinely impressive. The booth shook.”";
  if(total>=16) return "“Solid work — the judges demand an encore.”";
  if(total>=11) return "“There was a performance in there somewhere.”";
  if(total>=6)  return "“Bold choices. Questionable execution.”";
  return "“The judges have heard haunted microphones before. This was one.”";
}

/* ---------------- file library (session quick-add) ---------------- */
const library = []; // {id,name,type:'audio'|'video',url,file}
let libSeq = 0;
let installedPacks = []; // packs from packs_voice (desktop app)
const VIDEO_EXT = ["mp4","webm","mov","mkv","avi","m4v","mpg","mpeg","wmv","ogv"];
const AUDIO_EXT = ["mp3","wav","ogg","oga","m4a","aac","flac","opus","wma"];

function detectType(f){
  if(f.type && f.type.startsWith("video")) return "video";
  if(f.type && f.type.startsWith("audio")) return "audio";
  // Many files (.mov/.mkv/.flac/…) arrive with an empty MIME type — fall back to extension
  const ext = ((f.name.split(".").pop()) || "").toLowerCase();
  if(VIDEO_EXT.includes(ext)) return "video";
  if(AUDIO_EXT.includes(ext)) return "audio";
  return null;
}

function addFiles(fileList){
  const files = Array.from(fileList || []);
  if(!files.length) return;
  let added = 0, skipped = [];
  for(const f of files){
    const type = detectType(f);
    if(!type){ skipped.push(f.name); continue; }
    library.push({id:++libSeq, name:f.name, type, url:URL.createObjectURL(f), file:f});
    added++;
  }
  if(skipped.length)
    toast(`⚠️ Couldn't add: ${skipped.join(", ")} (not a recognised audio/video file)`, 5000);
  if(added) toast(`✅ Added ${added} file${added>1?"s":""} to your packs — see the list below 🎉`, 4000);
  renderLibrary(); refreshClipSelects();
}
function renderLibrary(){
  const box = $("#library-list");
  if(!library.length){
    box.innerHTML = `<div class="lib-empty">No quick-add files this session.</div>`;
    return;
  }
  box.innerHTML = "";
  for(const item of library){
    const div = document.createElement("div");
    div.className = "lib-item";
    const sizeLine = item.source === "folder"
      ? `${item.type} · 📁 packs folder`
      : `${item.type} · ${(item.file.size/1048576).toFixed(1)} MB`;
    div.innerHTML = `
      <span class="lib-icon">${item.type==="video" ? "🎬" : "🎵"}</span>
      <div class="lib-name">
        <div class="nm">${escapeHtml(item.name)}</div>
        <div class="small muted">${sizeLine}</div>
      </div>
      <button class="btn small ghost" data-act="prev">▶ Preview</button>
      ${item.source === "folder" ? "" : `<button class="btn small bad" data-act="del">🗑</button>`}`;
    if(item.source !== "folder"){
      div.querySelector('[data-act="del"]').onclick = () => {
        URL.revokeObjectURL(item.url);
        library.splice(library.indexOf(item),1);
        renderLibrary(); refreshClipSelects();
      };
    }
    div.querySelector('[data-act="prev"]').onclick = () => {
      const ex = div.querySelector(".lib-prev");
      if(ex){ ex.remove(); return; }
      const p = document.createElement("div");
      p.className = "lib-prev"; p.style.width = "100%"; p.style.marginTop = "10px";
      const el = document.createElement(item.type==="video" ? "video" : "audio");
      el.src = item.url; el.controls = true; el.playsInline = true;
      el.style.width = "100%"; el.style.maxWidth = "480px"; el.style.borderRadius = "10px";
      p.appendChild(el); div.appendChild(p); div.style.flexWrap = "wrap";
      el.play().catch(()=>{});
    };
    box.appendChild(div);
  }
}
function escapeHtml(s){ return s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

/* dropzone + inputs */
$("#file-input").addEventListener("change", e => { addFiles(e.target.files); e.target.value=""; });
const dz = $("#dropzone");
dz.addEventListener("dragover", e => { e.preventDefault(); dz.classList.add("over"); });
dz.addEventListener("dragleave", () => dz.classList.remove("over"));
dz.addEventListener("drop", e => { e.preventDefault(); dz.classList.remove("over"); addFiles(e.dataTransfer.files); });

/* ---------------- player inputs ---------------- */
function loadLastPlayers(){ try{ return JSON.parse(localStorage.getItem("vs-players")) || []; }catch(e){ return []; } }
function saveLastPlayers(names){ try{ localStorage.setItem("vs-players", JSON.stringify(names)); }catch(e){} }

function buildPlayerInputs(containerId, defaultCount=2){
  const box = document.getElementById(containerId);
  const last = loadLastPlayers();
  let count = defaultCount;
  function render(){
    box.innerHTML = `
      <div class="seg" style="margin-bottom:10px">
        ${[1,2,3,4].map(n => `<button data-c="${n}" class="${n===count?'on':''}">${n} player${n>1?"s":""}</button>`).join("")}
      </div>
      ${Array.from({length:count}, (_,i)=>`
        <div class="player-row">
          <span class="p-badge">${["🎤","🎧","🎬","⭐"][i]}</span>
          <input class="text-input p-name" data-i="${i}" maxlength="16" placeholder="Player ${i+1}" value="${escapeHtml(last[i]||"")}">
        </div>`).join("")}`;
    box.querySelectorAll("[data-c]").forEach(b => b.onclick = () => {
      count = +b.dataset.c;
      const names = getPlayers(containerId); // keep typed names
      render();
      box.querySelectorAll(".p-name").forEach((inp,i)=>{ if(names[i]) inp.value = names[i]; });
    });
  }
  render();
}
function getPlayers(containerId){
  return $$("#"+containerId+" .p-name").map((inp,i) => inp.value.trim() || `Player ${i+1}`);
}

/* segmented controls */
function wireSeg(id, cb){
  const el = document.getElementById(id);
  el.querySelectorAll("button").forEach(b => b.onclick = () => {
    el.querySelectorAll("button").forEach(x => x.classList.remove("on"));
    b.classList.add("on"); cb && cb(b.dataset.v);
  });
}
function segValue(id){ const b = document.querySelector("#"+id+" .on"); return b ? b.dataset.v : null; }

/* ---------------- STUDIO MODE ---------------- */
const G = { studio:null, dub:null, free:null };

$("#studio-start").onclick = () => {
  const players = getPlayers("studio-players");
  saveLastPlayers(players);
  const rounds = +segValue("studio-rounds");
  const src = document.querySelector('input[name="studio-src"]:checked').value;
  let audioLines = [], packName = "";
  if(src === "pack"){
    const vp = currentVoicePack();
    if(!vp){ toast("Install a voice pack in packs_voice first!"); return; }
    audioLines = vp.lines.map((l,i) => ({id:"vp-"+i, name:l.name, url:l.url}));
    packName = vp.name;
  } else if(src === "quick"){
    audioLines = library.filter(i => i.type === "audio").map(i => ({id:i.id, name:i.name, url:i.url}));
    if(!audioLines.length){ toast("Quick-add some audio files first!"); return; }
    packName = "Quick-add audio";
  }
  G.studio = {
    players, rounds, src, audioLines, packName,
    usedClips: [], usedLines: [],
    turn: 0, queue: [],
    scores: Object.fromEntries(players.map(p => [p,0]))
  };
  for(let r=0;r<rounds;r++) for(const p of players) G.studio.queue.push({player:p, round:r+1});
  $("#studio-hud-round").textContent = "";
  showScreen("screen-studio-play");
  studioNextTurn();
};
$("#studio-quit").onclick = () => showScreen("screen-home");

function studioPrompt(){
  const S = G.studio;
  if(S.src === "builtin"){
    const avail = LINES.map((_,i)=>i).filter(i => !S.usedLines.includes(i));
    const idx = avail.length ? pick(avail) : rand(LINES.length);
    S.usedLines.push(idx);
    const [text,mood] = LINES[idx];
    const est = clamp(1.4 + text.split(/\s+/).length * 0.42, 2.5, 9);
    return {kind:"tts", text, mood, dur: est + 1.5};
  }
  const avail = S.audioLines.filter(c => !S.usedClips.includes(c.id));
  const clip = avail.length ? pick(avail) : pick(S.audioLines);
  S.usedClips.push(clip.id);
  return {kind:"clip", text: clip.name, mood: S.src === "pack" ? `Voice pack: ${S.packName}` : "Quick-add audio", clip, dur: 12};
}

async function studioNextTurn(){
  const S = G.studio;
  if(S.turn >= S.queue.length){ studioFinalResults(); return; }
  const t = S.queue[S.turn];
  const prompt = studioPrompt();
  S.currentPrompt = prompt;
  $("#studio-hud-round").textContent = `Round ${t.round}/${S.rounds}`;
  $("#studio-hud-player").textContent = `🎤 ${t.player}`;

  const phase = $("#studio-phase");
  phase.innerHTML = `
    <div class="phase-title">${escapeHtml(t.player)}, your line is…</div>
    <div class="line-card">
      <div class="mood">${escapeHtml(prompt.mood)}</div>
      <div class="line">${prompt.kind==="tts" ? `“${escapeHtml(prompt.text)}”` : `🎵 ${escapeHtml(prompt.text)}`}</div>
    </div>
    <div class="row">
      <button class="btn ghost" id="st-hear">▶ Hear the line</button>
      <button class="btn primary" id="st-record">🎙️ Record my take</button>
    </div>
    <div class="muted small" style="margin-top:12px">${prompt.kind==="tts"
      ? "A mystery voice will perform it — then it's your turn."
      : "Listen to your clip, then give your best performance."}</div>`;

  $("#st-hear").onclick = () => studioHear(prompt);
  $("#st-record").onclick = () => studioRecord(prompt);
}

async function studioHear(p){
  const btn = $("#st-hear"); if(btn) btn.disabled = true;
  if(p.kind === "tts"){ await speak(p.text); }
  else await playClipOnce(p.clip.url);
  if(btn) btn.disabled = false;
}

function speak(text){
  return new Promise(res => {
    if(!("speechSynthesis" in window)){ sleep(1200).then(res); return; }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const voices = speechSynthesis.getVoices();
    if(voices.length) u.voice = pick(voices);
    u.pitch = 0.6 + Math.random()*1.0;
    u.rate  = 0.85 + Math.random()*0.3;
    u.onend = res; u.onerror = res;
    speechSynthesis.speak(u);
    setTimeout(res, 15000); // safety
  });
}
function playClipOnce(url){
  return new Promise(res => {
    const a = new Audio(url);
    a.onended = res; a.onerror = res;
    a.play().catch(res);
    setTimeout(res, 30000);
  });
}

async function studioRecord(p){
  let stream;
  try{ stream = await ensureMic(); }
  catch(e){ toast("🎤 " + e.message); return; }

  await overlayCountdown();
  const phase = $("#studio-phase");
  phase.innerHTML = `
    <div class="phase-title"><span class="rec-dot"></span>PERFORMING — give it everything!</div>
    <div class="meter"><div class="meter-fill" id="st-meter"></div></div>
    <div class="rec-timer" id="st-timer">0.0s</div>
    <div class="row"><button class="btn bad" id="st-stop">■ Finish early</button></div>`;

  const session = startRecording(stream, $("#st-meter"));
  const started = performance.now();
  const timerEl = $("#st-timer");
  const tInt = setInterval(() => {
    timerEl.textContent = ((performance.now()-started)/1000).toFixed(1) + "s";
  }, 100);

  let done = false;
  const finish = async () => {
    if(done) return; done = true;
    clearInterval(tInt);
    const recDur = (performance.now()-started)/1000;
    const take = await session.stop();
    studioJudge(take, recDur, p);
  };
  $("#st-stop").onclick = finish;
  setTimeout(finish, p.dur*1000);
}

function studioJudge(take, recDur, prompt){
  const phase = $("#studio-phase");
  phase.innerHTML = `<div class="thinking">🧑‍⚖️ The judges are deliberating…</div>`;

  const power  = clamp(take.avgLevel/0.075, 0, 1) * 10;
  const refDur = prompt.kind === "tts" ? prompt.dur - 1.5 : recDur; // clip mode: unknown ref → lenient
  let timing;
  if(prompt.kind === "tts"){
    const r = recDur / refDur;
    timing = clamp(1 - Math.abs(1-r)*0.9, 0, 1) * 10;
  } else timing = 4 + take.speechRatio * 6;
  const drama = clamp(take.speechRatio*1.15, 0, 1) * 6 + Math.random()*4;
  const total = power + timing + drama;

  setTimeout(async () => {
    phase.innerHTML = `
      <div class="phase-title">The scores are in!</div>
      <div class="judges" id="st-judges"></div>
      <div class="total-score" id="st-total"></div>
      <div class="verdict" id="st-verdict"></div>
      <div class="row">
        <a class="btn ghost" id="st-dl" download="take.webm" href="${take.url}">⬇️ Save take</a>
        <button class="btn primary" id="st-next">Next ▶</button>
      </div>`;
    const jbox = $("#st-judges");
    JUDGES.forEach((j,i) => {
      const score = {power, timing, drama}[j.key];
      const d = document.createElement("div");
      d.className = "judge";
      d.innerHTML = `<div class="face">${j.face}</div><div class="jname">${j.name}</div>
        <div class="jlabel">${j.label}</div><div class="jscore">${score.toFixed(1)}</div>`;
      jbox.appendChild(d);
      setTimeout(() => d.classList.add("show"), 350 + i*450);
    });
    setTimeout(() => { $("#st-total").textContent = total.toFixed(1) + " / 30"; }, 350 + JUDGES.length*450 + 200);
    setTimeout(() => { $("#st-verdict").textContent = verdictFor(total); }, 350 + JUDGES.length*450 + 600);

    const S = G.studio;
    S.scores[S.queue[S.turn].player] += total;
    S.turn++;
    $("#st-next").textContent = S.turn >= S.queue.length ? "See final results 🏁" : "Next performer ▶";
    $("#st-next").onclick = studioNextTurn;
  }, 1400);
}

function studioFinalResults(){
  const S = G.studio;
  const board = Object.entries(S.scores).sort((a,b) => b[1]-a[1]);
  const medals = ["🥇","🥈","🥉","🏅"];
  $("#studio-hud-round").textContent = "Final results";
  $("#studio-hud-player").textContent = "";
  $("#studio-phase").innerHTML = `
    <div class="crown">👑</div>
    <div class="winner-banner">${escapeHtml(board[0][0])} wins the studio!</div>
    <div class="score-table">
      ${board.map((r,i) => `<div class="score-row"><span class="pos">${medals[i]}</span>
        <span class="nm">${escapeHtml(r[0])}</span><span class="pts">${r[1].toFixed(1)}</span></div>`).join("")}
    </div>
    <div class="row">
      <button class="btn primary" id="st-again">🔁 Play again</button>
      <button class="btn ghost" id="st-home">🏠 Home</button>
    </div>`;
  $("#st-again").onclick = () => { G.studio.turn = 0;
    G.studio.queue.forEach(()=>{}); // queue already consumed; rebuild
    const {players, rounds} = G.studio;
    G.studio.queue = [];
    for(let r=0;r<rounds;r++) for(const p of players) G.studio.queue.push({player:p, round:r+1});
    G.studio.scores = Object.fromEntries(players.map(p => [p,0]));
    G.studio.usedClips = []; G.studio.usedLines = [];
    studioNextTurn();
  };
  $("#st-home").onclick = () => showScreen("screen-home");
}

/* ---------------- source selects (packs + session uploads) ---------------- */
function currentVoicePack(){
  const sel = $("#studio-pack-select");
  const i = parseInt(sel ? sel.value : "", 10);
  return isNaN(i) ? null : (installedPacks[i] || null);
}
function refreshClipSelects(){
  // Studio: voice-pack dropdown
  const sp = $("#studio-pack-select");
  if(sp){
    const prev = sp.value;
    const vps = installedPacks.map((p,i) => ({p,i})).filter(x => x.p.type === "voice");
    sp.innerHTML = vps.length
      ? vps.map(x => `<option value="${x.i}">🎵 ${escapeHtml(x.p.name)}${x.p.author ? " — " + escapeHtml(x.p.author) : ""} · ${x.p.lines.length} lines</option>`).join("")
      : `<option value="">— no voice packs installed —</option>`;
    if(prev && sp.querySelector(`option[value="${prev}"]`)) sp.value = prev;
  }
  // Dub & Freestyle: scene dropdowns (dub packs + session uploads)
  for(const selId of ["dub-clip-select","free-clip-select"]){
    const sel = document.getElementById(selId);
    const prev = sel.value;
    let html = "";
    const dps = installedPacks.map((p,i) => ({p,i})).filter(x => x.p.type === "dub");
    if(dps.length){
      html += `<optgroup label="📦 Dub packs">` + dps.map(x =>
        `<option value="pack:${x.i}">🎬 ${escapeHtml(x.p.name)}${x.p.author ? " — " + escapeHtml(x.p.author) : ""}${x.p.dubLines.length ? ` · ${x.p.dubLines.length} lines` : ""}</option>`).join("") + `</optgroup>`;
    }
    const files = library.filter(i => i.type === "video" || i.type === "audio");
    if(files.length){
      html += `<optgroup label="⚡ Session uploads">` + files.map(f =>
        `<option value="file:${f.id}">${f.type === "video" ? "🎬" : "🎵"} ${escapeHtml(f.name)}</option>`).join("") + `</optgroup>`;
    }
    sel.innerHTML = html || `<option value="">— no packs or clips yet —</option>`;
    if(prev && sel.querySelector(`option[value="${CSS.escape(prev)}"]`)) sel.value = prev;
    wireSourcePreview(selId);
  }
}
function wireSourcePreview(selId){
  const sel = document.getElementById(selId);
  const vid = document.getElementById(selId === "dub-clip-select" ? "dub-preview" : "free-preview");
  watchMedia(vid, "the scene preview");
  const apply = () => {
    const s = getSource(selId);
    if(s){ vid.src = s.url; vid.classList.add("show"); }
    else { vid.removeAttribute("src"); vid.classList.remove("show"); }
  };
  sel.onchange = apply; apply();
}
function getSource(selId){
  const v = document.getElementById(selId).value || "";
  if(v.startsWith("pack:")){
    const p = installedPacks[+v.slice(5)];
    return p ? {kind:"pack", pack:p, url:p.videoUrl, name:p.name} : null;
  }
  if(v.startsWith("file:")){
    const item = library.find(i => String(i.id) === v.slice(5));
    return item ? {kind:"file", item, url:item.url, name:item.name} : null;
  }
  return null;
}
function wireUploadInto(inputId){
  document.getElementById(inputId).addEventListener("change", e => {
    addFiles(e.target.files); e.target.value = "";
  });
}
wireUploadInto("dub-upload");
wireUploadInto("free-upload");

/* ---------------- shared dub-screen builder ---------------- */
/** Builds the record/review/screen/vote flow used by Dub + Freestyle modes. */
function makeDubFlow(cfg){
  // cfg = { clip, maxDur (0=all), players, retakes:boolean, captions:null|{auto}|{custom:[...]},
  //         phaseEl, hudPlayer, hudStep, videoTag }
  let idx = 0;
  const takes = []; // {player,url}

  start();
  function start(){
    setHud(cfg.players[idx], cfg.retakes ? "Recording dub" : "Live take");
    introPhase();
  }
  function setHud(player, step){
    document.getElementById(cfg.hudPlayer).textContent = `🎤 ${player}`;
    document.getElementById(cfg.hudStep).textContent = step;
  }

  function introPhase(){
    const p = cfg.players[idx];
    cfg.phaseEl.innerHTML = `
      <div class="phase-title">${escapeHtml(p)}, you're up!</div>
      <p class="muted">${cfg.retakes
        ? "Watch the clip, then dub over it. Retakes are allowed."
        : "You get ONE preview, then you perform it live. No retakes."}</p>
      <video id="${cfg.videoTag}" class="game-vid" playsinline muted></video>
      <div class="row">
        <button class="btn ghost" id="dv-watch">▶ Preview clip ${cfg.retakes ? "(with sound)" : "(once!)"}</button>
        <button class="btn primary" id="dv-rec">${cfg.retakes ? "🎙️ Start dubbing" : "⚡ Go live"}</button>
      </div>`;
    const vid = document.getElementById(cfg.videoTag); watchMedia(vid, "the scene");
    vid.src = cfg.clip.url;
    let previewsUsed = 0;
    $("#dv-watch").onclick = async () => {
      if(!cfg.retakes && previewsUsed >= 1){ toast("That was your only preview! 😈"); return; }
      previewsUsed++;
      vid.muted = false; vid.currentTime = 0;
      await vid.play().catch(()=>{});
      if(cfg.maxDur){ const h = () => { if(vid.currentTime >= cfg.maxDur){ vid.pause(); vid.removeEventListener("timeupdate",h);} }; vid.addEventListener("timeupdate",h); }
    };
    $("#dv-rec").onclick = () => recordPhase();
  }

  async function recordPhase(){
    let stream;
    try{ stream = await ensureMic(); }
    catch(e){ toast("🎤 " + e.message); return; }
    stopCurrentAudio();

    cfg.phaseEl.innerHTML = `
      <div class="phase-title"><span class="rec-dot"></span>${cfg.originalAudio
        ? "RECORDING — perform over the scene, talk over the sound!"
        : "RECORDING — the original audio is muted!"}</div>
      <div class="rec-wrap">
        <video id="${cfg.videoTag}" class="game-vid" playsinline muted></video>
        <div class="caption-overlay" id="cap-overlay" style="display:none"></div>
      </div>
      <div class="meter"><div class="meter-fill" id="dv-meter"></div></div>
      <div class="rec-timer" id="dv-timer">0.0s</div>
      <div class="row"><button class="btn bad" id="dv-stop">■ Finish early</button></div>`;

    const vid = document.getElementById(cfg.videoTag); watchMedia(vid, "the scene");
    vid.src = cfg.clip.url; vid.muted = !cfg.originalAudio;

    // captions (freestyle)
    let capInt = null;
    if(cfg.captions){
      const overlay = $("#cap-overlay");
      const list = cfg.captions.custom && cfg.captions.custom.length ? cfg.captions.custom : null;
      let i = 0;
      capInt = setInterval(() => {
        overlay.style.display = "block";
        overlay.textContent = list ? list[i % list.length] : pick(AUTO_CAPTIONS);
        overlay.style.animation = "none"; void overlay.offsetWidth; overlay.style.animation = "";
        i++;
      }, 2800);
    }

    await overlayCountdown(cfg.retakes ? "🎬 ACTION!" : "🔴 ON AIR!");
    vid.currentTime = 0;
    await vid.play().catch(e => { toast("Couldn't start the clip: " + e.message); if(capInt) clearInterval(capInt); return; });

    const session = startRecording(stream, $("#dv-meter"));
    const started = performance.now();
    const timerEl = $("#dv-timer");
    const tInt = setInterval(() => timerEl.textContent = ((performance.now()-started)/1000).toFixed(1)+"s", 100);

    let done = false;
    const finish = async () => {
      if(done) return; done = true;
      if(capInt) clearInterval(capInt);
      clearInterval(tInt);
      vid.pause();
      const take = await session.stop();
      reviewPhase(take);
    };
    vid.addEventListener("ended", finish);
    if(cfg.maxDur){
      vid.addEventListener("timeupdate", () => { if(vid.currentTime >= cfg.maxDur) finish(); });
    }
    $("#dv-stop").onclick = finish;
  }

  function reviewPhase(take){
    const p = cfg.players[idx];
    cfg.phaseEl.innerHTML = `
      <div class="phase-title">Take review — ${escapeHtml(p)}</div>
      <video id="${cfg.videoTag}" class="game-vid" playsinline muted></video>
      <div class="row">
        <button class="btn primary" id="dv-play">▶ Watch my dub</button>
        ${cfg.retakes ? `<button class="btn ghost" id="dv-retake">🔁 Retake</button>` : ""}
        <button class="btn good" id="dv-lock">✅ Lock it in</button>
      </div>`;
    const vid = document.getElementById(cfg.videoTag); watchMedia(vid, "the scene");
    vid.src = cfg.clip.url; vid.muted = !cfg.originalAudio;
    $("#dv-play").onclick = () => playSynced(vid, take.url);
    const lock = $("#dv-lock"); if(lock) lock.onclick = () => {
      stopCurrentAudio(); vid.pause();
      takes.push({player:p, url:take.url});
      idx++;
      if(idx < cfg.players.length) start();
      else screeningPhase();
    };
    const rt = $("#dv-retake"); if(rt) rt.onclick = () => { vid.pause(); recordPhase(); };
  }

  function screeningPhase(){
    setHud("Everyone", "Screening");
    const order = takes.map((_,i)=>i);
    for(let i=order.length-1;i>0;i--){ const j=rand(i+1); [order[i],order[j]]=[order[j],order[i]]; }
    cfg.screenOrder = order;
    const letters = "ABCDEFGH";
    cfg.phaseEl.innerHTML = `
      <div class="phase-title">🍿 Screening time!</div>
      <p class="muted vote-note">Watch every take. Names are hidden… for now.</p>
      <video id="${cfg.videoTag}" class="game-vid" playsinline muted></video>
      <div class="take-grid">
        ${order.map((ti,k) => `<div class="take-card" id="tc-${k}">
          <div class="lbl">Take ${letters[k]}</div>
          <button class="btn primary" data-k="${k}">▶ Play</button>
        </div>`).join("")}
      </div>
      <div class="row"><button class="btn big primary" id="dv-vote">Start voting 🗳️</button></div>`;
    const vid = document.getElementById(cfg.videoTag); watchMedia(vid, "the scene");
    vid.src = cfg.clip.url; vid.muted = !cfg.originalAudio;
    $$(".take-card button").forEach(b => b.onclick = () => {
      $$(".take-card").forEach(c => c.classList.remove("playing"));
      document.getElementById("tc-"+b.dataset.k).classList.add("playing");
      playSynced(vid, takes[order[+b.dataset.k]].url);
    });
    $("#dv-vote").onclick = () => {
      stopCurrentAudio(); vid.pause();
      if(cfg.players.length >= 2) votePhase(); else resultsPhase();
    };
  }

  async function votePhase(){
    let voterIdx = 0;
    const votes = {};
    const letters = "ABCDEFGH";
    const nextVoter = () => {
      if(voterIdx >= cfg.players.length){ cfg.votes = votes; resultsPhase(); return; }
      const voter = cfg.players[voterIdx];
      setHud(voter, "Voting");
      cfg.phaseEl.innerHTML = `
        <div class="phase-title">🔒 ${escapeHtml(voter)}, you're voting</div>
        <p class="muted vote-note">Everyone else — eyes off the screen! Pass the device.</p>
        <div class="take-grid">
          ${cfg.screenOrder.map((ti,k) => `<div class="take-card">
            <div class="lbl">Take ${letters[k]}</div>
            <button class="btn ghost small" data-k="${k}" data-act="peek">▶ Peek</button>
            <button class="btn primary" data-k="${k}" data-act="vote">🗳️ Vote</button>
          </div>`).join("")}
        </div>`;
      const vid = document.createElement("video"); // hidden peek player
      vid.muted = false; vid.playsInline = true; vid.style.cssText = "width:100%;max-width:640px;border-radius:12px;margin-top:14px;background:#000;display:none";
      cfg.phaseEl.appendChild(vid);
      vid.src = cfg.clip.url; vid.muted = !cfg.originalAudio;
      cfg.phaseEl.querySelectorAll("[data-act='peek']").forEach(b => b.onclick = () => {
        playSynced(vid, takes[cfg.screenOrder[+b.dataset.k]].url);
      });
      cfg.phaseEl.querySelectorAll("[data-act='vote']").forEach(b => b.onclick = () => {
        stopCurrentAudio(); vid.pause();
        votes[voter] = cfg.screenOrder[+b.dataset.k];
        voterIdx++; nextVoter();
      });
    };
    nextVoter();
  }

  function resultsPhase(){
    setHud("Results", "🏆");
    // tally votes captured during votePhase (stored on cfg.votes)
    const tally = Object.fromEntries(takes.map((_,i)=>[i,0]));
    if(cfg.votes){
      for(const ti of Object.values(cfg.votes)) tally[ti] = (tally[ti]||0)+1;
    }
    const ranked = takes.map((t,i)=>({...t, idx:i, n: tally[i]||0})).sort((a,b)=>b.n-a.n);
    const letters = "ABCDEFGH";
    const hasVotes = cfg.players.length >= 2;
    cfg.phaseEl.innerHTML = `
      <div class="crown">👑</div>
      ${hasVotes ? `<div class="winner-banner">${escapeHtml(ranked[0].player)} delivers the best dub!</div>` : ""}
      <div class="score-table">
        ${ranked.map(r => `<div class="score-row">
          <span class="pos">${r===ranked[0] && hasVotes ? "🥇" : "🎬"}</span>
          <span class="nm">${escapeHtml(r.player)} <span class="muted small">(Take ${letters[cfg.screenOrder.indexOf(r.idx)]})</span></span>
          ${hasVotes ? `<span class="pts">${r.n} vote${r.n===1?"":"s"}</span>` : ""}
        </div>`).join("")}
      </div>
      <div class="row">
        ${takes.map((t,i)=>`<a class="btn small ghost" href="${t.url}" download="dub-${i+1}.webm">⬇️ ${escapeHtml(t.player)}</a>`).join("")}
      </div>
      <div class="row">
        <button class="btn primary" id="dv-again">🔁 Play again</button>
        <button class="btn ghost" id="dv-home">🏠 Home</button>
      </div>`;
    $("#dv-again").onclick = () => cfg.onRestart();
    $("#dv-home").onclick = () => showScreen("screen-home");
  }

  return { restart: () => { idx = 0; takes.length = 0; cfg.votes = null; start(); } };

  function playSynced(vid, url){
    stopCurrentAudio();
    vid.muted = !cfg.originalAudio; vid.currentTime = 0;
    const a = new Audio(url);
    const startAll = () => { a.currentTime = 0; a.play().catch(()=>{}); };
    vid.currentTime = 0;
    const p = vid.play();
    if(p && p.then) p.then(startAll).catch(()=>{}); else startAll();
    currentAudio = a;
    a.onended = () => {};
    vid.onended = () => { a.pause(); };
  }
}

/* ---------------- DUB MODE wiring ---------------- */
$("#dub-start").onclick = () => {
  const s = getSource("dub-clip-select");
  if(!s){ toast("Install a dub pack in packs_voice (or quick-add a clip) first!"); return; }
  const players = getPlayers("dub-players"); saveLastPlayers(players);
  const maxDur = +segValue("dub-length");
  const originalAudio = segValue("dub-orig") !== "off";
  showScreen("screen-dub-play");
  if(s.kind === "pack" && s.pack.dubLines.length){
    runPackDub();
    function runPackDub(){
      makePackDubFlow({
        pack: s.pack, players, maxDur, originalAudio,
        phaseEl: $("#dub-phase"), hudPlayer:"dub-hud-player", hudStep:"dub-hud-step",
        videoTag:"dv-video", onRestart: () => { showScreen("screen-dub-play"); runPackDub(); }
      });
    }
  } else {
    const clip = {url: s.url, name: s.name};
    runDub();
    function runDub(){
      makeDubFlow({
        clip, maxDur, players, retakes:true, captions:null, originalAudio,
        phaseEl: $("#dub-phase"), hudPlayer:"dub-hud-player", hudStep:"dub-hud-step",
        videoTag:"dv-video", onRestart: () => { showScreen("screen-dub-play"); runDub(); }
      });
    }
  }
};
$("#dub-quit").onclick = () => showScreen("screen-home");

/* ---------------- FREESTYLE wiring ---------------- */
$("#free-start").onclick = () => {
  const s = getSource("free-clip-select");
  if(!s){ toast("Install a dub pack in packs_voice (or quick-add a clip) first!"); return; }
  const players = getPlayers("free-players"); saveLastPlayers(players);
  const capMode = document.querySelector('input[name="free-cap"]:checked').value;
  const custom = $("#free-captions").value.split("\n").map(s=>s.trim()).filter(Boolean);
  const captions = capMode === "custom" && custom.length ? {custom} : {auto:true};
  const originalAudio = segValue("free-orig") !== "off";
  const clip = {url: s.url, name: s.name};
  showScreen("screen-free-play");
  runFree();
  function runFree(){
    makeDubFlow({
      clip, maxDur: 60, players, retakes:false, captions, originalAudio,
      phaseEl: $("#free-phase"), hudPlayer:"free-hud-player", hudStep:"free-hud-step",
      videoTag:"fv-video", onRestart: () => { showScreen("screen-free-play"); runFree(); }
    });
  }
};
$("#free-quit").onclick = () => showScreen("screen-home");

/* ---------------- home: mic check ---------------- */
$("#btn-mic-check").onclick = async () => {
  let stream;
  try{ stream = await ensureMic(); }
  catch(e){ toast("🎤 " + e.message); return; }
  const box = $("#mic-check-result");
  box.innerHTML = `Recording 3 seconds… speak now! <div class="meter"><div class="meter-fill" id="mc-meter"></div></div>`;
  const session = startRecording(stream, $("#mc-meter"));
  await sleep(3000);
  const take = await session.stop();
  box.innerHTML = `Playing it back… <div class="row"><button class="btn small ghost" id="mc-replay">🔁 Replay</button></div>`;
  playTakeAudio(take.url);
  $("#mc-replay").onclick = () => playTakeAudio(take.url);
  toast("✅ Microphone is working!");
};

/* ---------------- global wiring ---------------- */
$("#btn-home").onclick = () => showScreen("screen-home");
$$(".mode-card").forEach(c => c.onclick = () => showScreen(c.dataset.go));
wireSeg("studio-rounds"); wireSeg("dub-length"); wireSeg("dub-orig"); wireSeg("free-orig");

if("speechSynthesis" in window){
  speechSynthesis.onvoiceschanged = () => {};
}
buildPlayerInputs("studio-players", 2);
buildPlayerInputs("dub-players", 2);
buildPlayerInputs("free-players", 2);
renderLibrary();
refreshClipSelects();

/* ---------------- desktop app: packs_voice ---------------- */
function loadPacks(data){
  installedPacks = data.packs || [];
  renderPackCards();
  refreshClipSelects();
  const banner = $("#packs-folder-banner");
  if(banner){
    banner.classList.remove("hidden");
    banner.innerHTML = `📁 <b>packs_voice:</b> ${escapeHtml(data.dir)}<br>
      Each <b>folder</b> inside is one pack — drop pack folders in and they appear here automatically, even mid-game.
      <button class="btn small ghost" id="open-packs-folder" style="margin-left:8px">Open folder</button>`;
    $("#open-packs-folder").onclick = () => window.packsAPI.openFolder();
  }
}
function renderPackCards(){
  const box = $("#pack-cards");
  if(!box) return;
  if(!installedPacks.length){
    box.innerHTML = `<div class="lib-empty">No packs installed yet.<br>
      <span class="small">Put a pack folder into <b>packs_voice</b> — a folder of audio files becomes a <b>Voice Pack</b> (Studio Mode),
      a folder containing <b>dub_video</b> becomes a <b>Dub Pack</b> (Dub Mode).</span></div>`;
    return;
  }
  box.innerHTML = installedPacks.map((p) => `
    <div class="pack-card">
      <span class="pack-icon">${p.type === "dub" ? "🎬" : "🎵"}</span>
      <div class="pack-name">
        <div class="nm">${escapeHtml(p.name)}</div>
        <div class="small muted">${p.author ? "by " + escapeHtml(p.author) + " · " : ""}${p.type === "dub"
          ? `Dub pack${p.dubLines.length ? ` · ${p.dubLines.length} lines` : ""}${p.backingUrl ? " · backing track" : ""}`
          : `Voice pack · ${p.lines.length} lines`}</div>
      </div>
      <span class="tag">${p.type === "dub" ? "Dub" : "Voice"}</span>
    </div>`).join("");
}
if(window.packsAPI){
  window.packsAPI.onUpdate(loadPacks);
  window.packsAPI.request();
}

/* ---------------- PACK DUB FLOW (line-by-line, official style) ---------------- */
function getVideoDuration(url){
  return new Promise(res => {
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => res(v.duration || 0);
    v.onerror = () => res(0);
    v.src = url;
  });
}
function playPackDub(vid, pack, take){
  stopCurrentAudio();
  vid.muted = true; vid.currentTime = 0;
  if(pack.backingUrl){
    const b = new Audio(pack.backingUrl); b.volume = 0.55;
    currentAudios.push(b);
    currentTimers.push(setTimeout(() => b.play().catch(()=>{}), 60));
  }
  for(const L of take.lines){
    const a = new Audio(L.url);
    currentAudios.push(a);
    currentTimers.push(setTimeout(() => a.play().catch(()=>{}), Math.max(0, L.start*1000)));
  }
  const p = vid.play(); if(p && p.then) p.catch(()=>{});
  vid.onended = () => stopCurrentAudio();
}

function makePackDubFlow(cfg){
  let idx = 0;
  const takes = [];
  let starts = [];

  boot();
  async function boot(){
    const dur = await getVideoDuration(cfg.pack.videoUrl);
    cfg.videoDur = dur;
    const N = cfg.pack.dubLines.length;
    const total = cfg.maxDur > 0 ? cfg.maxDur : (dur || N*4);
    cfg.total = total;
    const parsed = cfg.pack.dubLines.map(l => l.time);
    starts = (parsed.length && parsed.every(t => typeof t === "number" && !isNaN(t)))
      ? parsed
      : Array.from({length:N}, (_,i) => +(i*(total/N)).toFixed(2));
    setHud(cfg.players[0], "Dub pack");
    introPhase();
  }
  function setHud(p, step){
    document.getElementById(cfg.hudPlayer).textContent = `🎤 ${p}`;
    document.getElementById(cfg.hudStep).textContent = step;
  }
  function lineWindow(k){
    const end = k < cfg.pack.dubLines.length-1
      ? starts[k+1]
      : Math.min(cfg.total || starts[k]+8, starts[k]+8);
    return clamp(end - starts[k], 1, 15);
  }

  function introPhase(){
    const p = cfg.players[idx];
    setHud(p, "Dub pack");
    cfg.phaseEl.innerHTML = `
      <div class="phase-title">${escapeHtml(p)}, you're dubbing “${escapeHtml(cfg.pack.name)}”</div>
      <p class="muted">${cfg.pack.dubLines.length} lines to record, one at a time — your takes get stitched back into the scene at the right timestamps. Retakes allowed per line.</p>
      <video id="${cfg.videoTag}" class="game-vid" playsinline muted></video>
      <div class="row">
        <button class="btn ghost" id="pk-watch">▶ Preview scene</button>
        <button class="btn primary" id="pk-start">🎙️ Start dubbing</button>
      </div>`;
    const vid = document.getElementById(cfg.videoTag); watchMedia(vid, "the scene");
    vid.src = cfg.pack.videoUrl;
    $("#pk-watch").onclick = () => { vid.muted = false; vid.currentTime = 0; vid.play().catch(()=>{}); };
    $("#pk-start").onclick = () => { vid.pause(); linePhase(0, []); };
  }

  function linePhase(k, recorded){
    const p = cfg.players[idx];
    setHud(p, `Line ${k+1}/${cfg.pack.dubLines.length}`);
    const line = cfg.pack.dubLines[k];
    cfg.phaseEl.innerHTML = `
      <div class="phase-title">Line ${k+1} of ${cfg.pack.dubLines.length}</div>
      <div class="line-card">
        ${line.imageUrl ? `<img class="line-char-img" src="${line.imageUrl}" alt="" onerror="this.style.display='none'">` : ""}
        ${line.character ? `<div class="mood">${escapeHtml(line.character)}</div>` : ""}
        <div class="line">${line.text ? `“${escapeHtml(line.text)}”` : `🎵 ${escapeHtml(line.name)}`}</div>
        <div class="small muted" style="margin-top:8px">Plays at ${starts[k].toFixed(1)}s into the scene · up to ${lineWindow(k).toFixed(1)}s long</div>
      </div>
      <div class="row">
        <button class="btn ghost" id="pk-hear">▶ Hear reference line</button>
        <button class="btn primary" id="pk-rec">🎙️ Record this line</button>
      </div>`;
    $("#pk-hear").onclick = () => playTakeAudio(line.audioUrl);
    $("#pk-rec").onclick = () => recordLine(k, recorded);
  }

  async function recordLine(k, recorded){
    let stream;
    try{ stream = await ensureMic(); }catch(e){ toast("🎤 " + e.message); return; }
    stopCurrentAudio();
    await overlayCountdown("🎬 LINE!");
    cfg.phaseEl.innerHTML = `
      <div class="phase-title"><span class="rec-dot"></span>SAY YOUR LINE!</div>
      <div class="meter"><div class="meter-fill" id="pk-meter"></div></div>
      <div class="rec-timer" id="pk-timer">0.0s</div>
      <div class="row"><button class="btn bad" id="pk-stop">■ Finish early</button></div>`;
    const session = startRecording(stream, $("#pk-meter"));
    const t0 = performance.now();
    const timerEl = $("#pk-timer");
    const tInt = setInterval(() => timerEl.textContent = ((performance.now()-t0)/1000).toFixed(1)+"s", 100);
    let done = false;
    const finish = async () => {
      if(done) return; done = true;
      clearInterval(tInt);
      const take = await session.stop();
      recorded[k] = {start: starts[k], url: take.url};
      lineReview(k, recorded);
    };
    $("#pk-stop").onclick = finish;
    setTimeout(finish, lineWindow(k)*1000);
  }

  function lineReview(k, recorded){
    const isLast = k >= cfg.pack.dubLines.length-1;
    cfg.phaseEl.innerHTML = `
      <div class="phase-title">Line ${k+1} in the can! 🎬</div>
      <div class="row">
        <button class="btn ghost" id="pk-play">▶ Hear my take</button>
        <button class="btn ghost" id="pk-retake">🔁 Retake line</button>
        <button class="btn primary" id="pk-next">${isLast ? "🎬 Assemble my dub" : "Next line ▶"}</button>
      </div>`;
    $("#pk-play").onclick = () => playTakeAudio(recorded[k].url);
    $("#pk-retake").onclick = () => { stopCurrentAudio(); linePhase(k, recorded); };
    $("#pk-next").onclick = () => { stopCurrentAudio(); if(isLast) assemblePhase(recorded); else linePhase(k+1, recorded); };
  }

  function assemblePhase(recorded){
    const p = cfg.players[idx];
    const take = {player: p, lines: recorded};
    cfg.phaseEl.innerHTML = `
      <div class="phase-title">🎬 ${escapeHtml(p)} — watch your full dub</div>
      <video id="${cfg.videoTag}" class="game-vid" playsinline muted></video>
      <div class="row">
        <button class="btn primary" id="pk-playfull">▶ Play assembled dub</button>
        <button class="btn ghost" id="pk-redo">🔁 Start my dub over</button>
        <button class="btn good" id="pk-lock">✅ Lock it in</button>
      </div>`;
    const vid = document.getElementById(cfg.videoTag); watchMedia(vid, "the scene");
    vid.src = cfg.pack.videoUrl; vid.muted = true;
    $("#pk-playfull").onclick = () => playPackDub(vid, cfg.pack, take);
    $("#pk-redo").onclick = () => { stopCurrentAudio(); vid.pause(); linePhase(0, []); };
    $("#pk-lock").onclick = () => {
      stopCurrentAudio(); vid.pause();
      takes.push(take);
      idx++;
      if(idx < cfg.players.length){ introPhase(); return; }
      runScreeningVote({
        phaseEl: cfg.phaseEl, hudPlayer: cfg.hudPlayer, hudStep: cfg.hudStep,
        players: cfg.players, takes, videoUrl: cfg.pack.videoUrl,
        playTake: (vid2, t) => playPackDub(vid2, cfg.pack, t),
        canDownload: false, onRestart: cfg.onRestart
      });
    };
  }
}

/* ---------------- shared screening / voting / results ---------------- */
function runScreeningVote(o){
  const letters = "ABCDEFGH";
  const order = o.takes.map((_,i) => i);
  for(let i=order.length-1;i>0;i--){ const j = rand(i+1); [order[i],order[j]] = [order[j],order[i]]; }
  let votes = null;

  screening();
  function screening(){
    document.getElementById(o.hudPlayer).textContent = "🍿 Everyone";
    document.getElementById(o.hudStep).textContent = "Screening";
    o.phaseEl.innerHTML = `
      <div class="phase-title">🍿 Screening time!</div>
      <p class="muted vote-note">Watch every take. Names are hidden… for now.</p>
      <video id="sv-video" class="game-vid" playsinline muted></video>
      <div class="take-grid">
        ${order.map((ti,k) => `<div class="take-card" id="svc-${k}">
          <div class="lbl">Take ${letters[k]}</div>
          <button class="btn primary" data-k="${k}">▶ Play</button>
        </div>`).join("")}
      </div>
      <div class="row"><button class="btn big primary" id="sv-vote">${o.players.length >= 2 ? "Start voting 🗳️" : "See results 🏁"}</button></div>`;
    const vid = document.getElementById("sv-video"); watchMedia(vid, "the scene");
    vid.src = o.videoUrl; vid.muted = true;
    o.phaseEl.querySelectorAll(".take-card button").forEach(b => b.onclick = () => {
      o.phaseEl.querySelectorAll(".take-card").forEach(c => c.classList.remove("playing"));
      document.getElementById("svc-"+b.dataset.k).classList.add("playing");
      o.playTake(vid, o.takes[order[+b.dataset.k]]);
    });
    $("#sv-vote").onclick = () => { stopCurrentAudio(); vid.pause(); if(o.players.length >= 2) vote(); else results(); };
  }
  function vote(){
    let voterIdx = 0; votes = {};
    next();
    function next(){
      if(voterIdx >= o.players.length){ results(); return; }
      const voter = o.players[voterIdx];
      document.getElementById(o.hudPlayer).textContent = `🎤 ${voter}`;
      document.getElementById(o.hudStep).textContent = "Voting";
      o.phaseEl.innerHTML = `
        <div class="phase-title">🔒 ${escapeHtml(voter)}, you're voting</div>
        <p class="muted vote-note">Everyone else — eyes off the screen! Pass the device.</p>
        <video id="sv-video" class="game-vid" playsinline muted style="margin-top:14px"></video>
        <div class="take-grid">
          ${order.map((ti,k) => `<div class="take-card">
            <div class="lbl">Take ${letters[k]}</div>
            <button class="btn ghost small" data-k="${k}" data-act="peek">▶ Peek</button>
            <button class="btn primary" data-k="${k}" data-act="vote">🗳️ Vote</button>
          </div>`).join("")}
        </div>`;
      const vid = document.getElementById("sv-video"); watchMedia(vid, "the scene");
      vid.src = o.videoUrl; vid.muted = true;
      o.phaseEl.querySelectorAll("[data-act='peek']").forEach(b => b.onclick = () => o.playTake(vid, o.takes[order[+b.dataset.k]]));
      o.phaseEl.querySelectorAll("[data-act='vote']").forEach(b => b.onclick = () => {
        stopCurrentAudio(); vid.pause();
        votes[voter] = order[+b.dataset.k];
        voterIdx++; next();
      });
    }
  }
  function results(){
    document.getElementById(o.hudPlayer).textContent = "🏆";
    document.getElementById(o.hudStep).textContent = "Results";
    const tally = Object.fromEntries(o.takes.map((_,i) => [i,0]));
    const hasVotes = o.players.length >= 2 && votes;
    if(hasVotes) for(const ti of Object.values(votes)) tally[ti] = (tally[ti]||0)+1;
    const ranked = o.takes.map((t,i) => ({...t, idx:i, n:tally[i]||0})).sort((a,b) => b.n-a.n);
    o.phaseEl.innerHTML = `
      <div class="crown">👑</div>
      ${hasVotes ? `<div class="winner-banner">${escapeHtml(ranked[0].player)} delivers the best dub!</div>` : ""}
      <div class="score-table">
        ${ranked.map(r => `<div class="score-row">
          <span class="pos">${r === ranked[0] && hasVotes ? "🥇" : "🎬"}</span>
          <span class="nm">${escapeHtml(r.player)} <span class="muted small">(Take ${letters[order.indexOf(r.idx)]})</span></span>
          ${hasVotes ? `<span class="pts">${r.n} vote${r.n===1?"":"s"}</span>` : ""}
        </div>`).join("")}
      </div>
      ${o.canDownload ? `<div class="row">${o.takes.map((t,i) => `<a class="btn small ghost" href="${t.url}" download="dub-${i+1}.webm">⬇️ ${escapeHtml(t.player)}</a>`).join("")}</div>` : ""}
      <div class="row">
        <button class="btn primary" id="sv-again">🔁 Play again</button>
        <button class="btn ghost" id="sv-home">🏠 Home</button>
      </div>`;
    $("#sv-again").onclick = () => o.onRestart();
    $("#sv-home").onclick = () => showScreen("screen-home");
  }
}
