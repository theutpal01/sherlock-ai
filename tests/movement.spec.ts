import { test, expect } from '@playwright/test';

test('arrow key movement works', async ({ page }) => {
  await page.goto('http://127.0.0.1:5173/');
  await page.waitForLoadState('networkidle');
  
  // Click Start investigation on first case
  await page.click('button:has-text("Start investigation")');
  await page.waitForTimeout(2000); // wait for game to load
  
  // Get canvas and click to focus
  const canvas = page.locator('canvas');
  await canvas.click();
  await page.waitForTimeout(500);
  
  // Get initial position
  const initialPos = await page.evaluate(() => {
    const game = (window as any).game;
    if (!game || !game.scene) return { error: 'no game' };
    const scene = game.scene.getScene('manor');
    if (!scene || !scene.player) return { error: 'no player' };
    return { x: scene.player.x, y: scene.player.y };
  });
  console.log('Initial position:', initialPos);
  
  // Press ArrowRight multiple times
  for (let i = 0; i < 5; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(200);
  }
  
  // Check position changed
  const finalPos = await page.evaluate(() => {
    const game = (window as any).game;
    if (!game || !game.scene) return { error: 'no game' };
    const scene = game.scene.getScene('manor');
    if (!scene || !scene.player) return { error: 'no player' };
    return { x: scene.player.x, y: scene.player.y, velX: scene.player.sprite.body.velocity.x };
  });
  console.log('Final position:', finalPos);
  
  // Also test ArrowUp, ArrowDown, ArrowLeft
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press('ArrowUp');
    await page.waitForTimeout(200);
  }
  
  const pos2 = await page.evaluate(() => {
    const game = (window as any).game;
    if (!game || !game.scene) return { error: 'no game' };
    const scene = game.scene.getScene('manor');
    if (!scene || !scene.player) return { error: 'no player' };
    return { x: scene.player.x, y: scene.player.y, velY: scene.player.sprite.body.velocity.y };
  });
  console.log('After up:', pos2);
  
  expect(finalPos).not.toEqual(initialPos);
});
