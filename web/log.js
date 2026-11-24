/* The Keeper's Log: the story of why the lighthouse went dark. Pages unlock as you find things, and the full journal opens from the cabin. */
export const LOG_PAGES = [
  { id: "p1", date: "3 October", title: "A quiet season", text: "The Marrow Light has burned every night for forty-one years. Old Tam trained me on it, and I have kept it since he went ashore. The lamp turns, the sea behaves, and the supply boat comes on Thursdays. I wrote that last line proudly. I should not have." },
  { id: "p2", date: "19 October", title: "The glass barometer", text: "The glass has dropped further than I have ever seen it. The gulls left in the night, all at once. The old hands say a storm that quiet before it starts is the kind that does not forgive. I have lashed the shutters and filled both generator cans." },
  { id: "p3", date: "21 October", title: "The night it came", text: "It struck at dusk. The wind took the porch rail first, then the aerial. The generator choked on the spray and died with the lamp half-turned. I climbed the stair by hand to crank it, and a gust threw me against the glass. That is when the cold got into me." },
  { id: "p4", date: "22 October", title: "What I did with the fuel", text: "Two cans were not enough for a night like this. I left one on the porch and carried the other down toward the wreck on the beach, thinking I might signal a ship with it. By the time I understood there was no ship, I could not climb back up. The rope is in the old ruins where I hid it from the weather." },
  { id: "p5", date: "23 October", title: "For whoever finds this", text: "The brass key opens the lamp room, and it is in the cabin. Refuel the generator first, because the lamp will not turn without it. Then climb, and light it. A lit beacon breaks the storm's hold on the sea, or so Tam always swore. I have never been brave enough to find out. Please be braver than I was." }
];
export function createLog(ui) {
  let open = false, page = 0, unlocked = new Set(["p1"]);
  const el = ui.root, body = ui.body, title = ui.title, date = ui.date, count = ui.count, prev = ui.prev, next = ui.next;
  const pages = () => LOG_PAGES.filter((p) => unlocked.has(p.id));
  function render() { const ps = pages(); page = Math.min(page, ps.length - 1); const p = ps[page]; title.textContent = p.title; date.textContent = p.date; body.textContent = p.text; count.textContent = `${page + 1} / ${ps.length}`; prev.disabled = page === 0; next.disabled = page >= ps.length - 1; }
  return {
    unlock(ids) { for (const i of ids) unlocked.add(i); }, unlocked: () => [...unlocked], setUnlocked(a) { unlocked = new Set(["p1", ...a]); },
    openAt(id) { const ps = pages(); const i = ps.findIndex((p) => p.id === id); page = i >= 0 ? i : ps.length - 1; open = true; el.classList.remove("hidden"); render(); },
    toggle() { open ? this.close() : this.openAt(); }, close() { open = false; el.classList.add("hidden"); }, isOpen: () => open,
    flip(d) { const ps = pages(); page = Math.max(0, Math.min(ps.length - 1, page + d)); render(); }
  };
}
