/* Stormbound input: keyboard, mouse-look (pointer lock or drag), and touch (stick, look-drag, buttons, arrows). */
export function createInput(canvas) {
  const I = { keys: new Set(), fx: 0, fz: 0, lookX: 0, lookY: 0, sprint: false, crouch: false, jumpEdge: false, useEdge: false, flashEdge: false, pauseEdge: false, touchOn: false, stickX: 0, stickY: 0, dp: { up: 0, down: 0, left: 0, right: 0 }, tSprint: false, tJump: false };
  const K = (e) => e.code;
  addEventListener("keydown", (e) => { const c = K(e); if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(c)) e.preventDefault(); if (e.repeat) return; I.keys.add(c); if (c === "Space") I.jumpEdge = true; if (c === "KeyE") I.useEdge = true; if (c === "KeyF") I.flashEdge = true; if (c === "Escape" || c === "KeyP") I.pauseEdge = true; });
  addEventListener("keyup", (e) => I.keys.delete(K(e))); addEventListener("blur", () => I.keys.clear());
  /* mouse look: pointer lock when available, else drag */
  let drag = false, lx = 0, ly = 0;
  canvas.addEventListener("mousedown", (e) => { if (I.touchOn) return; if (document.pointerLockElement !== canvas && canvas.requestPointerLock && !I.noLock) { try { canvas.requestPointerLock(); } catch (er) {} } drag = true; lx = e.clientX; ly = e.clientY; });
  addEventListener("mouseup", () => (drag = false));
  addEventListener("mousemove", (e) => { if (document.pointerLockElement === canvas) { I.lookX += e.movementX; I.lookY += e.movementY; } else if (drag) { I.lookX += e.clientX - lx; I.lookY += e.clientY - ly; lx = e.clientX; ly = e.clientY; } });
  /* touch */
  const stick = document.getElementById("stick"), knob = document.getElementById("knob"); let sId = null, sx0 = 0, sy0 = 0, lookId = null, tlx = 0, tly = 0;
  const setKnob = (dx, dy) => { knob.style.transform = `translate(${dx}px,${dy}px)`; };
  if (stick) {
    stick.addEventListener("pointerdown", (e) => { sId = e.pointerId; stick.setPointerCapture(sId); const r = stick.getBoundingClientRect(); sx0 = r.left + r.width / 2; sy0 = r.top + r.height / 2; I.touchOn = true; e.preventDefault(); });
    stick.addEventListener("pointermove", (e) => { if (e.pointerId !== sId) return; let dx = e.clientX - sx0, dy = e.clientY - sy0; const m = Math.hypot(dx, dy), R = 52; if (m > R) { dx *= R / m; dy *= R / m; } setKnob(dx, dy); I.stickX = dx / R; I.stickY = dy / R; });
    const end = (e) => { if (e.pointerId !== sId) return; sId = null; I.stickX = I.stickY = 0; setKnob(0, 0); }; stick.addEventListener("pointerup", end); stick.addEventListener("pointercancel", end);
  }
  canvas.addEventListener("pointerdown", (e) => { if (e.pointerType !== "touch") return; I.touchOn = true; lookId = e.pointerId; tlx = e.clientX; tly = e.clientY; });
  canvas.addEventListener("pointermove", (e) => { if (e.pointerType !== "touch" || e.pointerId !== lookId) return; I.lookX += (e.clientX - tlx) * 1.4; I.lookY += (e.clientY - tly) * 1.4; tlx = e.clientX; tly = e.clientY; });
  const upL = (e) => { if (e.pointerId === lookId) lookId = null; }; canvas.addEventListener("pointerup", upL); canvas.addEventListener("pointercancel", upL);
  const hold = (id, on, off) => { const b = document.getElementById(id); if (!b) return; b.addEventListener("pointerdown", (e) => { I.touchOn = true; b.setPointerCapture(e.pointerId); b.classList.add("on"); on(); e.preventDefault(); }); const o = () => { b.classList.remove("on"); off && off(); }; b.addEventListener("pointerup", o); b.addEventListener("pointercancel", o); };
  hold("b-sprint", () => (I.tSprint = true), () => (I.tSprint = false)); hold("b-jump", () => (I.jumpEdge = true)); hold("b-use", () => (I.useEdge = true));
  document.querySelectorAll(".dpad button").forEach((b) => { const k = b.dataset.k; b.addEventListener("pointerdown", (e) => { I.touchOn = true; b.setPointerCapture(e.pointerId); I.dp[k] = 1; e.preventDefault(); }); const o = () => (I.dp[k] = 0); b.addEventListener("pointerup", o); b.addEventListener("pointercancel", o); });
  /* read the movement axes for this frame. fx = strafe right, fz = forward(-1)/back(+1) in camera space */
  I.poll = () => { const k = I.keys; let x = (k.has("KeyD") || k.has("ArrowRight") ? 1 : 0) - (k.has("KeyA") || k.has("ArrowLeft") ? 1 : 0) + I.dp.right - I.dp.left, z = (k.has("KeyS") || k.has("ArrowDown") ? 1 : 0) - (k.has("KeyW") || k.has("ArrowUp") ? 1 : 0) + I.dp.down - I.dp.up;
    x += I.stickX; z += I.stickY; const m = Math.hypot(x, z); if (m > 1) { x /= m; z /= m; } I.fx = x; I.fz = z; I.sprint = k.has("ShiftLeft") || k.has("ShiftRight") || I.tSprint || (I.touchOn && Math.hypot(I.stickX, I.stickY) > 0.93); I.crouch = k.has("KeyC") || k.has("ControlLeft") || k.has("ControlRight"); };
  I.takeLook = () => { const l = [I.lookX, I.lookY]; I.lookX = I.lookY = 0; return l; };
  I.consume = (n) => { const v = I[n]; I[n] = false; return v; };
  return I;
}
