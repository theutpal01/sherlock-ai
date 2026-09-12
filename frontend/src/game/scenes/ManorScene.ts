import Phaser from 'phaser';
import { gameEvents } from '../events/bridge';
import { CHAR_IDS, FURNITURE, IDLE_FRAMES, REDUCED_MOTION, decorSpots, ensureArt, ensureCharAnims } from '../art';
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

export interface NpcSync {
  id: string;
  label: string;
  roomId: string;
  role?: string;
}

/**
 * Data-driven manor scene: room rects, portals, objects, and NPC spots
 * all come from the active case layout. No backend calls here — movement
 * stays local; meaningful interactions emit bridge events for React.
 */
export class ManorScene extends Phaser.Scene {
  private player!: Player;
  private interactions!: InteractionManager;
  private layout!: CaseLayout;
  private currentRoomId = '';
  private faceTick = 0;
  private lastWarpAt = 0;
  private roomLabel!: Phaser.GameObjects.Text;
  private banner!: Phaser.GameObjects.Text;
  private npcMarkers = new Map<string, { dot: Phaser.GameObjects.Sprite; plate: Plate }>();
  private objectPlates = new Map<string, Plate>();
  private discovered = new Set<string>();
  private npcRooms = new Map<string, string>();
  /** Every text plate with a live anchor: y-sorted, proximity-boosted. */
  private plates: Array<{ id: string; plate: Plate; pos: () => { x: number; y: number } }> = [];
  private activePlateId: string | null = null;
  private plateTick = 0;
  private bridgeOffs: Array<() => void> = [];
  private blurOff: (() => void) | null = null;
  private alive = false;

  constructor() {
    super('manor');
  }

  preload(): void {
    // Packed CC0 sheet; cached across scene restarts.
    if (!this.textures.exists('dungeon')) {
      this.load.spritesheet('dungeon', 'assets/dungeon/tilemap_packed.png', {
        frameWidth: 16,
        frameHeight: 16,
      });
    }
    if (!this.textures.exists('floors')) {
      this.load.image('floors', 'assets/floors/floors.png');
    }
    // One 24x32 walk-cycle sheet per cast member (CC-BY, credited).
    for (const id of CHAR_IDS) {
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
  }

  create(): void {
    this.alive = true;
    ensureArt(this);
    ensureCharAnims(this, 'player');
    const caseId = (this.registry.get('caseId') as string) || 'blackwood_manor';
    this.layout = getLayout(caseId);
    this.currentRoomId = this.layout.startRoom;
    this.physics.world.setBounds(0, 0, this.layout.worldW, this.layout.worldH);
    this.buildRooms();

    const spawn = this.layout.spawns[this.layout.startRoom]!;
    this.player = new Player(this, spawn.x, spawn.y);

    const shapes = this.children.getAll() as Phaser.GameObjects.Rectangle[];
    for (const shape of shapes) {
      if (shape.getData?.('solid')) {
        this.physics.add.existing(shape, true);
        this.physics.add.collider(this.player.sprite, shape);
      }
    }

    this.buildDoors();
    this.buildObjects();

    this.cameras.main.setBounds(0, 0, this.layout.worldW, this.layout.worldH);
    this.cameras.main.startFollow(this.player.sprite, true, 0.12, 0.12);

    const startName = roomName(this.layout, this.layout.startRoom);
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
        if (event.type === 'WORLD_SYNC') {
          this.syncWorld((event.payload as { npcs: NpcSync[] }).npcs);
        } else if (event.type === 'INTERACTION_STARTED') {
          const payload = event.payload as { objectId?: string };
          if (payload.objectId) this.sparkleAtObject(payload.objectId);
        } else if (event.type === 'PAUSE_GAME') {
          this.scene.pause();
        } else if (event.type === 'RESUME_GAME') {
          this.scene.resume();
        } else if (event.type === 'INTERACT_PRESSED') {
          this.interactions.tryInteract();
        } else if (event.type === 'INTERACTION_AVAILABLE') {
          const payload = event.payload as { kind: string | null; id: string | null };
          this.activePlateId =
            payload.kind === 'object' && payload.id
              ? `obj:${payload.id}`
              : payload.kind === 'npc' && payload.id
                ? `npc:${payload.id}`
                : null;
        } else if (event.type === 'EVIDENCE_SYNC') {
          this.markEvidence((event.payload as { evidenceIds: string[] }).evidenceIds ?? []);
        } else if (event.type === 'EVIDENCE_DISCOVERED') {
          const payload = event.payload as { evidenceId?: string };
          if (payload.evidenceId) this.markEvidence([payload.evidenceId]);
        }
      }),
    );
    this.events.once('shutdown', () => this.teardown());

    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-E', () => this.interactions.tryInteract());

    // Stuck keys (alt-tab mid-press) used to drift the detective forever:
    // a window blur now releases everything deterministically.
    this.blurOff = () => {
      resetTouch();
      this.player.fullStop();
    };
    window.addEventListener('blur', this.blurOff);

    gameEvents.emit({
      type: 'PLAYER_ENTERED_ROOM',
      payload: { roomId: this.layout.startRoom, roomName: startName },
    });
    // Handshake: React re-sends the latest world sync so NPC markers
    // render even if earlier syncs fired before this scene booted.
    gameEvents.emit({ type: 'SCENE_READY' });
  }

  /** Deterministic cleanup: called on shutdown AND by destroyGame. */
  teardown(): void {
    this.alive = false;
    this.plates = [];
    this.activePlateId = null;
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
    this.player.update();
    this.interactions.update();
    this.detectRoom();
    this.faceTick += 1;
    if (this.faceTick % 20 === 0) this.faceNpcs();
    this.plateTick += 1;
    if (this.plateTick % 12 === 0) this.updatePlates();
  }

  /**
   * Label layer: y-sorted base depths so overlap reads naturally, the
   * nearest interactable boosted to the front, and any other plate under
   * the detective ghosted so text never smears across an entity.
   */
  private updatePlates(): void {
    if (!this.alive || !this.player) return;
    const pr = {
      x0: this.player.x - 24,
      y0: this.player.y - 32,
      x1: this.player.x + 24,
      y1: this.player.y + 32,
    };
    for (const entry of this.plates) {
      const { x, y } = entry.pos();
      const isActive = this.activePlateId !== null && entry.id === this.activePlateId;
      entry.plate.container.setDepth(isActive ? 15 : 4 + (y / this.layout.worldH) * 3);
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
      const m = 6; // margin so the frame isn't pinched
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
      // Hand-placed furniture dressing (verified CC-BY sprites).
      for (const item of room.decor ?? []) {
        this.add.image(item.x, item.y, item.tex).setScale(item.scale ?? 2).setDepth(1);
      }
      // Deterministic scatter so rooms don't read as flat color.
      for (const spot of decorSpots(room.id, x, y, w, h, 14)) {
        this.add.circle(spot.x, spot.y, spot.s, 0xffffff, 0.06).setDepth(1);
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
        const pulse: Phaser.GameObjects.GameObject[] = [];
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
          this.registerPlate(`door:${door.id}`, new Plate(this, sx, sy, {
            title: `→ ${dest}`,
            kind: 'gate',
          }), () => ({ x: sx, y: sy }));
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
          this.registerPlate(`door:${door.id}`, new Plate(this, sx, mid, {
            title: `→ ${dest}`,
            kind: 'gate',
          }), () => ({ x: sx, y: mid }));
          this.add.rectangle(wx + WALL / 2, (a + b) / 2, WALL, b - a, JAMB).setDepth(2);
          const lw = Math.max(6, mid - 1 - (a + 4));
          const rw = Math.max(6, b - 4 - (mid + 1));
          leaf(wx + WALL / 2, a + 4 + lw / 2, WALL - 4, lw);
          leaf(wx + WALL / 2, mid + 1 + rw / 2, WALL - 4, rw);
          this.add.circle(wx + WALL / 2, mid - 5, 2, KNOB).setDepth(3);
          this.add.circle(wx + WALL / 2, mid + 5, 2, KNOB).setDepth(3);
        }
        if (!REDUCED_MOTION) {
          // Gentle beckon on the leaves; skipped under prefers-reduced-motion.
          this.tweens.add({
            targets: pulse,
            alpha: { from: 1, to: 0.5 },
            duration: 1100,
            yoyo: true,
            repeat: -1,
            ease: 'Sine.easeInOut',
          });
        }
      }
    }
    for (const door of this.layout.doors) {
      const zone = this.add.zone(door.x + door.w / 2, door.y + door.h / 2, door.w, door.h);
      this.physics.add.existing(zone);
      const body = zone.body as Phaser.Physics.Arcade.Body;
      body.setAllowGravity(false);
      body.moves = false;
      this.physics.add.overlap(this.player.sprite, zone, () => this.warp(door.targetRoomId));
    }
  }

  private buildObjects(): void {
    for (const obj of this.layout.objects) {
      const scale = obj.scale ?? 2;
      const img =
        obj.sprite.kind === 'frame'
          ? this.add.image(obj.x, obj.y, 'dungeon', obj.sprite.frame)
          : this.add.image(obj.x, obj.y, obj.sprite.key);
      img.setScale(scale).setDepth(2);
      img.setInteractive({ useHandCursor: true });
      img.on('pointerdown', () => {
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
        }
      });
      const plate = new Plate(this, obj.x, obj.y + 30, {
        title: obj.label,
        kind: 'evidence',
      });
      if (obj.evidence && this.discovered.has(obj.evidence)) plate.setFound(true);
      this.objectPlates.set(obj.id, plate);
      this.registerPlate(`obj:${obj.id}`, plate, () => ({ x: obj.x, y: obj.y + 30 }));
    }
  }

  /** Dim plates for already-found evidence (no spoiler: ids only). */
  markEvidence(evidenceIds: string[]): void {
    if (!this.alive) return;
    for (const eid of evidenceIds) this.discovered.add(eid);
    for (const obj of this.layout.objects) {
      if (obj.evidence && this.discovered.has(obj.evidence)) {
        this.objectPlates.get(obj.id)?.setFound(true);
      }
    }
  }

  /** Center-screen area banner on room entry (screen-fixed). */
  private showBanner(name: string): void {
    if (!this.alive) return;
    this.banner.setText(name.toUpperCase());
    this.tweens.killTweensOf(this.banner);
    this.banner.setAlpha(1);
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
      const spots = this.layout.npcSpots[roomId] ?? [];
      ids.sort().forEach((id, i) => {
        const spot = spots[i % Math.max(1, spots.length)];
        if (spot) assigned.set(id, spot);
      });
    }
    for (const npc of npcs) {
      seen.add(npc.id);
      const spot = assigned.get(npc.id);
      if (!spot) continue;
      const relocated =
        this.npcRooms.get(npc.id) !== undefined && this.npcRooms.get(npc.id) !== npc.roomId;
      this.npcRooms.set(npc.id, npc.roomId);
      const marker = this.npcMarkers.get(npc.id);
      if (marker) {
        if (relocated && !REDUCED_MOTION) {
          // Walk to the new spot with the matching gait, then stand.
          const dx = spot.x - marker.dot.x;
          const dy = spot.y - marker.dot.y;
          const dir =
            Math.abs(dx) >= Math.abs(dy) ? (dx >= 0 ? 'right' : 'left') : dy >= 0 ? 'down' : 'up';
          marker.dot.play(`char-${npc.id}-walk-${dir}`, true);
          marker.plate.container.setPosition(spot.x, spot.y + 40);
          this.tweens.add({
            targets: marker.dot,
            x: spot.x,
            duration: 900,
            ease: 'Sine.easeInOut',
          });
          this.tweens.add({
            targets: marker.dot,
            y: spot.y,
            duration: 900,
            ease: 'Sine.easeInOut',
            onComplete: () => {
              marker.dot.stop();
              marker.dot.setFrame(IDLE_FRAMES.down);
            },
          });
        } else {
          marker.dot.setPosition(spot.x, spot.y);
          marker.plate.container.setPosition(spot.x, spot.y + 40);
        }
      } else {
        const dot = this.add
          .sprite(spot.x, spot.y, `char-${npc.id}`, IDLE_FRAMES.down)
          .setScale(2)
          .setDepth(3);
        dot.setInteractive({ useHandCursor: true });
        dot.on('pointerdown', () => {
          const roomId = this.npcRooms.get(npc.id) ?? npc.roomId;
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
          return spot
            ? [
                {
                  kind: 'npc' as const,
                  id: npc.id,
                  roomId: npc.roomId,
                  label: npc.label,
                  x: spot.x,
                  y: spot.y,
                  radius: NPC_RADIUS,
                },
              ]
            : [];
        }),
      ],
      this.player,
    );
  }

  /** One-shot sparkle where the player examines something. */
  sparkleAtObject(objectId: string): void {
    if (!this.alive) return;
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
    this.cameras.main.fadeOut(120, 0, 0, 0);
    this.cameras.main.once('camerafadeoutcomplete', () => {
      this.player.sprite.setPosition(spawn.x, spawn.y);
      this.player.sprite.setVelocity(0, 0);
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
          payload: { roomId: room.id, roomName: room.name },
        });
      }
    }
  }
}
