import { runTraining, skipTraining } from '../training.mjs';
import { buyShopItem, loadInventory, loadShopCatalog, sellShopItem, useInventoryItem } from '../economy.mjs';
import { startNextAcademyWeek } from '../graduationEnding.mjs';

export function canHandleProgressionEconomyApiRoute(method, pathname) {
  return (
    (method === 'POST' && pathname === '/api/training/run') ||
    (method === 'POST' && pathname === '/api/training/skip') ||
    (method === 'POST' && pathname === '/api/academy/week/start') ||
    (method === 'GET' && pathname === '/api/inventory') ||
    (method === 'POST' && pathname === '/api/inventory/use') ||
    (method === 'GET' && pathname === '/api/shop') ||
    (method === 'POST' && pathname === '/api/shop/buy') ||
    (method === 'POST' && pathname === '/api/shop/sell')
  );
}

export async function handleProgressionEconomyApi({ req, res, url, context, sendJson, readBody }) {
  const root = context.activeRoot ?? context.root;

  if (req.method === 'POST' && url.pathname === '/api/training/run') {
    const body = await readBody(req);
    return sendJson(res, await runTraining({ root, trainingId: body.training_id, randomSeed: body.random_seed }));
  }
  if (req.method === 'POST' && url.pathname === '/api/training/skip') {
    return sendJson(res, await skipTraining({ root }));
  }
  if (req.method === 'POST' && url.pathname === '/api/academy/week/start') {
    return sendJson(res, await startNextAcademyWeek({ root, authoringRoot: context.root }));
  }
  if (req.method === 'GET' && url.pathname === '/api/inventory') {
    return sendJson(res, await loadInventory({ root }));
  }
  if (req.method === 'POST' && url.pathname === '/api/inventory/use') {
    const body = await readBody(req);
    try {
      return sendJson(res, await useInventoryItem({ root, itemId: body.item_id }));
    } catch (error) {
      return sendJson(res, { error: error.message }, 400);
    }
  }
  if (req.method === 'GET' && url.pathname === '/api/shop') {
    return sendJson(res, await loadShopCatalog({ root }));
  }
  if (req.method === 'POST' && url.pathname === '/api/shop/buy') {
    const body = await readBody(req);
    try {
      return sendJson(res, await buyShopItem({ root, itemId: body.item_id, quantity: body.quantity }));
    } catch (error) {
      return sendJson(res, { error: error.message }, 400);
    }
  }
  if (req.method === 'POST' && url.pathname === '/api/shop/sell') {
    const body = await readBody(req);
    try {
      return sendJson(res, await sellShopItem({ root, itemId: body.item_id, quantity: body.quantity }));
    } catch (error) {
      return sendJson(res, { error: error.message }, 400);
    }
  }
}
