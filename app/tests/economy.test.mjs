import test from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

import { loadShopCatalog, loadInventory, buyShopItem, useInventoryItem } from '../src/economy.mjs';

async function writeJson(root, relativePath, value) {
  const fullPath = path.join(root, relativePath);
  await fs.mkdir(path.dirname(fullPath), { recursive: true });
  await fs.writeFile(fullPath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

async function readJson(root, relativePath) {
  return JSON.parse(await fs.readFile(path.join(root, relativePath), 'utf8'));
}

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function splitEconomyRoot() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'magic-adv-economy-split-'));
  await writeJson(root, 'data/definitions/game_data/shop_catalog.json', {
    shop_name: '学院購買部',
    items: [
      {
        item_id: 'light_mastery_elixir',
        name: '光の霊薬',
        description: '使うと光魔法習熟度が1上がる。',
        buy_price: 10000,
        sell_price: 0,
        stat_effect: { group: 'magic', key: 'light', amount: 1 }
      }
    ]
  });
  await writeJson(root, 'data/definitions/game_data/stage_flags.json', {
    flags: [
      {
        id: 'stage.test.reward',
        label: '報酬テスト',
        location_id: 'front_gate_morning',
        condition: '報酬を受け取る。',
        question: '報酬を受け取ったか',
        reward_on_inventory_open: {
          item_id: 'ripple_clock_face',
          quantity: 1,
          name: '水面時計の銅針',
          description: 'テスト報酬。',
          sell_price: 3
        }
      }
    ]
  });
  await writeJson(root, 'data/definitions/game_data/world/settings.json', {
    academy_name: '星灯魔法学院',
    player_name: '主人公',
    world_description: '学院の基本設定。',
    world_condition_texts: []
  });
  await writeJson(root, 'data/seeds/game_data/player_inventory.json', {
    money: 12000,
    items: []
  });
  await writeJson(root, 'data/seeds/game_data/runtime/player_parameters.json', {
    magic: {
      light: { min: 0, max: 100, label: '光魔法習熟度', value: 7 }
    },
    abilities: {
      strength: { min: 0, max: 100, label: '筋力', value: 4 }
    }
  });
  await writeJson(root, 'data/mutable/game_data/runtime_state.json', {
    version: 1,
    global_flags: { 'stage.test.reward': true },
    characters: {}
  });
  return root;
}

test('loadShopCatalog and loadInventory read split definitions/seeds without claiming stage rewards or mutating completion flags', async () => {
  const root = await splitEconomyRoot();

  const catalog = await loadShopCatalog({ root });
  const inventory = await loadInventory({ root });

  assert.equal(catalog.shop_name, '学院購買部');
  assert.equal(catalog.items[0].item_id, 'light_mastery_elixir');
  assert.equal(inventory.money, 12000);
  assert.equal(inventory.items.some((item) => item.item_id === 'ripple_clock_face'), false);

  const savedInventory = await readJson(root, 'data/seeds/game_data/player_inventory.json');
  const savedState = await readJson(root, 'data/mutable/game_data/runtime_state.json');
  assert.deepEqual(savedInventory.items, []);
  assert.equal(savedState.global_flags['stage.test.reward'], true);
});

test('buyShopItem and useInventoryItem write split mutable inventory and player parameters without reviving legacy game_data writes', async () => {
  const root = await splitEconomyRoot();

  await loadInventory({ root });
  const bought = await buyShopItem({ root, itemId: 'light_mastery_elixir', quantity: 1 });
  assert.equal(bought.inventory.money, 2000);
  assert.equal(bought.inventory.items.some((item) => item.item_id === 'ripple_clock_face'), false);

  const used = await useInventoryItem({ root, itemId: 'light_mastery_elixir' });
  assert.equal(used.effect.key, 'light');
  assert.equal(used.effect.before, 7);
  assert.equal(used.effect.after, 8);
  assert.equal(used.inventory.items.some((item) => item.item_id === 'light_mastery_elixir'), false);

  const mutableInventory = await readJson(root, 'data/mutable/game_data/player_inventory.json');
  const mutableParameters = await readJson(root, 'data/mutable/game_data/runtime/player_parameters.json');
  assert.equal(mutableInventory.money, 2000);
  assert.equal(mutableInventory.items.some((item) => item.item_id === 'light_mastery_elixir'), false);
  assert.equal(mutableParameters.magic.light.value, 8);
  assert.equal(await pathExists(path.join(root, 'app/config/world/settings.json')), false, 'item-use stat updates should not create a desktop world override file');

  await assert.rejects(fs.access(path.join(root, 'game_data/player_inventory.json')), { code: 'ENOENT' });
  await assert.rejects(fs.access(path.join(root, 'game_data/runtime/player_parameters.json')), { code: 'ENOENT' });
});
