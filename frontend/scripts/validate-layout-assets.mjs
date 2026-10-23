import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const gameRoot = join(frontendRoot, 'src', 'game');
const layoutRoot = join(gameRoot, 'layouts');
const artPath = join(gameRoot, 'art.ts');
const scenePath = join(gameRoot, 'scenes', 'Scene.ts');
const playerPath = join(gameRoot, 'entities', 'Player.ts');
const portraitsPath = join(gameRoot, 'portraits.ts');
const creditsPath = join(frontendRoot, 'public', 'assets', 'CREDITS.md');
const creditsText = readFileSync(creditsPath, 'utf8');
const artSource = ts.createSourceFile(
  artPath,
  readFileSync(artPath, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);

function unwrap(expression) {
  return ts.isAsExpression(expression) || ts.isSatisfiesExpression(expression)
    ? unwrap(expression.expression)
    : expression;
}

function stringElements(expression) {
  const value = unwrap(expression);
  return ts.isArrayLiteralExpression(value)
    ? value.elements.filter(ts.isStringLiteral).map((element) => element.text)
    : [];
}

const furniture = new Set();
const props = new Set();
const procedural = new Set();
const staticTextures = new Set();

function collectRegisteredAssets(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'STATIC_FLOOR_STYLES' && node.initializer) {
    stringElements(node.initializer).forEach((style) => staticTextures.add(`tile-floor-${style}`));
  }
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'STATIC_WALL_STYLES' && node.initializer) {
    stringElements(node.initializer).forEach((style) => staticTextures.add(`tile-wall-${style}`));
  }
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'FURNITURE' && node.initializer) {
    stringElements(node.initializer).forEach((name) => furniture.add(`furn-${name}`));
  }
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text.endsWith('_PROPS') && node.initializer) {
    stringElements(node.initializer).forEach((name) => props.add(`prop-${name}`));
  }

  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'bake' &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    procedural.add(node.arguments[0].text);
  }

  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'frameTile' &&
    node.arguments.length > 1 &&
    ts.isCallExpression(node.arguments[1]) &&
    ts.isIdentifier(node.arguments[1].expression) &&
    node.arguments[1].expression.text === 'floorTileKey' &&
    node.arguments[1].arguments.length > 0 &&
    ts.isStringLiteral(node.arguments[1].arguments[0])
  ) {
    staticTextures.add(`tile-floor-${node.arguments[1].arguments[0].text}`);
  }

  ts.forEachChild(node, collectRegisteredAssets);
}

collectRegisteredAssets(artSource);

const sceneSource = ts.createSourceFile(
  scenePath,
  readFileSync(scenePath, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);
const stringConstants = new Map();
function collectStringConstants(node) {
  if (
    ts.isVariableDeclaration(node) &&
    ts.isIdentifier(node.name) &&
    node.initializer &&
    ts.isStringLiteral(node.initializer)
  ) {
    stringConstants.set(node.name.text, node.initializer.text);
  }
  ts.forEachChild(node, collectStringConstants);
}
collectStringConstants(sceneSource);

const runtimeTextures = new Set();
function collectRuntimeTextures(node) {
  if (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.name.text === 'generateTexture' &&
    node.arguments.length > 0
  ) {
    const key = node.arguments[0];
    if (ts.isStringLiteral(key)) runtimeTextures.add(key.text);
    else if (ts.isIdentifier(key) && stringConstants.has(key.text)) {
      runtimeTextures.add(stringConstants.get(key.text));
    }
  }
  ts.forEachChild(node, collectRuntimeTextures);
}
collectRuntimeTextures(sceneSource);

const creditErrors = [];
for (const key of procedural) {
  if (!creditsText.includes(`\`${key}\``)) {
    creditErrors.push(`art.ts bake() texture ${key} is missing from CREDITS.md`);
  }
}
for (const key of runtimeTextures) {
  if (!creditsText.includes(`\`${key}\``)) {
    creditErrors.push(`Scene.ts generated texture ${key} is missing from CREDITS.md`);
  }
}

const portraitsSource = ts.createSourceFile(
  portraitsPath,
  readFileSync(portraitsPath, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);
let characterIds = [];
let dedicatedPortraitIds = [];
const castSheetIds = new Set();

function collectCharacterAssets(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
    if (node.name.text === 'CHAR_IDS') characterIds = stringElements(node.initializer);
    if (node.name.text === 'DEDICATED_PORTRAIT_IDS') {
      dedicatedPortraitIds = stringElements(node.initializer);
    }
    if (node.name.text === 'NPC_ART_IDS' && ts.isObjectLiteralExpression(unwrap(node.initializer))) {
      for (const property of unwrap(node.initializer).properties) {
        if (ts.isPropertyAssignment(property) && ts.isStringLiteral(property.initializer)) {
          castSheetIds.add(property.initializer.text);
        }
      }
    }
  }
  ts.forEachChild(node, collectCharacterAssets);
}

collectCharacterAssets(portraitsSource);

const layouts = readdirSync(layoutRoot)
  .filter((name) => name.endsWith('.ts') && name !== 'types.ts' && name !== 'index.ts')
  .sort();
const references = [];
const geometryErrors = [];
const DOOR_MIN_SENSOR_CONTACT = 8;
const DOOR_MIN_TANGENT_CLEARANCE = 18;
let checkedDoorCount = 0;
let loadedLayoutCount = 0;
let minimumSensorContact = Infinity;
let minimumTangentClearance = Infinity;

function numericConstant(source, name) {
  let value;
  function visit(node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === name &&
      node.initializer &&
      ts.isNumericLiteral(node.initializer)
    ) {
      value = Number(node.initializer.text);
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return value;
}

function numericCallArguments(source, expressionText) {
  let values;
  function visit(node) {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.getText(source).replace(/\s/g, '') === expressionText
    ) {
      values = node.arguments.map((argument) =>
        ts.isNumericLiteral(argument) ? Number(argument.text) : undefined,
      );
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return values;
}

const playerSource = ts.createSourceFile(
  playerPath,
  readFileSync(playerPath, 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);
const playerScale = numericCallArguments(playerSource, 'this.sprite.setScale');
const playerBodySize = numericCallArguments(playerSource, 'this.sprite.body?.setSize');
const wallThickness = numericConstant(sceneSource, 'WALL');
if (!playerScale || !playerBodySize || wallThickness === undefined) {
  geometryErrors.push(
    'Door geometry validation could not read the runtime player scale, body size, or wall thickness',
  );
}
const colliderWidth = playerScale && playerBodySize
  ? playerBodySize[0] * playerScale[0]
  : undefined;
const colliderHeight = playerScale && playerBodySize
  ? playerBodySize[1] * (playerScale[1] ?? playerScale[0])
  : undefined;
if (
  colliderWidth === undefined ||
  colliderHeight === undefined ||
  !Number.isFinite(colliderWidth) ||
  !Number.isFinite(colliderHeight)
) {
  geometryErrors.push('Door geometry validation could not calculate the scaled player collider');
}

function formatPixels(value) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
}

function validateDoorGeometry(layout, filename) {
  const rooms = new Map(layout.rooms.map((room) => [room.id, room]));
  const neighbors = new Map(layout.rooms.map((room) => [room.id, []]));

  for (const room of layout.rooms) {
    if (
      room.w <= 0 ||
      room.h <= 0 ||
      room.x < 0 ||
      room.y < 0 ||
      room.x + room.w > layout.worldW ||
      room.y + room.h > layout.worldH
    ) {
      geometryErrors.push(filename + ': room ' + room.id + ' is outside the world bounds');
    }
  }

  for (const door of layout.doors) {
    checkedDoorCount += 1;
    const room = rooms.get(door.roomId);
    const targetRoom = rooms.get(door.targetRoomId);
    if (!room) {
      geometryErrors.push(filename + ': door ' + door.id + ' has missing source room ' + door.roomId);
      continue;
    }
    if (!targetRoom) {
      geometryErrors.push(filename + ': door ' + door.id + ' has missing target room ' + door.targetRoomId);
      continue;
    }
    neighbors.get(door.roomId).push(door.targetRoomId);

    if (
      door.w <= 0 ||
      door.h <= 0 ||
      door.x < 0 ||
      door.y < 0 ||
      door.x + door.w > layout.worldW ||
      door.y + door.h > layout.worldH
    ) {
      geometryErrors.push(filename + ': door ' + door.id + ' trigger is outside the world bounds');
      continue;
    }

    const centerX = door.x + door.w / 2;
    const centerY = door.y + door.h / 2;
    const distances = {
      top: centerY - room.y,
      bottom: room.y + room.h - centerY,
      left: centerX - room.x,
      right: room.x + room.w - centerX,
    };
    const sides = ['top', 'bottom', 'left', 'right'];
    let wall = sides[0];
    for (const side of sides.slice(1)) {
      if (distances[wall] > distances[side]) wall = side;
    }

    const verticalWall = wall === 'left' || wall === 'right';
    const spanStart = verticalWall
      ? Math.max(room.y, door.y)
      : Math.max(room.x, door.x);
    const spanEnd = verticalWall
      ? Math.min(room.y + room.h, door.y + door.h)
      : Math.min(room.x + room.w, door.x + door.w);
    const openingLength = spanEnd - spanStart;
    const tangentCollider = verticalWall ? colliderHeight : colliderWidth;
    const tangentClearance = (openingLength - tangentCollider) / 2;
    minimumTangentClearance = Math.min(minimumTangentClearance, tangentClearance);
    if (spanStart < 0 || spanEnd > (verticalWall ? layout.worldH : layout.worldW)) {
      geometryErrors.push(filename + ': door ' + door.id + ' opening span is outside the world bounds');
    }
    if (tangentClearance < DOOR_MIN_TANGENT_CLEARANCE) {
      geometryErrors.push(
        filename + ': door ' + door.id + ' tangent clearance is ' +
          formatPixels(tangentClearance) + 'px; requires ' +
          DOOR_MIN_TANGENT_CLEARANCE + 'px',
      );
    }

    let wallStart;
    let wallEnd;
    let triggerStart;
    let triggerEnd;
    const colliderNormalHalf = verticalWall ? colliderWidth / 2 : colliderHeight / 2;
    if (wall === 'top') {
      wallStart = room.y;
      wallEnd = room.y + wallThickness;
      triggerStart = door.y;
      triggerEnd = door.y + door.h;
    } else if (wall === 'bottom') {
      wallStart = room.y + room.h - wallThickness;
      wallEnd = room.y + room.h;
      triggerStart = door.y;
      triggerEnd = door.y + door.h;
    } else if (wall === 'left') {
      wallStart = room.x;
      wallEnd = room.x + wallThickness;
      triggerStart = door.x;
      triggerEnd = door.x + door.w;
    } else {
      wallStart = room.x + room.w - wallThickness;
      wallEnd = room.x + room.w;
      triggerStart = door.x;
      triggerEnd = door.x + door.w;
    }
    const triggerGap = Math.max(0, wallStart - triggerEnd, triggerStart - wallEnd);
    const sensorContact = colliderNormalHalf - triggerGap;
    minimumSensorContact = Math.min(minimumSensorContact, sensorContact);
    if (sensorContact < DOOR_MIN_SENSOR_CONTACT) {
      geometryErrors.push(
        filename + ': door ' + door.id + ' player-to-trigger contact margin is ' +
          formatPixels(sensorContact) + 'px; requires ' +
          DOOR_MIN_SENSOR_CONTACT + 'px',
      );
    }
  }

  if (!rooms.has(layout.startRoom)) {
    geometryErrors.push(filename + ': start room ' + layout.startRoom + ' does not exist');
    return;
  }
  const reached = new Set([layout.startRoom]);
  const queue = [layout.startRoom];
  while (queue.length > 0) {
    for (const next of neighbors.get(queue.shift()) ?? []) {
      if (!reached.has(next)) {
        reached.add(next);
        queue.push(next);
      }
    }
  }
  if (reached.size !== rooms.size) {
    const unreachable = [...rooms.keys()].filter((roomId) => !reached.has(roomId));
    geometryErrors.push(
      filename + ': door graph reaches ' + reached.size + '/' + rooms.size +
        ' rooms; unreachable: ' + unreachable.join(', '),
    );
  }
}

for (const filename of layouts) {
  const path = join(layoutRoot, filename);
  const sourceText = readFileSync(path, 'utf8');
  const source = ts.createSourceFile(path, sourceText, ts.ScriptTarget.Latest, true);

  function collectReferences(node) {
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      (node.name.text === 'tex' || node.name.text === 'key') &&
      ts.isStringLiteral(node.initializer) &&
      /^(?:spr|furn|prop)-/.test(node.initializer.text)
    ) {
      const { line } = source.getLineAndCharacterOfPosition(node.initializer.getStart(source));
      references.push({ key: node.initializer.text, filename, line: line + 1 });
    }
    if (
      ts.isPropertyAssignment(node) &&
      ts.isIdentifier(node.name) &&
      (node.name.text === 'floorStyle' || node.name.text === 'wallStyle') &&
      ts.isStringLiteral(node.initializer)
    ) {
      const prefix = node.name.text === 'floorStyle' ? 'tile-floor-' : 'tile-wall-';
      const { line } = source.getLineAndCharacterOfPosition(node.initializer.getStart(source));
      references.push({ key: `${prefix}${node.initializer.text}`, filename, line: line + 1 });
    }
    ts.forEachChild(node, collectReferences);
  }

  collectReferences(source);

  try {
    const compiled = ts.transpileModule(sourceText, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText;
    const layoutModule = { exports: {} };
    new Function('exports', 'require', 'module', compiled)(
      layoutModule.exports,
      (name) => {
        throw new Error('Unexpected runtime import ' + name);
      },
      layoutModule,
    );
    const caseLayouts = Object.values(layoutModule.exports).filter(
      (value) =>
        value &&
        typeof value === 'object' &&
        typeof value.caseId === 'string' &&
        Array.isArray(value.rooms) &&
        Array.isArray(value.doors) &&
        typeof value.worldW === 'number' &&
        typeof value.worldH === 'number' &&
        typeof value.startRoom === 'string',
    );
    if (caseLayouts.length !== 1) {
      geometryErrors.push(
        filename + ': expected one case layout export, found ' + caseLayouts.length,
      );
    } else {
      loadedLayoutCount += 1;
      validateDoorGeometry(caseLayouts[0], filename);
    }
  } catch (error) {
    geometryErrors.push(
      filename + ': could not load layout for geometry validation: ' + error.message,
    );
  }
}

const errors = [...creditErrors, ...geometryErrors];
for (const reference of references) {
  if (reference.key.startsWith('spr-') && !procedural.has(reference.key)) {
    errors.push(`${reference.filename}:${reference.line}: ${reference.key} is not registered with bake() in art.ts`);
  } else if (reference.key.startsWith('furn-') && !furniture.has(reference.key)) {
    errors.push(`${reference.filename}:${reference.line}: ${reference.key} is not listed in FURNITURE in art.ts`);
  } else if (reference.key.startsWith('prop-') && !props.has(reference.key)) {
    errors.push(`${reference.filename}:${reference.line}: ${reference.key} is not listed in a case prop catalog in art.ts`);
  } else if (
    (reference.key.startsWith('tile-floor-') || reference.key.startsWith('tile-wall-')) &&
    !procedural.has(reference.key) &&
    !staticTextures.has(reference.key)
  ) {
    errors.push(`${reference.filename}:${reference.line}: ${reference.key} is not registered in art.ts`);
  }
}

for (const key of furniture) {
  const file = join(frontendRoot, 'public', 'assets', 'furniture', `${key.slice('furn-'.length)}.png`);
  if (!existsSync(file)) errors.push(`FURNITURE registers ${key}, but ${file} is missing`);
}

for (const key of props) {
  const file = join(frontendRoot, 'public', 'assets', 'props', `${key.slice('prop-'.length)}.png`);
  if (!existsSync(file)) errors.push(`A case prop catalog registers ${key}, but ${file} is missing`);
}

for (const key of staticTextures) {
  const isFloor = key.startsWith('tile-floor-');
  const prefix = isFloor ? 'tile-floor-' : 'tile-wall-';
  const folder = isFloor ? 'floors' : 'walls';
  const style = key.slice(prefix.length);
  const file = join(frontendRoot, 'public', 'assets', folder, `${style}.png`);
  if (!existsSync(file)) errors.push(`Static floor texture ${key} is registered, but ${file} is missing`);
  if (!creditsText.includes(`\`${folder}/${style}.png\``)) {
    errors.push(`Static texture ${key} is missing from CREDITS.md`);
  }
}

for (const id of characterIds) {
  const face = join(frontendRoot, 'public', 'assets', 'faces', `npc-${id}.png`);
  const cast = join(frontendRoot, 'public', 'assets', 'cast', `${id}.png`);
  if (!existsSync(face)) errors.push(`CHAR_IDS includes ${id}, but ${face} is missing`);
  if (!existsSync(cast)) errors.push(`CHAR_IDS includes ${id}, but ${cast} is missing`);
  castSheetIds.add(id);
}

for (const id of dedicatedPortraitIds) {
  const face = join(frontendRoot, 'public', 'assets', 'faces', `npc-${id}.png`);
  if (!existsSync(face)) errors.push(`DEDICATED_PORTRAIT_IDS includes ${id}, but ${face} is missing`);
}

for (const id of castSheetIds) {
  const cast = join(frontendRoot, 'public', 'assets', 'cast', `${id}.png`);
  if (!existsSync(cast)) errors.push(`NPC_ART_IDS maps to ${id}, but ${cast} is missing`);
}

if (errors.length > 0) {
  console.error(`Layout asset validation failed:\n${errors.map((error) => `  - ${error}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(
    'Validated door geometry for ' + loadedLayoutCount + ' case layouts and ' +
      checkedDoorCount + ' doors; minimum player-to-trigger contact margin ' +
      formatPixels(minimumSensorContact) + 'px, minimum tangent clearance ' +
      formatPixels(minimumTangentClearance) + 'px.',
  );
  console.log(
    `Validated ${references.length} texture references across ${layouts.length} case layouts, ${furniture.size} furniture assets, ${characterIds.length} character portraits and cast sheets, ${dedicatedPortraitIds.length} dedicated portraits, and credits for ${procedural.size} drawn and ${runtimeTextures.size} runtime textures.`,
  );
}
