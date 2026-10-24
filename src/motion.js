const ease = 'cubic-bezier(.22,1,.36,1)';
export class Motion {
  constructor(preferences) { this.preferences = preferences; this.media = matchMedia('(prefers-reduced-motion: reduce)'); }
  get reduced() { return this.preferences()?.reducedMotion || this.media.matches; }
  run(node, frames, duration = 420, delay = 0) {
    if (!node) return Promise.resolve();
    node.getAnimations().forEach(animation => animation.cancel());
    if (this.reduced) return Promise.resolve();
    return node.animate(frames, { duration, delay, easing: ease, fill: 'backwards' }).finished.catch(() => {});
  }
  enter(nodes, distance = 12) {
    nodes.filter(Boolean).forEach((node, index) => this.run(node, [{ opacity: 0, transform: `translateY(${distance}px)` }, { opacity: 1, transform: 'translateY(0)' }], 550, index * 45));
  }
  async cover(title, note) {
    const curtain = document.getElementById('scene-curtain');
    document.getElementById('transition-title').textContent = title;
    document.getElementById('transition-note').textContent = note;
    curtain.hidden = false;
    await this.run(curtain, [{ opacity: 0 }, { opacity: 1 }], 220);
  }
  async reveal(ticket) {
    const curtain = document.getElementById('scene-curtain');
    await this.run(curtain, [{ opacity: 1 }, { opacity: 0 }], 520);
    if (ticket.current()) curtain.hidden = true;
  }
}
