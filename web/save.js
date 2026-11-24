/* Stormbound save: one small JSON in localStorage. Survives reloads; ignores corrupt data; never crashes if storage is blocked. */
const KEY = "stormbound_save_v1";
export const Save = {
  read() { try { const d = JSON.parse(localStorage.getItem(KEY) || "null"); return d && d.v === 1 ? d : null; } catch (e) { return null; } },
  write(d) { try { localStorage.setItem(KEY, JSON.stringify(d)); return true; } catch (e) { return false; } },
  clear() { try { localStorage.removeItem(KEY); } catch (e) {} },
  /* a finished run keeps the last survivor so the menu can offer a replay with a different one */
  markComplete(key, time) { const prev = this.read() || {}; this.write({ v: 1, complete: true, key, time, last: key, runs: (prev.runs || 0) + 1 }); }
};
