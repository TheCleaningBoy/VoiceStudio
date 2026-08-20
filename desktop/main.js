const { app, BrowserWindow, session, ipcMain, shell } = require("electron");
const path = require("path");
const fs = require("fs");
const { pathToFileURL } = require("url");

const VIDEO_EXT = ["ogv","mp4","webm","mov","mkv","avi","m4v","mpg","mpeg","wmv"];
const AUDIO_EXT = ["ogg","mp3","wav","oga","m4a","aac","flac","opus","wma"];

let PACKS_DIR = null;
let mainWindow = null;

/* ---------------- helpers ---------------- */
const extOf = n => ((n.split(".").pop()) || "").toLowerCase();
const baseOf = n => n.replace(/\.[^.]+$/, "");
const isVideo = n => VIDEO_EXT.includes(extOf(n));
const isAudio = n => AUDIO_EXT.includes(extOf(n));
const packUrl = rel => pathToFileURL(path.join(PACKS_DIR, rel)).href;
// Direct file:// URLs — served by Chromium's own media stack (ranges etc.)

function parseIni(text){
  const o = {};
  for(const line of String(text).split(/\r?\n/)){
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if(m) o[m[1].toLowerCase()] = m[2];
  }
  return o;
}
/* Godot-style value helpers: quoted strings & arrays */
function iniString(raw){
  if(raw === undefined || raw === null) return null;
  let s = String(raw).trim();
  if(s.length >= 2 && s.startsWith('"') && s.endsWith('"')){
    s = s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, "\\");
  }
  return s === "" ? null : s;
}
function iniArray(raw){
  if(raw === undefined || raw === null) return [];
  let s = String(raw).trim();
  if(s.startsWith("[")) s = s.slice(1);
  if(s.endsWith("]")) s = s.slice(0, -1);
  return s.split(",").map(x => x.trim()).filter(Boolean);
}
function readIni(absPath){
  try{ return parseIni(fs.readFileSync(absPath, "utf8")); }catch(e){ return null; }
}
function parseTime(v){
  if(v === undefined || v === null) return null;
  const s = String(v).trim().replace(/,/g, ".");
  if(!s) return null;
  if(s.includes(":")){
    // mm:ss or hh:mm:ss, optional decimal seconds ("24:39.5" → 1479.5)
    const parts = s.split(":");
    if(parts.some(p => !/^\d+(\.\d+)?$/.test(p))){
      const f = parseFloat(s);
      return isNaN(f) ? null : f;
    }
    let t = 0;
    for(const p of parts) t = t * 60 + parseFloat(p);
    return t;
  }
  // plain decimal seconds ("4.070" → 4.07) — the "." is NOT a separator
  const f = parseFloat(s);
  return isNaN(f) ? null : f;
}
function firstKey(o, keys){
  for(const k of keys){ if(o[k] !== undefined && o[k] !== "") return o[k]; }
  return null;
}

/* ---------------- packs folder ---------------- */
function resolvePacksDir(){
  // Portable exe: folder next to the exe. Dev/other: Documents.
  const base = process.env.PORTABLE_EXECUTABLE_DIR || app.getPath("documents");
  return path.join(base, "packs_voice");
}

function ensurePacksDir(){
  try{
    fs.mkdirSync(PACKS_DIR, {recursive:true});
    const readme = path.join(PACKS_DIR, "PUT YOUR PACKS HERE.txt");
    if(!fs.existsSync(readme)){
      fs.writeFileSync(readme,
`VOICER STUDIO — packs_voice
===========================

Drop PACK FOLDERS into this folder. Each folder = one pack.
The game detects them automatically, even while it's running.

VOICE PACK (for Studio Mode)
  A folder full of audio files — each file is one line to imitate.
  Supported: ogg, mp3, wav, m4a, flac, aac, opus, wma

    packs_voice/
      My Sound Pack/
        01_line.ogg
        02_line.ogg
        ...

DUB PACK (for Dub Mode)
  A folder containing a scene video named dub_video (.ogv/.mp4/.webm/.mov...),
  one audio file per line (01_clip.ogg, 02_clip.ogg...) and a matching .ini
  file per line with its timestamp. Optional extras:
    _pack_info.ini    ->  title= / author=
    _backing_track.ogg->  music/ambience under your dub

    packs_voice/
      My Dub Pack/
        _pack_info.ini
        dub_video.ogv
        _backing_track.ogg
        01_clip.ogg
        01_clip.ini       (e.g.  time=2.5  character=Hero  text=Look out!)
        02_clip.ogg
        02_clip.ini

Tip: keep the whole author folder intact — don't flatten the files.
`);
    }
  }catch(e){ console.error("Could not create packs folder:", e); }
}

/* ---------------- pack scanning ---------------- */
function walkFiles(dir, rel, out){
  let entries;
  try{ entries = fs.readdirSync(dir, {withFileTypes:true}); }catch(e){ return; }
  for(const e of entries){
    const rp = rel ? rel + "/" + e.name : e.name;
    if(e.isDirectory()) walkFiles(path.join(dir, e.name), rp, out);
    else out.push({name: e.name, rel: rp, abs: path.join(dir, e.name)});
  }
}

function scanPacks(){
  const packs = [];
  let subdirs = [];
  try{
    subdirs = fs.readdirSync(PACKS_DIR, {withFileTypes:true})
      .filter(d => d.isDirectory() && !d.name.startsWith("."));
  }catch(e){ return packs; }

  for(const d of subdirs){
    const packDirAbs = path.join(PACKS_DIR, d.name);
    const files = [];
    walkFiles(packDirAbs, d.name, files);
    if(!files.length) continue;

    const infoFile = files.find(f => f.name.toLowerCase() === "_pack_info.ini");
    const info = infoFile ? readIni(infoFile.abs) : {};
    const name  = iniString(firstKey(info || {}, ["title","name","packname","pack_name"])) || d.name;
    const author = iniString(firstKey(info || {}, ["author","creator","by","madeby"]));

    const videos = files.filter(f => isVideo(f.name));
    const audios = files.filter(f => isAudio(f.name));

    // ---- DUB PACK: has dub_video.* (or any video) ----
    const dubVideo = videos.find(v => baseOf(v.name).toLowerCase() === "dub_video") || videos[0];
    if(dubVideo){
      const backing = audios.find(a => baseOf(a.name).toLowerCase().startsWith("_backing_track")) || null;
      const lineAudios = audios
        .filter(a => a !== backing && !a.name.startsWith("_"))
        .sort((a,b) => a.rel.localeCompare(b.rel, undefined, {numeric:true}));
      const dubLines = lineAudios.map(a => {
        const iniFile = files.find(f => baseOf(f.rel) === baseOf(a.rel) && f.name.toLowerCase().endsWith(".ini"));
        const ini = iniFile ? readIni(iniFile.abs) : {};
        // timestamps: official Godot-style  dub_timestamps=[0.0]
        let time = null;
        const tsArr = iniArray(ini ? ini["dub_timestamps"] : null);
        if(tsArr.length) time = parseTime(iniString(tsArr[0]));
        if(time === null) time = parseTime(iniString(firstKey(ini || {}, ["time","timestamp","start","seconds","sec","starttime","start_time"])));
        // character: official  dub_characters=["Clark"]
        const chArr = iniArray(ini ? ini["dub_characters"] : null).map(iniString).filter(Boolean);
        const character = chArr.length ? chArr[0] : iniString(firstKey(ini || {}, ["character","char","speaker"]));
        // line text: official  caption="..."
        const text = iniString(firstKey(ini || {}, ["caption","text","line","lyric","subtitle","quote"]));
        // character image referenced by the ini
        let imageUrl = null;
        const img = iniString(ini ? ini["image"] : null);
        if(img && iniFile){
          const dirRel = iniFile.rel.includes("/") ? iniFile.rel.slice(0, iniFile.rel.lastIndexOf("/")) : "";
          imageUrl = packUrl(dirRel ? dirRel + "/" + img : img);
        }
        return { name: baseOf(a.name), audioUrl: packUrl(a.rel), time, text, character, imageUrl };
      });
      packs.push({
        type: "dub", name, author, dir: d.name,
        videoUrl: packUrl(dubVideo.rel),
        backingUrl: backing ? packUrl(backing.rel) : null,
        dubLines
      });
      continue;
    }

    // ---- VOICE PACK: folder of audio lines ----
    if(audios.length){
      const lines = audios
        .filter(a => !a.name.startsWith("_"))
        .sort((a,b) => a.rel.localeCompare(b.rel, undefined, {numeric:true}))
        .map(a => ({name: baseOf(a.name), url: packUrl(a.rel)}));
      packs.push({type:"voice", name, author, dir: d.name, lines});
      continue;
    }

    // folder with no usable content — ignore
  }

  packs.sort((a,b) => a.name.localeCompare(b.name));
  return packs;
}

function sendPacks(){
  if(mainWindow && !mainWindow.isDestroyed()){
    mainWindow.webContents.send("packs:update", {dir: PACKS_DIR, packs: scanPacks()});
  }
}

function createWindow(){
  mainWindow = new BrowserWindow({
    width: 1180,
    height: 860,
    minWidth: 480,
    minHeight: 600,
    backgroundColor: "#0e0b16",
    title: "Voicer Studio",
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, "preload.js")
    }
  });
  mainWindow.loadFile(path.join(__dirname, "..", "index.html"));
  mainWindow.webContents.on("did-finish-load", sendPacks);
}

app.whenReady().then(() => {
  PACKS_DIR = resolvePacksDir();
  ensurePacksDir();


  // Auto-allow microphone access so the game just works
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    callback(permission === "media" || permission === "audioCapture");
  });

  createWindow();

  ipcMain.on("packs:request", () => sendPacks());
  ipcMain.on("packs:open", () => { shell.openPath(PACKS_DIR); });

  // Watch the folder so new packs appear live
  let t = null;
  try{
    fs.watch(PACKS_DIR, {recursive: true}, () => {
      clearTimeout(t);
      t = setTimeout(sendPacks, 600);
    });
  }catch(e){ console.error("watch failed:", e); }

  app.on("activate", () => {
    if(BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if(process.platform !== "darwin") app.quit();
});
