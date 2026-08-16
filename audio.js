const EFFECTS = {
  click: "./assets/audio/click.ogg",
  chime: "./assets/audio/chime.ogg",
  event: "./assets/audio/event.ogg",
};

export class PilgrimAudio {
  constructor() {
    this.enabled = true;
    this.started = false;
    this.music = new Audio("./assets/audio/procession-loop.ogg");
    this.music.loop = true;
    this.music.volume = 0.2;
    this.effects = Object.fromEntries(
      Object.entries(EFFECTS).map(([name, src]) => {
        const sound = new Audio(src);
        sound.volume = 0.42;
        return [name, sound];
      }),
    );
  }

  async start() {
    this.started = true;
    if (!this.enabled) return;
    try {
      await this.music.play();
    } catch {
      // A later explicit interaction can retry playback.
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) this.music.pause();
    else if (this.started) void this.start();
  }

  play(name) {
    if (!this.enabled || !this.effects[name]) return;
    const effect = this.effects[name];
    effect.currentTime = 0;
    void effect.play().catch(() => {});
  }
}
