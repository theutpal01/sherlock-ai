import Phaser from 'phaser';
import { gameEvents } from '../events/bridge';
import {
  FURNITURE,
  STATIC_FLOOR_STYLES,
  STATIC_WALL_STYLES,
  STARFALL_PROPS,
  GREENHOUSE_PROPS,
  MIDNIGHT_MAIL_PROPS,
  IDLE_FRAMES,
  characterAssetId,
  decorSpots,
  ensureArt,
  ensureCharAnims,
  prefersReducedMotion,
  type Facing,
} from '../art';
import { characterAssetIdsForCase } from '../portraits';
import { Plate } from '../labels';
import { Player } from '../entities/Player';
import { InteractionManager, type InteractableEntry } from '../interactions/InteractionManager';
import { NPC_RADIUS, getLayout, roomName, type CaseLayout, type DoorLayout, type RoomLayout } from '../layouts';
import { resetTouch } from '../touch';

type WallSide = 'top' | 'bottom' | 'left' | 'right';

interface DoorGap {
  door: DoorLayout;
  wall: WallSide;
  span: [number, number];
}

const WALL = 16;
const WARP_COOLDOWN_MS = 600;
const EVIDENCE_MARKER_COLOR = 0x38bdf8;
const ACTIVE_MARKER_COLOR = 0xf59e0b;

export interface NpcSync {
  id: string;
  label: string;
  roomId: string;
  role?: string;
}

interface DoorConfigSync {
  doors: Array<{
    between: [string, string];
    locked: boolean;
    unlock_evidence?: string | null;
    lock_hint?: string;
  }>;
}

/**
 * Data-driven manor scene: room rects, portals, objects, and NPC spots
 * all come from the active case layout. No backend calls here — movement
 * stays local; meaningful interactions emit bridge events for React.
 */
export class Scene extends Phaser.Scene {
  private player!: Player;
  private interactions!: InteractionManager;
  private layout!: CaseLayout;
  private currentRoomId = '';
  private faceTick = 0;
  private lastWarpAt = 0;
  private lastLockedNoticeAt = Number.NEGATIVE_INFINITY;
  private roomLabel!: Phaser.GameObjects.Text;
  private evidenceCounter!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private bannerHideTimer: Phaser.Time.TimerEvent | null = null;
  private npcMarkers = new Map<string, { dot: Phaser.GameObjects.Sprite; plate: Plate }>();
  private objectPlates = new Map<string, Plate>();
  private doorPlates = new Map<string, Plate>();
  private doorLeaves = new Map<string, Phaser.GameObjects.Rectangle[]>();
  private doorUnlockEvidence = new Map<string, string>();
  private doorLockHints = new Map<string, string>();
  private doorLockIcons = new Map<string, Phaser.GameObjects.Image>();
  private doorBarriers = new Map<string, Phaser.GameObjects.Rectangle>();
  private doorColliders = new Map<string, Phaser.Physics.Arcade.Collider>();
  private evidenceMarkers = new Map<string, Phaser.GameObjects.Rectangle>();
  private discovered = new Set<string>();
  private activeEvidenceId: string | null = null;
  private npcRooms = new Map<string, string>();
  /** Every text plate with a live anchor: y-sorted, proximity-boosted. */
  private plates: Array<{ id: string; plate: Plate; pos: () => { x: number; y: number } }> = [];
  private activePlateId: string | null = null;
  private plateTick = 0;
  private lastFootstepPosition: { x: number; y: number } | null = null;
  private footstepDistance = 0;
  private gamepadInteractWasDown = false;
  private bridgeOffs: Array<() => void> = [];
  private blurOff: (() => void) | null = null;
  private alive = false;
  private dailySeed: number | null = null;

  constructor() {
    super('manor');
  }

  preload(): void {
    const caseId = (this.registry.get('caseId') as string) || 'blackwood_manor';
    for (const style of STATIC_FLOOR_STYLES) {
      const key = `tile-floor-${style}`;
      if (!this.textures.exists(key)) this.load.image(key, `assets/floors/${style}.png`);
    }
    for (const style of STATIC_WALL_STYLES) {
      const key = `tile-wall-${style}`;
      if (!this.textures.exists(key)) this.load.image(key, `assets/walls/${style}.png`);
    }
    // Load only the detective and cast sheets used by this case.
    for (const id of characterAssetIdsForCase(caseId)) {
      const key = `char-${id}`;
      if (!this.textures.exists(key)) {
        this.load.spritesheet(key, `assets/cast/${id}.png`, {
          frameWidth: 24,
          frameHeight: 32,
        });
      }
    }
    for (const name of FURNITURE) {
      const key = `furn-${name}`;
      if (!this.textures.exists(key)) {
        this.load.image(key, `assets/furniture/${name}.png`);
      }
    }
    for (const name of STARFALL_PROPS) {
      const key = `prop-${name}`;
      if (!this.textures.exists(key)) this.load.image(key, `assets/props/${name}.png`);
    }
    for (const name of GREENHOUSE_PROPS) {
      const key = `prop-${name}`;
      if (!this.textures.exists(key)) this.load.image(key, `assets/props/${name}.png`);
    }
    for (const name of MIDNIGHT_MAIL_PROPS) {
      const key = `prop-${name}`;
      if (!this.textures.exists(key)) this.load.image(key, `assets/props/${name}.png`);
    }
  }

  create(): void {
    this.alive = true;
    this.discovered.clear();
    this.lastLockedNoticeAt = Number.NEGATIVE_INFINITY;
    this.doorPlates.clear();
    this.doorLeaves.clear();
    this.doorUnlockEvidence.clear();
    this.doorLockHints.clear();
    this.doorLockIcons.clear();
    this.doorBarriers.clear();
    this.doorColliders.clear();
    const caseId = (this.registry.get('caseId') as string) || 'blackwood_manor';
    ensureArt(this);
    for (const id of characterAssetIdsForCase(caseId)) ensureCharAnims(this, id);
    const dailySeed = this.registry.get('dailySeed');
    this.dailySeed = typeof dailySeed === 'number' && Number.isSafeInteger(dailySeed) ? dailySeed : null;
    this.layout = getLayout(caseId);
    const requestedRoomId = this.registry.get('initialRoomId') as string | undefined;
    const requestedRoom = this.layout.rooms.find(
      (room) => room.id === requestedRoomId && this.layout.spawns[room.id],
    );
    this.currentRoomId = requestedRoom?.id ?? this.layout.startRoom;
    this.physics.world.setBounds(0, 0, this.layout.worldW, this.layout.worldH);
    this.buildRooms();
    this.buildAtmosphere();

    const spawn = this.layout.spawns[this.currentRoomId] ?? this.layout.spawns[this.layout.startRoom]!;
    this.player = new Player(this, spawn.x, spawn.y);
    this.lastFootstepPosition = { x: spawn.x, y: spawn.y };

    const shapes = this.children.getAll() as Phaser.GameObjects.Rectangle[];
    for (const shape of shapes) {
      if (shape.getData?.('solid')) {
        this.physics.add.existing(shape, true);
        this.physics.add.collider(this.player.sprite, shape);
      }
    }

    this.buildDoors();
    this.buildObjects();
    const evidenceTotal = new Set(this.layout.objects.flatMap((obj) => obj.evidence ? [obj.evidence] : [])).size;
    this.evidenceCounter = this.add
      .text(948, 10, `EVIDENCE 0/${evidenceTotal}`, {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '9px',
        color: '#bae6fd',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 6 },
      })
      .setOrigin(1, 0)
      .setScrollFactor(0)
      .setDepth(30)
      .setInteractive({ useHandCursor: true });
    this.evidenceCounter.on('pointerdown', () => {
      gameEvents.emit({ type: 'OPEN_EVIDENCE_NOTEBOOK' });
    });
    this.updateEvidenceCounter();

    this.cameras.main.setBounds(0, 0, this.layout.worldW, this.layout.worldH);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);

    const startName = roomName(this.layout, this.currentRoomId);
    this.roomLabel = this.add
      .text(12, 10, startName.toUpperCase(), {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '12px',
        color: '#e7e5e4',
        backgroundColor: '#000000aa',
        padding: { x: 8, y: 6 },
      })
      .setScrollFactor(0)
      .setDepth(30);
    this.banner = this.add
      .text(480, 120, '', {
        fontFamily: '"Press Start 2P", monospace',
        fontSize: '22px',
        color: '#fde68a',
        backgroundColor: '#000000cc',
        padding: { x: 16, y: 12 },
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(30)
      .setAlpha(0);

    this.interactions = new InteractionManager(this);
    this.interactions.bind(this.objectEntries(), this.player);

    this.bridgeOffs.push(
      gameEvents.subscribe((event) => {
        if (event.type === 'DOOR_CONFIG_SYNC') {
          this.syncDoorConfig((event.payload as DoorConfigSync).doors ?? []);
        } else if (event.type === 'WORLD_SYNC') {
          this.syncWorld((event.payload as { npcs: NpcSync[] }).npcs);
        } else if (event.type === 'INTERACTION_STARTED') {
          const payload = event.payload as { objectId?: string };
          if (payload.objectId) this.sparkleAtObject(payload.objectId);
        } else if (event.type === 'NPC_DIALOGUE_STARTED') {
          this.scene.pause();
        } else if (event.type === 'PAUSE_GAME') {
          this.scene.pause();
        } else if (event.type === 'RESUME_GAME') {
          this.gamepadInteractWasDown = Boolean(this.input.gamepad?.pad1?.A);
          this.scene.resume();
        } else if (event.type === 'INTERACT_PRESSED') {
          if (!this.scene.isPaused()) this.interactions.tryInteract();
        } else if (event.type === 'INTERACTION_AVAILABLE') {
          const payload = event.payload as { kind: string | null; id: string | null };
          if (this.activeEvidenceId) {
            this.evidenceMarkers.get(this.activeEvidenceId)
              ?.setFillStyle(EVIDENCE_MARKER_COLOR, 0.8)
              .setStrokeStyle(1, 0xe0f2fe, 0.9)
              .setScale(1);
          }
          this.activePlateId =
            payload.kind === 'object' && payload.id
              ? `obj:${payload.id}`
              : payload.kind === 'npc' && payload.id
                ? `npc:${payload.id}`
                : null;
          const activeObject = payload.kind === 'object'
            ? this.layout.objects.find((obj) => obj.id === payload.id)
            : undefined;
          this.activeEvidenceId = activeObject?.evidence ?? null;
          if (this.activeEvidenceId) {
            this.evidenceMarkers.get(this.activeEvidenceId)
              ?.setFillStyle(ACTIVE_MARKER_COLOR, 1)
              .setStrokeStyle(2, 0xfffbeb, 1)
              .setScale(1.5);
          }
        } else if (event.type === 'EVIDENCE_SYNC') {
          this.markEvidence((event.payload as { evidenceIds: string[] }).evidenceIds ?? []);
        } else if (event.type === 'EVIDENCE_DISCOVERED') {
          const payload = event.payload as { evidenceId?: string };
          if (payload.evidenceId) this.markEvidence([payload.evidenceId], true);
        }
      }),
    );
    this.events.once('shutdown', () => this.teardown());

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-E', (event: KeyboardEvent) => {
      if (!event.repeat && !this.scene.isPaused() && !this.hasBlockingDomFocus()) {
        this.interactions.tryInteract();
      }
    });

    // Stuck keys (alt-tab mid-press) used to drift the detective forever:
    // a window blur now releases everything deterministically.
    this.blurOff = () => {
      resetTouch();
      this.player.fullStop();
    };
    window.addEventListener('blur', this.blurOff);

    gameEvents.emit({
      type: 'PLAYER_ENTERED_ROOM',
      payload: {
        roomId: this.currentRoomId,
        roomName: startName,
        floorStyle: this.layout.rooms.find((room) => room.id === this.currentRoomId)?.floorStyle,
      },
    });
    // Handshake: React re-sends the latest world sync so NPC markers
    // render even if earlier syncs fired before this scene booted.
    gameEvents.emit({ type: 'SCENE_READY' });
  }

  /** Deterministic cleanup: called on shutdown AND by destroyGame. */
  teardown(): void {
    this.alive = false;
    this.bannerHideTimer?.remove(false);
    this.bannerHideTimer = null;
    this.plates = [];
    this.activePlateId = null;
    this.activeEvidenceId = null;
    if (this.blurOff) {
      window.removeEventListener('blur', this.blurOff);
      this.blurOff = null;
    }
    for (const off of this.bridgeOffs) {
      try {
        off();
      } catch {
        /* already torn down */
      }
    }
    this.bridgeOffs = [];
  }

  override update(): void {
    this.detectRoom();
    this.interactions.update(this.currentRoomId);
    const blockingDomFocus = this.hasBlockingDomFocus();
    const gamepadInteractDown = Boolean(this.input.gamepad?.pad1?.connected && this.input.gamepad.pad1.A);
    if (
      gamepadInteractDown &&
      !this.gamepadInteractWasDown &&
      !this.scene.isPaused() &&
      !blockingDomFocus
    ) {
      this.interactions.tryInteract();
    }
    this.gamepadInteractWasDown = gamepadInteractDown;
    this.faceTick += 1;
    if (this.faceTick % 20 === 0) this.faceNpcs();
    this.plateTick += 1;
    if (this.plateTick % 12 === 0) this.updatePlates();
    this.player.update(!blockingDomFocus, !blockingDomFocus);
    const position = { x: this.player.x, y: this.player.y };
    if (this.lastFootstepPosition) {
      this.footstepDistance += Phaser.Math.Distance.Between(
        this.lastFootstepPosition.x,
        this.lastFootstepPosition.y,
        position.x,
        position.y,
      );
    }
    this.lastFootstepPosition = position;
    if (this.footstepDistance >= 58) {
      this.footstepDistance %= 58;
      const floorStyle = this.layout.rooms.find((room) => room.id === this.currentRoomId)?.floorStyle ?? 'stone';
      gameEvents.emit({
        type: 'PLAYER_FOOTSTEP',
        payload: { floorStyle },
      });
    }
  }

  /** Keep game controls from activating behind focused fields or modal UI. */
  private hasBlockingDomFocus(): boolean {
    if (typeof document === 'undefined') return false;
    const active = document.activeElement;
    return (
      active instanceof HTMLInputElement ||
      active instanceof HTMLTextAreaElement ||
      active instanceof HTMLSelectElement ||
      (active instanceof HTMLElement && (
        active.isContentEditable || Boolean(active.closest('[aria-modal="true"]'))
      ))
    );
  }

  /**
   * Label layer: y-sorted base depths so overlap reads naturally, the
   * nearest interactable boosted to the front, and plates behind the
   * detective softened (never hidden) so text stays legible.
   */
  private updatePlates(): void {
    if (!this.alive || !this.player) return;
    this.player.sprite.setDepth(this.spriteDepth(this.player.y));
    for (const [id, marker] of this.npcMarkers) {
      marker.dot.setDepth(this.spriteDepth(marker.dot.y));
    }
    const pr = {
      x0: this.player.x - 24,
      y0: this.player.y - 32,
      x1: this.player.x + 24,
      y1: this.player.y + 32,
    };
    for (const entry of this.plates) {
      const { x, y } = entry.pos();
      const isActive = this.activePlateId !== null && entry.id === this.activePlateId;
      entry.plate.container.setDepth(isActive ? 15 : 4 + (y / this.layout.worldH) * 2);
      if (isActive) {
        entry.plate.setDimmed(false);
        continue;
      }
      const hw = entry.plate.w / 2;
      const hh = entry.plate.h / 2;
      const overlap = x - hw < pr.x1 && x + hw > pr.x0 && y - hh < pr.y1 && y + hh > pr.y0;
      entry.plate.setDimmed(overlap);
    }
  }

  /**
   * Entity depth band: sprites sit below ALL plates (active plate tops at
   * 15) but above walls/objects, sorted by feet so nearer figures cover
   * farther ones — same family as plates, never interleaved under text.
   */
  private spriteDepth(worldY: number): number {
    return 3.4 + (worldY / this.layout.worldH) * 0.5;
  }

  /** NPCs in the player's room face the player — cheap reactivity. */
  private faceNpcs(): void {
    for (const [id, marker] of this.npcMarkers) {
      if (this.npcRooms.get(id) !== this.currentRoomId) continue;
      if (marker.dot.anims.isPlaying) continue; // mid-walk: leave it alone
      const dx = this.player.x - marker.dot.x;
      const dy = this.player.y - marker.dot.y;
      const dir =
        Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up';
      marker.dot.setFrame(IDLE_FRAMES[dir]);
    }
  }

  /**
   * Shared gap data: wall carving AND doorway drawing read the same
   * spans, so openings and frames align by construction.
   */
  private doorGaps(room: RoomLayout): DoorGap[] {
    const { x, y, w, h } = room;
    const out: DoorGap[] = [];
    for (const door of this.layout.doors.filter((d) => d.roomId === room.id)) {
      const cx = door.x + door.w / 2;
      const cy = door.y + door.h / 2;
      const m = 0; // margin so the frame isn't pinched
      const dist = { top: cy - y, bottom: y + h - cy, left: cx - x, right: x + w - cx };
      const wall = (Object.keys(dist) as WallSide[]).reduce((a, b) =>
        dist[a] <= dist[b] ? a : b,
      );
      const span: [number, number] =
        wall === 'top' || wall === 'bottom'
          ? [Math.max(x, door.x - m), Math.min(x + w, door.x + door.w + m)]
          : [Math.max(y, door.y - m), Math.min(y + h, door.y + door.h + m)];
      out.push({ door, wall, span });
    }
    return out;
  }

  private buildRooms(): void {
    for (const room of this.layout.rooms) {
      this.add
        .tileSprite(
          room.x + room.w / 2,
          room.y + room.h / 2,
          room.w,
          room.h,
          `tile-floor-${room.floorStyle}`,
        )
        .setDepth(0);
      const { x, y, w, h } = room;
      // Wall gaps where this room's doors sit, so portals read as openings.
      const gaps: Record<WallSide, Array<[number, number]>> = {
        top: [],
        bottom: [],
        left: [],
        right: [],
      };
      for (const { wall, span } of this.doorGaps(room)) gaps[wall].push(span);
      const wallTex = `tile-wall-${room.wallStyle}`;
      const segments: Array<[number, number, number, number]> = [];
      const carve = (
        from: number,
        to: number,
        fixed: number,
        horizontal: boolean,
        spans: Array<[number, number]>,
      ) => {
        const ordered = [...spans].sort((a, b) => a[0] - b[0]);
        let cursor = from;
        for (const [g0, g1] of ordered) {
          if (g0 - cursor >= 8) {
            const len = g0 - cursor;
            segments.push(
              horizontal
                ? [cursor + len / 2, fixed, len, WALL]
                : [fixed, cursor + len / 2, WALL, len],
            );
          }
          cursor = Math.max(cursor, g1);
        }
        if (to - cursor >= 8) {
          const len = to - cursor;
          segments.push(
            horizontal
              ? [cursor + len / 2, fixed, len, WALL]
              : [fixed, cursor + len / 2, WALL, len],
          );
        }
      };
      carve(x, x + w, y + WALL / 2, true, gaps.top);
      carve(x, x + w, y + h - WALL / 2, true, gaps.bottom);
      carve(y, y + h, x + WALL / 2, false, gaps.left);
      carve(y, y + h, x + w - WALL / 2, false, gaps.right);
      for (const [cx, cy, ww, hh] of segments) {
        this.add.tileSprite(cx, cy, ww, hh, wallTex).setDepth(1);
        const rect = this.add.rectangle(cx, cy, ww, hh, 0x000000, 0);
        rect.setData('solid', true);
      }
      // Area nameplate, top-left inside the room.
      this.registerPlate(`room:${room.id}`, new Plate(this, x + 120, y + 30, { title: room.name, kind: 'room' }), () => ({
        x: x + 120,
        y: y + 30,
      }));
      // Hand-placed furniture dressing from the generated case art set.
      for (const item of room.decor ?? []) {
        const image = this.add.image(item.x, item.y, item.tex).setScale(item.scale ?? 2).setDepth(1);
        if (item.solid) {
          const footprint = this.add.rectangle(
            item.x,
            item.y + image.displayHeight * 0.18,
            Math.max(16, image.displayWidth * 0.65),
            Math.max(12, image.displayHeight * 0.35),
            0x000000,
            0,
          );
          footprint.setData('solid', true);
        }
      }
      // Deterministic scatter so rooms don't read as flat color.
      for (const spot of decorSpots(room.id, x, y, w, h, 14)) {
        this.add.circle(spot.x, spot.y, spot.s, 0xffffff, 0.06).setDepth(1);
      }
    }
  }

  /** Soft local light around placed lamps, kept below actors and clues. */
  private buildAtmosphere(): void {
    const marshRooms = this.layout.rooms.filter((room) => room.floorStyle === 'marsh');
    if (marshRooms.length > 0) {
      const fogKey = 'fx-marsh-fog';
      if (!this.textures.exists(fogKey)) {
        const graphics = this.make.graphics({ x: 0, y: 0 });
        graphics.fillStyle(0xb8c9c6, 0.075);
        graphics.fillEllipse(70, 80, 150, 44);
        graphics.fillEllipse(170, 68, 220, 52);
        graphics.fillEllipse(290, 82, 240, 48);
        graphics.fillEllipse(420, 72, 170, 42);
        graphics.fillStyle(0xdce4df, 0.035);
        graphics.fillEllipse(110, 70, 190, 30);
        graphics.fillEllipse(260, 76, 250, 32);
        graphics.fillEllipse(430, 68, 180, 28);
        graphics.generateTexture(fogKey, 512, 128);
        graphics.destroy();
      }

      for (const room of marshRooms) {
        const centerX = room.x + room.w / 2;
        const fog = this.add.image(centerX, room.y + room.h - 88, fogKey)
          .setDisplaySize(room.w - 48, 84)
          .setAlpha(0.55)
          .setDepth(0.5);
        if (!prefersReducedMotion()) {
          fog.setX(centerX - 12);
          this.tweens.add({
            targets: fog,
            x: { from: centerX - 12, to: centerX + 12 },
            duration: 14000,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onRepeat: () => {
              if (prefersReducedMotion()) {
                this.tweens.killTweensOf(fog);
                fog.setX(centerX);
              }
            },
          });
        }
      }
    }

    if (marshRooms.length > 0 && !prefersReducedMotion()) {
      const rainKey = 'fx-rain-streak';
      if (!this.textures.exists(rainKey)) {
        const graphics = this.make.graphics({ x: 0, y: 0 });
        graphics.lineStyle(2, 0xb6d4df, 0.8).lineBetween(1, 0, 4, 12);
        graphics.generateTexture(rainKey, 5, 13);
        graphics.destroy();
      }
      for (const room of marshRooms) {
        const rain = this.add.particles(room.x, room.y + 12, rainKey, {
          x: { min: 0, max: room.w },
          speedX: { min: -48, max: -30 },
          speedY: { min: 190, max: 260 },
          lifespan: 1500,
          frequency: 90,
          alpha: { start: 0.28, end: 0 },
          scale: { start: 0.7, end: 0.7 },
          rotate: -12,
        }).setDepth(1.15);
        rain.setScrollFactor(1);
      }
    }

    const lightTextures = new Set([
      'spr-storm-lantern',
      'furn-lamp',
      'spr-chandelier',
      'spr-manor-fireplace',
      'spr-galley-stove',
      'spr-stage-footlights',
    ]);
    const lightSources = this.layout.rooms.flatMap((room) =>
      (room.decor ?? [])
        .filter((item) => lightTextures.has(item.tex)),
    );
    if (lightSources.length === 0) return;

    const textureKey = 'fx-lantern-glow';
    if (!this.textures.exists(textureKey)) {
      const graphics = this.make.graphics({ x: 0, y: 0 });
      for (let radius = 62; radius >= 4; radius -= 4) {
        const strength = 0.004 + (1 - radius / 64) * 0.026;
        graphics.fillStyle(0xffb347, strength).fillCircle(64, 64, radius);
      }
      graphics.generateTexture(textureKey, 128, 128);
      graphics.destroy();
    }

    for (const source of lightSources) {
      const glow = this.add.image(source.x, source.y, textureKey)
        .setScale(source.scale ?? 2)
        .setAlpha(0.85)
        .setDepth(1.2);
      if (!prefersReducedMotion()) {
        this.tweens.add({
          targets: glow,
          alpha: { from: 0.72, to: 0.96 },
          duration: 1700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          onRepeat: () => {
            if (prefersReducedMotion()) {
              this.tweens.killTweensOf(glow);
              glow.setAlpha(0.85);
            }
          },
        });
      }
    }
  }

  /** Track a plate for depth sorting + occlusion ghosting. */
  private registerPlate(
    id: string,
    plate: Plate,
    pos: () => { x: number; y: number },
  ): void {
    this.plates = this.plates.filter((p) => p.id !== id);
    this.plates.push({ id, plate, pos });
  }

  private buildDoors(): void {
    // Doorways drawn as exact wall-band geometry from the SAME spans the
    // walls were carved with: jambs, double leaves, threshold, knobs.
    const JAMB = 0x241a0e;
    const LEAF = 0x4a3421;
    const SILL = 0x6b5233;
    const KNOB = 0xfde68a;
    for (const room of this.layout.rooms) {
      const { x, y, w, h } = room;
      for (const { door, wall, span } of this.doorGaps(room)) {
        const [a, b] = span;
        const mid = (a + b) / 2;
        // Gate sign on the room side of the opening, naming the destination.
        const dest = roomName(this.layout, door.targetRoomId);
        const locked = this.isDoorLocked(door);
        const gateTitle = locked ? 'LOCKED · NEED KEY' : `→ ${dest}`;
        const pulse: Phaser.GameObjects.Rectangle[] = [];
        const leaf = (
          cx: number,
          cy: number,
          ww: number,
          hh: number,
        ): Phaser.GameObjects.Rectangle => {
          const r = this.add.rectangle(cx, cy, ww, hh, LEAF).setDepth(2);
          pulse.push(r);
          return r;
        };
        if (wall === 'top' || wall === 'bottom') {
          const wy = wall === 'top' ? y : y + h - WALL;
          const sx = mid;
          const sy = wy + (wall === 'top' ? WALL + 34 : -34);
          const plate = new Plate(this, sx, sy, {
            title: gateTitle,
            kind: 'gate',
          });
          this.doorPlates.set(door.id, plate);
          this.registerPlate(`door:${door.id}`, plate, () => ({ x: sx, y: sy }));
          this.add.rectangle((a + b) / 2, wy + WALL / 2, b - a, WALL, JAMB).setDepth(2);
          const lw = Math.max(6, mid - 1 - (a + 4));
          const rw = Math.max(6, b - 4 - (mid + 1));
          leaf(a + 4 + lw / 2, wy + WALL / 2, lw, WALL - 4);
          leaf(mid + 1 + rw / 2, wy + WALL / 2, rw, WALL - 4);
          this.add.rectangle((a + b) / 2, wy + WALL - 2, b - a, 4, SILL).setDepth(2);
          this.add.circle(mid - 5, wy + WALL / 2, 2, KNOB).setDepth(3);
          this.add.circle(mid + 5, wy + WALL / 2, 2, KNOB).setDepth(3);
        } else {
          const wx = wall === 'left' ? x : x + w - WALL;
          const sx = wx + (wall === 'left' ? WALL + 92 : -WALL - 92);
          const plate = new Plate(this, sx, mid, {
            title: gateTitle,
            kind: 'gate',
          });
          this.doorPlates.set(door.id, plate);
          this.registerPlate(`door:${door.id}`, plate, () => ({ x: sx, y: mid }));
          this.add.rectangle(wx + WALL / 2, (a + b) / 2, WALL, b - a, JAMB).setDepth(2);
          const lw = Math.max(6, mid - 1 - (a + 4));
          const rw = Math.max(6, b - 4 - (mid + 1));
          leaf(wx + WALL / 2, a + 4 + lw / 2, WALL - 4, lw);
          leaf(wx + WALL / 2, mid + 1 + rw / 2, WALL - 4, rw);
          this.add.circle(wx + WALL / 2, mid - 5, 2, KNOB).setDepth(3);
          this.add.circle(wx + WALL / 2, mid + 5, 2, KNOB).setDepth(3);
        }
        this.doorLeaves.set(door.id, pulse);
        if (!locked && !prefersReducedMotion()) {
          // Gentle beckon on the leaves; skipped under prefers-reduced-motion.
          this.tweens.add({
            targets: pulse,
            alpha: { from: 1, to: 0.5 },
            duration: 1100,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onRepeat: () => {
              if (prefersReducedMotion()) {
                this.tweens.killTweensOf(pulse);
                pulse.forEach((leaf) => leaf.setAlpha(1));
              }
            },
          });
        }
        if (locked) {
          this.addDoorBarrier(door);
        }
      }
    }
    for (const door of this.layout.doors) {
      const zone = this.add.zone(door.x + door.w / 2, door.y + door.h / 2, door.w, door.h);
      this.physics.add.existing(zone);
      const body = zone.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);
      body.moves = false;
      this.physics.add.overlap(this.player.sprite, zone, () => {
        if (this.isDoorLocked(door)) {
          this.showLockedDoorHint(door);
          return;
        }
        this.warp(door.targetRoomId);
      });
    }
  }

  private isDoorLocked(door: DoorLayout): boolean {
    const evidenceId = this.doorUnlockEvidence.get(door.id);
    return evidenceId !== undefined && !this.discovered.has(evidenceId);
  }

  /** Apply the case API's door lock state to every matching layout portal. */
  private syncDoorConfig(configs: DoorConfigSync['doors']): void {
    if (!this.alive) return;
    for (const door of this.layout.doors) {
      const config = configs.find(
        ({ between }) =>
          between.includes(door.roomId) && between.includes(door.targetRoomId),
      );
      if (!config) continue;
      const wasLocked = this.isDoorLocked(door);
      const evidenceId = config.locked ? config.unlock_evidence ?? undefined : undefined;
      const hint = config.locked ? config.lock_hint : undefined;
      if (evidenceId) this.doorUnlockEvidence.set(door.id, evidenceId);
      else this.doorUnlockEvidence.delete(door.id);
      if (hint) this.doorLockHints.set(door.id, hint);
      else this.doorLockHints.delete(door.id);
      const locked = this.isDoorLocked(door);
      this.doorPlates.get(door.id)?.setTitle(
        locked ? 'LOCKED · NEED KEY' : `→ ${roomName(this.layout, door.targetRoomId)}`,
      );
      if (locked) {
        const leaves = this.doorLeaves.get(door.id);
        if (leaves) {
          leaves.forEach((leaf) => this.tweens.killTweensOf(leaf));
          leaves.forEach((leaf) => leaf.setAlpha(1).setScale(1));
        }
        this.addDoorBarrier(door);
      } else {
        if (wasLocked || (evidenceId !== undefined && this.discovered.has(evidenceId))) {
          this.openDoor(door);
        }
        this.removeDoorBarrier(door);
      }
    }
  }

  private addDoorBarrier(door: DoorLayout): void {
    if (this.doorBarriers.has(door.id)) return;
    const icon = this.add
      .image(door.x + door.w / 2, door.y + door.h / 2, 'spr-brass-lock')
      .setScale(1.2)
      .setDepth(4);
    icon.setInteractive({ useHandCursor: true });
    icon.on('pointerdown', () => this.showLockedDoorHint(door));
    this.doorLockIcons.set(door.id, icon);
    const barrier = this.add.rectangle(
      door.x + door.w / 2,
      door.y + door.h / 2,
      door.w,
      door.h,
      0x000000,
      0,
    );
    this.physics.add.existing(barrier, true);
    const collider = this.physics.add.collider(this.player.sprite, barrier, () => {
      this.showLockedDoorHint(door);
    });
    this.doorBarriers.set(door.id, barrier);
    this.doorColliders.set(door.id, collider);
  }

  private removeDoorBarrier(door: DoorLayout): void {
    this.doorLockIcons.get(door.id)?.destroy();
    this.doorLockIcons.delete(door.id);
    const collider = this.doorColliders.get(door.id);
    if (collider) this.physics.world.removeCollider(collider);
    this.doorColliders.delete(door.id);
    this.doorBarriers.get(door.id)?.destroy();
    this.doorBarriers.delete(door.id);
  }

  private openDoor(door: DoorLayout): void {
    const leaves = this.doorLeaves.get(door.id);
    if (!leaves) return;
    leaves.forEach((leaf) => this.tweens.killTweensOf(leaf));
    leaves.forEach((leaf) => leaf.setAlpha(1));
    const horizontal = door.w > door.h;
    const scaleX = horizontal ? 0.35 : 1;
    const scaleY = horizontal ? 1 : 0.35;
    if (prefersReducedMotion()) {
      leaves.forEach((leaf) => leaf.setScale(scaleX, scaleY));
    } else {
      this.tweens.add({
        targets: leaves,
        scaleX,
        scaleY,
        duration: 350,
        ease: 'Cubic.easeOut',
      });
    }
    this.doorLeaves.delete(door.id);
  }

  private showLockedDoorHint(door: DoorLayout): void {
    if (this.time.now - this.lastLockedNoticeAt < 1000) return;
    this.lastLockedNoticeAt = this.time.now;
    gameEvents.emit({ type: 'DOOR_LOCKED', payload: { doorId: door.id } });
    this.showBanner(this.doorLockHints.get(door.id) || 'Locked');
  }

  private buildObjects(): void {
    for (const obj of this.layout.objects) {
      const scale = obj.scale ?? 2;
      const img = this.add.image(obj.x, obj.y, obj.sprite.key);
      img.setScale(scale).setDepth(2);
      img.setInteractive({ useHandCursor: true });
      img.on('pointerover', () => {
        if (this.currentRoomId === obj.roomId) img.setTint(0xffe7b0);
      });
      img.on('pointerout', () => img.clearTint());
      img.on('pointerdown', () => {
        if (this.scene.isPaused() || this.currentRoomId !== obj.roomId) return;
        const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, obj.x, obj.y);
        if (dist <= obj.radius) {
          this.interactions.interactWith({
            kind: 'object',
            id: obj.id,
            roomId: obj.roomId,
            label: obj.label,
            x: obj.x,
            y: obj.y,
            radius: obj.radius,
          });
        } else {
          this.showBanner('MOVE CLOSER TO EXAMINE');
        }
      });
      const plate = new Plate(this, obj.x, obj.y + 30, {
        title: obj.label,
        kind: 'evidence',
      });
      if (obj.evidence && this.discovered.has(obj.evidence)) plate.setFound(true);
      this.objectPlates.set(obj.id, plate);
      this.registerPlate(`obj:${obj.id}`, plate, () => ({ x: obj.x, y: obj.y + 30 }));
      if (obj.evidence && !this.discovered.has(obj.evidence)) {
        const markerY = obj.y - img.displayHeight / 2 - 8;
        const marker = this.add
          .rectangle(obj.x, markerY, 8, 8, EVIDENCE_MARKER_COLOR, 0.8)
          .setStrokeStyle(1, 0xe0f2fe, 0.9)
          .setRotation(Math.PI / 4)
          .setDepth(8);
        this.evidenceMarkers.set(obj.evidence, marker);
        if (!prefersReducedMotion()) {
          this.tweens.add({
            targets: marker,
            alpha: { from: 0.35, to: 0.95 },
            y: markerY - 3,
            duration: 900,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
            onRepeat: () => {
              if (prefersReducedMotion()) {
                this.tweens.killTweensOf(marker);
                marker.setPosition(obj.x, markerY).setAlpha(0.8);
              }
            },
          });
        }
      }
    }
  }

  /** Dim plates for already-found evidence (no spoiler: ids only). */
  markEvidence(evidenceIds: string[], playUnlockSound = false): void {
    if (!this.alive) return;
    for (const eid of evidenceIds) {
      this.discovered.add(eid);
      const unlockedDoorIds: string[] = [];
      for (const door of this.layout.doors) {
        if (this.doorUnlockEvidence.get(door.id) !== eid) continue;
        if (this.doorBarriers.has(door.id)) {
          unlockedDoorIds.push(door.id);
        }
        this.doorPlates.get(door.id)?.setTitle(`→ ${roomName(this.layout, door.targetRoomId)}`);
        this.openDoor(door);
        this.removeDoorBarrier(door);
      }
      if (playUnlockSound && unlockedDoorIds.length > 0) {
        gameEvents.emit({ type: 'DOOR_UNLOCKED', payload: { doorIds: unlockedDoorIds } });
      }
      if (this.activeEvidenceId === eid) this.activeEvidenceId = null;
      const marker = this.evidenceMarkers.get(eid);
      if (marker) {
        this.tweens.killTweensOf(marker);
        marker.destroy();
        this.evidenceMarkers.delete(eid);
      }
    }
    for (const obj of this.layout.objects) {
      if (obj.evidence && this.discovered.has(obj.evidence)) {
        this.objectPlates.get(obj.id)?.setFound(true);
      }
    }
    this.updateEvidenceCounter();
  }

  private updateEvidenceCounter(): void {
    if (!this.evidenceCounter || !this.layout) return;
    const ids = new Set(this.layout.objects.flatMap((obj) => obj.evidence ? [obj.evidence] : []));
    const found = [...ids].filter((id) => this.discovered.has(id)).length;
    this.evidenceCounter.setText(`EVIDENCE ${found}/${ids.size}`);
  }

  /** Center-screen area banner on room entry (screen-fixed). */
  private showBanner(name: string): void {
    if (!this.alive) return;
    this.bannerHideTimer?.remove(false);
    this.bannerHideTimer = null;
    this.banner.setText(name.toUpperCase());
    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(1);
    if (prefersReducedMotion()) {
      this.bannerHideTimer = this.time.delayedCall(2000, () => {
        this.banner.setAlpha(0);
        this.bannerHideTimer = null;
      });
      return;
    }
    this.tweens.add({
      targets: this.banner,
      alpha: 0,
      delay: 1400,
      duration: 600,
      ease: 'Sine.easeIn',
    });
  }

  private objectEntries(): InteractableEntry[] {
    return this.layout.objects.map((obj) => ({
      kind: 'object' as const,
      id: obj.id,
      roomId: obj.roomId,
      label: obj.label,
      x: obj.x,
      y: obj.y,
      radius: obj.radius,
    }));
  }

  /** Authoritative NPC placement from React (backend world state). */
  syncWorld(npcs: NpcSync[]): void {
    // Dead scenes (post-destroy event leakage, HMR) must not touch
    // the display list — this was a hard crash (displayList null).
    if (!this.alive) return;
    const seen = new Set<string>();
    // Deterministic occupancy: nth NPC (sorted by id) in a room takes
    // the nth stand-spot, so relocated NPCs never stack on each other.
    const occupants = new Map<string, string[]>();
    for (const npc of npcs) {
      const list = occupants.get(npc.roomId) ?? [];
      list.push(npc.id);
      occupants.set(npc.roomId, list);
    }
    const assigned = new Map<string, { x: number; y: number }>();
    for (const [roomId, ids] of occupants) {
      const spots = this.orderedNpcSpots(roomId, this.layout.npcSpots[roomId] ?? []);
      ids.sort().forEach((id, i) => {
        const spot = spots[i % Math.max(1, spots.length)];
        if (spot) assigned.set(id, spot);
      });
    }
    for (const npc of npcs) {
      seen.add(npc.id);
      const artId = characterAssetId(npc.id, this.layout.caseId);
      const spot = assigned.get(npc.id);
      if (!spot) continue;
      const relocated =
        this.npcRooms.get(npc.id) !== undefined && this.npcRooms.get(npc.id) !== npc.roomId;
      this.npcRooms.set(npc.id, npc.roomId);
      const marker = this.npcMarkers.get(npc.id);
      if (marker) {
        const moved = marker.dot.x !== spot.x || marker.dot.y !== spot.y;
        if (moved) {
          this.tweens.killTweensOf(marker.dot);
        }
        if (moved && relocated) {
          // Walk to the newly assigned spot with the matching gait, then stand
          // facing the direction of travel. Reduced motion keeps that pose.
          const dx = spot.x - marker.dot.x;
          const dy = spot.y - marker.dot.y;
          const dir: Facing =
            Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up';
          if (prefersReducedMotion()) {
            marker.dot.setPosition(spot.x, spot.y).setFrame(IDLE_FRAMES[dir]);
            marker.plate.container.setPosition(spot.x, spot.y + 40);
          } else {
            marker.dot.play(`char-${artId}-walk-${dir}`, true);
            this.tweens.add({
              targets: marker.dot,
              x: spot.x,
              y: spot.y,
              duration: 900,
              ease: 'Sine.easeInOut',
              onUpdate: () => {
                marker.plate.container.setPosition(marker.dot.x, marker.dot.y + 40);
              },
              onComplete: () => {
                marker.dot.stop();
                marker.dot.setFrame(IDLE_FRAMES[dir]);
              },
            });
          }
        } else {
          marker.dot.setPosition(spot.x, spot.y);
          marker.plate.container.setPosition(spot.x, spot.y + 40);
        }
      } else {
        const dot = this.add
          .sprite(spot.x, spot.y, `char-${artId}`, IDLE_FRAMES.down)
          .setScale(2)
          .setDepth(3.4); // scene y-sorts it every tick (updatePlates)
        dot.setInteractive({ useHandCursor: true });
        dot.on('pointerdown', () => {
          const roomId = this.npcRooms.get(npc.id) ?? npc.roomId;
          if (this.scene.isPaused() || this.currentRoomId !== roomId) return;
          const dist = Phaser.Math.Distance.Between(this.player.x, this.player.y, dot.x, dot.y);
          if (dist <= NPC_RADIUS) {
            this.interactions.interactWith({
              kind: 'npc',
              id: npc.id,
              roomId,
              label: npc.label,
              x: dot.x,
              y: dot.y,
              radius: NPC_RADIUS,
            });
          } else {
            this.showBanner('MOVE CLOSER TO TALK');
          }
        });
        const plate = new Plate(this, spot.x, spot.y + 40, {
          title: npc.label,
          subtitle: npc.role,
          kind: 'npc',
        });
        this.npcMarkers.set(npc.id, { dot, plate });
        this.registerPlate(`npc:${npc.id}`, plate, () => ({ x: dot.x, y: dot.y + 40 }));
      }
    }
    for (const [id, marker] of this.npcMarkers) {
      if (!seen.has(id)) {
        marker.dot.destroy();
        marker.plate.destroy();
        this.npcMarkers.delete(id);
        this.npcRooms.delete(id);
        this.plates = this.plates.filter((p) => p.id !== `npc:${id}`);
      }
    }
    this.interactions.bind(
      [
        ...this.objectEntries(),
        ...npcs.flatMap((npc) => {
          const spot = assigned.get(npc.id);
          const marker = this.npcMarkers.get(npc.id);
          return spot && marker
            ? [
                {
                  kind: 'npc' as const,
                  id: npc.id,
                  roomId: npc.roomId,
                  label: npc.label,
                  x: spot.x,
                  y: spot.y,
                  radius: NPC_RADIUS,
                  getPosition: () => ({ x: marker.dot.x, y: marker.dot.y }),
                },
              ]
            : [];
        }),
      ],
      this.player,
    );
  }

  /** Keep daily cast placement shared and repeatable while preserving case truth. */
  private orderedNpcSpots(roomId: string, spots: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    if (this.dailySeed === null || spots.length < 2) return spots;
    let roomHash = 2166136261;
    for (let i = 0; i < roomId.length; i += 1) {
      roomHash = Math.imul(roomHash ^ roomId.charCodeAt(i), 16777619);
    }
    let state = (this.dailySeed ^ roomHash) >>> 0;
    if (state === 0) state = 0x6d2b79f5;
    const ordered = [...spots];
    for (let i = ordered.length - 1; i > 0; i -= 1) {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      const j = state % (i + 1);
      [ordered[i], ordered[j]] = [ordered[j]!, ordered[i]!];
    }
    return ordered;
  }

  /** One-shot sparkle where the player examines something. */
  sparkleAtObject(objectId: string): void {
    if (!this.alive || prefersReducedMotion()) return;
    const obj = this.layout.objects.find((o) => o.id === objectId);
    if (!obj) return;
    const emitter = this.add.particles(obj.x, obj.y, 'fx-dot', {
      speed: { min: 40, max: 140 },
      lifespan: 500,
      quantity: 14,
      scale: { start: 1, end: 0 },
      emitting: false,
    });
    emitter.setDepth(15);
    emitter.explode(14, obj.x, obj.y);
    this.time.delayedCall(700, () => emitter.destroy());
  }

  private warp(targetRoomId: string): void {
    const now = this.time.now;
    if (now - this.lastWarpAt < WARP_COOLDOWN_MS) return;
    this.lastWarpAt = now;
    const spawn = this.layout.spawns[targetRoomId];
    if (!spawn) return;
    if (prefersReducedMotion()) {
      this.player.sprite.setPosition(spawn.x, spawn.y);
      this.player.sprite.setVelocity(0, 0);
      this.lastFootstepPosition = { x: spawn.x, y: spawn.y };
      this.footstepDistance = 0;
      return;
    }
    this.cameras.main.fadeOut(120, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.player.sprite.setPosition(spawn.x, spawn.y);
      this.player.sprite.setVelocity(0, 0);
      this.lastFootstepPosition = { x: spawn.x, y: spawn.y };
      this.footstepDistance = 0;
      this.cameras.main.fadeIn(150, 0, 0, 0);
    });
  }

  private detectRoom(): void {
    for (const room of this.layout.rooms) {
      const inside =
        this.player.x >= room.x &&
        this.player.x <= room.x + room.w &&
        this.player.y >= room.y &&
        this.player.y <= room.y + room.h;
      if (inside && room.id !== this.currentRoomId) {
        this.currentRoomId = room.id;
        this.roomLabel.setText(room.name.toUpperCase());
        this.showBanner(room.name);
        gameEvents.emit({
          type: 'PLAYER_ENTERED_ROOM',
          payload: { roomId: room.id, roomName: room.name, floorStyle: room.floorStyle },
        });
      }
    }
  }
}
