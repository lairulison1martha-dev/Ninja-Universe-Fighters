/**
 * Application controller: routes between screens, runs matches and applies
 * results. Called by boot.js once initialisation has finished.
 */

import screens from './screen-manager.js';
import saveManager from './save-manager.js';
import settings from './settings-manager.js';
import audio from './audio-manager.js';
import input from './input-manager.js';
import roster from './roster-manager.js';
import progression from './progression-manager.js';
import unlocks from './unlock-manager.js';
import achievementsMgr from './achievements-manager.js';
import story from './story-manager.js';
import arcade from './arcade-manager.js';
import survival from './survival-manager.js';
import tower from './tower-manager.js';
import assets from './asset-loader.js';

import { MobileControls } from './mobile-controls.js';
import { CombatEngine, PHASE } from './combat/combat-engine.js';
import { GameLoop } from './combat/game-loop.js';
import { StageRenderer } from './combat/stage-renderer.js';
import { FighterRenderer } from './combat/fighter-renderer.js';
import { TrainingController, DUMMY_MODES } from './combat/training-controller.js';
import { canTransform } from './combat/transformation-system.js';
import { canSubstitute } from './combat/substitution-system.js';

import MenuScreen from './ui/menu-screen.js';
import SelectScreen from './ui/select-screen.js';
import StageScreen from './ui/stage-screen.js';
import ListScreen from './ui/list-screen.js';
import SettingsScreen from './ui/settings-screen.js';
import LayoutEditor from './ui/layout-editor.js';
import HUD from './ui/hud.js';
import {
  toast, confirmDialog, playDialogue, showPause, hidePause,
  showResults, hideResults, showCutIn, announce,
} from './ui/overlays.js';

import { FIGHTERS, ROSTER_SIZE } from './data/fighters.js';
import { STAGES } from './data/stages.js';
import { getChapter } from './data/story.js';
import { APP_VERSION, DIFFICULTY_LABELS, COMBAT } from './constants.js';
import { labelize } from './roster-manager.js';

const $ = (id) => document.getElementById(id);

export class Game {
  constructor() {
    this.engine = null;
    this.loop = null;
    this.training = null;
    this.ctx = null;
    this.canvas = $('combat-canvas');
    this.stageRenderer = new StageRenderer();
    this.hud = new HUD();
    this.touch = new MobileControls($('touch-controls'));
    this.pendingMatch = null;
    this.flow = null;     // { kind, data } for story/arcade/survival/tower
    this.dpr = 1;
    /** Which jutsu slot the single touch JUTSU button fires. */
    this.jutsuSlot = 0;
  }

  /* ----------------------------------------------------------------- init */

  init() {
    screens.init();

    this.menu = new MenuScreen((id) => this.onMenu(id));
    this.select = new SelectScreen((cfg) => this.onSelectConfirm(cfg));
    this.stageScreen = new StageScreen((cfg) => this.onStageConfirm(cfg));
    this.list = new ListScreen();
    this.settingsScreen = new SettingsScreen({
      openLayoutEditor: () => this.openLayoutEditor(),
      clearCache: () => this.clearCache(),
    });
    this.layoutEditor = new LayoutEditor(() => screens.back());

    this.touch.build();
    this.touch.onCycleJutsu = () => this.cycleJutsuSlot();
    this.touch.hide();

    screens.addEventListener('show', (e) => this.onScreenShown(e.detail));
    screens.addEventListener('back-root', () => {
      if (screens.is('menu')) return;
      screens.resetStack('menu');
    });
    screens.addEventListener('orientation', () => {
      this.resizeCanvas();
      this.touch.layout();
    });

    $('btn-pause').addEventListener('click', () => this.pauseMatch());

    settings.addEventListener('change', (e) => {
      const key = e.detail?.key;
      if (key === 'controlScale' || key === 'leftHanded' || key === 'controlOpacity'
        || key === 'layout') {
        this.touch.layout();
      }
      if (key === 'quality') {
        this.resizeCanvas();
        if (this.engine) this.stageRenderer.setStage(this.engine.stage, this.engine.variant);
      }
    });

    globalThis.addEventListener('resize', () => this.resizeCanvas(), { passive: true });
    globalThis.addEventListener('pagehide', () => saveManager.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        saveManager.flush();
        audio.suspend();
        if (this.engine && !this.engine.isPaused && screens.is('combat')) this.pauseMatch();
      } else {
        audio.resume();
      }
    });

    this.resizeCanvas();
    screens.resetStack('menu');
    this.menu.show();
  }

  onScreenShown({ name, prev }) {
    if (prev === 'menu' && name !== 'menu') this.menu.hide();
    if (name === 'menu') this.menu.show();
    if (name === 'combat') {
      this.resizeCanvas();
      if (settings.shouldShowTouchControls()) this.touch.show(); else this.touch.hide();
    } else {
      this.touch.hide();
    }
    if (prev === 'combat' && name !== 'combat') this.stopMatch();
    if (name === 'layout') this.layoutEditor.open();
    if (prev === 'layout' && name !== 'layout') this.layoutEditor.close();
    if (name === 'settings') this.settingsScreen.render();
  }

  /* ------------------------------------------------------------ routing -- */

  onMenu(id) {
    switch (id) {
      case 'continue': this.continueStory(); break;
      case 'story': this.showStory(); break;
      case 'versus': this.startVersusFlow(); break;
      case 'arcade': this.showArcade(); break;
      case 'survival': this.showSurvival(); break;
      case 'training': this.startTrainingFlow(); break;
      case 'tower': this.showTower(); break;
      case 'bossrush': this.showBossRush(); break;
      case 'collection': this.showCollection(); break;
      case 'achievements': this.showAchievements(); break;
      case 'settings': screens.show('settings'); break;
      case 'credits': this.showCredits(); break;
      default: break;
    }
  }

  /* ------------------------------------------------------------- versus -- */

  startVersusFlow() {
    this.flow = { kind: 'versus' };
    this.select.configure({
      title: 'Player vs AI', mode: 'versus', allowOpponent: true, showOptions: true,
    });
    screens.show('select');
  }

  startTrainingFlow() {
    this.flow = { kind: 'training' };
    this.select.configure({ title: 'Training', mode: 'training', allowOpponent: true, showOptions: false });
    screens.show('select');
  }

  onSelectConfirm(cfg) {
    this.pendingMatch = {
      playerId: cfg.playerId,
      opponentId: cfg.opponentId || roster.randomAny(cfg.playerId),
      playerCostume: cfg.playerCostume || 'default',
      opponentCostume: cfg.opponentCostume || 'default',
      difficulty: cfg.difficulty,
      rounds: cfg.rounds,
      timer: cfg.timer,
    };
    // Start fetching both fighters' art now, while the player picks a stage,
    // so startMatch usually finds it already registered.
    assets.loadFighterArt(this.pendingMatch.playerId, this.pendingMatch.playerCostume);
    assets.loadFighterArt(this.pendingMatch.opponentId, this.pendingMatch.opponentCostume);
    this.stageScreen.render();
    screens.show('stage');
  }

  onStageConfirm({ stageId }) {
    const variant = this.stageScreen.resolveVariant();
    const base = this.pendingMatch;
    const kind = this.flow?.kind;

    if (kind === 'training') {
      this.startMatch({
        ...base, stageId, variant, training: true, rounds: 1, timer: 0, difficulty: 'normal',
      });
      return;
    }
    if (kind === 'arcade' || kind === 'bossrush') {
      const run = kind === 'arcade'
        ? arcade.startLadder(this.flow.id, base.playerId, base.difficulty)
        : arcade.startBossRush(this.flow.id, base.playerId, base.difficulty);
      if (!run) { toast('Could not start that run.'); return; }
      this.startMatch({ ...run, variant });
      return;
    }
    if (kind === 'survival') {
      const run = survival.start(base.playerId);
      this.startMatch({ ...run, variant });
      return;
    }
    this.startMatch({ ...base, stageId, variant });
  }

  /* -------------------------------------------------------------- story -- */

  showStory() {
    const chapters = story.chapters();
    this.list.render({
      title: 'Story — The Severed Accord',
      sections: [{
        items: chapters.map((c) => ({
          title: `${c.index}. ${c.title}`,
          subtitle: c.unlocked ? c.summary : c.requirement,
          badge: c.completed ? 'Complete' : (c.unlocked ? `${c.completedNodes}/${c.nodeCount}` : 'Locked'),
          badgeClass: c.completed ? 'tag--complete' : (c.unlocked ? '' : 'tag--locked'),
          progress: c.progress,
          locked: !c.unlocked,
          tags: [c.subtitle],
          onClick: () => this.playChapter(c.id),
          onLockedClick: () => toast(c.requirement),
        })),
      }],
    });
    screens.show('list');
  }

  continueStory() {
    const point = story.continuePoint();
    if (!point) { toast('No story progress yet — start from chapter 1.'); this.showStory(); return; }
    this.playChapter(point.chapterId);
  }

  async playChapter(chapterId) {
    const node = story.nextNode(chapterId);
    if (!node) {
      const c = getChapter(chapterId);
      const answer = await confirmDialog({
        title: `${c.title} complete`,
        text: 'Replay this chapter from the beginning?',
        okLabel: 'Replay', danger: false,
      });
      if (answer) { story.resetChapter(chapterId); this.playChapter(chapterId); }
      return;
    }

    this.flow = { kind: 'story', chapterId, nodeId: node.id };

    if (node.type === 'dialogue') {
      const stage = STAGES[node.stage];
      this.list.render({
        title: getChapter(chapterId).title,
        single: true,
        sections: [{ items: [{ title: 'Scene', subtitle: stage.displayName, onClick: () => {} }] }],
      });
      screens.show('list');
      await playDialogue(node.lines);
      story.completeNode(chapterId, node.id);
      this.playChapter(chapterId);
      return;
    }

    // Battle node
    if (!saveManager.isFighterUnlocked(node.player)) {
      saveManager.update((d) => { if (!d.unlockedFighters.includes(node.player)) d.unlockedFighters.push(node.player); });
    }
    this.startMatch({
      playerId: node.player,
      opponentId: node.opponent,
      stageId: node.stage,
      variant: node.variant,
      difficulty: node.difficulty,
      rounds: node.rounds,
      timer: node.timer,
      conditions: (node.conditions || []).map((c) => c.id),
      mode: 'story',
      label: node.title,
    });
  }

  /* -------------------------------------------------------- arcade etc. -- */

  showArcade() {
    const ladders = arcade.ladders();
    this.list.render({
      title: 'Arcade',
      sections: [{
        items: ladders.map((l) => ({
          title: l.displayName,
          subtitle: l.unlocked ? l.description : l.requirement,
          badge: l.cleared ? 'Cleared' : (l.unlocked ? `${l.opponents.length} fights` : 'Locked'),
          badgeClass: l.cleared ? 'tag--complete' : (l.unlocked ? '' : 'tag--locked'),
          locked: !l.unlocked,
          tags: l.bestScore ? [`Best ${l.bestScore}`] : [],
          onClick: () => {
            this.flow = { kind: 'arcade', id: l.id };
            this.select.configure({ title: l.displayName, mode: 'arcade', allowOpponent: false, showOptions: true });
            screens.show('select');
          },
          onLockedClick: () => toast(l.requirement),
        })),
      }],
    });
    screens.show('list');
  }

  showBossRush() {
    const rushes = arcade.bossRushes();
    this.list.render({
      title: 'Boss Rush',
      sections: [{
        items: rushes.map((r) => ({
          title: r.displayName,
          subtitle: r.unlocked ? r.description : r.requirement,
          badge: r.cleared ? 'Cleared' : (r.unlocked ? `${r.opponents.length} bosses` : 'Locked'),
          badgeClass: r.cleared ? 'tag--complete' : (r.unlocked ? '' : 'tag--locked'),
          locked: !r.unlocked,
          onClick: () => {
            this.flow = { kind: 'bossrush', id: r.id };
            this.select.configure({ title: r.displayName, mode: 'bossrush', allowOpponent: false, showOptions: true });
            screens.show('select');
          },
          onLockedClick: () => toast(r.requirement),
        })),
      }],
    });
    screens.show('list');
  }

  showSurvival() {
    const rec = survival.records;
    this.list.render({
      title: 'Survival',
      single: true,
      sections: [{
        items: [{
          title: 'Start a survival run',
          subtitle: 'Fight wave after wave. You keep the health you finish each fight with, plus a small heal.',
          badge: `Best wave ${rec.bestWave}`,
          onClick: () => {
            this.flow = { kind: 'survival' };
            this.select.configure({ title: 'Survival', mode: 'survival', allowOpponent: false, showOptions: false });
            screens.show('select');
          },
        }, {
          title: 'Records',
          subtitle: `Best wave ${rec.bestWave} · Best score ${rec.bestScore} · ${rec.runs} runs`,
          onClick: () => toast(`Best wave ${rec.bestWave}, best score ${rec.bestScore}.`),
        }],
      }],
    });
    screens.show('list');
  }

  showTower() {
    const floors = tower.floors();
    const reach = tower.highestFloor;
    const visible = floors.filter((f) => f.floor <= reach + 3 || f.milestone);
    this.list.render({
      title: `Challenge Tower — floor ${reach} / 100`,
      search: true,
      sections: [{
        items: visible.map((f) => ({
          title: `Floor ${f.floor}${f.boss ? ' — Boss' : ''}`,
          subtitle: `${FIGHTERS[f.opponent].displayName} · ${STAGES[f.stage].displayName} · ${DIFFICULTY_LABELS[f.difficulty]}`,
          badge: f.cleared ? 'Cleared' : (f.unlocked ? 'Open' : 'Locked'),
          badgeClass: f.cleared ? 'tag--complete' : (f.unlocked ? '' : 'tag--locked'),
          tags: f.conditionLabels,
          locked: !f.unlocked,
          onClick: () => {
            this.flow = { kind: 'tower', floor: f.floor };
            this.select.configure({ title: `Tower floor ${f.floor}`, mode: 'tower', allowOpponent: false, showOptions: false });
            this.pendingTowerFloor = f.floor;
            screens.show('select');
          },
          onLockedClick: () => toast(`Clear floor ${f.floor - 1} first.`),
        })),
      }],
    });
    screens.show('list');
  }

  /* --------------------------------------------------------- collection -- */

  showCollection() {
    const unlocked = saveManager.data.unlockedFighters;
    const stages = saveManager.data.unlockedStages;
    const forms = saveManager.data.transformationsUnlocked;
    this.list.render({
      title: 'Collection',
      search: true,
      sections: [
        {
          title: `Fighters — ${unlocked.length} / ${roster.count}`,
          items: unlocked.map((id) => {
            const d = FIGHTERS[id];
            const m = saveManager.masteryLevel(id);
            return {
              title: d.displayName,
              subtitle: `${labelize(d.archetype)} · ${labelize(d.village)} · mastery ${m}/10`,
              badge: d.playableStatus === 'complete' ? 'Full move set' : 'Prototype',
              badgeClass: d.playableStatus === 'complete' ? 'tag--complete' : 'tag--proto',
              onClick: () => {
                this.select.configure({ title: 'Collection', mode: 'versus', allowOpponent: true });
                screens.show('select');
                this.select.openSheet(id);
              },
            };
          }),
        },
        {
          title: `Stages — ${stages.length} / ${Object.keys(STAGES).length}`,
          items: stages.map((id) => ({
            title: STAGES[id].displayName,
            subtitle: STAGES[id].description,
            onClick: () => toast(STAGES[id].description),
          })),
        },
        {
          title: `Transformations unlocked — ${forms.length}`,
          empty: 'Story and mastery progress unlocks extra forms.',
          items: forms.map((id) => ({
            title: id.replace(/_/g, ' '),
            subtitle: 'Unlocked',
            onClick: () => {},
          })),
        },
      ],
    });
    screens.show('list');
  }

  showAchievements() {
    const list = achievementsMgr.list();
    this.list.render({
      title: `Achievements — ${achievementsMgr.earnedCount} / ${achievementsMgr.total}`,
      search: true,
      sections: [{
        items: list.map((a) => ({
          title: a.name,
          subtitle: a.description,
          badge: a.earned ? 'Earned' : 'Locked',
          badgeClass: a.earned ? 'tag--complete' : 'tag--locked',
          tags: a.title ? [`Title: ${a.title}`] : [],
          onClick: () => {
            if (a.earned && a.title) {
              achievementsMgr.setActiveTitle(a.title);
              toast(`Title set: ${a.title}`);
            }
          },
        })),
      }],
    });
    screens.show('list');
  }

  showCredits() {
    this.list.render({
      title: 'Credits',
      single: true,
      sections: [],
      html: `
        <h3>Ninja Universe Fighters</h3>
        <p>Version ${APP_VERSION}. An offline, installable, single-player mobile arena fighter built with vanilla HTML, CSS and JavaScript — no framework, no build step, no backend. Every match is Player vs AI: you control one fighter, the CPU controls the one you chose to fight.</p>

        <h3>Original assets</h3>
        <ul>
          <li>The app icon is generated procedurally by <code>tools/generate-icons.py</code>. The editable master is <code>assets/icons/icon-source.svg</code>.</li>
          <li>Stages and every visual effect are drawn at runtime from data — no downloaded art.</li>
          <li>Fighter sprites are generated pixel art — see below.</li>
          <li>All music and sound effects are synthesised with the Web Audio API at runtime.</li>
          <li>All ${ROSTER_SIZE} fighters have their own sprite set and portrait; the procedural silhouette renderer remains as the fallback if art fails to load.</li>
          <li>Alternate ages, masks, Edo versions and awakenings are costumes and transformations on their main fighter, not extra roster cards.</li>
        </ul>

        <h3>Fighter sprites</h3>
        <p>Every fighter has their own sprite set under
        <code>assets/fighters/&lt;id&gt;/</code> — 19 animations, 84 frames, 64×64
        pixel art with a transparent background and a shared ground line. The art
        is generated, not drawn over anything: <code>tools/fighter_art.py</code>
        rasterises a posed skeleton from each fighter's design record, so hair,
        build, clothing, gear and palette differ per character. No image is read
        as input by the build, so there is nothing traced or sampled.</p>
        <p>The twenty starters have hand-authored design records; the rest are
        derived from their own roster data. Sets load per match rather than at
        boot — the whole roster is several megabytes — and the twenty starters
        are precached for offline play.</p>

        <h3>Names and likenesses</h3>
        <p>Character and technique names reference well-known series characters for a private prototype. No copyrighted artwork, sprites, logos, screenshots, music or voice lines are used or downloaded anywhere in this project, and every asset path is structured so names and art can be replaced later.</p>

        <h3>Story</h3>
        <p>"The Severed Accord" is an original campaign written for this project. It does not adapt or retell any published episode.</p>

        <h3>Built with</h3>
        <ul>
          <li>HTML5, CSS3, vanilla ES modules</li>
          <li>Canvas 2D for combat, DOM for menus</li>
          <li>Web App Manifest + service worker for offline play</li>
          <li>localStorage for saves</li>
        </ul>`,
    });
    screens.show('list');
  }

  /* --------------------------------------------------------------- match -- */

  async startMatch(cfg) {
    // Tower runs resolve their configuration here so the stage screen is skipped.
    if (this.flow?.kind === 'tower' && this.pendingTowerFloor) {
      const run = tower.start(this.pendingTowerFloor, cfg.playerId);
      this.pendingTowerFloor = null;
      if (!run) { toast('That floor is not open yet.'); return; }
      cfg = { ...run, variant: run.variant };
    }

    this.stopMatch();

    // Fighter art is fetched per match, not at boot. Both fighters' sets have
    // to be registered before the engine constructs them, because a Fighter
    // picks up its sheet in its constructor. A set that fails to load simply
    // leaves that fighter on the procedural renderer.
    await Promise.all([
      assets.loadFighterArt(cfg.playerId, cfg.playerCostume),
      assets.loadFighterArt(cfg.opponentId, cfg.opponentCostume),
    ]);

    const engine = new CombatEngine();
    engine.setup({
      playerId: cfg.playerId,
      opponentId: cfg.opponentId,
      stageId: cfg.stageId,
      variant: cfg.variant,
      difficulty: cfg.difficulty,
      rounds: cfg.rounds,
      timer: cfg.timer,
      playerCostume: cfg.playerCostume,
      opponentCostume: cfg.opponentCostume,
      conditions: cfg.conditions,
      opponentHealthBonus: cfg.opponentHealthBonus,
      startHealth: cfg.startHealth,
      training: !!cfg.training,
      mode: cfg.mode || this.flow?.kind || 'versus',
    });
    this.engine = engine;
    this.matchConfig = cfg;

    this.stageRenderer.setStage(engine.stage, engine.variant);
    this.hud.bind(engine);
    this.hud.show();

    engine.addEventListener('announce', (e) => announce(e.detail.text, e.detail.seconds));
    engine.addEventListener('cutin', (e) => showCutIn(e.detail.fighter, e.detail.ability));
    engine.addEventListener('match-end', (e) => this.onMatchEnd(e.detail));
    engine.addEventListener('transform', (e) => {
      if (e.detail.fighter === engine.player) this.setupTouchLabels(engine.player);
    });

    if (cfg.training) {
      this.training = new TrainingController(engine);
    } else {
      this.training = null;
      this.hud.setTraining('');
    }

    audio.playMusic(engine.stage.musicId);
    this.setupTouchLabels(engine.player);

    this.loop = new GameLoop((dt) => this.update(dt), (a, fdt) => this.render(a, fdt));
    this.loop.onPause = (auto) => { if (auto && engine.phase !== PHASE.PAUSED) this.pauseMatch(); };
    this.loop.start();

    screens.show('combat');
    this.resizeCanvas();
    saveManager.pushRecent(cfg.playerId);
  }

  stopMatch() {
    if (this.loop) { this.loop.stop(); this.loop = null; }
    if (this.engine) { this.engine.destroy(); this.engine = null; }
    this.training = null;
    hidePause();
    hideResults();
    this.hud.hide();
    this.touch.releaseAll();
    input.releaseAll();
  }

  /**
   * Short, readable button text for a jutsu. Multi-word techniques become
   * initials ("Shadow Clone Jutsu" → SCJ); single words are truncated
   * ("Rasengan" → RASEN). Filler words are dropped first so the initials stay
   * meaningful.
   */
  static abbreviate(name, fallback) {
    if (!name) return fallback;
    const words = name
      .replace(/[:!'’]/g, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .filter((w) => !/^(of|the|a|an|style|art|release|jutsu|technique)$/i.test(w));
    const useful = words.length ? words : name.split(/\s+/).filter(Boolean);
    if (useful.length >= 2) return useful.slice(0, 3).map((w) => w[0].toUpperCase()).join('');
    return useful[0].slice(0, 5).toUpperCase();
  }

  setupTouchLabels(fighter) {
    this.jutsuSlot = 0;
    this.refreshJutsuButton(fighter);
  }

  /**
   * The touch HUD carries one JUTSU button, so its caption names the slot it
   * will fire and the chip beside it steps to the next one. A fighter with a
   * single jutsu never sees the chip.
   */
  refreshJutsuButton(fighter) {
    const slots = (fighter || this.engine?.player)?.abilities.slots || [];
    const usable = slots.filter(Boolean);
    if (this.jutsuSlot >= slots.length || !slots[this.jutsuSlot]) this.jutsuSlot = 0;
    const a = slots[this.jutsuSlot];
    // With one jutsu the caption is simply JUTSU, as designed. With more than
    // one it names the selected technique, so the cycle chip beside it means
    // something rather than changing an unlabelled thing.
    this.touch.setLabel('jutsu', usable.length > 1 ? Game.abbreviate(a?.displayName, 'JUTSU') : 'JUTSU');
    this.touch.setDisabled('jutsu', !a);
    if (this.touch.cycleEl) this.touch.cycleEl.hidden = usable.length < 2;
  }

  /** Step the touch JUTSU button to the fighter's next available slot. */
  cycleJutsuSlot() {
    const slots = this.engine?.player?.abilities.slots || [];
    if (slots.filter(Boolean).length < 2) return;
    for (let i = 1; i <= slots.length; i++) {
      const next = (this.jutsuSlot + i) % slots.length;
      if (slots[next]) { this.jutsuSlot = next; break; }
    }
    this.refreshJutsuButton();
    audio.play('sfx_ui_move', { volume: 0.4 });
  }

  /* ---------------------------------------------------------- simulation -- */

  update(dt) {
    const e = this.engine;
    if (!e) return;
    input.tick(dt);
    if (!e.isPaused) this.readInput(dt);
    e.step(dt);
    this.training?.update(dt);
  }

  readInput(dt) {
    const e = this.engine;
    const f = e.player;
    const st = input.p1;
    if (e.phase !== PHASE.FIGHT || f.isDead) return;

    // Movement
    const ax = st.axis.x;
    const ay = st.axis.y;
    const dead = 0.18;

    if (st.consume('pause')) { this.pauseMatch(); return; }

    // Guard is a hold.
    f.setGuard(st.isHeld('guard'));

    if (!f.guardHeld) {
      if (Math.abs(ax) > dead) {
        f.walk(Math.sign(ax), Math.abs(ax) > 0.62);
      } else if (!f.airborne && f.state !== 'attack') {
        f.walk(0);
      }
      if (ay > 0.6) f.crouch(true); else f.crouch(false);
    }

    if (st.consume('jump')) f.jump();
    if (st.consume('dash')) {
      const dir = Math.abs(ax) > dead ? Math.sign(ax) : f.facing;
      f.dash(dir, e.ctx(f));
    }
    if (st.consume('substitution')) {
      if (canSubstitute(f)) e.requestSubstitution(f);
      else audio.play('sfx_ui_error', { volume: 0.5 });
    }
    // The touch HUD has no Substitution button. Tapping GUARD while being hit
    // spends a stock instead — the escape input every fighting game already
    // trains, so the mechanic survives the smaller button set.
    if (f.state === 'hitstun' && st.consume('guard') && canSubstitute(f)) {
      e.requestSubstitution(f);
    }
    if (st.consume('awaken')) {
      const check = canTransform(f);
      if (check.ok) e.requestTransform(f);
      else { toast(check.reason); audio.play('sfx_ui_error', { volume: 0.6 }); }
    }
    if (st.consume('assist')) {
      if (!e.assists.call(f)) audio.play('sfx_ui_error', { volume: 0.5 });
    }

    // Attacks
    if (st.consume('light')) this.attack(f, 'light', ax, ay);
    if (st.consume('heavy')) this.attack(f, 'heavy', ax, ay);
    if (st.consume('jutsu1')) this.useSlot(f, 0);
    if (st.consume('jutsu2')) this.useSlot(f, 1);
    if (st.consume('jutsu3')) this.useSlot(f, 2);
    // The touch HUD has one JUTSU button; it fires whichever slot is selected.
    if (st.consume('jutsu')) this.useSlot(f, this.jutsuSlot);
    if (st.consume('ultimate')) {
      const ult = f.abilities.ultimate;
      if (ult && f.use(ult)) e.onUltimateStarted(f, ult);
      else audio.play('sfx_ui_error', { volume: 0.5 });
    }

    // Chakra charge: the dedicated CHAKRA button, or the original
    // guard-and-crouch hold, which keyboard and gamepad players still use.
    f.charging = (st.isHeld('chakra') || (f.guardHeld && ay > 0.6))
      && !f.airborne && f.state !== 'attack';
  }

  attack(f, kind, ax, ay) {
    const e = this.engine;
    const opp = e.other(f);
    const dist = Math.abs(opp.x - f.x);

    // Throw: heavy while very close and holding toward the opponent.
    if (kind === 'heavy' && !f.airborne && dist < 110 && Math.sign(ax) === f.facing && Math.abs(ax) > 0.4) {
      if (f.use(f.abilities.throw)) return;
    }
    // Launcher: light/heavy while holding up.
    if (ay < -0.55 && !f.airborne) {
      if (f.use(f.abilities.launcher)) return;
    }
    // Dash attack while dashing.
    if (f.state === 'dash') {
      if (f.use(f.abilities.dash)) return;
    }

    if (f.airborne) {
      const chain = f.data.airCombos;
      if (f.act) {
        for (const id of chain) if (f.tryChain(id)) return;
      }
      const first = e.abilityById(kind === 'heavy' ? chain[chain.length - 1] : chain[0]);
      if (first && f.use(first)) return;
      audio.play('sfx_ui_error', { volume: 0.4 });
      return;
    }

    if (kind === 'heavy') {
      if (f.act) {
        // Cancel a connected basic into the heavy.
        if (f.tryChain(f.abilities.heavy.id)) return;
      }
      if (f.use(f.abilities.heavy)) return;
      return;
    }

    // Light: walk the ground chain.
    const chain = f.data.basicCombos;
    if (f.act) {
      const idx = chain.indexOf(f.act.ability.id);
      if (idx >= 0 && idx + 1 < chain.length && f.tryChain(chain[idx + 1])) return;
      return;
    }
    const opener = e.abilityById(chain[0]);
    if (opener) f.use(opener);
  }

  useSlot(f, index) {
    const a = f.abilities.slots[index];
    if (!a) { audio.play('sfx_ui_error', { volume: 0.4 }); return; }
    const check = f.canUse(a);
    if (!check.ok) {
      audio.play('sfx_ui_error', { volume: 0.5 });
      if (this.engine.isTraining) toast(`${a.displayName}: ${check.reason}`);
      return;
    }
    f.use(a);
  }

  /* ---------------------------------------------------------- rendering -- */

  resizeCanvas() {
    const canvas = this.canvas;
    if (!canvas) return;
    const dpr = settings.renderScale;
    const w = canvas.clientWidth || globalThis.innerWidth;
    const h = canvas.clientHeight || globalThis.innerHeight;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    this.dpr = dpr;
    this.ctx = canvas.getContext('2d', { alpha: false });
    // Fighter art is pixel art drawn at ~3x. Bilinear smoothing would blur it,
    // so it is off for the whole combat canvas; the stage renderer draws
    // gradients and paths, which do not go through the image sampler.
    this.ctx.imageSmoothingEnabled = false;
    this.stageRenderer.resize(w, h);
    if (this.engine) this.engine.camera.resize(w, h);
    this.touch.layout();
  }

  render(alpha, frameDt) {
    const e = this.engine;
    const ctx = this.ctx;
    if (!e || !ctx) return;

    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    this.stageRenderer.drawSky(ctx, w, h);

    ctx.save();
    e.camera.applyTo(ctx);
    this.stageRenderer.draw(ctx, e.camera, frameDt);

    // assists behind fighters
    for (const s of e.assists.live()) {
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = s.assist.color;
      ctx.beginPath();
      ctx.ellipse(s.x, -(s.y + 60), 42 * s.assist.size, 56 * s.assist.size, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    for (const f of e.fighters) FighterRenderer.draw(ctx, f, frameDt);

    // projectiles
    for (const p of e.projectiles.live()) {
      const spec = p.spec;
      ctx.save();
      ctx.translate(p.x, -p.y);
      ctx.rotate(Math.atan2(-p.vy, p.vx));
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, p.radius * 2);
      g.addColorStop(0, spec.color2 || '#fff');
      g.addColorStop(0.5, spec.color);
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      if (spec.shape === 'beam') {
        ctx.fillRect(-p.radius * 3, -p.radius, p.radius * 6, p.radius * 2);
      } else if (spec.shape === 'shard') {
        ctx.beginPath();
        ctx.moveTo(p.radius * 1.8, 0);
        ctx.lineTo(-p.radius, -p.radius * 0.7);
        ctx.lineTo(-p.radius, p.radius * 0.7);
        ctx.closePath();
        ctx.fill();
      } else if (spec.shape === 'ring') {
        ctx.strokeStyle = spec.color;
        ctx.lineWidth = p.radius * 0.5;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 0.5, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, p.radius * 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }

    // particles
    const parts = e.effects.p;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      if (!p.active) continue;
      const life = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, life);
      ctx.fillStyle = p.color;
      const sx = p.x;
      const sy = -p.y;
      if (p.kind === 'streak') {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.angle);
        ctx.fillRect(-p.size * 3, -p.size * 0.3, p.size * 6, p.size * 0.7);
        ctx.restore();
      } else if (p.kind === 'shard') {
        ctx.save();
        ctx.translate(sx, sy);
        ctx.rotate(p.angle);
        ctx.fillRect(-p.size, -p.size, p.size * 2, p.size * 2);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(sx, sy, p.size * (p.kind === 'flame' ? life + 0.4 : 1), 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // damage numbers
    ctx.textAlign = 'center';
    ctx.font = '700 26px system-ui, sans-serif';
    for (const n of e.effects.numbers) {
      if (!n.active) continue;
      const a = 1 - n.age / n.life;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = n.color;
      ctx.save();
      ctx.translate(n.x, -n.y);
      ctx.scale(n.size, n.size);
      ctx.strokeStyle = 'rgba(0,0,0,.6)';
      ctx.lineWidth = 4;
      ctx.strokeText(n.text, 0, 0);
      ctx.fillText(n.text, 0, 0);
      ctx.restore();
    }
    ctx.globalAlpha = 1;

    ctx.restore();

    this.hud.update();
    this.updateTouchFeedback();
    if (this.training) this.hud.setTraining(this.training.readout(input.p1));
  }

  /**
   * Keep every button honest about what it can do right now: ready ring,
   * cooldown sweep, or dimmed and unpressable. A control that looks live but
   * refuses is worse than one that says up front it is not available, so the
   * disabled state here is the same check `readInput` makes.
   */
  updateTouchFeedback() {
    const f = this.engine?.player;
    if (!f) return;
    const slot = f.abilities.slots[this.jutsuSlot];
    this.touch.setCooldown('jutsu', f.cooldownFrac(slot));
    this.touch.setDisabled('jutsu', !slot);

    const ult = f.abilities.ultimate;
    const ultReady = !!ult && f.canUse(ult).ok;
    this.touch.setCooldown('ultimate', f.cooldownFrac(ult));
    this.touch.setReady('ultimate', ultReady);
    this.touch.setDisabled('ultimate', !ultReady);

    const awakenReady = canTransform(f).ok;
    this.touch.setReady('awaken', awakenReady);
    this.touch.setDisabled('awaken', !awakenReady);

    // Chakra can only be gathered with both feet down and nothing in progress.
    this.touch.setDisabled('chakra', f.airborne || f.state === 'attack' || f.chakra >= COMBAT.chakraMax);

    void canSubstitute;
  }

  /* ------------------------------------------------------------- pausing -- */

  pauseMatch() {
    const e = this.engine;
    if (!e || e.isPaused) return;
    e.pause();
    this.touch.releaseAll();
    input.releaseAll();
    audio.duck(0.3, 0.2);

    const actions = [
      { label: 'Resume', className: 'btn--primary', onClick: () => this.resumeMatch() },
      { label: 'Restart', onClick: () => { hidePause(); this.startMatch(this.matchConfig); } },
    ];
    if (this.training) {
      actions.push({ label: 'Training options', onClick: () => { hidePause(); this.showTrainingOptions(); } });
      actions.push({ label: 'Reset positions', onClick: () => { this.training.reset(); this.resumeMatch(); } });
    }
    actions.push({ label: 'Quit to menu', className: 'btn--danger', onClick: () => this.quitMatch() });
    showPause(actions);
  }

  resumeMatch() {
    hidePause();
    this.engine?.resume();
    audio.applyVolumes();
  }

  async quitMatch() {
    const ok = await confirmDialog({
      title: 'Quit the match?',
      text: 'Progress in this match will be lost.',
      okLabel: 'Quit',
    });
    if (!ok) return;
    hidePause();
    arcade.abandon();
    survival.abandon();
    tower.abandon();
    this.stopMatch();
    screens.resetStack('menu');
  }

  showTrainingOptions() {
    const t = this.training;
    this.list.render({
      title: 'Training options',
      single: true,
      sections: [{
        items: [
          ...['infiniteHealth', 'infiniteChakra', 'infiniteSubstitution'].map((key) => ({
            title: { infiniteHealth: 'Infinite health', infiniteChakra: 'Infinite chakra', infiniteSubstitution: 'Infinite substitution' }[key],
            subtitle: t.settings[key] ? 'On' : 'Off',
            badge: t.settings[key] ? 'On' : 'Off',
            badgeClass: t.settings[key] ? 'tag--complete' : '',
            onClick: () => { t.set(key, !t.settings[key]); this.showTrainingOptions(); },
          })),
          ...DUMMY_MODES.map((m) => ({
            title: `Dummy: ${m.label}`,
            subtitle: t.settings.dummy === m.id ? 'Selected' : '',
            badge: t.settings.dummy === m.id ? '✓' : '',
            onClick: () => { t.set('dummy', m.id); this.showTrainingOptions(); },
          })),
          {
            title: 'Frame data display',
            subtitle: t.settings.showFrameData ? 'On' : 'Off',
            onClick: () => { t.set('showFrameData', !t.settings.showFrameData); this.showTrainingOptions(); },
          },
          {
            title: 'Input display',
            subtitle: t.settings.showInputs ? 'On' : 'Off',
            onClick: () => { t.set('showInputs', !t.settings.showInputs); this.showTrainingOptions(); },
          },
        ],
      }],
      footer: [
        { label: 'Back to training', className: 'btn--primary', onClick: () => { screens.show('combat'); this.resumeMatch(); } },
      ],
    });
    screens.show('list');
  }

  /* ------------------------------------------------------------ results -- */

  onMatchEnd(detail) {
    const cfg = this.matchConfig;
    if (cfg.training) return;   // training never ends

    const player = this.engine.player;
    const won = detail.playerWon;
    const healthFrac = Math.max(0, player.health / player.maxHealth);

    const summary = progression.awardMatch({
      playerId: cfg.playerId,
      won,
      mode: cfg.mode || 'versus',
      stats: detail.stats,
      roundWins: detail.roundWins,
      difficulty: cfg.difficulty || 'normal',
      perfect: !!player.roundPerfect,
      comeback: !!player.roundComeback,
      ultimateFinish: !!player.ultimateFinish,
    });

    const rows = [
      { label: 'Rounds', value: `${detail.roundWins[0]} – ${detail.roundWins[1]}` },
      { label: 'Damage dealt', value: Math.round(detail.stats.player.damageDealt) },
      { label: 'Damage taken', value: Math.round(detail.stats.player.damageTaken) },
      { label: 'Best combo', value: detail.stats.player.maxCombo },
      { label: 'XP earned', value: `+${summary.xp}` },
      { label: 'Ryo earned', value: `+${summary.coins}` },
    ];

    const actions = [];
    const kind = this.flow?.kind;

    if (kind === 'story') {
      if (won) {
        const res = story.completeNode(this.flow.chapterId, this.flow.nodeId);
        if (res.rewards?.unlocked?.length) {
          summary.newlyUnlocked = [...(summary.newlyUnlocked || []), ...res.rewards.unlocked];
        }
        actions.push({
          label: 'Continue', className: 'btn--primary',
          onClick: () => { hideResults(); this.stopMatch(); this.playChapter(this.flow.chapterId); },
        });
      } else {
        actions.push({
          label: 'Retry', className: 'btn--primary',
          onClick: () => { hideResults(); this.startMatch(cfg); },
        });
      }
      actions.push({ label: 'Story menu', onClick: () => { hideResults(); this.stopMatch(); this.showStory(); } });
    } else if (kind === 'arcade' || kind === 'bossrush') {
      const res = arcade.reportResult(won, healthFrac);
      if (res.done && res.won) {
        rows.push({ label: 'Run score', value: res.score });
        actions.push({ label: 'Finish', className: 'btn--primary', onClick: () => { hideResults(); this.stopMatch(); screens.resetStack('menu'); } });
      } else if (res.done) {
        actions.push({
          label: 'Continue (−150 score)', className: 'btn--primary',
          onClick: () => {
            const next = arcade.continueRun();
            hideResults();
            if (next) this.startMatch({ ...next, variant: cfg.variant });
            else { this.stopMatch(); screens.resetStack('menu'); }
          },
        });
        actions.push({ label: 'Give up', onClick: () => { hideResults(); arcade.abandon(); this.stopMatch(); screens.resetStack('menu'); } });
      } else {
        rows.push({ label: 'Next', value: res.next.label });
        actions.push({
          label: 'Next fight', className: 'btn--primary',
          onClick: () => { hideResults(); this.startMatch({ ...res.next, variant: cfg.variant }); },
        });
        actions.push({ label: 'Quit run', onClick: () => { hideResults(); arcade.abandon(); this.stopMatch(); screens.resetStack('menu'); } });
      }
    } else if (kind === 'survival') {
      const res = survival.reportResult(won, healthFrac);
      rows.push({ label: 'Wave reached', value: res.wave });
      rows.push({ label: 'Score', value: Math.round(res.score) });
      if (res.done) {
        if (res.record) rows.push({ label: 'New record', value: 'Yes' });
        actions.push({ label: 'Finish', className: 'btn--primary', onClick: () => { hideResults(); this.stopMatch(); screens.resetStack('menu'); } });
      } else {
        actions.push({
          label: 'Next wave', className: 'btn--primary',
          onClick: () => { hideResults(); this.startMatch({ ...res.next, variant: cfg.variant }); },
        });
        actions.push({ label: 'End run', onClick: () => { hideResults(); survival.abandon(); this.stopMatch(); screens.resetStack('menu'); } });
      }
    } else if (kind === 'tower') {
      const res = tower.reportResult(won);
      if (res.cleared) {
        rows.push({ label: 'Floor cleared', value: this.flow.floor });
        if (res.next) {
          actions.push({
            label: 'Next floor', className: 'btn--primary',
            onClick: () => { hideResults(); this.flow = { kind: 'tower', floor: res.next.label.replace('Floor ', '') | 0 }; this.startMatch(res.next); },
          });
        }
        actions.push({ label: 'Tower menu', onClick: () => { hideResults(); this.stopMatch(); this.showTower(); } });
      } else {
        actions.push({ label: 'Retry', className: 'btn--primary', onClick: () => { hideResults(); this.startMatch(cfg); } });
        actions.push({ label: 'Tower menu', onClick: () => { hideResults(); this.stopMatch(); this.showTower(); } });
      }
    } else {
      actions.push({ label: 'Rematch', className: 'btn--primary', onClick: () => { hideResults(); this.startMatch(cfg); } });
      actions.push({ label: 'Change fighters', onClick: () => { hideResults(); this.stopMatch(); this.startVersusFlow(); } });
      actions.push({ label: 'Main menu', onClick: () => { hideResults(); this.stopMatch(); screens.resetStack('menu'); } });
    }

    unlocks.refresh();
    achievementsMgr.check();

    showResults({
      title: won ? 'Victory' : 'Defeat',
      rows,
      level: summary.xpProgress,
      unlocks: summary.newlyUnlocked,
      achievements: summary.newAchievements,
      actions,
    });
    audio.playMusic('bgm_results');
  }

  /* ------------------------------------------------------------- utility -- */

  openLayoutEditor() {
    screens.show('layout');
  }

  async clearCache() {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration();
      reg?.active?.postMessage({ type: 'CLEAR_CACHE' });
    }
    if ('caches' in globalThis) {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('nuf-')).map((n) => caches.delete(n)));
    }
  }
}

export const game = new Game();
export default game;
