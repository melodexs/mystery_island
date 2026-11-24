/* Stormbound audio: everything synthesized with the Web Audio API (no files). Rain, wind, surf, thunder and effects. */
let AC = null, master = null, rainG, windG, windF, surfG, surfF, humG, humO, noiseBuf, muted = false;
try { muted = localStorage.getItem("sb_muted") === "1"; } catch (e) {}
export const isMuted = () => muted;
export const debugLevels = () => AC ? { hum: +humG.gain.value.toFixed(4), surf: +surfG.gain.value.toFixed(4), rain: +rainG.gain.value.toFixed(4), master: +master.gain.value.toFixed(3), state: AC.state } : null;
export function setMuted(m) { muted = !!m; try { localStorage.setItem("sb_muted", muted ? "1" : "0"); } catch (e) {} if (master) master.gain.setTargetAtTime(muted ? 0 : 0.7, AC.currentTime, 0.04); }
export function audioInit() {
  if (AC) { if (AC.state === "suspended") AC.resume(); return; }
  try { AC = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
  master = AC.createGain(); master.gain.value = muted ? 0 : 0.7; master.connect(AC.destination);
  const mk = (secs) => { const b = AC.createBuffer(1, AC.sampleRate * secs, AC.sampleRate), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; return b; };
  noiseBuf = mk(3);
  const loop = (type, freq, q, vol) => { const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = AC.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q; const g = AC.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(master); s.start(); return { g, f }; };
  const r = loop("highpass", 2400, 0.4, 0.07); rainG = r.g; const w = loop("bandpass", 380, 0.7, 0.1); windG = w.g; windF = w.f; const sf = loop("lowpass", 520, 0.4, 0.04); surfG = sf.g; surfF = sf.f;
  humG = AC.createGain(); humG.gain.value = 0; humG.connect(master); for (const f of [50, 100.6, 150.3]) { const o = AC.createOscillator(); o.type = "sawtooth"; o.frequency.value = f; const lp = AC.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 260; const og = AC.createGain(); og.gain.value = f === 50 ? 0.5 : 0.18; o.connect(lp); lp.connect(og); og.connect(humG); o.start(); }
  const trem = AC.createOscillator(), tg = AC.createGain(); trem.frequency.value = 7.5; tg.gain.value = 0.015; trem.connect(tg); tg.connect(humG.gain); trem.start();
}
export function ambience(gust, rainAmt, nearSea, calm, genHum = 0, time = 0) { if (!AC) return; const n = AC.currentTime; rainG.gain.setTargetAtTime(0.07 * rainAmt, n, 0.4); windG.gain.setTargetAtTime((0.07 + gust * 0.18) * (calm ? 0.35 : 1), n, 0.3); windF.frequency.setTargetAtTime(300 + gust * 500, n, 0.3);
  const swell = 0.5 + 0.5 * Math.sin(time * 0.55) * Math.sin(time * 0.23 + 1);                       // slow, irregular wave rhythm: a wave rolls in, then draws back
  surfG.gain.setTargetAtTime(0.015 + nearSea * (0.03 + swell * 0.1), n, 0.35); surfF.frequency.setTargetAtTime(380 + swell * 700 * nearSea, n, 0.35);
  humG.gain.setTargetAtTime(0.11 * genHum, n, 0.5); }
const blip = (f, d, type = "sine", v = 0.18, slide = 0) => { if (!AC) return; const o = AC.createOscillator(), g = AC.createGain(), n = AC.currentTime; o.type = type; o.frequency.setValueAtTime(f, n); if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, f + slide), n + d); g.gain.setValueAtTime(v, n); g.gain.exponentialRampToValueAtTime(0.0001, n + d); o.connect(g); g.connect(master); o.start(); o.stop(n + d + 0.02); };
const puff = (d, f, v, type = "lowpass") => { if (!AC) return; const s = AC.createBufferSource(); s.buffer = noiseBuf; const fl = AC.createBiquadFilter(); fl.type = type; fl.frequency.value = f; const g = AC.createGain(), n = AC.currentTime; g.gain.setValueAtTime(v, n); g.gain.exponentialRampToValueAtTime(0.0001, n + d); s.connect(fl); fl.connect(g); g.connect(master); s.start(); s.stop(n + d + 0.02); };
export const thunder = () => { if (!AC) return; const s = AC.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = AC.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 180; const g = AC.createGain(), n = AC.currentTime; g.gain.setValueAtTime(0.0001, n); g.gain.exponentialRampToValueAtTime(0.7, n + 0.3); g.gain.exponentialRampToValueAtTime(0.25, n + 2); g.gain.exponentialRampToValueAtTime(0.0001, n + 4.8); f.frequency.exponentialRampToValueAtTime(55, n + 4.8); s.connect(f); f.connect(g); g.connect(master); s.start(); s.stop(n + 4.9); };
export const SND = {
  pickup: () => { [784, 988, 1319].forEach((f, i) => setTimeout(() => { blip(f, 0.5, "sine", 0.14); blip(f * 2.01, 0.3, "sine", 0.04); }, i * 85)); }, use: () => blip(300, 0.1, "square", 0.07), deny: () => blip(140, 0.18, "square", 0.08, -30),
  step: (sprint, surf) => { const v = sprint ? 1.5 : 1;
    if (surf === "sand") { puff(0.16, 650, 0.1 * v); puff(0.1, 1500, 0.035 * v, "bandpass"); }
    else if (surf === "rock") { puff(0.045, 3200, 0.17 * v, "highpass"); blip(210 + Math.random() * 40, 0.05, "square", 0.04 * v); }
    else if (surf === "wood") { blip(135 + Math.random() * 20, 0.09, "triangle", 0.16 * v); puff(0.05, 1100, 0.07 * v); }
    else { puff(0.09, 1700, 0.075 * v, "bandpass"); } }, jump: () => puff(0.12, 700, 0.09),
  land: (d) => puff(0.22, 230, Math.min(0.55, 0.14 + d * 0.05)), splash: () => puff(0.55, 1400, 0.28, "bandpass"), hurt: () => blip(150, 0.32, "sawtooth", 0.2, -60),
  win: () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.55, "triangle", 0.2), i * 170)), gen: () => { blip(70, 0.8, "sawtooth", 0.14, 40); puff(1, 300, 0.2); },
  door: () => puff(0.4, 420, 0.18), rope: () => puff(0.3, 1800, 0.1, "highpass"), click: () => blip(900, 0.05, "square", 0.05), beam: () => { blip(220, 1.2, "sine", 0.12, 440); }
};
