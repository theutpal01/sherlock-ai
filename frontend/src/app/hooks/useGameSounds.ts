import { useEffect, useState } from 'react';
import { gameEvents } from '../../game/events/bridge';
import { sound } from '../../game/sound';

/** Maps bridge events to synthesized sounds; owns the mute toggle state. */
export function useGameSounds() {
  const [muted, setMuted] = useState(!sound.enabled);

  useEffect(() => {
    const unlock = () => sound.unlock();
    window.addEventListener('keydown', unlock);
    window.addEventListener('pointerdown', unlock);
    const off = gameEvents.subscribe((event) => {
      if (event.type === 'EVIDENCE_DISCOVERED') sound.blip();
      else if (event.type === 'NPC_DIALOGUE_STARTED') sound.talk();
      else if (event.type === 'PLAYER_ENTERED_ROOM') sound.sweep();
      else if (event.type === 'CASE_COMPLETED') {
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
    sound.setEnabled(sound.enabled ? false : true);
    setMuted(!sound.enabled);
  };

  return { muted, toggleMuted };
}
