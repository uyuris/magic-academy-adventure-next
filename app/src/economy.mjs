import { createStorageApi } from './storage.mjs';
import { loadStageFlags } from './stageFlags.mjs';
import { abilityParameterDefinitions, magicParameterDefinitions } from './parameters.mjs';
import { loadWorldSettings, updatePlayerParameters } from './worldSettings.mjs';

const inventoryPath = 'game_data/player_inventory.json';
const catalogPath = 'game_data/shop_catalog.json';

const statItemPrice = 10000;

const statItemDefinitions = [
  ...magicParameterDefinitions.map(({ key, label }) => ({
    item_id: `${key}_mastery_elixir`,
    name: `${label.replace('習熟度', '')}の霊薬`,
    description: `使うと${label}が1上がる。`,
    buy_price: statItemPrice,
    sell_price: 0,
    stat_effect: { group: 'magic', key, amount: 1 }
  })),
  ...abilityParameterDefinitions.map(({ key, label }) => ({
    item_id: `${key}_tonic`,
    name: `${label}の霊薬`,
    description: `使うと${label}が1上がる。`,
    buy_price: statItemPrice,
    sell_price: 0,
    stat_effect: { group: 'abilities', key, amount: 1 }
  }))
];

const fallbackCatalog = {
  shop_name: '学院購買部',
  items: statItemDefinitions
};

const fallbackInventory = {
  money: 150,
  items: [],
  applied_money_delta_conversation_ids: []
};

const specialRewardItems = [
  {
    item_id: 'fairy_doll',
    name: '妖精さんの人形',
    description: '禁書庫の静かなティータイムのあと、鞄に紛れていた小さな妖精の人形。淡い茶葉の香りがする。',
    buy_price: 0,
    sell_price: 0
  },
  {
    item_id: 'necromancy_book',
    name: '死霊術の本',
    description: '禁書庫で見つけた、死霊術について記された古い本。表紙は冷たく、開くと乾いた紙と封蝋の匂いがする。',
    buy_price: 0,
    sell_price: 0
  },
  {
    item_id: 'margin_starmap_bookmark',
    name: '余白星図の栞',
    description: '禁書庫の白紙本から抜け落ちた薄い栞。何も書かれていないはずの余白に、見るたび違う小さな星座が瞬いている。',
    buy_price: 0,
    sell_price: 0
  }
];

function storageApiFor(rootOrStorage) {
  if (rootOrStorage && typeof rootOrStorage.readJson === 'function' && typeof rootOrStorage.writeJson === 'function') {
    return rootOrStorage;
  }
  return createStorageApi({ root: rootOrStorage });
}

async function readJsonIfExists(rootOrStorage, relativePath, fallback) {
  const storage = storageApiFor(rootOrStorage);
  const value = await storage.readJsonIfExists(relativePath);
  return value == null ? structuredClone(fallback) : value;
}

async function writeJson(rootOrStorage, relativePath, value) {
  const storage = storageApiFor(rootOrStorage);
  await storage.writeJson(relativePath, value);
}

function normalizeQuantity(quantity) {
  const value = Number(quantity ?? 1);
  if (!Number.isInteger(value) || value <= 0) throw new Error('quantity_must_be_positive_integer');
  return value;
}

function normalizeInventory(inventory) {
  const appliedMoneyDeltaConversationIds = Array.isArray(inventory?.applied_money_delta_conversation_ids)
    ? [...new Set(inventory.applied_money_delta_conversation_ids
      .map((conversationId) => String(conversationId ?? '').trim())
      .filter(Boolean))].sort()
    : [];
  return {
    money: Math.max(0, Math.floor(Number(inventory?.money ?? 0))),
    items: (inventory?.items ?? [])
      .map((item) => ({ item_id: item.item_id, quantity: Math.max(0, Math.floor(Number(item.quantity ?? 0))) }))
      .filter((item) => item.item_id && item.quantity > 0),
    applied_money_delta_conversation_ids: appliedMoneyDeltaConversationIds
  };
}

function findCatalogItem(catalog, itemId) {
  const item = (catalog.items ?? []).find((candidate) => candidate.item_id === itemId);
  if (!item) throw new Error('unknown_shop_item');
  return item;
}

function sellableItemDefinitions(catalog, stageRewardItems = []) {
  return [...(catalog.items ?? []), ...specialRewardItems, ...stageRewardItems];
}

function findSellableItem(catalog, stageRewardItems, itemId) {
  const item = sellableItemDefinitions(catalog, stageRewardItems).find((candidate) => candidate.item_id === itemId);
  if (!item) throw new Error('unknown_inventory_item');
  return item;
}

function itemQuantity(inventory, itemId) {
  return inventory.items.find((item) => item.item_id === itemId)?.quantity ?? 0;
}

function setItemQuantity(inventory, itemId, quantity) {
  const nextItems = inventory.items.filter((item) => item.item_id !== itemId);
  if (quantity > 0) nextItems.push({ item_id: itemId, quantity });
  nextItems.sort((a, b) => a.item_id.localeCompare(b.item_id));
  return { ...inventory, items: nextItems };
}

function stageRewardCatalogItems(definitions) {
  return (definitions.flags ?? [])
    .map((flag) => flag.reward_on_inventory_open)
    .filter((reward) => reward?.item_id)
    .map((reward) => ({
      item_id: reward.item_id,
      name: reward.name ?? reward.item_id,
      description: reward.description ?? '',
      buy_price: 0,
      sell_price: Math.max(0, Math.floor(Number(reward.sell_price ?? 0)))
    }));
}

function decorateInventory(inventory, catalog, stageRewardItems = []) {
  const itemDefinitions = sellableItemDefinitions(catalog, stageRewardItems);
  return {
    money: inventory.money,
    items: inventory.items.map((owned) => {
      const catalogItem = itemDefinitions.find((item) => item.item_id === owned.item_id);
      return {
        item_id: owned.item_id,
        name: catalogItem?.name ?? owned.item_id,
        description: catalogItem?.description ?? '',
        quantity: owned.quantity,
        sell_price: catalogItem?.sell_price ?? 0,
        ...(catalogItem?.stat_effect ? { stat_effect: catalogItem.stat_effect } : {})
      };
    })
  };
}

function normalizeRewardGrant(reward) {
  if (!reward?.item_id) return null;
  return {
    item_id: reward.item_id,
    quantity: Math.max(1, Math.floor(Number(reward.quantity ?? 1)))
  };
}

function applyRewardGrants(inventory, rewards) {
  let nextInventory = inventory;
  for (const reward of rewards) {
    nextInventory = setItemQuantity(nextInventory, reward.item_id, itemQuantity(nextInventory, reward.item_id) + reward.quantity);
  }
  return nextInventory;
}

export async function loadShopCatalog({ root }) {
  const catalog = await readJsonIfExists(root, catalogPath, fallbackCatalog);
  return {
    shop_name: catalog.shop_name ?? '学院購買部',
    items: (catalog.items ?? []).map((item) => ({
      item_id: item.item_id,
      name: item.name ?? item.item_id,
      description: item.description ?? '',
      buy_price: Math.max(0, Math.floor(Number(item.buy_price ?? 0))),
      sell_price: Math.max(0, Math.floor(Number(item.sell_price ?? 0))),
      ...(item.stat_effect ? {
        stat_effect: {
          group: item.stat_effect.group,
          key: item.stat_effect.key,
          amount: Math.max(1, Math.floor(Number(item.stat_effect.amount ?? 1)))
        }
      } : {})
    })).filter((item) => item.item_id)
  };
}

export async function loadInventory({ root }) {
  const [rawInventory, catalog, definitions] = await Promise.all([
    readJsonIfExists(root, inventoryPath, fallbackInventory),
    loadShopCatalog({ root }),
    loadStageFlags({ root })
  ]);
  return decorateInventory(normalizeInventory(rawInventory), catalog, stageRewardCatalogItems(definitions));
}

export async function grantInventoryRewards({ root, rewards = [] }) {
  const normalizedRewards = rewards
    .map((reward) => normalizeRewardGrant(reward))
    .filter(Boolean);
  const [rawInventory, catalog, definitions] = await Promise.all([
    readJsonIfExists(root, inventoryPath, fallbackInventory),
    loadShopCatalog({ root }),
    loadStageFlags({ root })
  ]);
  const stageRewardItems = stageRewardCatalogItems(definitions);
  const inventory = normalizeInventory(rawInventory);
  const nextInventory = applyRewardGrants(inventory, normalizedRewards);
  const changed = JSON.stringify(nextInventory) !== JSON.stringify(inventory);
  if (changed) await writeJson(root, inventoryPath, nextInventory);
  return {
    granted_rewards: normalizedRewards,
    before_inventory: decorateInventory(inventory, catalog, stageRewardItems),
    inventory: decorateInventory(nextInventory, catalog, stageRewardItems)
  };
}

export async function buyShopItem({ root, itemId, quantity }) {
  const amount = normalizeQuantity(quantity);
  const [catalog, rawInventory, definitions] = await Promise.all([
    loadShopCatalog({ root }),
    readJsonIfExists(root, inventoryPath, fallbackInventory),
    loadStageFlags({ root })
  ]);
  const inventory = normalizeInventory(rawInventory);
  const item = findCatalogItem(catalog, itemId);
  const total = item.buy_price * amount;
  if (inventory.money < total) throw new Error('insufficient_money');
  const next = setItemQuantity({ ...inventory, money: inventory.money - total }, itemId, itemQuantity(inventory, itemId) + amount);
  const stageRewardItems = stageRewardCatalogItems(definitions);
  await writeJson(root, inventoryPath, next);
  return { item, quantity: amount, inventory: decorateInventory(next, catalog, stageRewardItems) };
}

export async function sellShopItem({ root, itemId, quantity }) {
  const amount = normalizeQuantity(quantity);
  const [catalog, rawInventory, definitions] = await Promise.all([
    loadShopCatalog({ root }),
    readJsonIfExists(root, inventoryPath, fallbackInventory),
    loadStageFlags({ root })
  ]);
  const inventory = normalizeInventory(rawInventory);
  const stageRewardItems = stageRewardCatalogItems(definitions);
  const item = findSellableItem(catalog, stageRewardItems, itemId);
  const owned = itemQuantity(inventory, itemId);
  if (owned < amount) throw new Error('insufficient_item_quantity');
  const next = setItemQuantity({ ...inventory, money: inventory.money + (item.sell_price * amount) }, itemId, owned - amount);
  await writeJson(root, inventoryPath, next);
  return { item, quantity: amount, inventory: decorateInventory(next, catalog, stageRewardItems) };
}

function findUsableItem(catalog, itemId) {
  const item = (catalog.items ?? []).find((candidate) => candidate.item_id === itemId);
  if (!item) throw new Error('unknown_inventory_item');
  if (!item.stat_effect?.group || !item.stat_effect?.key) throw new Error('item_is_not_usable');
  return item;
}

export async function useInventoryItem({ root, itemId }) {
  const [catalog, rawInventory, world, definitions] = await Promise.all([
    loadShopCatalog({ root }),
    readJsonIfExists(root, inventoryPath, fallbackInventory),
    loadWorldSettings({ root }),
    loadStageFlags({ root })
  ]);
  const inventory = normalizeInventory(rawInventory);
  const item = findUsableItem(catalog, itemId);
  const owned = itemQuantity(inventory, itemId);
  if (owned < 1) throw new Error('insufficient_item_quantity');
  const { group, key } = item.stat_effect;
  const amount = Math.max(1, Math.floor(Number(item.stat_effect.amount ?? 1)));
  const before = Math.max(0, Math.min(100, Number(world.player_parameters?.[group]?.[key]?.value ?? 0)));
  const after = Math.max(0, Math.min(100, before + amount));
  const nextParameters = structuredClone(world.player_parameters);
  nextParameters[group][key] = { ...nextParameters[group][key], value: after };
  const nextWorld = await updatePlayerParameters({
    root,
    playerParameters: nextParameters
  });
  const nextInventory = setItemQuantity(inventory, itemId, owned - 1);
  const stageRewardItems = stageRewardCatalogItems(definitions);
  await writeJson(root, inventoryPath, nextInventory);
  return {
    item,
    effect: { group, key, label: world.player_parameters[group][key].label, amount, before, after },
    inventory: decorateInventory(nextInventory, catalog, stageRewardItems),
    world: nextWorld
  };
}

export async function applyPlayerMoneyDelta({ root, conversationId = null, delta }) {
  const [catalog, rawInventory] = await Promise.all([
    loadShopCatalog({ root }),
    readJsonIfExists(root, inventoryPath, fallbackInventory)
  ]);
  const inventory = normalizeInventory(rawInventory);
  const amount = Number.isFinite(Number(delta)) ? Math.trunc(Number(delta)) : 0;
  const normalizedConversationId = String(conversationId ?? '').trim() || null;
  if (normalizedConversationId && inventory.applied_money_delta_conversation_ids.includes(normalizedConversationId)) {
    return {
      before_money: inventory.money,
      delta: amount,
      after_money: inventory.money,
      already_applied: true,
      inventory: decorateInventory(inventory, catalog)
    };
  }
  const nextAppliedIds = normalizedConversationId
    ? [...inventory.applied_money_delta_conversation_ids, normalizedConversationId].sort()
    : inventory.applied_money_delta_conversation_ids;
  const next = {
    ...inventory,
    money: Math.max(0, inventory.money + amount),
    applied_money_delta_conversation_ids: nextAppliedIds
  };
  await writeJson(root, inventoryPath, next);
  return {
    before_money: inventory.money,
    delta: amount,
    after_money: next.money,
    already_applied: false,
    inventory: decorateInventory(next, catalog)
  };
}
