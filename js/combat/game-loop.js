/**
 * Fixed-timestep game loop.
 *
 * Simulation runs at SIM_HZ with an accumulator so combat is frame-rate
 * independent; rendering happens once per rAF. The loop pauses automatically
 * when the tab/app is backgrounded, which also stops the audio scheduler.
 */

import { SIM_DT, MAX_SIM_STEPS } from '../constants.js';
import settings from '../settings-manager.js';

export class GameLoop {
  /**
   * @param {(dt:number)=>void} update fixed-step simulation
   * @param {(alpha:number, frameDt:number)=>void} render
   */
  constructor(update, render) {
    this.update = update;
    this.render = render;
    this.running = false;
    this.rafId = 0;
    this.last = 0;
    this.acc = 0;
    this.frameBudget = 0;
    this.fps = 60;
    this._fpsAcc = 0;
    this._fpsFrames = 0;
    this.onPause = null;
    this.onResume = null;
    this._visHandler = () => {
      if (document.hidden) this.pause(true);
      else if (this.wasAutoPaused) this.start();
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.wasAutoPaused = false;
    this.last = performance.now();
    this.acc = 0;
    document.addEventListener('visibilitychange', this._visHandler);
    globalThis.addEventListener('pagehide', this._visHandler);
    this.rafId = requestAnimationFrame(this._tick);
    this.onResume?.();
  }

  pause(auto = false) {
    if (!this.running) return;
    this.running = false;
    this.wasAutoPaused = auto;
    cancelAnimationFrame(this.rafId);
    if (!auto) {
      document.removeEventListener('visibilitychange', this._visHandler);
      globalThis.removeEventListener('pagehide', this._visHandler);
    }
    this.onPause?.(auto);
  }

  stop() {
    this.pause(false);
    this.wasAutoPaused = false;
  }

  _tick = (now) => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this._tick);

    let frameDt = (now - this.last) / 1000;
    this.last = now;
    // A long stall (tab restored, phone woke up) must not fast-forward the match.
    if (frameDt > 0.25) frameDt = SIM_DT;

    // Optional frame-rate cap.
    const target = settings.values.fpsTarget;
    if (target && target < 120) {
      this.frameBudget += frameDt;
      const interval = 1 / target;
      if (this.frameBudget < interval * 0.92) return;
      frameDt = this.frameBudget;
      this.frameBudget = 0;
    }

    this._fpsAcc += frameDt;
    this._fpsFrames++;
    if (this._fpsAcc >= 0.5) {
      this.fps = this._fpsFrames / this._fpsAcc;
      this._fpsAcc = 0;
      this._fpsFrames = 0;
    }

    this.acc += frameDt;
    let steps = 0;
    while (this.acc >= SIM_DT && steps < MAX_SIM_STEPS) {
      this.update(SIM_DT);
      this.acc -= SIM_DT;
      steps++;
    }
    // If we are hopelessly behind, drop the backlog rather than spiralling.
    if (steps === MAX_SIM_STEPS) this.acc = 0;

    this.render(this.acc / SIM_DT, frameDt);
  };
}

export default GameLoop;
