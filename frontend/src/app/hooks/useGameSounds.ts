import { useEffect, useState } from 'react';
import { gameEvents } from '../../game/events/bridge';
import { sound } from '../../game/sound';
import type { FloorStyle } from '../../game/art';

/** Maps bridge events to synthesized sounds; owns the mute toggle state. */
export function useGameSounds() {
  const [muted, setMuted] = useState(!sound.enabled);
  const [volume, setVolumeState] = useState(sound.volume);
  const [preferenceWriteFailures, setPreferenceWriteFailures] = useState({ mute: false, volume: false });

  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    const off = gameEvents.subscribe((event) => {
      if (event.type === 'EVIDENCE_DISCOVERED') sound.blip();
      else if (event.type === 'PLAYER_FOOTSTEP') {
        const payload = event.payload as { floorStyle?: FloorStyle };
        sound.footstep(payload.floorStyle ?? 'stone');
      }
      else if (event.type === 'NPC_DIALOGUE_STARTED') sound.talk();
      else if (event.type === 'NPC_BARK') sound.murmur();
      else if (event.type === 'DOOR_LOCKED') sound.doorLocked();
      else if (event.type === 'DOOR_UNLOCKED') sound.doorUnlocked();
      else if (event.type === 'PLAYER_ENTERED_ROOM') {
        sound.sweep();
        const payload = event.payload as { roomId?: string; floorStyle?: FloorStyle };
        if (payload.roomId) sound.enterRoom(payload.roomId);
        sound.setRain(payload.floorStyle === 'marsh');
      } else if (event.type === 'CASE_COMPLETED') {
        const payload = event.payload as { verdict: string };
        sound.sting(payload.verdict === 'CORRECT');
      }
    });
    return () => {
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('pointerdown', unlock);
      off();
    };
  }, []);

  const toggleMuted = () => {
    const enable = !sound.enabled;
    const saved = sound.setEnabled(enable);
    if (enable) sound.unlock();
    setMuted(!sound.enabled);
    setPreferenceWriteFailures((current) => ({ ...current, mute: !saved }));
  };

  const setVolume = (next: number) => {
    const saved = sound.setVolume(next);
    setVolumeState(sound.volume);
    setPreferenceWriteFailures((current) => ({ ...current, volume: !saved }));
  };

  return {
    muted,
    toggleMuted,
    volume,
    setVolume,
    preferenceStorageWarning: preferenceWriteFailures.mute || preferenceWriteFailures.volume,
  };
}
