# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: tests/movement.spec.ts >> arrow key movement works
- Location: tests/movement.spec.ts:3:5

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/
Call log:
  - navigating to "http://127.0.0.1:5173/", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test('arrow key movement works', async ({ page }) => {
> 4  |   await page.goto('http://127.0.0.1:5173/');
     |              ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://127.0.0.1:5173/
  5  |   await page.waitForLoadState('networkidle');
  6  |   
  7  |   // Click Start investigation on first case
  8  |   await page.click('button:has-text("Start investigation")');
  9  |   await page.waitForTimeout(2000); // wait for game to load
  10 |   
  11 |   // Get canvas and click to focus
  12 |   const canvas = page.locator('canvas');
  13 |   await canvas.click();
  14 |   await page.waitForTimeout(500);
  15 |   
  16 |   // Get initial position
  17 |   const initialPos = await page.evaluate(() => {
  18 |     const game = (window as any).game;
  19 |     if (!game || !game.scene) return { error: 'no game' };
  20 |     const scene = game.scene.getScene('manor');
  21 |     if (!scene || !scene.player) return { error: 'no player' };
  22 |     return { x: scene.player.x, y: scene.player.y };
  23 |   });
  24 |   console.log('Initial position:', initialPos);
  25 |   
  26 |   // Press ArrowRight multiple times
  27 |   for (let i = 0; i < 5; i++) {
  28 |     await page.keyboard.press('ArrowRight');
  29 |     await page.waitForTimeout(200);
  30 |   }
  31 |   
  32 |   // Check position changed
  33 |   const finalPos = await page.evaluate(() => {
  34 |     const game = (window as any).game;
  35 |     if (!game || !game.scene) return { error: 'no game' };
  36 |     const scene = game.scene.getScene('manor');
  37 |     if (!scene || !scene.player) return { error: 'no player' };
  38 |     return { x: scene.player.x, y: scene.player.y, velX: scene.player.sprite.body.velocity.x };
  39 |   });
  40 |   console.log('Final position:', finalPos);
  41 |   
  42 |   // Also test ArrowUp, ArrowDown, ArrowLeft
  43 |   for (let i = 0; i < 3; i++) {
  44 |     await page.keyboard.press('ArrowUp');
  45 |     await page.waitForTimeout(200);
  46 |   }
  47 |   
  48 |   const pos2 = await page.evaluate(() => {
  49 |     const game = (window as any).game;
  50 |     if (!game || !game.scene) return { error: 'no game' };
  51 |     const scene = game.scene.getScene('manor');
  52 |     if (!scene || !scene.player) return { error: 'no player' };
  53 |     return { x: scene.player.x, y: scene.player.y, velY: scene.player.sprite.body.velocity.y };
  54 |   });
  55 |   console.log('After up:', pos2);
  56 |   
  57 |   expect(finalPos).not.toEqual(initialPos);
  58 | });
  59 | 
```