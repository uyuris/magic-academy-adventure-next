import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { runtimePublicReferenceRoot, runtimeSourceReferenceRoot, projectRoot } from './testPaths.mjs';

const root = runtimePublicReferenceRoot;
const sourceRoot = runtimeSourceReferenceRoot;

function cssRuleBlock(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return css.match(new RegExp(`${escaped}\\s*\\{([\\s\\S]*?)\\n\\}`))?.[1] ?? '';
}

test('browser shell exposes Event between Training and Inventory without implementing event choices yet', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const js = await readFile(path.join(root, 'app.js'), 'utf8');

  for (const screen of ['title', 'slot-load', 'world', 'field', 'interaction', 'training', 'event', 'inventory', 'shop', 'debug', 'academy-map', 'academy-companion', 'academy-conversation-session', 'academy-room']) {
    assert.match(html, new RegExp(`data-screen="${screen}"`), `missing ${screen} tab`);
    assert.match(html, new RegExp(`id="${screen}-screen"`), `missing #${screen}-screen`);
  }

  assert.match(html, /id="academy-map-screen" class="screen active"/, 'academy map should be the initial screen for normal debug/tuning access');
  assert.match(html, /id="title-screen" class="screen title-hero-screen"/, 'title should be available but not the initial screen');
  assert.match(html, /data-screen="debug"[\s\S]*>デバッグ<[\s\S]*data-screen="title"[\s\S]*>タイトル<[\s\S]*data-screen="academy-map" class="active"[\s\S]*>学院マップ</, 'title tab should sit between Debug and the initially active Academy Map');
  assert.match(html, /data-screen="academy-room"[\s\S]*>自室<[\s\S]*data-screen="slot-load"[^>]*>ロード</, 'topbar should expose a dedicated ロード route after the normal screen tabs');
  assert.match(html, /<section id="title-screen"[\s\S]*id="start-new-game"[\s\S]*最初から始める[\s\S]*id="open-load-screen"[\s\S]*ロード/, 'title screen should expose new-game and placeholder load actions');
  assert.match(html, /<section id="title-screen"[\s\S]*id="title-status"[\s\S]*aria-live="polite"/, 'title screen should expose a visible live status area for startup failures');
  assert.doesNotMatch(html, /id="open-load-screen"[^>]*disabled/, 'title load action should no longer be a disabled placeholder once the load screen exists');
  assert.match(js, /async function startNewGame\(\)[\s\S]*postJson\('\/api\/new-game'/, 'new game button should call the play-area initialization API');
  assert.match(js, /function setTitleActionStatus\(message, options = \{\}\)[\s\S]*#title-status/, 'front-end should expose a dedicated title status writer');
  assert.match(js, /function reportError\(error\)[\s\S]*#title-screen[^\n]*active[\s\S]*setTitleActionStatus\(/, 'runtime errors triggered from the title screen should become visible there instead of staying console-only');
  assert.match(js, /async function routePendingEventFromAcademyMap\(\)[\s\S]*refreshEventFlagStatus\(\)[\s\S]*pending_events[\s\S]*startAcademyConversationSessionFromPendingEvent\(autoStartFlag\.id\)/, 'academy map entry should detect a ready event and start it through the loading-aware academy conversation session route');
  assert.match(js, /async function startNewGame\(\)[\s\S]*showScreen\('academy-map', \{ rerollAcademyMap: true \}\)[\s\S]*await routePendingEventFromAcademyMap\(\)/, 'new game should enter the academy map route and then auto-start the opening event when it is ready');
  assert.match(js, /#start-new-game[\s\S]*startNewGame\(\)/, 'new game button should be wired');

  assert.match(html, /id="event-pending-list"/, 'event screen should expose a pending-event status list');
  assert.match(html, /id="event-empty-message"/, 'event screen should explain when no event is ready');
  assert.doesNotMatch(html, /id="complete-event"/);
  assert.doesNotMatch(html, /id="event-choices"/);
  assert.match(html, /data-screen="interaction"[\s\S]*>インタラクション<\/[\s\S]*data-screen="training"[\s\S]*>鍛錬<\/[\s\S]*data-screen="event"[\s\S]*>イベント<\/[\s\S]*data-screen="inventory"[\s\S]*>所持品・所持金</, 'event tab should sit between Training/鍛錬 and Inventory');
  assert.doesNotMatch(html, /data-screen="training">育成<\//, 'training tab should not keep the old 育成 label');
  assert.match(html, /data-screen="world"[\s\S]*>ワールド</, 'world tab should remain in the normal left-side group');
  assert.match(html, /data-screen="debug"[\s\S]*>デバッグ<[\s\S]*data-screen="title"[\s\S]*>タイトル<[\s\S]*data-screen="academy-map"[\s\S]*>学院マップ<[\s\S]*data-screen="academy-companion"[\s\S]*>会話相手<[\s\S]*data-screen="academy-conversation-session"[\s\S]*>会話セッション<[\s\S]*data-screen="academy-room"[\s\S]*>自室</, 'academy room tab should sit to the right of academy conversation session');
  assert.match(html, /id="world-screen" class="screen"/, 'world settings should be its own tabbed screen');
  assert.match(html, /id="debug-screen" class="screen"/, 'debug panel should be its own tabbed screen instead of an always-visible aside');

  for (const id of [
    'start-new-game',
    'open-load-screen',
    'field-route-list',
    'academy-map-stage-layer',
    'academy-map-location-dialog',
    'academy-map-location-image',
    'academy-map-go-button',
    'academy-map-close-button',
    'academy-map-hover-stage',
    'academy-map-hover-description',
    'academy-companion-screen',
    'academy-companion-stage-name',
    'academy-companion-stage-description',
    'academy-companion-list',
    'academy-companion-back-to-map',
    'academy-companion-stage-detail-dialog',
    'academy-companion-stage-detail-title',
    'academy-companion-stage-detail-text',
    'academy-companion-stage-detail-image',
    'academy-companion-character-detail-dialog',
    'academy-companion-character-detail-standee',
    'academy-companion-character-parameters',
    'start-academy-companion-character',
    'academy-conversation-session-screen',
    'academy-conversation-session-location-name-button',
    'academy-conversation-session-location-detail-dialog',
    'academy-conversation-session-character-name-button',
    'academy-conversation-session-character-detail-dialog',
    'academy-conversation-session-character-standee',
    'academy-conversation-session-character-detail-standee',
    'academy-conversation-session-character-parameters',
    'academy-conversation-session-message-stream',
    'academy-conversation-session-player-input',
    'academy-conversation-session-run-conversation',
    'academy-conversation-session-end-conversation',
    'academy-room-title',
    'academy-room-money',
    'academy-room-player-parameters',
    'academy-room-buddy-card',
    'academy-room-enemy-count',
    'academy-room-enemy-list',
    'academy-room-item-count',
    'academy-room-inventory-items',
    'academy-room-start-training',
    'academy-room-open-load',
    'field-left-column',
    'field-location-detail-dialog',
    'field-current-location-button',
    'player-name',
    'world-description',
    'player-parameters-editor',
    'magic-parameter-presets',
    'ability-parameter-presets',
    'save-world-description',
    'character-selection-list',
    'character-prompt-description',
    'character-speaking-basis',
    'interaction-character-parameters',
    'start-selected-character',
    'training-options',
    'training-player-parameters',
    'training-result',
    'message-stream',
    'player-input',
    'run-conversation',
    'end-conversation',
    'save-slot-id',
    'create-save',
    'save-slots',
    'load-save'
  ]) {
    assert.match(html, new RegExp(`id="${id}"`), `missing #${id}`);
  }
});



test('academy room hub replaces the old status hero, merges money into inventory, and routes load/training through the accepted controls', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const js = await readFile(path.join(root, 'app.js'), 'utf8');
  const css = await readFile(`${root}/style.css`, 'utf8');

  const roomBlock = html.match(/<section id="academy-room-screen"[\s\S]*?<section id="training-screen"/)?.[0] ?? '';
  assert.match(roomBlock, /<p class="eyebrow">My Room<\/p>[\s\S]*<h2 id="academy-room-title">自室<\/h2>[\s\S]*一週間の終わりに主人公の能力、現在のバディー、所持金と所持品を確認できます。/, 'room hero should replace STATUS/ステータス with the requested 自室 copy');
  assert.match(roomBlock, /class="academy-map-status-card academy-room-action-card"[\s\S]*class="academy-room-action-header-row"[\s\S]*class="academy-room-action-copy"[\s\S]*Actions[\s\S]*次の行動を選びます[\s\S]*class="academy-room-week-row"[\s\S]*Current Week[\s\S]*id="academy-room-week"[\s\S]*第1週[\s\S]*id="academy-room-start-training"[\s\S]*次の一週間に進む[\s\S]*id="academy-room-skip-training"[\s\S]*鍛錬をサボる[\s\S]*id="academy-room-open-load"[\s\S]*ロード/, 'former money-card area should become the three-button room action card with left-aligned actions copy and right-aligned current-week summary above the buttons');
  assert.doesNotMatch(roomBlock, /status-money-card|<span>Money<\/span>/, 'room hero should remove the old standalone money card');
  assert.doesNotMatch(roomBlock, /id="academy-room-inventory-title"|<p class="eyebrow">Inventory<\/p>/, 'inventory column should no longer keep the outer Inventory / 所持品 heading');
  assert.match(roomBlock, /academy-room-inventory-stack[\s\S]*academy-room-money-section[\s\S]*<p class="eyebrow">Money<\/p>[\s\S]*<h4>所持金<\/h4>[\s\S]*id="academy-room-money"[\s\S]*academy-room-items-section[\s\S]*<p class="eyebrow">Items<\/p>[\s\S]*<h4>所持品<\/h4>[\s\S]*id="academy-room-item-count"[\s\S]*id="academy-room-inventory-items"/, 'inventory column should read directly as Money / Items subsections');
  assert.doesNotMatch(roomBlock, /現在の所持金/, 'money block should not keep the extra helper label above the amount');

  assert.match(js, /const screens = \{[\s\S]*'academy-room': document\.querySelector\('#academy-room-screen'\)/, 'browser screen registry should add the academy-room screen');
  assert.match(js, /if \(name === 'academy-room'\) renderAcademyRoomScreen\(\);/, 'showScreen should render the room screen when it becomes active');
  assert.match(js, /let slotLoadCanResumePlay = false;/, 'front-end should track whether the current load-screen entry can resume play');
  assert.match(js, /async function openLoadScreen\(\{ canResumePlay = false \} = \{\}\) \{[\s\S]*if \(conversationFinalizationInFlight\) \{[\s\S]*showProcessingToast\(\);[\s\S]*return;[\s\S]*\}[\s\S]*slotLoadCanResumePlay = canResumePlay;[\s\S]*await refreshSaveSlots\(\);[\s\S]*showScreen\('slot-load'\);/, 'load screen entry should explicitly store whether play resume is allowed while preserving finalization blocking');
  assert.match(js, /function canResumeFromSlotLoad\(\) \{[\s\S]*return slotLoadCanResumePlay && Boolean\(currentActiveSlotId\);[\s\S]*\}/, 'resume button enablement should require both an entry context and an active slot');
  assert.match(js, /async function loadSpecificSlot\(slotId\) \{[\s\S]*if \(conversationFinalizationInFlight\) \{[\s\S]*showProcessingToast\(\);[\s\S]*return;[\s\S]*\}[\s\S]*showScreen\('academy-room'\);/, 'actual slot loading should also refuse to race finalization and land on academy-room after success');
  assert.match(js, /async function endConversation[\s\S]*current_screen: 'academy-room'[\s\S]*let transition = endingConversation[\s\S]*next_screen: 'academy-room'[\s\S]*const loadingReadiness = endingConversation \? finalization : Promise\.resolve\(\)[\s\S]*showAcademyLoadingScreenUntilReady\(\{[\s\S]*readiness: loadingReadiness[\s\S]*nextScreen: transition\.next_screen[\s\S]*copyKey: transition\.loading_copy_key/, 'conversation end should open academy-room after the fixed loading delay while keeping graduation completion on the finalization-awaited title transition');
  assert.match(js, /async function openAcademyRoomTraining\(\)[\s\S]*showAcademyLoadingScreenUntilReady\(\{[\s\S]*nextScreen: 'academy-training'[\s\S]*\}\)/, 'room training action should reuse the academy loading flow before academy-training');
  assert.match(js, /async function openAcademyRoomSkipTraining\(\)[\s\S]*postJson\('\/api\/academy\/week\/start', \{\}\)[\s\S]*postJson\('\/api\/training\/skip', \{\}\)[\s\S]*routeAfterCompletedAcademyTraining\(\)/, 'room skip action should start the academy week, skip training without parameter gains, and then reuse the completed-training route');
  assert.match(js, /#academy-room-start-training[\s\S]*openAcademyRoomTraining\(\)\.catch\(reportError\)/, 'room training button should be wired through the loading-mediated room training helper');
  assert.match(js, /#academy-room-skip-training[\s\S]*openAcademyRoomSkipTraining\(\)\.catch\(reportError\)/, 'room skip button should be wired through the dedicated room skip helper');
  assert.match(js, /#academy-room-open-load[\s\S]*openLoadScreen\(\{ canResumePlay: true \}\)/, 'room load button should open the load screen with play-resume enabled');
  assert.match(js, /if \(tab\.dataset\.screen === 'slot-load'\) \{[\s\S]*openLoadScreen\(\{ canResumePlay: document\.body\.classList\.contains\('play-mode'\) \}\)/, 'topbar load route should pass an explicit play-mode resume context');

  assert.match(css, /body:has\(#academy-room-screen\.active\) \.layout \{[\s\S]*height: calc\(100dvh - var\(--runtime-topbar-height, 88px\)\)[\s\S]*overflow: hidden/, 'room layout should follow viewport height like the academy training screen family');
  assert.match(css, /#academy-room-screen\.active[\s\S]*display: grid[\s\S]*height: 100%[\s\S]*min-height: 0/, 'active room screen should fill the viewport-bound layout');
  assert.match(css, /\.academy-room-shell[\s\S]*grid-template-rows: auto minmax\(0, 1fr\)[\s\S]*height: 100%/, 'room shell should dedicate remaining height to the lower content area');
  assert.match(css, /\.academy-room-grid[\s\S]*grid-template-columns: minmax\(280px, 0\.9fr\) minmax\(320px, 1fr\) minmax\(360px, 1\.08fr\)[\s\S]*minmax\(0, 1fr\)/, 'room lower grid should size columns while keeping the content area height-aware');
  assert.match(css, /\.academy-room-hero[\s\S]*grid-template-columns:[\s\S]*gap:[\s\S]*align-items:/, 'room hero should keep a dedicated balanced two-block header layout');
  assert.match(css, /\.academy-room-shell[\s\S]*border: 1px solid rgba\(211, 180, 105, 0\.34\)[\s\S]*linear-gradient\(180deg, rgba\(8, 12, 20, 0\.94\), rgba\(4, 7, 12, 0\.98\)\)/, 'room shell should align with the academy conversation-session dark palette while keeping the gold border language');
  assert.match(css, /\.academy-room-hero-copy > p:last-child\s*\{[\s\S]*max-width:\s*none[\s\S]*white-space:\s*nowrap/, 'room hero explanation should keep a wider single-line desktop presentation instead of wrapping early');
  assert.match(css, /\.academy-room-action-header-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto[\s\S]*align-items:\s*end/, 'room action header should reserve the left side for action copy and the right edge for the current-week summary');
  assert.match(css, /\.academy-room-week-row\s*\{[\s\S]*justify-items:\s*end[\s\S]*text-align:\s*right[\s\S]*gap:\s*6px/, 'current-week summary should right-align its label and week number with room for the two-line stack inside the action header');
  assert.match(css, /\.academy-room-action-card \.academy-room-action-copy > span\s*\{[\s\S]*font-size:\s*20px[\s\S]*font-weight:\s*600[\s\S]*letter-spacing:\s*0\.04em[\s\S]*line-height:\s*1\.1/, 'room action header should enlarge the Actions label relative to the helper copy');
});

test('title screen is a toolbarless full-screen play entry while normal startup keeps the debug toolbar on academy map', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const js = await readFile(path.join(root, 'app.js'), 'utf8');
  const css = await readFile(`${root}/style.css`, 'utf8');

  assert.match(html, /<body>\s*<header class="topbar">/, 'normal startup should keep the topbar available before JS runs');
  assert.match(html, /<section id="academy-map-screen" class="screen active"/, 'normal startup should begin on the toolbar-visible academy map');
  assert.match(html, /<section id="title-screen" class="screen title-hero-screen"/, 'title is a toolbarless route, not the initial screen');
  const titleBlock = html.match(/<section id="title-screen"[\s\S]*?<section id="world-screen"/)?.[0] ?? '';
  assert.match(titleBlock, /<h2 id="title-title">STARFALL MAGIC ACADEMY<\/h2>/, 'title screen should display the requested English title');
  assert.doesNotMatch(titleBlock, /Starfall Magic Academy|星灯魔法学院 ADV|title-screen-lead|panel-help|霧の塔|新規開始はプレイ用領域/, 'title screen should remove all explanatory copy outside the requested title and buttons');
  assert.match(html, /class="title-screen-shell"/, 'title copy should not reuse the old app-card panel');
  assert.doesNotMatch(html, /<div class="title-screen-shell app-card">/, 'title screen should not keep the old generic app-card styling');
  assert.match(html, /id="start-new-game"[^>]*class="academy-map-action-button title-action-button"/, 'new-game button should use the gold-outline academy action button language');
  assert.match(html, /id="open-load-screen"[^>]*class="academy-map-action-button title-action-button"/, 'title load button should use the same gold-outline academy action button language');

  assert.match(css, /body\.title-screen-active\s+\.topbar\s*{\s*display:\s*none;\s*}/, 'title screen should hide the debug/testing topbar');
  assert.match(css, /body\.play-mode\s+\.topbar\s*{\s*display:\s*none;\s*}/, 'started gameplay should also hide the debug/testing topbar');
  assert.match(css, /body\.title-screen-active\s+\.layout[\s\S]*min-height:\s*100dvh/, 'title screen layout should use the full viewport');
  assert.match(css, /#title-screen\.active[\s\S]*min-height:\s*100dvh/, 'active title screen should not subtract topbar height');
  assert.match(css, /\.title-hero-screen[\s\S]*url\('\/canonical\/title\/title\.png'\)/, 'title screen should use canonical/title/title.png');
  assert.match(css, /\.title-screen-shell\s*\{[\s\S]*width:\s*fit-content[\s\S]*margin:\s*clamp\(18px, 3\.4vw, 42px\) 0 0 clamp\(18px, 4\.8vw, 64px\)[\s\S]*padding:\s*clamp\(11px, 1\.75vw, 17px\)[\s\S]*backdrop-filter:\s*blur\(12px\)/, 'title copy frame should be only as wide as the title and buttons need while moving into the upper-left');
  assert.match(css, /\.title-screen-shell \.title-action-button\s*\{[\s\S]*border-color:\s*rgba\(211, 180, 105, 0\.74\)[\s\S]*color:\s*#fff8e6/, 'title actions should use the gold-outline button variant, not the blue secondary variant');

  assert.match(js, /document\.body\.classList\.toggle\('title-screen-active',\s*name === 'title'\)/, 'showScreen should keep the title-active body class in sync');
  assert.match(js, /document\.body\.classList\.add\('play-mode'\)[\s\S]*showScreen\('academy-map'/, 'starting a new game should enter play mode before routing into gameplay');
});

test('settings screen is a first-class academy-style route and title controls add 設定 while shrinking/moving the title shell to the upper-left', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const js = await readFile(path.join(root, 'app.js'), 'utf8');
  const css = await readFile(`${root}/style.css`, 'utf8');

  assert.match(html, /data-screen="academy-room"[\s\S]*>自室<[\s\S]*data-screen="slot-load"[^>]*>ロード<[\s\S]*data-screen="settings"[^>]*>設定</, 'topbar should expose 設定 after ロード as another right-side runtime route');
  assert.match(html, /<section id="title-screen"[\s\S]*class="title-action-layout"[\s\S]*class="title-primary-actions"[\s\S]*id="start-new-game"[\s\S]*最初から始める[\s\S]*id="open-load-screen"[\s\S]*ロード[\s\S]*class="title-settings-action"[\s\S]*id="open-settings-screen"[\s\S]*設定/, 'title screen should split primary actions from a dedicated right-side settings action within the title panel');
  assert.match(html, /<section id="settings-screen" class="screen" aria-labelledby="settings-title">[\s\S]*class="academy-map-shell settings-screen-shell"[\s\S]*<p class="eyebrow">Settings<\/p>[\s\S]*<h2 id="settings-title">設定<\/h2>[\s\S]*class="settings-screen-hero-actions"[\s\S]*id="settings-back-to-title"[^>]*class="academy-map-action-button secondary"[\s\S]*id="lmstudio-settings-form"[\s\S]*id="lmstudio-connection-mode-localhost"[\s\S]*id="lmstudio-connection-mode-lan"[\s\S]*id="lmstudio-host"[\s\S]*id="lmstudio-port"[\s\S]*id="fetch-lmstudio-models"[\s\S]*id="lmstudio-model"[\s\S]*id="save-lmstudio-settings"[^>]*class="academy-map-action-button"/, 'settings screen should be its own academy-style route with LM Studio connection fields, model selection, model fetch action, and a title return button in the settings-area upper-right hero actions');

  assert.match(js, /const screens = \{[\s\S]*settings: document\.querySelector\('#settings-screen'\)/, 'browser screen registry should add the settings screen');
  assert.match(js, /async function loadLmStudioSettings\(\)/, 'front-end should expose a dedicated LM Studio settings loader');
  assert.match(js, /async function fetchLmStudioModels\(\)/, 'front-end should expose a dedicated LM Studio model discovery action');
  assert.match(js, /async function saveLmStudioSettings\(\)/, 'front-end should expose a dedicated LM Studio settings saver');
  assert.match(js, /getJson\('\/api\/settings\/lmstudio'\)/, 'settings screen should fetch the current LM Studio settings from the server');
  assert.match(js, /fetch\('\/api\/settings\/lmstudio\/models', \{[\s\S]*method: 'POST'/, 'settings screen should request model options through the runtime server instead of calling LM Studio directly from the browser');
  assert.match(js, /fetch\('\/api\/settings\/lmstudio', \{[\s\S]*method: 'PATCH'/, 'settings screen save action should PATCH LM Studio settings');
  assert.match(js, /body: JSON\.stringify\(\{[\s\S]*connection_mode: connectionMode,[\s\S]*host: host\?\.value,[\s\S]*port: Number\(port\?\.value \|\| 1234\),[\s\S]*model: model\?\.value/, 'settings save action should include the selected model alongside the connection fields');
  assert.match(js, /document\.body\.classList\.toggle\('settings-screen-active',\s*name === 'settings'\)/, 'showScreen should keep a dedicated settings-active body class in sync so the topbar can hide on the settings route');
  assert.match(js, /#open-load-screen[\s\S]*openLoadScreen\(\{ canResumePlay: false \}\)/, 'title load button should open the load screen with play-resume disabled');
  assert.match(js, /#open-settings-screen[\s\S]*showScreen\('settings'\)/, 'title settings button should route into the shared settings screen');
  assert.match(js, /#settings-back-to-title[\s\S]*showScreen\('title'\)/, 'settings heading should provide a direct return-to-title button');
  assert.match(js, /if \(tab\.dataset\.screen === 'settings'\) \{[\s\S]*showScreen\('settings'\)[\s\S]*loadLmStudioSettings\(\)\.catch\(reportError\)/, 'topbar settings route should load current LM Studio settings when opened');
  assert.match(js, /#fetch-lmstudio-models[\s\S]*fetchLmStudioModels\(\)\.catch\(reportError\)/, 'settings screen should wire the fetch-models button to the shared model discovery action');

  assert.match(css, /#title-screen\.active\s*\{[\s\S]*place-items:\s*start start;/, 'active title screen should really anchor the panel to the upper-left in the winning rule');
  assert.match(css, /\.title-screen-shell\s*\{[\s\S]*margin:\s*clamp\(18px, 3\.4vw, 42px\) 0 0 clamp\(18px, 4\.8vw, 64px\)[\s\S]*padding:\s*clamp\(11px, 1\.75vw, 17px\)[\s\S]*border-radius:\s*18px/, 'title shell should keep the existing upper-left shell dimensions instead of transform scaling');
  assert.match(css, /\.title-screen-shell h2\s*\{[\s\S]*font-size:\s*clamp\(21px, 3\.05vw, 42px\)/, 'title heading should keep the current retuned real font size');
  assert.match(css, /\.title-action-layout\s*\{[\s\S]*display:\s*flex[\s\S]*align-items:\s*center[\s\S]*gap:\s*10px[\s\S]*margin:\s*14px 0 0/, 'title action layout should provide a shared row for left actions and the right-side settings action');
  assert.match(css, /\.title-primary-actions\s*\{[\s\S]*display:\s*flex[\s\S]*gap:\s*10px[\s\S]*flex-wrap:\s*wrap/, 'title primary actions should keep the left-side button group compact');
  assert.match(css, /\.title-settings-action\s*\{[\s\S]*margin-left:\s*auto[\s\S]*display:\s*flex[\s\S]*justify-content:\s*flex-end/, 'title settings action wrapper should push the settings button to the right edge of the panel');
  assert.match(css, /\.title-screen-shell \.title-action-button\s*\{[\s\S]*min-width:\s*124px[\s\S]*font-size:\s*14px/, 'title action buttons should preserve the current direct-dimension sizing');
  const titleShellCss = css.match(/\.title-screen-shell\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.doesNotMatch(titleShellCss, /transform:\s*scale\(/, 'title-shell shrink should not be implemented via transform scaling');
  assert.match(css, /body\.settings-screen-active\s+\.topbar\s*{\s*display:\s*none;\s*}/, 'settings screen should hide the topbar the same way the title and slot-load routes do');
  assert.match(css, /body\.settings-screen-active\s*\{\s*overflow:\s*hidden;\s*}/, 'settings screen should lock body overflow so only the settings content card scrolls');
  assert.match(css, /body:has\(#settings-screen\.active\) \.layout\s*\{[\s\S]*height:\s*100dvh[\s\S]*min-height:\s*0[\s\S]*overflow:\s*hidden/, 'settings route hides the topbar, so its layout should fill the viewport and delegate overflow to the settings card');
  assert.match(css, /#settings-screen\.active\s*\{[\s\S]*display:\s*grid[\s\S]*height:\s*100%[\s\S]*min-height:\s*0[\s\S]*overflow:\s*hidden/, 'active settings screen should stay inside the bounded layout instead of scrolling the page');
  assert.match(css, /\.settings-screen-shell\s*\{[\s\S]*height:\s*100%[\s\S]*min-height:\s*0[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\)/, 'settings screen shell should keep the hero fixed and give the remaining height to the card row');
  assert.match(css, /\.settings-card\s*\{[\s\S]*border:\s*1px solid rgba\(211, 180, 105, 0\.34\)[\s\S]*linear-gradient\(180deg, rgba\(8, 12, 20, 0\.94\), rgba\(4, 7, 12, 0\.98\)[\s\S]*min-height:\s*0[\s\S]*overflow-y:\s*auto[\s\S]*overflow-x:\s*hidden[\s\S]*scrollbar-gutter:\s*stable/, 'settings card should preserve the dark-gold card palette while becoming the vertical scroll container for overflowing settings content');
  assert.match(css, /\.settings-inline-status,[\s\S]*\.settings-base-url,[\s\S]*\.settings-model-status\s*\{[\s\S]*overflow-wrap:\s*anywhere/, 'settings status, derived URL, and model status text should wrap instead of forcing or hiding horizontal overflow');
  assert.match(css, /@media \(max-width:\s*760px\) \{[\s\S]*\.settings-field-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/, 'settings host and port fields should collapse to one column on narrow screens');
  assert.match(css, /\.academy-map-hero\.settings-screen-hero\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto[\s\S]*align-items:\s*start/, 'settings hero should reserve a dedicated right-edge column so the title return button can sit in the top-right corner of the settings area without being overridden by the shared academy-map hero rule');
  assert.match(css, /\.settings-screen-hero-actions\s*\{[\s\S]*justify-items:\s*end[\s\S]*align-self:\s*start/, 'settings hero actions should place the title return button at the upper-right of the whole settings area');
});

test('conversation LM Studio runtime errors redirect only from loading context and stay visible in the conversation session', async () => {
  const html = await readFile(path.join(projectRoot, 'app/public/index.html'), 'utf8');
  const js = await readFile(path.join(projectRoot, 'app/public/app.js'), 'utf8');

  assert.match(html, /id="academy-conversation-session-status"[^>]*aria-live="polite"[^>]*hidden/, 'conversation session should expose a visible live status target for in-session LM Studio errors');
  assert.match(js, /const LM_STUDIO_RUNTIME_ERROR_CODES = new Set\(\[[\s\S]*LMSTUDIO_CONFIG_REQUIRED[\s\S]*LMSTUDIO_CONNECTION_UNAVAILABLE[\s\S]*\]\)/, 'front-end should recognize both config-required and connection-unavailable LM Studio runtime codes');
  assert.match(js, /function handleRuntimeApiError\(error, \{ allowSettingsRedirect = false \} = \{\}\)/, 'runtime error handling should make settings redirection an explicit opt-in');
  assert.match(js, /function reportLoadingError\(error\)[\s\S]*handleRuntimeApiError\(error, \{ allowSettingsRedirect: true \}\)/, 'loading contexts should opt in to the settings redirect for LM Studio runtime errors');
  assert.match(js, /async function showAcademyLoadingScreenUntilReady\([\s\S]*catch \(error\)[\s\S]*reportLoadingError\(error\)[\s\S]*throw error/, 'loading helper should break out of academy-loading by reporting LM Studio runtime errors before rethrowing');
  const pendingEventStarter = js.match(/async function startAcademyConversationSessionFromPendingEvent\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(pendingEventStarter, /if \(loadingAlreadyVisible\) \{[\s\S]*catch \(error\)[\s\S]*reportLoadingError\(error\)[\s\S]*throw error/, 'pending-event routes that reuse an already-visible loading screen should still opt in to the settings redirect on LM Studio runtime errors');
  const reportConversationError = js.match(/function reportConversationError\(error\) \{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.match(reportConversationError, /setConversationStatus\([\s\S]*tone: 'error'/, 'normal conversation errors should be displayed on the conversation screen');
  assert.doesNotMatch(reportConversationError, /showScreen\('settings'\)/, 'normal conversation errors must not navigate away to settings');
  assert.match(js, /async function runConversation\(\)[\s\S]*catch \(error\)[\s\S]*reportConversationError\(error\)[\s\S]*finally/, 'player-message generation should handle failures in-session before controls are re-enabled');
});

test('character authoring UI becomes read-only when runtime capabilities disable desktop editing', async () => {
  const html = await readFile(path.join(projectRoot, 'app/public/index.html'), 'utf8');
  const js = await readFile(path.join(projectRoot, 'app/public/app.js'), 'utf8');

  assert.match(html, /id="selected-character-source"/, 'character selection header should expose a source/status line for runtime capability messages');
  assert.match(js, /let characterAuthoringCapability = \{\s*enabled: true,\s*reason: null,\s*message: null\s*\};/, 'front-end should track character authoring capability from the runtime');
  assert.match(js, /function characterAuthoringEnabled\(\) \{[\s\S]*characterAuthoringCapability\?\.enabled !== false;[\s\S]*\}/, 'front-end should centralize the authoring-enabled check');
  assert.match(js, /characterAuthoringCapability = result\.capabilities\?\.character_authoring/, 'character refresh should ingest server capability metadata');
  assert.match(js, /selectedCharacterSource\.textContent = authoringEnabled \? '' : characterAuthoringMessage\(\);/, 'field companion panel should explain why editing is disabled on desktop');
  assert.match(js, /description\.readOnly = !authoringEnabled;[\s\S]*speakingBasis\.readOnly = !authoringEnabled;[\s\S]*saveButton\.disabled = !authoringEnabled;/, 'desktop-disabled authoring should set both textareas readOnly and disable save');
  assert.match(js, /async function saveSelectedCharacterDescription\(\) \{[\s\S]*if \(!characterAuthoringEnabled\(\)\) return;/, 'save handler should no-op before issuing a desktop-disallowed write request');
  assert.match(js, /デスクトップ版ではキャラクター説明の編集は無効です。ブラウザ実行で編集してください。/, 'desktop-disabled authoring should surface the explicit browser-only guidance');
});

test('academy conversation-session portraits use a scoped 1.25x center crop and gold frame contract on the root CSS surface', async () => {
  const css = await readFile(path.join(projectRoot, 'app/public/style.css'), 'utf8');

  assert.match(css, /#academy-conversation-session-message-stream \.message-face\s*\{[\s\S]*border-radius:\s*20px;[\s\S]*border:\s*1px solid rgba\(211, 180, 105, 0\.42\);[\s\S]*box-shadow:\s*0 0 24px rgba\(211, 180, 105, 0\.16\);/, 'root CSS should give academy conversation-session portraits the gold frame contract');
  assert.match(css, /#academy-conversation-session-message-stream \.message-face img\s*\{[\s\S]*object-fit:\s*cover;[\s\S]*transform:\s*scale\(1\.25\);[\s\S]*transform-origin:\s*center center;/, 'root CSS should apply a scoped 1.25x center crop to academy conversation-session portraits');
});

test('academy conversation-session standee frame matches the stage-image frame language and fills the frame with the image', async () => {
  const css = await readFile(path.join(projectRoot, 'app/public/style.css'), 'utf8');
  const block = cssRuleBlock(css, '#academy-conversation-session-character-standee');

  assert.match(block, /(?:^|\n)\s*width:\s*100%;/, 'standee frame should span the left-panel frame width');
  assert.match(block, /(?:^|\n)\s*height:\s*clamp\(160px, calc\(100dvh - var\(--runtime-topbar-height, 0px\) - 340px\), 340px\);/, 'standee frame should keep the established responsive height as an actual frame height');
  assert.match(block, /border-radius:\s*18px;/, 'standee should keep the same corner radius as the stage image');
  assert.match(block, /border:\s*1px solid rgba\(211, 180, 105, 0\.28\);/, 'standee should use the same gold border opacity as the stage image');
  assert.match(block, /background-color:\s*rgba\(7, 11, 20, 0\.58\);/, 'standee should use the same dark card surface as the stage image');
  assert.match(block, /box-shadow:\s*inset 0 -42px 72px rgba\(0, 0, 0, 0\.30\);/, 'standee should use the stage-image inner shadow language');
  assert.match(block, /object-fit:\s*cover;/, 'standee image content should fill the frame instead of sitting inside it');
  assert.match(block, /object-position:\s*50% bottom;/, 'standee image content should remain bottom aligned');
  assert.doesNotMatch(block, /padding:\s*8px;|object-fit:\s*contain;|radial-gradient\(circle at 50% 18%|inset 0 1px 22px|drop-shadow\(/, 'standee frame should not keep inner padding, contain sizing, or the old blue halo / white inner glow / outer drop-shadow frame language');
});

test('new game intro uses scoped loading copy and avoids showing academy map before the mentor intro route', async () => {
  const js = await readFile(path.join(root, 'app.js'), 'utf8');
  const html = await readFile(path.join(root, 'index.html'), 'utf8');

  assert.match(html, /id="academy-loading-title">学院マップへ移動中<\//, 'loading screen baseline should still exist in HTML before JS rewrites the copy at runtime');
  assert.match(js, /title:\s*'イントロダクションに進みます'/, 'new-game intro loading title should use the requested wording');
  assert.match(js, /status:\s*'メンター役の生徒があなたをお出迎えしてくれるようです'/, 'new-game intro loading status should use the requested wording');
  assert.match(js, /title:\s*'卒業のときを迎えました'/, 'graduation ending start loading title should use the requested wording');
  assert.match(js, /status:\s*'エンディングセッションに遷移します。'/, 'graduation ending start loading status should use the requested wording');
  assert.match(js, /title:\s*'卒業しました。'/, 'graduation ending completion loading title should use the requested wording');
  assert.match(js, /status:\s*'スタート画面に遷移します。'/, 'graduation ending completion loading status should use the requested wording');
  assert.match(js, /'academy-conversation-session':\s*\{[\s\S]*title:\s*'会話セッションへ移動中'[\s\S]*status:\s*'会話の準備を待っています。'/, 'normal academy conversation-session copy should remain intact for non-intro routes');
  assert.match(js, /async function startNewGame\(\)[\s\S]*await refresh\(\)[\s\S]*await refreshSaveSlots\(\)[\s\S]*document\.body\.classList\.add\('play-mode'\)[\s\S]*if \(await routeNewGameIntroFromTitle\(\)\) return;[\s\S]*showScreen\('academy-map', \{ rerollAcademyMap: true \}\)[\s\S]*await routePendingEventFromAcademyMap\(\)/, 'new game should try the dedicated intro orchestrator before falling back to academy map');
  assert.match(js, /async function routeNewGameIntroFromTitle\(\)[\s\S]*refreshEventFlagStatus\(\)[\s\S]*event\.opening_mentor_intro\.ready[\s\S]*showAcademyLoadingScreenUntilReady\(\{[\s\S]*(copyKey:\s*'new-game-intro'|loadingCopy:\s*\{[\s\S]*イントロダクションに進みます)[\s\S]*nextScreen:\s*'academy-conversation-session'/, 'new-game intro route should hold academy-loading with intro-specific copy before entering academy conversation session');
  assert.match(js, /async function routeNewGameIntroFromTitle\(\)[\s\S]*if \(!introFlag\) return false;[\s\S]*showAcademyLoadingScreenUntilReady\([\s\S]*\)[\s\S]*return true;/, 'academy map should only remain as the fallback when the intro event is unavailable');
});

test('academy room training enters graduation loading immediately and waits there only on the 50th graduation week', async () => {
  const js = await readFile(path.join(root, 'app.js'), 'utf8');

  assert.match(js, /const GRADUATION_ENDING_WEEK = 50;/, 'browser graduation week threshold should be fixed at 50 weeks');
  assert.match(js, /function isEnteringGraduationEndingWeek\(\)[\s\S]*elapsed_weeks \?\? 0\) \+ 1 >= GRADUATION_ENDING_WEEK[\s\S]*ending_completed !== true/, 'browser should detect the graduation week from runtime elapsed weeks before starting the next academy week');
  assert.match(js, /function waitForConversationFinalization\(\)[\s\S]*activeConversationFinalizationPromise \?\? Promise\.resolve\(\)/, 'browser should expose the live conversation finalization promise for graduation-week waits');
  assert.match(js, /async function openAcademyRoomTraining\(\)[\s\S]*if \(isEnteringGraduationEndingWeek\(\)\) \{[\s\S]*const readiness = \(async \(\) => \{[\s\S]*await waitForConversationFinalization\(\);[\s\S]*const started = await postJson\('\/api\/academy\/week\/start', \{\}\);[\s\S]*\}\)\(\);[\s\S]*await showAcademyLoadingScreenUntilReady\(\{[\s\S]*readiness,[\s\S]*copyKey:\s*'graduation-ending-start'[\s\S]*\}\);[\s\S]*return;[\s\S]*\}/, 'graduation-week training should show the graduation loading screen immediately, then wait for finalization and week start inside that readiness flow');
  assert.match(js, /const readiness = \(async \(\) => \{[\s\S]*\}\)\(\);[\s\S]*await showAcademyLoadingScreenUntilReady\(\{[\s\S]*readiness,/, 'graduation-week branch should start the readiness task before awaiting the loading screen helper');
});

test('world parameter presets and field character detail action stay inside requested UI surfaces', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const worldBlock = html.match(/<section id="world-screen"[\s\S]*?<section id="field-screen"/)?.[0] ?? '';
  assert.match(worldBlock, /id="magic-parameter-presets"[\s\S]*data-parameter-preset-group="magic" data-parameter-preset-value="0"[\s\S]*data-parameter-preset-group="magic" data-parameter-preset-value="25"[\s\S]*data-parameter-preset-group="magic" data-parameter-preset-value="50"[\s\S]*data-parameter-preset-group="magic" data-parameter-preset-value="75"[\s\S]*data-parameter-preset-group="magic" data-parameter-preset-value="100"/, 'world screen should provide five magic proficiency preset buttons');
  assert.match(worldBlock, /id="ability-parameter-presets"[\s\S]*data-parameter-preset-group="abilities" data-parameter-preset-value="0"[\s\S]*data-parameter-preset-group="abilities" data-parameter-preset-value="25"[\s\S]*data-parameter-preset-group="abilities" data-parameter-preset-value="50"[\s\S]*data-parameter-preset-group="abilities" data-parameter-preset-value="75"[\s\S]*data-parameter-preset-group="abilities" data-parameter-preset-value="100"/, 'world screen should provide five basic-parameter preset buttons');
  const fieldCharacterDialog = html.match(/<dialog id="field-character-detail-dialog"[\s\S]*?<\/dialog>/)?.[0] ?? '';
  assert.match(fieldCharacterDialog, /id="start-field-character-from-detail"[\s\S]*>このキャラと会話する<[\s\S]*aria-label="キャラ詳細を閉じる"/, 'field character detail popup should put conversation start button to the left of close');
});

test('academy companion character detail clears stale standee before revealing the selected character image', async () => {
  const js = await readFile(path.join(projectRoot, 'app/public/app.js'), 'utf8');

  assert.match(js, /function openAcademyCompanionCharacterDetail\(character\) \{[\s\S]*academyCompanionDetailCharacterId = character\.character_id;[\s\S]*activeCharacterId = character\.character_id;/, 'companion detail should update both detail and active character ids for the selected character');
  assert.match(js, /const standeeUrl = characterSceneStandeeUrl\(character\);[\s\S]*standee\.hidden = true;[\s\S]*standee\.removeAttribute\('src'\);[\s\S]*standee\.dataset\.characterId = character\.character_id;[\s\S]*standee\.alt = `\$\{character\.display_name \?\? character\.character_id\}の一枚絵`;/, 'companion detail should hide and clear the previous standee before opening the dialog');
  assert.match(js, /openInteractionDetailDialog\('#academy-companion-character-detail-dialog'\);[\s\S]*if \(!standeeUrl\) return;[\s\S]*const preload = new Image\(\);/, 'companion detail should open without showing a stale image and preload the selected standee');
  assert.match(js, /preload\.addEventListener\('load', \(\) => \{[\s\S]*if \(academyCompanionDetailCharacterId !== character\.character_id\) return;[\s\S]*if \(standee\.dataset\.characterId !== character\.character_id\) return;[\s\S]*standee\.src = standeeUrl;[\s\S]*standee\.hidden = false;/, 'companion detail should reveal the preloaded standee only if it still belongs to the current detail character');
  assert.match(js, /preload\.addEventListener\('error', \(\) => \{[\s\S]*if \(standee\.dataset\.characterId !== character\.character_id\) return;[\s\S]*standee\.hidden = true;[\s\S]*standee\.removeAttribute\('src'\);/, 'companion detail should keep the standee hidden on load failure instead of restoring a stale image');
});

test('character detail and standee surfaces never fall back to generated face icons', async () => {
  const js = await readFile(path.join(root, 'app.js'), 'utf8');

  const sourceSheetImageUrl = js.match(/function sourceSheetImageUrl\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.doesNotMatch(sourceSheetImageUrl, /view === 'face' \|\| view === 'standee'[\s\S]*character_faces_400/, 'standee view must not share the face-icon URL branch');
  assert.match(sourceSheetImageUrl, /view === 'standee'[\s\S]*characterSceneStandeeUrl/, 'standee view should resolve to the scene/standee artwork path');

  const fallback = js.match(/function fallbackSceneStandeeToFace\([\s\S]*?\n\}/)?.[0] ?? '';
  assert.equal(fallback, '', 'detail/standee images should not have an error fallback that swaps the one-image artwork to a face icon');
  assert.doesNotMatch(js, /addEventListener\('error', fallbackSceneStandeeToFace\)/, 'detail/standee image error handling must not convert one-image surfaces into face icons');
});

test('academy map uses a rich clickable map and routes selected stages into character selection', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const js = await readFile(path.join(root, 'app.js'), 'utf8');
  const css = await readFile(`${root}/style.css`, 'utf8');

  const mapBlock = html.match(/<section id="academy-map-screen"[\s\S]*?<section id="field-screen"/)?.[0] ?? '';
  assert.match(mapBlock, /class="academy-map-shell"/, 'academy map should have a dedicated rich visual shell');
  assert.match(mapBlock, /id="academy-map-stage-layer"[\s\S]*aria-label="学院マップ上の舞台"/, 'academy map should render clickable stage points on the map layer');
  const mapDialog = html.match(/<dialog id="academy-map-location-dialog"[\s\S]*?<\/dialog>/)?.[0] ?? '';
  assert.match(mapDialog, /id="academy-map-location-image"[\s\S]*id="academy-map-go-button"[\s\S]*ここに行く[\s\S]*id="academy-map-close-button"[\s\S]*閉じる/, 'academy map dialog should show stage image, go button, and close button');
  assert.match(mapDialog, /academy-map-action-button[\s\S]*academy-map-action-button/, 'academy map dialog buttons should reuse the map hotspot visual language');
  assert.equal(mapBlock.includes('id="academy-map-location-dialog"'), false, 'stage detail dialog must not live inside #academy-map-screen because it must remain visible after the companion screen hides the map screen');
  const mapHero = mapBlock.match(/<div class="academy-map-hero">[\s\S]*?<div class="academy-map-canvas"/)?.[0] ?? '';
  const mapCanvas = mapBlock.match(/<div class="academy-map-canvas"[\s\S]*?<\/div>\s*<\/div>\s*<\/section>/)?.[0] ?? '';
  const shopBlock = html.match(/<section id="shop-screen"[\s\S]*?<section id="debug-screen"/)?.[0] ?? '';
  assert.doesNotMatch(mapBlock, /各舞台にはキャラクターがランダムに配置されていますが、キャラクターの配置は表示されません。/, 'academy map should remove the old left-side random-placement helper sentence');
  assert.doesNotMatch(mapHero, /academy-map-status-card|TURN STAGE/, 'academy map should not reserve a right-side information card in the hero');
  assert.match(mapCanvas, /id="academy-map-hover-tooltip"[\s\S]*id="academy-map-hover-stage"[\s\S]*id="academy-map-hover-description"/, 'hovered-stage description should live as a tooltip on the map canvas near the hovered point');
  assert.match(shopBlock, /id="shop-title">購買<\/[\s\S]*id="shop-back-to-map"[^>]*>学院マップに戻る</, 'shop screen should include a dedicated return-to-academy-map button');

  assert.match(html, /<section id="academy-companion-screen"[\s\S]*id="academy-companion-list"[\s\S]*id="academy-companion-back-to-map"[\s\S]*id="academy-companion-character-detail-dialog"/, 'academy companion screen should exist as a map-styled conversation partner selector with a character detail dialog');
  assert.match(html, /<h2 id="academy-companion-title">会話相手の選択<\/h2>[\s\S]*下のキャラクター一覧から会話相手を選択してください/, 'academy companion title and help text should use the play-facing requested wording');
  assert.match(html, /CONFIRMED STAGE[\s\S]*<button id="academy-companion-stage-name"[\s\S]*id="academy-companion-stage-summary"/, 'confirmed stage name should be a clickable detail affordance with the stage description underneath');
  const companionDialog = html.match(/<dialog id="academy-companion-character-detail-dialog"[\s\S]*?<\/dialog>/)?.[0] ?? '';
  assert.match(companionDialog, /class="character-detail-layout academy-companion-character-detail-layout"[\s\S]*id="academy-companion-character-detail-standee"[\s\S]*id="academy-companion-character-parameters"/, 'academy companion character detail should place the scene standee on the left and parameters on the right with a dedicated separated layout');
  assert.doesNotMatch(companionDialog, /character-prompt-description|character-speaking-basis|character-memory-records|character-skill-records|character-work-records|prompt_description|speaking_basis/, 'academy companion character detail should not include extra edit or record surfaces');

  assert.match(js, /const academyMapStagePinCoordinates = \{[\s\S]*学院マップのピン座標はここを編集します[\s\S]*courtyard_fountain: \{ x: 49\.9, y: 45\.8 \}[\s\S]*alchemy_lab: \{ x: 65\.8, y: 43\.4 \}[\s\S]*underground_waterway: \{ x: 93\.2, y: 60 \}[\s\S]*academy_shop: \{ x: 35\.9, y: 30\.7 \}[\s\S]*main_hall_runaway_golem: \{ x: 58, y: 92 \}/, 'academy map stage pins should hard-code the user-tuned percentage coordinates from the calibration pass plus the fixed shop pin');
  assert.match(js, /const ACADEMY_MAP_PIN_DRAG_EDITING_ENABLED = false/, 'temporary academy map pin drag editing should be stopped after fixed coordinates are integrated');
  assert.match(js, /const ACADEMY_MAP_EVENT_LOCATION_IDS = new Set\(\[[\s\S]*'sealed_ritual_room'[\s\S]*'festival_plaza_night'[\s\S]*'mirror_hall'[\s\S]*'snowy_inner_garden'[\s\S]*'rainy_cloister'[\s\S]*\]\)/, 'event maps should be declared in one set so pins and random character placement can exclude the same stages');
  assert.doesNotMatch(js, /magic-academy:academy-map-pin-coordinates|academyMapStoredPinCoordinates|rememberAcademyMapPinCoordinate|exportAcademyMapPinCoordinates/, 'fixed academy-map coordinates should not keep the temporary pin-calibration storage/export path after integration');
  assert.match(js, /const ACADEMY_MAP_SHOP_NODE_ID = 'academy_shop'/, 'academy map should declare a stable special-node id for shop access');
  assert.match(js, /function academyMapShopNode\(\)[\s\S]*id: ACADEMY_MAP_SHOP_NODE_ID[\s\S]*display_name: '購買'[\s\S]*description: '各種霊薬を取り揃えている学院購買部。必要な道具や品物を売買できる。'[\s\S]*visible_situation: '各種霊薬を取り揃えている学院購買部。必要な道具や品物を売買できる。'/, 'shop access should be modeled as a dedicated academy-map special node instead of a normal field location');
  assert.match(js, /function isAcademyMapShopNode\(nodeOrId\)[\s\S]*nodeId === ACADEMY_MAP_SHOP_NODE_ID/, 'academy map should detect the special shop node explicitly');
  assert.match(js, /function academyMapRenderableNodes\(locations = academyMapLocations\(\)\)[\s\S]*return \[\.\.\.academyMapConversationLocations\(locations\), academyMapShopNode\(\)\];/, 'academy map rendering should append the shop node without polluting normal conversation locations');
  assert.match(js, /function renderAcademyMapLocationPreview\(location\)[\s\S]*const goButton = document\.querySelector\('#academy-map-go-button'\);[\s\S]*goButton\.textContent = isAcademyMapShopNode\(location\) \? '購買に行く' : 'ここに行く'/, 'shared map dialog should switch the primary action label by node type');
  assert.match(js, /function academyMapPointFor\(locationIdOrIndex, indexOrTotal, maybeTotal\)[\s\S]*academyMapStagePinCoordinates\[locationId\][\s\S]*if \(configuredPoint\) return configuredPoint[\s\S]*const columns = 5/, 'academy map point placement should use configured coordinates first and keep a uniform fallback grid');
  assert.match(js, /function isAcademyEventMapLocation\(locationOrId\)[\s\S]*ACADEMY_MAP_EVENT_LOCATION_IDS\.has\(locationId\)/, 'event-map identity should be reusable instead of duplicated by display and placement code');
  assert.match(js, /function academyMapConversationLocations\(locations = academyMapLocations\(\)\)[\s\S]*locations\.filter\(\(location\) => !isAcademyEventMapLocation\(location\)\)/, 'normal academy-map locations should exclude event maps');
  assert.match(js, /const mapLocations = academyMapRenderableNodes\(locations\)[\s\S]*mapLocations\.map\(\(candidate, index\) => \{[\s\S]*const point = academyMapPointFor\(candidate\.id, index, mapLocations\.length\)/, 'academy map rendering should include the special shop node while still positioning all nodes by id');
  assert.doesNotMatch(js, /enableAcademyMapPinDragEditing\(button, candidate\)/, 'fixed academy-map rendering should not wire the temporary browser-local drag editor');
  assert.doesNotMatch(js, /academyMapPointFor[\s\S]*row % 2 \? 5 : 0[\s\S]*Math\.min\(91, x\)/, 'academy map point placement should not stagger rows into a right-edge clamp that makes the map feel crowded on the right');
  assert.match(js, /academyMapSelectedLocationId/, 'browser should remember the selected academy-map stage');
  assert.match(js, /academyMapCharacterAssignments/, 'browser should store internal random character placement for academy map stages');
  assert.match(js, /function rerollAcademyMapCharacterAssignments\(\)[\s\S]*academyMapAssignmentSignature = academyMapCurrentAssignmentSignature\(\)[\s\S]*const locationBuckets = Object\.fromEntries\(locations\.map\(\(location\) => \[location\.id, \[\]\]\)\)[\s\S]*const shuffledLocations = academyMapConversationLocations\(locations\)\.sort\(\(\) => Math\.random\(\) - 0\.5\)[\s\S]*const location = shuffledLocations\[index % shuffledLocations\.length\][\s\S]*if \(location\) locationBuckets\[location\.id\]\.push\(character\.character_id\)/, 'academy map placement should distribute every character across non-event stages only and record the state signature that produced it');
  assert.match(js, /function ensureAcademyMapCharacterAssignments\(\{ force = false \} = \{\}\)[\s\S]*force \|\| !Object\.keys\(academyMapCharacterAssignments\)\.length[\s\S]*rerollAcademyMapCharacterAssignments\(\)[\s\S]*renderAcademyMap\(currentField\)/, 'academy map should preserve placement across access routes and reroll only when explicitly forced or when placement is missing');
  assert.match(js, /showScreen\(name, \{ rerollAcademyMap = false \} = \{\}\)[\s\S]*name === 'academy-map'[\s\S]*ensureAcademyMapCharacterAssignments\(\{ force: rerollAcademyMap \}\)/, 'showing the academy map normally should not reroll buddy placement just because the player reached it through a different route');
  assert.match(js, /#academy-companion-back-to-map[\s\S]*showScreen\('academy-map', \{ rerollAcademyMap: false \}\)/, 'back from companion screen to academy map should preserve the existing random placement');
  assert.match(js, /function assignedAcademyMapCharactersFor\(locationId\)/, 'companion selection should read only characters assigned to the selected stage');
  assert.match(js, /let academyCompanionLocationId = null/, 'browser should keep the confirmed companion stage separately from the transient map dialog selection');
  assert.match(js, /function renderAcademyCompanionScreen\(locationId = academyCompanionLocationId\)/, 'browser should render a dedicated conversation partner screen from the confirmed companion stage');
  const companionStageDialog = html.match(/<dialog id="academy-companion-stage-detail-dialog"[\s\S]*?<\/dialog>/)?.[0] ?? '';
  assert.match(companionStageDialog, /id="academy-companion-stage-detail-title"[\s\S]*id="academy-companion-stage-detail-image"[\s\S]*id="academy-companion-stage-detail-text"/, 'companion stage detail should have its own visible dialog in the active companion screen');
  assert.match(companionStageDialog, /class="interaction-detail-dialog field-location-detail-dialog"[\s\S]*id="academy-companion-stage-detail-image"[\s\S]*id="academy-companion-stage-detail-text"/, 'companion stage detail should use the wide stage-image dialog layout with the description below it');
  assert.doesNotMatch(companionStageDialog, /character-detail-layout|academy-stage-detail-layout|academy-stage-detail-frame|academy-stage-detail-info/, 'companion stage detail should not use the character-detail two-column structure');
  assert.match(js, /function renderAcademyCompanionStageDetail\(location\)[\s\S]*#academy-companion-stage-detail-title[\s\S]*#academy-companion-stage-detail-text[\s\S]*#academy-companion-stage-detail-image/, 'browser should populate the companion-owned stage detail dialog from the selected stage');
  assert.match(js, /function openAcademyCompanionStageDetail\(\)[\s\S]*renderAcademyCompanionStageDetail\(location\)[\s\S]*openInteractionDetailDialog\('#academy-companion-stage-detail-dialog'\)/, 'clicking the confirmed stage name should open the matching visible stage detail dialog instead of a dialog inside a hidden session screen');
  assert.doesNotMatch(js, /function openAcademyCompanionStageDetail\(\)[\s\S]*openInteractionDetailDialog\('#academy-conversation-session-location-detail-dialog'\)/, 'companion stage detail must not open the session dialog while the session screen is hidden');
  assert.match(js, /#academy-companion-stage-name[\s\S]*openAcademyCompanionStageDetail\(\)/, 'confirmed stage name button should be wired to the stage detail popup');
  assert.match(js, /document\.querySelector\('#academy-companion-stage-summary'\)\.textContent =[\s\S]*selectedAcademyStageSituation\(location\)[\s\S]*location\?\.description/, 'confirmed stage card should show the selected stage description instead of candidate-placement helper text');
  assert.match(js, /openAcademyCompanionCharacterDetail\(character\)/, 'companion buttons should open character details before conversation starts');
  assert.match(js, /#start-academy-companion-character[\s\S]*startAcademyConversationSessionFromCompanion\(academyCompanionDetailCharacterId\)/, 'academy companion detail should start the inspected character in the added conversation session screen');
  assert.match(js, /function updateAcademyMapHoverPreview\(location, point = null\)[\s\S]*#academy-map-hover-tooltip[\s\S]*tooltip\.style\.left = `\$\{point\.x\}%`[\s\S]*tooltip\.style\.top = `\$\{point\.y\}%`/, 'hover preview should position a tooltip near the hovered stage point');
  assert.match(js, /function renderAcademyMap\(field\)/, 'browser should render map hotspots from field locations');
  assert.match(js, /function stageHasAssignedBuddy\(locationId\)[\s\S]*const buddyCharacterId = selectedAcademyBuddyCharacterId\(\)[\s\S]*return Boolean\(buddyCharacterId\) && assignedAcademyMapCharactersFor\(locationId\)\.some\(\(character\) => character\.character_id === buddyCharacterId\)/, 'academy map should define buddy presence from the current runtime buddy, not from every assigned character');
  assert.match(js, /function selectedAcademyBuddyCharacterId\(\)[\s\S]*currentRuntimeState\?\.current_buddy_character_id[\s\S]*selectableCharacters\.find\(\(character\) => character\.is_buddy === true\)/, 'academy map should read buddy presence from the authoritative current buddy state exposed by the backend');
  assert.match(js, /function selectedAcademyEnemyCharacterIds\(\)[\s\S]*currentRuntimeState\?\.current_enemy_character_ids[\s\S]*selectableCharacters\.filter\(\(character\) => character\.is_enemy === true\)/, 'academy map should read enemy presence from the authoritative current enemy list exposed by the backend');
  assert.match(js, /function stageHasAssignedEnemy\(locationId\)[\s\S]*const enemyCharacterIds = selectedAcademyEnemyCharacterIds\(\)[\s\S]*return assignedAcademyMapCharactersFor\(locationId\)\.some\(\(character\) => enemyCharacterIds\.has\(character\.character_id\)\)/, 'academy map should mark stages containing any current enemy');
  assert.doesNotMatch(js.match(/function selectedAcademyBuddyCharacterId\(\)[\s\S]*?\n\}/)?.[0] ?? '', /current_interaction_character_id/, 'active interaction character must not be treated as the buddy because it makes map pins and status depend on access path');
  assert.doesNotMatch(js.match(/function selectedAcademyEnemyCharacterIds\(\)[\s\S]*?\n\}/)?.[0] ?? '', /current_interaction_character_id/, 'active interaction character must not be treated as an enemy because it makes map pins and status depend on access path');
  assert.match(js, /button\.classList\.toggle\('has-buddy', stageHasAssignedBuddy\(candidate\.id\)\)/, 'academy map should mark only actual buddy-present stages, not every stage with any assigned character');
  assert.match(js, /button\.classList\.toggle\('has-enemy', stageHasAssignedEnemy\(candidate\.id\)\)/, 'academy map should mark stages with assigned enemies red');
  assert.match(js, /openAcademyMapLocationDialog\(candidate\)/, 'clicking a map node should open the stage detail dialog instead of moving immediately');
  assert.match(js, /async function goToAcademyMapLocation\(\)[\s\S]*if \(isAcademyMapShopNode\(academyMapSelectedLocationId\)\) \{[\s\S]*document\.querySelector\('#academy-map-location-dialog'\)\.close\(\);[\s\S]*showScreen\('shop'\);[\s\S]*return;[\s\S]*\}/, 'shop node action should close the shared dialog and open the shop screen instead of moving to a conversation stage');
  assert.match(js, /academyCompanionLocationId = academyMapSelectedLocationId[\s\S]*moveToLocation\(academyCompanionLocationId, \{[\s\S]*nextScreen: 'academy-companion',[\s\S]*selectedVisibleSituation: selectedAcademyStageSituation\(academyCompanionLocationId\)[\s\S]*\}\)/, 'go button should confirm normal stages, send the selected stage description, and move to the dedicated conversation partner selector');
  assert.match(js, /showScreen\('academy-companion'\)/, 'confirmed academy-map movement should move into the conversation partner selector');
  assert.match(js, /#academy-map-go-button/, 'browser should wire the academy map go button');
  assert.match(js, /#academy-map-close-button/, 'browser should wire the academy map close button');
  assert.match(js, /#shop-back-to-map[\s\S]*showScreen\('academy-map', \{ rerollAcademyMap: false \}\)/, 'shop screen should return to academy map without rerolling hidden assignments');

  assert.match(css, /:root\s*\{[\s\S]*--runtime-reading-font:\s*ui-serif, "Hiragino Mincho ProN", "Yu Mincho", serif/, 'runtime should centralize the conversation reading font for academy map, companion, and session screens');
  assert.match(css, /\.screen-tabs button,[\s\S]*button,[\s\S]*input,[\s\S]*textarea,[\s\S]*select\s*\{[\s\S]*font-family:\s*var\(--runtime-reading-font\)/, 'buttons and form controls should inherit the same reading font as conversation bubbles instead of falling back to browser sans-serif');
  assert.match(css, /\.academy-map-hero h2\s*\{[\s\S]*font-size:\s*clamp\(18px, 1\.8vw, 22px\)[\s\S]*line-height:\s*1\.35[\s\S]*letter-spacing:\s*0/, 'academy map and conversation-partner hero titles should be only slightly larger than their description text');
  assert.match(css, /\.layout:has\(#academy-map-screen\.active\)\s*\{[\s\S]*height:\s*calc\(100dvh - var\(--runtime-topbar-height, 88px\)\)[\s\S]*padding:\s*12px 20px 8px[\s\S]*overflow:\s*hidden/, 'academy map layout should lock to the current viewport with a tighter bottom inset so the map bottom stays visible');
  assert.match(css, /#academy-map-screen\.active[\s\S]*height:\s*100%[\s\S]*min-height:\s*0/, 'academy map screen should fit inside the viewport-bound layout');
  assert.match(css, /\.academy-map-shell[\s\S]*display:\s*grid[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\)[\s\S]*height:\s*100%[\s\S]*linear-gradient[\s\S]*border: 1px solid rgba\(255, 255, 255, 0\.08\)/, 'academy map shell should use sharp dark premium surfaces while sizing the canvas to remaining height');
  assert.match(css, /\.academy-map-canvas[\s\S]*width:\s*min\(100%, calc\(\(100dvh - var\(--runtime-topbar-height, 88px\) - 164px\) \* 1672 \/ 941\)\)[\s\S]*aspect-ratio:\s*1672 \/ 941[\s\S]*url\('\/canonical\/backgrounds\/academy_overview_map\.png'\)[\s\S]*background-repeat:\s*no-repeat[\s\S]*background-size:\s*cover, 100% 100%, cover/, 'academy map canvas should reserve enough vertical room for the shell/header while matching the canonical overview image ratio and pin coordinate area');
  assert.match(css, /\.academy-map-node[\s\S]*position:\s*absolute[\s\S]*width:\s*19px[\s\S]*height:\s*25px[\s\S]*clip-path:\s*polygon\(50% 0%, 88% 28%, 72% 100%, 28% 100%, 12% 28%\)[\s\S]*transform:\s*translate\(-50%, -100%\) rotate\(0deg\)/, 'map nodes should be small faceted crystal pins on the overview map');
  assert.match(css, /\.academy-map-node span[\s\S]*opacity:\s*0[\s\S]*scaleX\(0\.18\)[\s\S]*\.academy-map-node:hover:not\(:disabled\) span,[\s\S]*\.academy-map-node:focus-visible:not\(:disabled\) span[\s\S]*opacity:\s*1[\s\S]*scaleX\(1\)/, 'stage names should stay collapsed on pins and expand on hover or focus');
  assert.match(css, /\.academy-map-node\s*\{[\s\S]*--academy-map-pin-color:\s*#d0b46a[\s\S]*--academy-map-pin-fill:\s*linear-gradient\(145deg, rgba\(255, 250, 223, 0\.92\) 0 10%, #d0b46a 11% 28%, #8f6934 29% 54%, #2c2118 55% 76%, #f7dda0 77% 82%, #151923 83% 100%\)/, 'default map pins should use a readable antique-gold crystal palette');
  assert.match(css, /\.academy-map-node::before\s*\{[\s\S]*linear-gradient\(115deg, transparent 0 28%, rgba\(255, 255, 255, 0\.56\) 29% 31%, transparent 32% 48%, rgba\(255, 255, 255, 0\.28\) 49% 51%, transparent 52% 100%\)[\s\S]*mix-blend-mode:\s*screen/, 'crystal pins should show internal facet lines');
  assert.match(css, /\.academy-map-node::after\s*\{[\s\S]*radial-gradient\(circle, rgba\(255, 255, 245, 0\.92\) 0 20%, rgba\(255, 255, 245, 0\.34\) 21% 46%, transparent 47% 100%\)[\s\S]*filter:\s*blur\(0\.1px\)/, 'crystal pins should have a small top glint as their design treatment');
  assert.match(css, /\.academy-map-node:hover:not\(:disabled\),\n\.academy-map-node:focus-visible:not\(:disabled\)\s*\{[\s\S]*transform:\s*translate\(-50%, -100%\) rotate\(0deg\);[\s\S]*filter:\s*brightness\(1\.16\)/, 'hover/focus should not move or scale the crystal pin hit target, preventing hover-selection jitter');
  const pinHoverBlock = css.match(/\.academy-map-node:hover:not\(:disabled\),\n\.academy-map-node:focus-visible:not\(:disabled\)\s*\{[\s\S]*?\n\}/)?.[0] ?? '';
  assert.doesNotMatch(pinHoverBlock, /translateY\(-4px\)|scale\(1\.08\)/, 'map pin hover must not shrink/shift itself out from under the cursor');
  assert.match(css, /\.academy-map-node\.has-buddy\s*\{[\s\S]*--academy-map-pin-color:\s*#8fd4ef[\s\S]*--academy-map-pin-fill:\s*linear-gradient\(145deg, rgba\(238, 252, 255, 0\.92\) 0 10%, #8fd4ef 11% 30%, #357c9a 31% 55%, #123040 56% 78%, #c9f3ff 79% 84%, #0b1720 85% 100%\)/, 'buddy-present map pins should become a readable muted blue crystal, not a bright default highlight');
  assert.match(css, /\.academy-map-node\.has-enemy\s*\{[\s\S]*--academy-map-pin-color:\s*#e58a86[\s\S]*--academy-map-pin-fill:\s*linear-gradient\(145deg, rgba\(255, 238, 236, 0\.9\) 0 10%, #e58a86 11% 30%, #9d3f43 31% 55%, #3d171a 56% 78%, #ffd0c8 79% 84%, #1d0d10 85% 100%\)/, 'enemy-present map pins should become a readable muted red crystal');
  assert.match(css, /\.academy-map-node\.has-buddy\.has-enemy\s*\{[\s\S]*--academy-map-pin-color:\s*#8fd4ef/, 'buddy color should win when a stage has both buddy and enemy assignments');
  assert.doesNotMatch(css, /\.academy-map-node\.has-buddy\.has-enemy\s*\{[\s\S]*--academy-map-pin-color:\s*#e58a86/, 'buddy-plus-enemy stages should not keep enemy red as the final priority');
  assert.doesNotMatch(css, /\.academy-map-node\.current/, 'academy map blue focus should be decoupled from the field current location');
  assert.match(css, /\.academy-map-hover-tooltip[\s\S]*position:\s*absolute[\s\S]*transform:\s*translate\(14px, calc\(-100% - 12px\)\)[\s\S]*pointer-events:\s*none/, 'hover preview should appear as an absolute tooltip near the hovered pin without stealing hover');
  assert.match(css, /\.academy-map-hover-tooltip\.is-visible[\s\S]*opacity:\s*1[\s\S]*scale\(1\)/, 'hover preview tooltip should become visible on pin hover or focus');
  assert.match(css, /\.academy-map-action-button[\s\S]*border: 1px solid rgba\(211, 180, 105, 0\.54\)[\s\S]*box-shadow/, 'dialog actions should visually match map hotspot buttons');
  assert.match(css, /\.academy-companion-character-detail-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(360px, 420px\) minmax\(340px, 1fr\)[\s\S]*gap:\s*32px/, 'academy companion detail image and parameter columns should have explicit separation so frames do not overlap');
  assert.match(css, /\.academy-companion-standee-frame\s*\{[\s\S]*width:\s*100%[\s\S]*max-width:\s*100%[\s\S]*min-height:\s*420px/, 'academy companion standee should stay inside its grid column instead of overlapping parameters');
  assert.match(css, /\.academy-companion-grid[\s\S]*grid-template-columns[\s\S]*\.academy-companion-card[\s\S]*border: 1px solid rgba\(211, 180, 105, 0\.54\)/, 'conversation partner selector should use the same sharp map-button visual system');
  assert.match(css, /\.academy-companion-card\.is-buddy[\s\S]*border-color:\s*rgba\(150, 212, 255, 0\.92\)[\s\S]*\.academy-companion-card\.is-buddy::after[\s\S]*content:\s*'バディー'/, 'conversation partner selector should visibly label the current buddy in blue');
  assert.match(css, /\.academy-companion-card\.is-enemy[\s\S]*border-color:\s*rgba\(255, 122, 122, 0\.9\)[\s\S]*\.academy-companion-card\.is-enemy::after[\s\S]*content:\s*'エネミー'/, 'conversation partner selector should visibly label current enemies in red');
  assert.match(js, /button\.classList\.toggle\('is-buddy', character\.is_buddy === true\)[\s\S]*button\.classList\.toggle\('is-enemy', character\.is_enemy === true\)/, 'conversation partner cards should tag buddy and enemy characters from backend flags');
  assert.match(css, /\.academy-companion-card img\s*\{[\s\S]*border:\s*1px solid rgba\(211, 180, 105, 0\.42\)[\s\S]*box-shadow:\s*0 0 24px rgba\(211, 180, 105, 0\.16\)/, 'conversation partner character icons should use the same gold-ish outline family as the character detail artwork frame');
});

test('academy conversation session is a map-styled added conversation screen with standee panel and shared details', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const js = await readFile(path.join(root, 'app.js'), 'utf8');
  const css = await readFile(`${root}/style.css`, 'utf8');

  assert.match(html, /data-screen="academy-companion"[\s\S]*>会話相手<[\s\S]*data-screen="academy-conversation-session"[\s\S]*>会話セッション</, 'conversation session tab should be placed immediately to the right of conversation partner');
  assert.match(html, /<section id="interaction-screen"[\s\S]*<section id="academy-conversation-session-screen"/, 'new conversation session screen should be added without replacing the existing interaction screen');
  const sessionBlock = html.match(/<section id="academy-conversation-session-screen"[\s\S]*?<section id="academy-room-screen"/)?.[0] ?? '';
  assert.match(sessionBlock, /class="academy-map-shell academy-conversation-session-shell"/, 'conversation session should reuse the academy map and companion shell style');
  assert.doesNotMatch(sessionBlock, /<h2 id="academy-conversation-session-title">|確定した舞台と会話相手を見ながら会話します|CONFIRMED STAGE|academy-map-status-card/, 'session should remove the verbose top hero and confirmed-stage card');
  assert.doesNotMatch(sessionBlock, /Conversation Session|CONVERSATION SESSION|academy-conversation-session-header/, 'session should not keep the extra CONVERSATION SESSION label above the panels');
  assert.match(sessionBlock, /class="academy-conversation-session-grid"[\s\S]*class="standee-frame app-card academy-conversation-session-standee-frame"[\s\S]*class="conversation-panel chat-panel app-card academy-conversation-session-chat-panel"/, 'conversation session should keep the interaction two-panel structure inside the academy shell style');
  assert.match(sessionBlock, /class="academy-conversation-session-stage-card"[\s\S]*id="academy-conversation-session-location-image"[\s\S]*id="academy-conversation-session-location-name-button"[^>]*interaction-name-button[^>]*interaction-location-name-button[\s\S]*id="academy-conversation-session-character-standee"[\s\S]*id="academy-conversation-session-character-name-button"/, 'left session panel should integrate stage image and clickable stage name before the character standee/name, with the same name-button style as the character name');
  assert.match(sessionBlock, /id="academy-conversation-session-character-detail-dialog"[\s\S]*id="academy-conversation-session-character-detail-standee"[\s\S]*id="academy-conversation-session-character-parameters"/, 'session character detail should reuse the companion-style standee plus parameters layout');
  assert.doesNotMatch(sessionBlock, /interaction-character-description|character-prompt-description|character-speaking-basis|character-memory-records|character-skill-records|character-work-records/, 'session character detail should not show character description or edit/record surfaces');
  assert.match(sessionBlock, /id="academy-conversation-session-location-detail-dialog" class="interaction-detail-dialog field-location-detail-dialog"[\s\S]*id="academy-conversation-session-location-detail-title"[\s\S]*id="academy-conversation-session-location-detail-image"[\s\S]*id="academy-conversation-session-location-detail-text"/, 'session stage detail should use the wide stage-image dialog layout with the description below it');
  assert.doesNotMatch(sessionBlock, /academy-stage-detail-layout|academy-stage-detail-frame|academy-stage-detail-info/, 'session stage detail should not use the character-detail two-column stage layout');
  assert.doesNotMatch(sessionBlock, /<p class="speaker" id="academy-conversation-session-speaker">/, 'session right chat panel should not show the extra character-name line above messages');
  assert.match(sessionBlock, /id="academy-conversation-session-run-conversation" class="academy-map-action-button secondary"[\s\S]*id="academy-conversation-session-end-conversation" class="academy-map-action-button secondary"/, 'session chat action buttons should use the same academy detail button style');

  assert.match(js, /'academy-conversation-session': document\.querySelector\('#academy-conversation-session-screen'\)/, 'browser should register the new session screen');
  assert.match(js, /function renderAcademyConversationSessionScreen\(\)/, 'browser should render the added session screen separately');
  const conversationEntryFunction = js.match(/async function startAcademyConversationSessionFromCompanion\(characterId\)[\s\S]*?\n}\n\nasync function openInteractionTab/)?.[0] ?? '';
  assert.match(conversationEntryFunction, /postJson\('\/api\/interaction\/start'[\s\S]*source_type: 'field'/, 'conversation partner start should still start a field-sourced interaction session');
  assert.match(conversationEntryFunction, /const openingStreamStarted = new Promise\(\(resolve\) => \{[\s\S]*openingStreamStartedResolve = resolve[\s\S]*\}\)/, 'conversation-session entry should create a readiness gate for the LM Studio opening stream start');
  assert.match(conversationEntryFunction, /ensureOpeningUtterance\(\{ onAssistantStreamStart: markOpeningStreamStarted \}\)/, 'conversation-session entry should start the opening utterance while loading and observe the first assistant stream event');
  assert.match(conversationEntryFunction, /Promise\.race\(\[openingStreamStarted, openingPromise\]\)/, 'loading should wait for the opening stream to start, or surface an opening failure, rather than waiting for the full first reply');
  assert.match(conversationEntryFunction, /showAcademyLoadingScreenUntilReady\(\{[\s\S]*readiness[\s\S]*nextScreen: 'academy-conversation-session'[\s\S]*refreshBeforeNextScreen: false[\s\S]*\}\)[\s\S]*await openingPromise/, 'conversation partner start should enter the session at stream start and keep controls disabled until the opening reply finishes');
  assert.doesNotMatch(conversationEntryFunction, /await ensureOpeningUtterance\(\)/, 'conversation-session loading should not wait for the full first opening response before switching screens');
  assert.doesNotMatch(conversationEntryFunction, /showScreen\('academy-conversation-session'\)/, 'conversation partner start should not bypass the loading screen');
  assert.match(js, /#start-academy-companion-character[\s\S]*startAcademyConversationSessionFromCompanion\(academyCompanionDetailCharacterId\)/, 'companion detail start action should route to conversation session instead of the old interaction screen');
  assert.match(js, /function openAcademyConversationSessionLocationDetail\(\)[\s\S]*openInteractionDetailDialog\('#academy-conversation-session-location-detail-dialog'\)/, 'session stage name should open the wide stage detail popup');
  assert.match(js, /function openAcademyConversationSessionCharacterDetail\(\)[\s\S]*openInteractionDetailDialog\('#academy-conversation-session-character-detail-dialog'\)/, 'session character name should open the companion-style character detail popup');
  assert.match(js, /#academy-conversation-session-character-standee[\s\S]*characterSceneStandeeUrl\(selected\)/, 'session right-panel character image should use the full scene standee rather than face icons');
  const sessionRenderFunction = js.match(/function renderAcademyConversationSessionScreen\(\)[\s\S]*?\n}\n/)?.[0] ?? '';
  assert.doesNotMatch(sessionRenderFunction, /sourceSheetImageUrl\(\{[^}]*view: 'face'/, 'session standee panel must not use the face crop resolver');

  assert.match(css, /#academy-conversation-session-screen\.active[\s\S]*display:\s*grid[\s\S]*height:\s*max\(420px, calc\(100dvh - var\(--runtime-topbar-height, 0px\) - 40px\)\)[\s\S]*min-height:\s*0[\s\S]*overflow:\s*visible/, 'session screen should use the measured topbar height instead of hiding overflow behind an artificial bottom band');
  assert.doesNotMatch(css, /body:has\(#academy-conversation-session-screen\.active\)\s*\{[\s\S]*overflow:\s*hidden/, 'session screen must not lock body overflow and mask broken bottom layout');
  assert.match(css, /\.academy-conversation-session-shell\s*\{[\s\S]*box-sizing:\s*border-box[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\)[\s\S]*height:\s*100%[\s\S]*min-height:\s*0[\s\S]*overflow:\s*visible[\s\S]*padding:\s*0[\s\S]*border:\s*0[\s\S]*background:\s*transparent[\s\S]*box-shadow:\s*none/, 'session shell should be a transparent sizing wrapper, not a visible corner/background panel');
  assert.match(css, /\.academy-conversation-session-grid\s*\{[\s\S]*--academy-conversation-session-left-width:\s*clamp\(270px, calc\(\(100dvh - var\(--runtime-topbar-height, 0px\) - 96px\) \* 0\.54\), 390px\)[\s\S]*grid-template-columns:\s*var\(--academy-conversation-session-left-width\) minmax\(0, 1fr\)[\s\S]*height:\s*100%/, 'session layout should derive a compact left visual column from the visible image/name stack and give the chat panel the remaining width');
  assert.match(css, /\.academy-conversation-session-stage-card[\s\S]*#academy-conversation-session-location-image\s*\{[\s\S]*width:\s*100%[\s\S]*aspect-ratio:\s*16 \/ 9[\s\S]*background-color:\s*rgba\(7, 11, 20, 0\.58\)[\s\S]*background-size:\s*contain/, 'session left panel should make the stage image frame tall enough for the full 16:9 image to fit edge-to-edge without vertical cropping');
  assert.match(css, /\.academy-conversation-session-stage-card \.interaction-location-name-button\s*\{[\s\S]*font-size:\s*15px[\s\S]*line-height:\s*1\.45[\s\S]*color:\s*#d3b469[\s\S]*font-weight:\s*700/, 'session left-panel stage name should match the character-name font size, color, and button style');
  assert.match(css, /\.interaction-character-name-button\s*\{[\s\S]*font-size:\s*15px[\s\S]*line-height:\s*1\.45[\s\S]*font-weight:\s*700/, 'session left-panel character name should be bold while keeping the shared name-button sizing');
  assert.match(css, /\.academy-conversation-session-chat-panel\s*\{[\s\S]*display:\s*grid[\s\S]*box-sizing:\s*border-box[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\) auto auto[\s\S]*height:\s*100%/, 'session chat should remove the top speaker row and dedicate the freed space to the message stream without padding overflowing its grid cell');
  assert.match(css, /\.academy-conversation-session-button-row \.academy-map-action-button\s*\{[\s\S]*min-width:\s*126px[\s\S]*padding:\s*10px 13px[\s\S]*border-radius:\s*999px/, 'session send and end buttons should match academy-map stage-button sizing and pill shape');
  assert.match(css, /\.academy-conversation-session-button-row \.academy-map-action-button::before\s*\{[\s\S]*content:\s*none/, 'session send and end buttons should not show the map-node top marker');
  assert.match(css, /\.academy-conversation-session-standee-frame\s*\{[\s\S]*display:\s*flex[\s\S]*box-sizing:\s*border-box[\s\S]*flex-direction:\s*column[\s\S]*height:\s*100%[\s\S]*padding:\s*18px[\s\S]*overflow:\s*auto/, 'session left panel should use the same card padding as the chat panel while laying out captions sequentially');
  assert.match(css, /#academy-conversation-session-character-standee\s*\{[\s\S]*box-sizing:\s*border-box[\s\S]*display:\s*block[\s\S]*(?:^|\n)\s*width:\s*100%[\s\S]*(?:^|\n)\s*height:\s*clamp\(160px, calc\(100dvh - var\(--runtime-topbar-height, 0px\) - 340px\), 340px\)[\s\S]*border:\s*1px solid rgba\(211, 180, 105, 0\.28\)[\s\S]*border-radius:\s*18px[\s\S]*object-fit:\s*cover[\s\S]*object-position:\s*50% bottom/, 'session left-panel character image should fill the fixed image-card frame with border and rounded corners');
  assert.match(css, /#academy-conversation-session-location-detail-dialog,[\s\S]*#academy-companion-stage-detail-dialog\s*\{[\s\S]*box-sizing:\s*border-box[\s\S]*width:\s*min\(1240px, 96vw\)[\s\S]*#academy-conversation-session-location-detail-dialog \.interaction-detail-card,[\s\S]*#academy-companion-stage-detail-dialog \.interaction-detail-card\s*\{[\s\S]*box-sizing:\s*border-box[\s\S]*#academy-conversation-session-location-detail-image,[\s\S]*#academy-companion-stage-detail-image\s*\{[\s\S]*box-sizing:\s*border-box[\s\S]*max-width:\s*100%[\s\S]*\.academy-conversation-session-location-detail-text\s*\{[\s\S]*white-space:\s*nowrap[\s\S]*overflow-x:\s*auto/, 'session and companion stage details should restore the wide stage-image dialog, keep the image inside the popup, and keep the description on one line');
  const sequentialRenderFunction = js.match(/async function renderConversationResultSequentially\(result\)[\s\S]*?\n}\n/)?.[0] ?? '';
  assert.match(sequentialRenderFunction, /commitConversationResultState\(result\)/, 'sequential reply reveal should commit the canonical raw conversation state after the last segment');
  assert.doesNotMatch(sequentialRenderFunction, /renderMessageStream\(fullMessages\)/, 'sequential reply reveal should not replace the finished DOM at the end because that makes character and narration bubbles jump horizontally');
  const streamingFunction = js.match(/async function runAssistantSseStream\(\{[\s\S]*?\n}\n\nasync function runOpeningConversationStream/)?.[0] ?? '';
  assert.match(streamingFunction, /finishAssistantSegmentReveal\(\)[\s\S]*commitConversationResultState\(finalResult\)/, 'streaming reveal should commit canonical state after post-reply processing without replacing visible bubbles');
  assert.doesNotMatch(streamingFunction, /renderConversationResult\(finalResult, \{ revealAssistant: false \}\)/, 'streaming final reconciliation should not replace already-revealed character or narration bubbles when the send controls become available');
  assert.match(js, /function updateViewportMetrics\(\)[\s\S]*--runtime-topbar-height/, 'browser should measure the live wrapped topbar height for conversation-session viewport math');
  assert.match(js, /ResizeObserver[\s\S]*observe\(document\.querySelector\('\.topbar'\)\)/, 'browser should refresh session sizing when the topbar wraps or unwraps during resize');
  assert.match(js, /async function endConversation[\s\S]*clearVisibleConversation\(\);[\s\S]*let transition = endingConversation[\s\S]*next_screen: 'academy-room'[\s\S]*const loadingReadiness = endingConversation \? finalization : Promise\.resolve\(\)[\s\S]*showAcademyLoadingScreenUntilReady\(\{[\s\S]*readiness:\s*loadingReadiness[\s\S]*nextScreen: transition\.next_screen[\s\S]*refreshBeforeNextScreen: false[\s\S]*copyKey: transition\.loading_copy_key[\s\S]*\}\)/, 'ending an academy conversation session should use the fixed loading delay for 自室 while still waiting for finalization before the graduation title route');
  assert.doesNotMatch(js.match(/async function endConversation[\s\S]*?\n}\n/)?.[0] ?? '', /clearVisibleConversation\(\);\s*showScreen\('academy-room'\)/, 'conversation end should not bypass the room loading interstitial');
  assert.match(js, /finalization_status:\s*'running'[\s\S]*current_screen:\s*'academy-room'/, 'conversation-end running state should mirror the 自室 destination');
});

test('training remains separate and academy 鍛錬 is added between conversation session and academy room', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const js = await readFile(path.join(root, 'app.js'), 'utf8');
  const css = await readFile(`${root}/style.css`, 'utf8');

  assert.match(html, /data-screen="training"[\s\S]*>トレーニング</, 'existing training tab should remain as トレーニング');
  assert.match(html, /data-screen="academy-conversation-session"[\s\S]*>会話セッション<[\s\S]*data-screen="academy-training"[\s\S]*>鍛錬<[\s\S]*data-screen="academy-room"[\s\S]*>自室</, 'new 鍛錬 tab should sit between conversation session and 自室');
  const trainingBlock = html.match(/<section id="training-screen"[\s\S]*?<section id="event-screen"/)?.[0] ?? '';
  const academyTrainingBlock = html.match(/<section id="academy-training-screen"[\s\S]*?<section id="academy-room-screen"/)?.[0] ?? '';
  assert.match(trainingBlock, /id="training-title">トレーニング</, 'existing training screen should keep the training title');
  assert.doesNotMatch(trainingBlock, /academy-map-shell training-shell/, 'existing training screen should not be replaced by the academy 鍛錬 shell');
  assert.match(academyTrainingBlock, /class="academy-map-shell academy-training-shell"/, 'new 鍛錬 should use a separate academy shell');
  assert.match(academyTrainingBlock, /id="academy-training-title">鍛錬<[\s\S]*id="academy-training-weekday"[\s\S]*id="academy-training-progress"/, 'new 鍛錬 should have separate weekday/progress controls');
  assert.match(academyTrainingBlock, /id="academy-training-options"[\s\S]*id="academy-training-player-parameters"[\s\S]*id="academy-training-result"[\s\S]*id="academy-training-effect-overlay"[\s\S]*id="academy-training-day-transition"/, 'new 鍛錬 should have separate behavior hooks and effect overlays');
  assert.match(js, /'academy-training': document\.querySelector\('#academy-training-screen'\)/, 'browser should register the separate academy training screen');
  assert.match(js, /for \(const selector of \['#training-weekday', '#academy-training-weekday'\]/, 'weekday render should update both training surfaces');
  assert.match(js, /setTimeout\(\(\) => \{[\s\S]*overlay\.classList\.remove\('visible'\)[\s\S]*\}, 1000\)/, 'training effect timing should remain one second');
  assert.match(js, /setTimeout\(\(\) => \{[\s\S]*trainingDayTransitionInFlight = false[\s\S]*\}, 2000\)/, 'training day transition timing should remain two seconds');
  assert.match(css, /\.academy-training-shell\s*\{[\s\S]*height:\s*100%[\s\S]*min-height:\s*0/, '鍛錬 shell should occupy the active viewport-bound screen without hard-coding its own height');
  assert.match(css, /\.academy-training-panel[\s\S]*border:\s*1px solid rgba\(211, 180, 105, 0\.35\)[\s\S]*background:\s*radial-gradient/, '鍛錬 panels should use a renewed dark academy card styling');
});

test('academy training cards use symbol-first title-only choices and completed training returns to academy map through loading screen', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const js = await readFile(path.join(root, 'app.js'), 'utf8');
  const css = await readFile(`${root}/style.css`, 'utf8');

  assert.match(html, /6回行動すると学院マップへ戻ります。/, 'academy 鍛錬 help should name 学院マップ as the return screen');
  assert.match(html, /id="academy-loading-screen"[\s\S]*id="academy-loading-image"[\s\S]*id="academy-loading-status"/, 'training completion should have a dedicated loading screen with generated-image hooks');
  assert.match(js, /const ACADEMY_LOADING_MINIMUM_MS = 1000;/, 'loading screen should enforce an about-one-second minimum display');
  assert.match(js, /const ACADEMY_LOADING_IMAGE_ROTATION_MS = 3000;/, 'loading image should rotate every three seconds');
  assert.match(js, /const academyLoadingImageUrls = \[[\s\S]*\/canonical\/load\//, 'loading images should come from public canonical load assets');
  assert.match(js, /const trainingCardImageUrls = \{[\s\S]*artifact_appraisal: '\/canonical\/ui\/card_images\/artifact_appraisal\.png'[\s\S]*wind_step: '\/canonical\/ui\/card_images\/wind_step\.png'[\s\S]*\}/, 'training cards should use the canonical card_images icon set by matching training id');
  assert.match(js, /const trainingOptions = \[[\s\S]*id: 'artifact_appraisal'[\s\S]*id: 'barrier_weaving'[\s\S]*id: 'broom_flight'[\s\S]*id: 'familiar_bonding'[\s\S]*id: 'potion_brewing'[\s\S]*id: 'rune_calligraphy'[\s\S]*id: 'spirit_listening'[\s\S]*id: 'star_observation'[\s\S]*\]/, 'generated card images that had no existing action should get corresponding new training choices');
  assert.match(js, /cardImage\.className = 'training-card-image'[\s\S]*cardImage\.src = training\.cardImageUrl[\s\S]*button\.append\(cardImage, body\)/, 'academy training cards should render the generated image as the main card visual');
  assert.match(js, /#academy-training-options[\s\S]*createTrainingOptionCard\(training, \{ compact: true \}\)/, 'academy 鍛錬 choices should render compact card-image choices');
  assert.match(js, /function startAcademyLoadingImageRotation\(\)[\s\S]*setInterval\(\(\) => setAcademyLoadingImage\(\), ACADEMY_LOADING_IMAGE_ROTATION_MS\)/, 'loading screen should keep replacing the displayed image while active');
  assert.match(js, /function waitForAcademyMapReadiness\(\)[\s\S]*waitForConversationFinalization\(\)/, 'loading should wait on the shared conversation finalization promise before reopening academy routes');
  assert.match(html, /id="academy-loading-title"/, 'loading screen title should be addressable so its destination copy can change per transition');
  assert.match(html, /id="academy-loading-status"/, 'loading screen status should be addressable so its destination copy can change per transition');
  assert.match(js, /function setAcademyLoadingDestinationCopy\(nextScreen, \{ copyKey = null, loadingCopy = null \} = \{\}\)[\s\S]*academy-conversation-session[\s\S]*会話セッションへ移動中[\s\S]*会話の準備を待っています[\s\S]*academy-training[\s\S]*次の一週間が始まります[\s\S]*会話を終えて、次の一週間の鍛錬予定を整えています[\s\S]*academy-map[\s\S]*学院マップへ移動中[\s\S]*会話セッションの整理と学院マップの準備を待っています/, 'loading screen copy should match the destination instead of always saying 学院マップ');
  assert.match(js, /async function showAcademyLoadingScreenUntilReady\(\{ readiness, nextScreen = null, refreshBeforeNextScreen = true, copyKey = null, loadingCopy = null \}\)[\s\S]*setAcademyLoadingDestinationCopy\(nextScreen, \{ copyKey, loadingCopy \}\)[\s\S]*showScreen\('academy-loading'\)[\s\S]*Promise\.all\(\[minimumDisplay, readiness\]\)[\s\S]*if \(nextScreen == null\) return;[\s\S]*if \(refreshBeforeNextScreen\) await refresh\(\)[\s\S]*showScreen\(nextScreen\)/, 'academy loading should be shared by map return, graduation waiting, and conversation-session entry while updating destination copy');
  assert.match(js, /async function runAssistantSseStream\(\{[\s\S]*onAssistantStreamStart = null[\s\S]*\}\)/, 'SSE helper should accept an entry callback for the moment assistant streaming starts');
  assert.match(js, /function notifyAssistantStreamStarted\(\)[\s\S]*onAssistantStreamStart\?\.\(\)/, 'SSE helper should notify callers exactly when the first assistant stream event arrives');
  assert.match(js, /if \(event === 'assistant_delta'\) \{[\s\S]*notifyAssistantStreamStarted\(\)/, 'assistant deltas should mark the opening stream as ready before the first completed bubble is available');
  assert.match(js, /async function routeAfterCompletedAcademyTraining\(\)[\s\S]*setAcademyLoadingDestinationCopy\('academy-map'\)[\s\S]*showScreen\('academy-loading'\)[\s\S]*const minimumDisplay = new Promise\(\(resolve\) => setTimeout\(resolve, ACADEMY_LOADING_MINIMUM_MS\)\)[\s\S]*Promise\.all\(\[minimumDisplay, waitForAcademyMapReadiness\(\)\]\)[\s\S]*const status = await refreshEventFlagStatus\(\)[\s\S]*const autoStartFlag = \(status\.pending_events \?\? \[\]\)\.find\(\(flag\) => flag\.interaction\?\.location_id && flag\.character_id\)[\s\S]*if \(autoStartFlag\) \{[\s\S]*await startAcademyConversationSessionFromPendingEvent\(autoStartFlag\.id, \{ loadingAlreadyVisible: true \}\)[\s\S]*return;[\s\S]*\}[\s\S]*await refresh\(\)[\s\S]*showScreen\('academy-map'\)/, 'completed 鍛錬 should hold the loading screen through finalization, then branch directly into a pending event session before academy map fallback');
  assert.match(js, /async function startAcademyConversationSessionFromPendingEvent\(flagId, \{ loadingAlreadyVisible = false \} = \{\}\)[\s\S]*postJson\('\/api\/event-flags\/start', \{ flag_id: flagId, screen: 'academy-conversation-session' \}\)[\s\S]*ensureOpeningUtterance\(\{ onAssistantStreamStart: markOpeningStreamStarted \}\)[\s\S]*Promise\.race\(\[openingStreamStarted, openingPromise\]\)[\s\S]*if \(loadingAlreadyVisible\) \{[\s\S]*await readiness;[\s\S]*showScreen\('academy-conversation-session'\)[\s\S]*\} else \{[\s\S]*showAcademyLoadingScreenUntilReady\(\{[\s\S]*nextScreen: 'academy-conversation-session'[\s\S]*refreshBeforeNextScreen: false[\s\S]*\}\)[\s\S]*\}[\s\S]*await openingPromise/, 'post-training pending events should keep academy loading visible until the LM Studio opening stream starts before revealing 会話セッション');
  assert.match(js, /if \(result\.training_progress\?\.completed\) \{[\s\S]*await routeAfterCompletedAcademyTraining\(\)[\s\S]*\}/, 'completed academy training should use the event-aware return route instead of unconditionally opening the academy map');
  assert.match(js, /async function startEventFlagInteractionFromScreen\(flagId, \{ screen = 'interaction' \} = \{\}\)[\s\S]*postJson\('\/api\/event-flags\/start', \{ flag_id: flagId, screen \}\)[\s\S]*showScreen\(screen\)[\s\S]*await ensureOpeningUtterance\(\)/, 'manual event starts should still use the immediate screen-start path for the Event tab interaction route');
  assert.match(js, /function createTrainingOptionCard\(training, \{ compact = false \} = \{\}\)/, 'training card renderer should support a compact academy-card mode');
  assert.match(js, /if \(!compact\) \{[\s\S]*training-effect-preview[\s\S]*training-weekday-bonus[\s\S]*description[\s\S]*\}/, 'detailed probability/effect text should only be appended outside compact academy cards');
  assert.match(js, /#academy-training-options[\s\S]*createTrainingOptionCard\(training, \{ compact: true \}\)/, 'academy 鍛錬 choices should render compact title-only cards');
  assert.match(html, /id="academy-training-result"[\s\S]*鍛錬状況[\s\S]*訓練可能回数: 残り 6 \/ 6[\s\S]*現在の曜日: 光曜（光）/, 'academy 鍛錬 right panel should use the former result area for remaining training count and current weekday');
  assert.match(js, /function renderAcademyTrainingProgressSummary\(progress = currentTrainingProgress\)[\s\S]*#academy-training-result[\s\S]*訓練可能回数: 残り \${remaining} \/ \${normalizedProgress\.actions_limit}[\s\S]*現在の曜日: \${day\.name}（\${day\.element_label}）/, 'academy 鍛錬 result area should render remaining action count and current weekday instead of effect details');
  assert.match(js, /function renderTrainingProgress\(progress = currentTrainingProgress\)[\s\S]*renderTrainingWeekday\(trainingDayForProgress\(currentTrainingProgress\)\)[\s\S]*renderAcademyTrainingProgressSummary\(currentTrainingProgress\)/, 'academy 鍛錬 progress summary should update whenever training progress changes');
  assert.match(js, /function renderTrainingResult\(result\) \{[\s\S]*document\.querySelectorAll\('#training-result'\)/, 'training result rendering should be limited to the legacy training result area');
  assert.doesNotMatch(js, /function renderTrainingResult\(result\) \{[\s\S]*document\.querySelectorAll\('#training-result, #academy-training-result'\)/, 'academy 鍛錬 should not replace the progress summary with detailed result effects');
  assert.match(js, /result\.training_progress\?\.completed[\s\S]*routeAfterCompletedAcademyTraining\(\)/, 'completed 鍛錬 should route through the event-aware loading path instead of directly showing the map');
  assert.doesNotMatch(js, /result\.training_progress\?\.completed[\s\S]*showScreen\('academy-map'\)/, 'completed 鍛錬 must not bypass readiness-gated loading');
  assert.match(css, /#academy-loading-screen\.active[\s\S]*display:\s*grid/, 'loading screen should render as a full-screen grid while active');
  assert.match(css, /\.academy-loading-image-frame img[\s\S]*object-fit:\s*cover/, 'loading image should fill the loading visual frame');
  assert.match(css, /body:has\(#academy-training-screen\.active\) \.layout\s*\{[\s\S]*height:\s*calc\(100dvh - var\(--runtime-topbar-height, 88px\)\)[\s\S]*padding:\s*12px 20px 8px[\s\S]*overflow:\s*hidden/, 'academy training layout should be bounded by the actual viewport height like the academy map, not by a natural content or floor height');
  assert.match(css, /#academy-training-screen\.active\s*\{[\s\S]*display:\s*grid[\s\S]*height:\s*100%[\s\S]*min-height:\s*0[\s\S]*overflow:\s*hidden/, 'academy training active screen should fill the viewport-bound layout so Discipline Menu height follows screen size');
  assert.doesNotMatch(css, /#academy-training-screen\.active\s*\{[^}]*height:\s*max\(420px, calc\(100dvh/, 'academy training must not keep a 420px floor that prevents Discipline Menu from tracking small viewport heights');
  assert.match(css, /\.academy-training-shell\s*\{[\s\S]*box-sizing:\s*border-box[\s\S]*height:\s*100%[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\)[\s\S]*overflow:\s*hidden/, 'academy training shell should fill the active screen height instead of hard-coding its own viewport height');
  assert.match(css, /\.academy-map-shell\.academy-training-shell\s*\{[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\)[\s\S]*padding:\s*12px/, 'academy training shell should explicitly override the later generic academy-map-shell two-row template that caps Discipline Menu height');
  assert.match(html, /class="academy-training-panel-heading academy-training-status-heading"[\s\S]*Player Parameters[\s\S]*id="academy-training-status-title">主人公の現在値/, 'academy training player-parameter heading should share the same panel-heading structure as the discipline menu');
  assert.match(css, /\.academy-training-board\s*\{[\s\S]*--academy-training-panel-padding:\s*clamp\(8px, 1\.6dvh, 14px\)[\s\S]*--academy-training-panel-gap:\s*clamp\(5px, 0\.9dvh, 10px\)[\s\S]*--academy-training-panel-heading-height:\s*clamp\(44px, 8dvh, 70px\)/, 'academy training panel padding and heading height should respond to viewport height');
  assert.match(css, /\.academy-training-menu-panel\s*\{[\s\S]*grid-template-rows:\s*var\(--academy-training-panel-heading-height\) minmax\(0, 1fr\)[\s\S]*gap:\s*var\(--academy-training-panel-gap\)/, 'discipline menu should reserve viewport-responsive heading height before filling the remaining card board');
  assert.match(css, /\.academy-training-status-panel\s*\{[\s\S]*grid-template-rows:\s*var\(--academy-training-panel-heading-height\) minmax\(0, 1fr\) auto[\s\S]*gap:\s*var\(--academy-training-panel-gap\)/, 'player parameters panel should use the same viewport-responsive heading height as the discipline menu');
  assert.match(css, /\.academy-training-menu-panel > \.academy-training-panel-heading,\n\.academy-training-status-panel > \.academy-training-panel-heading\s*\{[\s\S]*height:\s*var\(--academy-training-panel-heading-height\)[\s\S]*font-size:\s*clamp\(11px, 1\.4dvh, 12px\)/, 'both academy training headings should shrink and grow with viewport height instead of natural content height');
  assert.match(css, /\.training-options\.academy-training-options\s*\{[\s\S]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)[\s\S]*grid-template-rows:\s*repeat\(4, minmax\(0, 1fr\)\)[\s\S]*aspect-ratio:\s*5 \/ 4[\s\S]*justify-self:\s*center[\s\S]*overflow:\s*hidden/, 'academy training choices should use a centered fixed 5 by 4 square-card board instead of stretching cards into horizontal strips');
  assert.match(css, /\.academy-training-options \.training-card-image\s*\{[\s\S]*position:\s*absolute[\s\S]*inset:\s*0[\s\S]*width:\s*100%[\s\S]*height:\s*100%[\s\S]*aspect-ratio:\s*1 \/ 1[\s\S]*object-fit:\s*cover/, 'academy training card images should keep the generated square image ratio while filling the whole card');
  assert.match(css, /\.academy-training-options \.training-option-card\.compact[\s\S]*grid-template-rows:\s*minmax\(0, 1fr\)[\s\S]*aspect-ratio:\s*1 \/ 1[\s\S]*min-height:\s*0[\s\S]*overflow:\s*hidden/, 'compact academy cards should match the square generated-card image ratio without bottom slack');
  assert.match(css, /\.academy-training-options \.training-option-card\.compact \.training-card-body\s*\{[\s\S]*position:\s*relative[\s\S]*align-self:\s*end[\s\S]*background:\s*linear-gradient/, 'academy training card titles should overlay the image at the bottom rather than reserving blank space below it');
  assert.match(css, /\.academy-training-options \.training-option-card\.compact \.training-icon\s*\{[\s\S]*display:\s*none/, 'academy card-image UI should not keep the old sprite icon as the primary visual');
  assert.doesNotMatch(css, /\.academy-training-options \.training-option-card\.compact::after/, 'academy card-image UI should not add the unwanted bottom-right decorative mark');
  assert.match(css, /\.academy-training-options \.training-option-card\.compact \.training-card-body small,[\s\S]*\.academy-training-options \.training-option-card\.compact \.training-effect-preview,[\s\S]*\.academy-training-options \.training-option-card\.compact \.training-weekday-bonus\s*\{[\s\S]*display:\s*none/, 'compact academy cards should hide explanatory effect/probability text');
});

test('academy room screen shows player parameters buddy money and a scrollable item list in academy visual style', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const js = await readFile(path.join(root, 'app.js'), 'utf8');
  const css = await readFile(`${root}/style.css`, 'utf8');

  const statusBlock = html.match(/<section id="academy-room-screen"[\s\S]*?<section id="training-screen"/)?.[0] ?? '';
  assert.match(html, /data-screen="academy-training"[\s\S]*>鍛錬<[\s\S]*data-screen="academy-room"[\s\S]*>自室</, 'academy room tab should sit to the right of academy training');
  assert.match(statusBlock, /class="academy-map-shell academy-room-shell"[\s\S]*class="academy-room-hero-copy"[\s\S]*id="academy-room-title">自室<[\s\S]*class="academy-map-status-card academy-room-action-card"[\s\S]*Actions[\s\S]*次の行動を選びます[\s\S]*id="academy-room-start-training"[^>]*class="academy-map-action-button secondary"[\s\S]*id="academy-room-open-load"[^>]*class="academy-map-action-button secondary"/, 'academy room action buttons should keep the balanced header while using the same secondary button contract as the conversation-session buttons');
  assert.match(statusBlock, /class="academy-map-status-card academy-room-action-card"[\s\S]*class="academy-room-action-header-row"[\s\S]*class="academy-room-action-copy"[\s\S]*Actions[\s\S]*次の行動を選びます[\s\S]*class="academy-room-week-row"[\s\S]*id="academy-room-week"[\s\S]*id="academy-room-start-training"[\s\S]*id="academy-room-skip-training"[\s\S]*id="academy-room-open-load"[\s\S]*class="panel-title-row academy-room-player-title-row"[\s\S]*id="academy-room-player-parameters"[^>]*class="academy-training-player-parameters training-player-parameters"[\s\S]*class="academy-room-panel app-card academy-room-relationship-panel"[\s\S]*id="academy-room-buddy-title"[\s\S]*id="academy-room-buddy-card"[\s\S]*id="academy-room-buddy-empty"[\s\S]*id="academy-room-enemy-title"[\s\S]*id="academy-room-enemy-list"[\s\S]*academy-room-money-section[\s\S]*class="panel-title-row academy-room-inventory-subtitle-row academy-room-money-row"[\s\S]*id="academy-room-money"[\s\S]*academy-room-items-section[\s\S]*id="academy-room-inventory-items"/, 'academy room should keep the current-week summary adjacent to the action copy inside the room action card while preserving the shared player-parameter, relationship, and inventory structure');
  assert.doesNotMatch(statusBlock, /id="academy-room-inventory-title"|現在の所持金/, 'academy room inventory should drop the outer inventory heading and the extra money helper label');
  assert.doesNotMatch(statusBlock, /class="academy-room-panel app-card academy-room-buddy-panel"/, 'academy room should not keep a separate narrow buddy panel');
  assert.match(js, /'academy-room': document\.querySelector\('#academy-room-screen'\)/, 'browser should register the academy room screen');
  assert.match(js, /if \(name === 'academy-room'\) renderAcademyRoomScreen\(\)/, 'switching to the academy room tab should render fresh room data');
  assert.match(js, /function renderTrainingPlayerParameters\(parameters = \{\}\) \{[\s\S]*'#training-player-parameters'[\s\S]*'#academy-training-player-parameters'[\s\S]*'#academy-room-player-parameters'[\s\S]*\}/, 'training/player-parameter helper should also render the academy room panel so the room uses the same parameter mechanism as the academy training right pane');
  assert.match(js, /function academyRoomDisplayedWeekNumber\(state = currentRuntimeState\) \{[\s\S]*elapsed_weeks[\s\S]*\+ 1[\s\S]*\}/, 'academy room should derive the play-facing displayed week from currentRuntimeState.elapsed_weeks + 1');
  assert.match(js, /function academyRoomDisplayedWeekLabel\(state = currentRuntimeState\) \{[\s\S]*第\$\{academyRoomDisplayedWeekNumber\(state\)\}週[\s\S]*\}/, 'academy room should format the displayed week as 第N週');
  assert.match(js, /function renderAcademyRoomScreen\(\)[\s\S]*#academy-room-week[\s\S]*academyRoomDisplayedWeekLabel\(currentRuntimeState\)[\s\S]*#academy-room-money[\s\S]*renderTrainingPlayerParameters\(currentWorld\?\.player_parameters \?\? \{\}\)[\s\S]*renderAcademyRoomBuddy\(\)[\s\S]*renderAcademyRoomEnemies\(\)[\s\S]*renderAcademyRoomInventoryItems\(currentInventory\)/, 'academy room render should update the current-week label before filling money, parameters, buddy, enemies, and inventory');
  assert.match(js, /async function refresh\(\) \{[\s\S]*currentRuntimeState = state \?\? currentRuntimeState;[\s\S]*renderTrainingProgress\(currentTrainingProgress\);[\s\S]*if \(screens\['academy-room'\]\?\.classList\.contains\('active'\)\) renderAcademyRoomScreen\(\);/, 'refresh should rerender academy-room after currentRuntimeState updates so the room week display cannot stay stale');
  assert.match(js, /function renderAcademyRoomBuddy\(\)[\s\S]*#academy-room-buddy-card[\s\S]*#academy-room-buddy-empty[\s\S]*selectedAcademyBuddyCharacterId\(\)[\s\S]*selectableCharacters\.find[\s\S]*card\.classList\.add\('is-empty'\)[\s\S]*emptyContainer\.replaceChildren\(\)[\s\S]*card\.replaceChildren\(empty\)/, 'academy room buddy card should collapse into an inline empty state instead of leaving a blank reserved card above the message');
  assert.match(js, /function renderAcademyRoomEnemies\(\)[\s\S]*selectedAcademyEnemyCharacterIds\(\)[\s\S]*#academy-room-enemy-count[\s\S]*#academy-room-enemy-list/, 'academy room enemy list should use the same current-enemy resolver as academy map red pins');
  assert.match(js, /function renderAcademyRoomInventoryItems\(inventory = currentInventory\)[\s\S]*#academy-room-item-count[\s\S]*items\.map[\s\S]*className = 'academy-room-item-row'[\s\S]*item\.stat_effect[\s\S]*useInventoryItem\(item\.item_id\)/, 'academy room inventory should render item rows, item count, and use buttons for usable items');
  assert.match(css, /#academy-room-screen\.active[\s\S]*display:\s*grid[\s\S]*height:\s*100%[\s\S]*\.academy-room-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(280px, 0\.9fr\) minmax\(320px, 1fr\) minmax\(360px, 1\.08fr\)[\s\S]*\.academy-room-player-panel,[\s\S]*\.academy-room-relationship-panel,[\s\S]*\.academy-room-inventory-panel[\s\S]*box-sizing:\s*border-box[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\)[\s\S]*#academy-room-player-parameters\s*\{[\s\S]*overflow-y:\s*auto[\s\S]*\.academy-room-relationship-list[\s\S]*overflow-y:\s*auto[\s\S]*\.academy-room-inventory-items\s*\{[\s\S]*overflow-y:\s*auto[\s\S]*max-height:\s*none/, 'academy room player, relationship, and item regions should each use border-box internal scrolling inside the height-aware layout');
  assert.match(css, /\.academy-room-money-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto[\s\S]*align-items:\s*end[\s\S]*gap:\s*10px/, 'academy room money row should become a flat title row instead of a separate inset box');
  assert.match(css, /#academy-room-money\s*\{[\s\S]*justify-self:\s*end[\s\S]*text-align:\s*right[\s\S]*font-size:\s*24px/, 'academy room money amount should be right-aligned text instead of left-aligned content inside an inner card');
  assert.doesNotMatch(css, /\.academy-room-money-block\s*\{/, 'academy room money should no longer keep the old inset money block styling');
  assert.match(css, /\.academy-training-player-parameters\s*\{[\s\S]*min-height:\s*0[\s\S]*overflow:\s*auto/, 'academy room should be able to inherit the same academy-training player-parameter scroll container contract');
  assert.doesNotMatch(css, /#academy-room-player-parameters\s*\{[\s\S]*margin-top:\s*6px|#academy-room-player-parameters \.character-parameter-section\s*\{|#academy-room-player-parameters \.character-parameter-group\s*\{|#academy-room-player-parameters \.character-parameter-item\s*\{/, 'academy room should stop carrying a separate parameter-density override once it reuses the academy-training right-panel mechanism');
  assert.match(css, /\.academy-room-hero-copy[\s\S]*max-width:[\s\S]*padding:[\s\S]*\.academy-room-action-card\s*\{[\s\S]*align-content:\s*start[\s\S]*\.academy-room-action-header-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto[\s\S]*align-items:\s*end[\s\S]*gap:\s*18px[\s\S]*\.academy-room-week-row\s*\{[\s\S]*justify-items:\s*end[\s\S]*text-align:\s*right[\s\S]*gap:\s*6px[\s\S]*\.academy-room-action-copy\s*\{[\s\S]*justify-items:\s*start[\s\S]*align-content:\s*end[\s\S]*\.academy-room-action-card \.academy-room-action-copy > span\s*\{[\s\S]*font-size:\s*20px[\s\S]*font-weight:\s*600[\s\S]*letter-spacing:\s*0\.04em[\s\S]*line-height:\s*1\.1[\s\S]*#academy-room-week\s*\{[\s\S]*font-size:\s*24px[\s\S]*letter-spacing:\s*0\.04em[\s\S]*\.academy-room-buddy-card\.is-empty\s*\{[\s\S]*min-height:\s*0[\s\S]*padding:\s*0[\s\S]*border:\s*none[\s\S]*background:\s*none[\s\S]*\.academy-room-buddy-card\.is-empty \.panel-help[\s\S]*white-space:\s*nowrap/, 'academy room action card should keep the current-week summary adjacent to the action copy while preserving the existing hero and empty-buddy layout behavior');
  assert.match(css, /\.academy-room-action-card \.academy-map-action-button\s*\{[\s\S]*width:\s*100%[\s\S]*min-width:\s*126px[\s\S]*max-width:\s*none[\s\S]*padding:\s*10px 13px[\s\S]*border-radius:\s*999px[\s\S]*border:\s*1px solid rgba\(211, 180, 105, 0\.54\)[\s\S]*background:[\s\S]*rgba\(255, 248, 229, 0\.16\)[\s\S]*rgba\(35, 49, 77, 0\.82\)[\s\S]*color:\s*#fff8e6/, 'academy room action buttons should use the same dark gold conversation-session button design while stretching to the room card width');
});

test('slot-load screen hides the topbar and uses a viewport-fit internal-scroll slot list', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const js = await readFile(path.join(root, 'app.js'), 'utf8');
  const css = await readFile(`${root}/style.css`, 'utf8');

  const slotLoadBlock = html.match(/<section id="slot-load-screen"[\s\S]*?<section id="world-screen"/)?.[0] ?? '';
  assert.match(slotLoadBlock, /class="slot-load-shell[^"]*"[\s\S]*class="screen-heading slot-load-screen-heading"[\s\S]*class="app-card slot-load-card"[\s\S]*id="slot-load-list" class="continuity-record-list slot-load-list"/, 'slot-load should use a dedicated shell/card/list structure so viewport-fit sizing does not depend on the generic continuity list contract');
  assert.match(slotLoadBlock, /id="slot-load-resume-play"[^>]*>プレイに戻る<[^]*id="back-to-title-screen"[^>]*>タイトルに戻る</, 'slot-load action row should place プレイに戻る to the left of タイトルに戻る');

  assert.match(js, /const screens = \{[\s\S]*'slot-load': document\.querySelector\('#slot-load-screen'\)/, 'browser should keep slot-load as a registered first-class screen');
  assert.match(js, /function showScreen\(name, \{ rerollAcademyMap = false \} = \{\}\) \{[\s\S]*document\.body\.classList\.toggle\('title-screen-active', name === 'title'\)[\s\S]*document\.body\.classList\.toggle\('slot-load-screen-active', name === 'slot-load'\)/, 'slot-load should toggle a dedicated body state so the topbar can be hidden only on the load screen');
  assert.match(js, /let currentActiveSlotId = null;\s*let slotLoadCanResumePlay = false;/, 'browser should track both the active slot and the load-screen entry context for slot-load resume availability');
  assert.match(slotLoadBlock, /<dialog id="slot-load-delete-confirm-dialog" class="interaction-detail-dialog[^\"]*" aria-labelledby="slot-load-delete-confirm-title">[\s\S]*class="interaction-detail-card[^\"]*">[\s\S]*id="slot-load-delete-confirm-title">セーブデータ削除確認<\/[hH]3>[\s\S]*スロットを削除しますか？[\s\S]*id="slot-load-delete-confirm-submit"[^>]*>削除する<[\s\S]*id="slot-load-delete-confirm-cancel"[^>]*>削除しない</, 'slot-load should include a shared-dialog confirmation modal with the requested delete copy');
  assert.match(js, /let pendingDeleteSlotId = null;/, 'browser should track which slot is awaiting delete confirmation');
  assert.match(js, /function openDeleteSlotDialog\(slotId\) \{[\s\S]*pendingDeleteSlotId = slotId;[\s\S]*document\.body\.classList\.add\('interaction-detail-backdrop'\);[\s\S]*dialog\.showModal\(\)/, 'slot delete should open a native shared dialog and remember the pending slot');
  assert.match(js, /function closeDeleteSlotDialog\(\) \{[\s\S]*pendingDeleteSlotId = null;[\s\S]*dialog\.close\(\)/, 'slot delete cancel path should clear pending state and close the dialog');
  assert.match(js, /async function confirmDeleteSlot\(\) \{[\s\S]*if \(!pendingDeleteSlotId\) return;[\s\S]*const slotId = pendingDeleteSlotId;[\s\S]*closeDeleteSlotDialog\(\);[\s\S]*await deleteSpecificSlot\(slotId\);[\s\S]*\}/, 'slot delete confirm should be the only path that forwards the remembered slot into deleteSpecificSlot');
  assert.match(js, /function canResumeFromSlotLoad\(\) \{[\s\S]*return slotLoadCanResumePlay && Boolean\(currentActiveSlotId\);[\s\S]*\}/, 'slot-load resume availability should require both an active slot and a play-resumable load-screen entry context');
  assert.match(js, /function updateSlotLoadResumeButton\(\) \{[\s\S]*#slot-load-resume-play[\s\S]*disabled = !canResumeFromSlotLoad\(\)/, 'slot-load should actively synchronize the resume button disabled state');
  assert.match(js, /async function refreshSaveSlots\(\) \{[\s\S]*currentActiveSlotId = response\.active_slot_id \?\? null;[\s\S]*updateSlotLoadResumeButton\(\)/, 'slot refresh should update active-slot knowledge before syncing the resume button');
  assert.match(js, /remove\.addEventListener\('click', \(\) => openDeleteSlotDialog\(slot\.slot_id\)\)/, 'slot card delete button should open the confirmation dialog instead of deleting immediately');
  assert.doesNotMatch(js, /remove\.addEventListener\('click', \(\) => deleteSpecificSlot\(slot\.slot_id\)\.catch\(reportError\)\)/, 'slot card delete button must no longer call deleteSpecificSlot directly');
  assert.match(js, /#slot-load-delete-confirm-submit[\s\S]*addEventListener\('click', \(\) => confirmDeleteSlot\(\)\.catch\(reportError\)\)/, 'delete confirmation submit button should be wired through the confirm helper');
  assert.match(js, /#slot-load-delete-confirm-cancel[\s\S]*addEventListener\('click', \(\) => closeDeleteSlotDialog\(\)\)/, 'delete confirmation cancel button should be wired through the close helper');
  assert.match(js, /#slot-load-delete-confirm-dialog'\)\.addEventListener\('close', \(\) => \{[\s\S]*pendingDeleteSlotId = null;[\s\S]*document\.body\.classList\.remove\('interaction-detail-backdrop'\);[\s\S]*}\)/, 'delete confirmation dialog close event should clear pending state and shared backdrop state');
  assert.match(js, /#slot-load-resume-play[\s\S]*addEventListener\('click', \(\) => resumePlayFromSlotLoad\(\)\.catch\(reportError\)\)/, 'slot-load resume button should be wired through a dedicated browser-side resume helper');
  assert.match(js, /async function resumePlayFromSlotLoad\(\) \{[\s\S]*if \(!canResumeFromSlotLoad\(\)\) return;[\s\S]*document\.body\.classList\.add\('play-mode'\);[\s\S]*showScreen\('academy-room'\);[\s\S]*\}/, 'slot-load resume should return directly to academy-room without calling the slot-load API again');
  assert.doesNotMatch(js.match(/async function resumePlayFromSlotLoad\([\s\S]*?\n}\n/)?.[0] ?? '', /\/api\/slots\/load|loadSpecificSlot\(/, 'slot-load resume must not trigger a fresh slot load');

  assert.match(css, /body\.slot-load-screen-active \.topbar\s*\{[\s\S]*display:\s*none/, 'slot-load should hide the topbar while active');
  assert.match(css, /body\.slot-load-screen-active \.layout\s*\{[\s\S]*width:\s*100%[\s\S]*max-width:\s*none[\s\S]*height:\s*100dvh[\s\S]*min-height:\s*100dvh[\s\S]*margin:\s*0[\s\S]*padding:\s*0[\s\S]*overflow:\s*hidden/, 'slot-load layout should fill the viewport like a focused entry screen once the topbar is hidden');
  assert.match(css, /#slot-load-screen\.active\s*\{[\s\S]*display:\s*grid[\s\S]*height:\s*100%[\s\S]*min-height:\s*0[\s\S]*overflow:\s*hidden/, 'slot-load active screen should fill the bounded layout height');
  assert.match(css, /\.slot-load-shell\s*\{[\s\S]*display:\s*grid[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\)[\s\S]*height:\s*100%[\s\S]*min-height:\s*0[\s\S]*overflow:\s*hidden/, 'slot-load shell should reserve heading height and give the remainder to the list card');
  assert.match(css, /\.slot-load-card\s*\{[\s\S]*display:\s*grid[\s\S]*grid-template-rows:\s*auto minmax\(0, 1fr\)[\s\S]*min-height:\s*0[\s\S]*overflow:\s*hidden/, 'slot-load card should bound the save-slot list instead of letting the whole page grow');
  assert.match(css, /\.slot-load-list\s*\{[\s\S]*max-height:\s*none[\s\S]*height:\s*100%[\s\S]*min-height:\s*0[\s\S]*overflow-y:\s*auto/, 'slot-load list should own overflow and no longer use the shared fixed-height cap');
  assert.doesNotMatch(css, /#slot-load-screen[\s\S]*\.slot-load-list[\s\S]*max-height:\s*260px/, 'slot-load must not keep the old 260px slot-list ceiling');
});

test('live public slot-load surface requires a delete confirmation dialog before deleteSpecificSlot', async () => {
  const html = await readFile(path.join(projectRoot, 'app/public/index.html'), 'utf8');
  const js = await readFile(path.join(projectRoot, 'app/public/app.js'), 'utf8');

  assert.match(html, /<dialog id="slot-load-delete-confirm-dialog" class="interaction-detail-dialog[^\"]*" aria-labelledby="slot-load-delete-confirm-title">[\s\S]*class="interaction-detail-card[^\"]*">[\s\S]*id="slot-load-delete-confirm-title">セーブデータ削除確認<\/[hH]3>[\s\S]*スロットを削除しますか？[\s\S]*id="slot-load-delete-confirm-submit"[^>]*>削除する<[\s\S]*id="slot-load-delete-confirm-cancel"[^>]*>削除しない</, 'live public index should expose the requested shared-dialog delete confirmation');
  assert.match(js, /let pendingDeleteSlotId = null;/, 'live public app should track which slot is awaiting delete confirmation');
  assert.match(js, /function openDeleteSlotDialog\(slotId\) \{[\s\S]*pendingDeleteSlotId = slotId;[\s\S]*document\.body\.classList\.add\('interaction-detail-backdrop'\);[\s\S]*dialog\.showModal\(\)/, 'live public app should open the shared dialog and remember the pending slot');
  assert.match(js, /function closeDeleteSlotDialog\(\) \{[\s\S]*pendingDeleteSlotId = null;[\s\S]*dialog\.close\(\)/, 'live public app should clear pending state when the dialog closes');
  assert.match(js, /async function confirmDeleteSlot\(\) \{[\s\S]*if \(!pendingDeleteSlotId\) return;[\s\S]*const slotId = pendingDeleteSlotId;[\s\S]*closeDeleteSlotDialog\(\);[\s\S]*await deleteSpecificSlot\(slotId\);[\s\S]*\}/, 'live public app should route confirmed delete through deleteSpecificSlot only after confirmation');
  assert.match(js, /remove\.addEventListener\('click', \(\) => openDeleteSlotDialog\(slot\.slot_id\)\)/, 'live public slot delete button should open the dialog instead of deleting immediately');
  assert.doesNotMatch(js, /remove\.addEventListener\('click', \(\) => deleteSpecificSlot\(slot\.slot_id\)\.catch\(reportError\)\)/, 'live public slot delete button must not call deleteSpecificSlot directly');
});

test('shop screen keeps map return in the heading, uses equal columns, and removes duplicate money from the catalog column', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const js = await readFile(path.join(root, 'app.js'), 'utf8');
  const css = await readFile(`${root}/style.css`, 'utf8');

  const shopBlock = html.match(/<section id="shop-screen"[\s\S]*?<section id="debug-screen"/)?.[0] ?? '';
  assert.match(shopBlock, /class="shop-shell"[\s\S]*class="screen-heading shop-screen-heading"[\s\S]*class="shop-heading-row"[\s\S]*class="shop-heading-copy"[\s\S]*class="shop-heading-actions"[\s\S]*id="shop-back-to-map"/, 'shop screen should keep the academy-map return action in a dedicated heading action area');
  assert.match(shopBlock, /class="shop-grid"[\s\S]*class="shop-column shop-inventory-column[^"]*"[\s\S]*id="shop-inventory-money"[\s\S]*id="shop-inventory-items"[\s\S]*class="shop-column shop-catalog-column[^"]*"[\s\S]*id="shop-items"/, 'shop screen should keep dedicated inventory and catalog columns');
  assert.doesNotMatch(shopBlock, /id="shop-money"/, 'catalog column should no longer duplicate the player money display');
  assert.match(shopBlock, /各種霊薬を取り揃えている学院購買部。必要な道具や品物を売買できる。/, 'catalog column should use the requested academy-store description');
  assert.match(js, /function academyMapShopNode\(\) \{[\s\S]*description: '各種霊薬を取り揃えている学院購買部。必要な道具や品物を売買できる。'[\s\S]*visible_situation: '各種霊薬を取り揃えている学院購買部。必要な道具や品物を売買できる。'/, 'academy-map shop detail preview should reuse the requested academy-store description');
  assert.match(html, /id="economy-message-box" class="economy-message-box" role="status" aria-live="polite"/, 'economy actions should expose a global message box surface');

  assert.match(js, /function renderShopInventoryColumn\(inventory = currentInventory\)[\s\S]*#shop-inventory-money[\s\S]*#shop-inventory-items[\s\S]*sellInventoryItem\(item\.item_id\)/, 'shop inventory column should render money, owned items, and sell actions from current inventory');
  assert.match(js, /function renderShop\(shop = currentShop\)[\s\S]*#shop-money-title[\s\S]*#shop-items[\s\S]*buyShopItem\(item\.item_id\)/, 'catalog renderer should keep the academy-store title and item list without depending on a duplicate money field');
  assert.doesNotMatch(js, /querySelector\('\#shop-money'\)|querySelector\("\#shop-money"\)/, 'catalog renderer should not query the removed duplicate money field');
  assert.match(js, /function refreshEconomy\(\)[\s\S]*renderInventory\(inventory\)[\s\S]*renderShopInventoryColumn\(inventory\)[\s\S]*renderShop\(shop\)/, 'economy refresh should keep legacy inventory, shop inventory column, and catalog in sync');
  assert.match(js, /function showEconomyMessage\(message\)[\s\S]*#economy-message-box[\s\S]*classList\.add\('visible'\)/, 'economy message helper should drive the global message box');
  assert.match(js, /async function buyShopItem\(itemId\)[\s\S]*showEconomyMessage\(`\$\{result\.item\.name \?\? result\.item\.item_id\}を\$\{moneyText\(result\.item\.buy_price\)\}で購入しました。`\)/, 'buy flow should announce the purchased item and price');
  assert.match(js, /async function sellInventoryItem\(itemId\)[\s\S]*showEconomyMessage\(`\$\{result\.item\.name \?\? result\.item\.item_id\}を\$\{moneyText\(result\.item\.sell_price\)\}で売却しました。`\)/, 'sell flow should announce the sold item and price');

  assert.match(css, /body:has\(#shop-screen\.active\) \.layout\s*\{[\s\S]*height:\s*calc\(100dvh - var\(--runtime-topbar-height, 88px\)\)[\s\S]*overflow:\s*hidden/, 'shop screen should pin the main layout to the viewport height like other academy surfaces');
  assert.match(css, /#shop-screen\.active\s*\{[\s\S]*display:\s*grid[\s\S]*height:\s*100%[\s\S]*min-height:\s*0/, 'active shop screen should fill the bounded layout height');
  assert.match(css, /\.shop-heading-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) auto[\s\S]*align-items:\s*start/, 'shop heading should reserve a right-side action lane for the map return button');
  assert.match(css, /\.shop-heading-actions\s*\{[^}]*justify-content:\s*flex-end[^}]*align-items:\s*flex-start[^}]*padding-top:\s*28px[^}]*padding-right:\s*24px[^}]*\}/, 'heading action lane should absorb the inward top-right inset so the button stays inside the popup bounds without a custom base transform');
  assert.doesNotMatch(css, /\.shop-back-button\s*\{[^}]*transform:/, 'map return button should not override the shared academy-map button transform contract with its own base transform');
  assert.match(css, /\.shop-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\) minmax\(0, 1fr\)[\s\S]*min-height:\s*0/, 'shop grid should use equal-width two-column proportions');
  assert.match(css, /\.shop-column\s*\{[\s\S]*grid-template-rows:\s*auto auto minmax\(0, 1fr\)[\s\S]*min-height:\s*0/, 'each shop column should reserve heading rows and let only the item area stretch');
  assert.match(css, /#shop-inventory-items[\s\S]*overflow-y:\s*auto[\s\S]*#shop-items[\s\S]*overflow-y:\s*auto/, 'both trade lists should scroll internally instead of growing the full page');
  assert.match(css, /@media \(max-width: 980px\) \{[\s\S]*\.shop-heading-row\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)[\s\S]*\.shop-heading-actions\s*\{[\s\S]*justify-content:\s*flex-start[\s\S]*\.shop-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(0, 1fr\)/, 'narrow screens should stack the heading action and collapse the shop grid to one column');
  assert.match(css, /\.economy-message-box\s*\{[\s\S]*position:\s*fixed[\s\S]*opacity:\s*0[\s\S]*transform:[\s\S]*\.economy-message-box\.visible\s*\{[\s\S]*opacity:\s*1/, 'economy message box should be an animated fixed overlay that becomes visible on trade actions');
});

test('debug screen exposes buddy and enemy relationship flag controls', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const js = await readFile(path.join(root, 'app.js'), 'utf8');
  const debugBlock = html.match(/<section id="debug-screen"[\s\S]*<\/main>/)?.[0] ?? '';

  assert.match(debugBlock, /aria-label="relationship flags"[\s\S]*id="relationship-character-select"[\s\S]*id="set-debug-buddy"[\s\S]*id="clear-debug-buddy"[\s\S]*id="add-debug-enemy"[\s\S]*id="remove-debug-enemy"[\s\S]*id="clear-debug-enemies"[\s\S]*id="relationship-debug-status"/, 'debug screen should provide direct buddy/enemy flag controls and a current-state summary');
  assert.match(debugBlock, /経過週数[\s\S]*id="debug-elapsed-weeks"[\s\S]*id="set-debug-weeks"[\s\S]*id="debug-weeks-status"/, 'debug screen should expose direct elapsed-weeks editing controls for graduation testing');
  assert.match(js, /function renderRelationshipDebugControls\(\)[\s\S]*#relationship-character-select[\s\S]*currentRuntimeState\?\.current_buddy_character_id[\s\S]*current_enemy_character_ids/, 'browser should render relationship debug controls from current runtime state');
  assert.match(js, /function renderRelationshipDebugControls\(\)[\s\S]*document\.querySelector\('#debug-elapsed-weeks'\)[\s\S]*document\.querySelector\('#debug-weeks-status'\)[\s\S]*currentRuntimeState\?\.elapsed_weeks/, 'browser should render elapsed-weeks debug controls from current runtime state alongside relationship debug info');
  assert.match(js, /async function setDebugRelationships\([\s\S]*postJson\('\/api\/debug\/relationships'[\s\S]*buddy_character_id[\s\S]*enemy_character_ids/, 'browser relationship controls should persist through the debug relationships API');
  assert.match(js, /async function setDebugElapsedWeeks\([\s\S]*postJson\('\/api\/debug\/weeks'[\s\S]*elapsed_weeks/, 'browser elapsed-weeks controls should persist through the debug weeks API');
  for (const selector of ['#set-debug-buddy', '#clear-debug-buddy', '#add-debug-enemy', '#remove-debug-enemy', '#clear-debug-enemies']) {
    assert.match(js, new RegExp(`${selector.replace('#', '\\#')}[\\s\\S]*addEventListener`), `${selector} should be wired`);
  }
});

test('field and interaction controls are placed in the requested play/debug columns', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<div id="field-left-column"[\s\S]*id="field-route-list"[\s\S]*id="field-location-detail-dialog"[\s\S]*<div id="field-right-column"[\s\S]*id="character-selection-list"/, 'field left column should contain movement choices and a location detail popup, while right column contains character selection');
  const fieldBlock = html.match(/<section id="field-screen"[\s\S]*?<section id="interaction-screen"/)?.[0] ?? '';
  assert.doesNotMatch(fieldBlock, /id="current-location-card"|id="background-panel"/, 'field should not keep the old upper-left current-location panel inline');
  assert.match(fieldBlock, /id="field-current-location-button"[\s\S]*id="field-location-detail-dialog"[\s\S]*id="field-location-detail-title">現在地<[\s\S]*id="field-location-detail-image"[\s\S]*id="field-location-detail-text"/, 'field current location details should live in a popup opened from the movement panel');
  assert.match(fieldBlock, /id="selected-character-name-button"[\s\S]*id="field-character-detail-dialog"[\s\S]*id="field-character-detail-title">選択中のキャラ<[\s\S]*id="character-prompt-description"[\s\S]*id="character-speaking-basis"[\s\S]*id="character-memory-records"[\s\S]*id="character-skill-records"[\s\S]*id="character-work-records"/, 'field selected character name should open a popup containing description, speaking style, and character records');
  const fieldSelectionBlock = fieldBlock.match(/<section class="character-select-panel app-card"[\s\S]*?<dialog id="field-character-detail-dialog"/)?.[0] ?? '';
  assert.doesNotMatch(fieldSelectionBlock, /id="character-prompt-description"|id="character-speaking-basis"|id="character-memory-records"|id="character-skill-records"|id="character-work-records"/, 'field character details should not stay inline under the selection list');
  const interactionBlock = html.match(/<section id="interaction-screen"[\s\S]*?<section id="debug-screen"/)?.[0] ?? '';
  assert.match(interactionBlock, /<figure class="standee-frame app-card">[\s\S]*id="interaction-location-preview"[\s\S]*id="interaction-location-image"[\s\S]*id="interaction-location-name-button"[\s\S]*id="character-standee"[\s\S]*id="interaction-character-name-button"/, 'left interaction panel should show only current location image/name above the selected character image/name');
  assert.match(interactionBlock, /id="interaction-location-detail-dialog" class="interaction-detail-dialog field-location-detail-dialog"[\s\S]*id="interaction-location-detail-image"[\s\S]*id="interaction-location-detail-text"/, 'interaction location detail popup should use the same large stage image dialog sizing and description as the field movement detail');
  assert.match(interactionBlock, /id="interaction-character-detail-dialog"[\s\S]*id="interaction-character-detail-title">選択中のキャラ<[\s\S]*id="interaction-character-detail-standee"[\s\S]*id="interaction-character-description"[\s\S]*id="interaction-character-parameters"/, 'character description and parameters should live in a popup dialog with the selected character scene standee on the left');
  const fieldCharacterDialog = fieldBlock.match(/<dialog id="field-character-detail-dialog"[\s\S]*?<\/dialog>/)?.[0] ?? '';
  assert.match(fieldCharacterDialog, /class="character-detail-layout"[\s\S]*id="field-character-detail-standee"[\s\S]*id="character-prompt-description"[\s\S]*id="character-speaking-basis"/, 'field character detail popup should show the scene standee to the left of editable information');
  const leftPanelBlock = interactionBlock.match(/<figure class="standee-frame app-card">[\s\S]*?<\/figure>/)?.[0] ?? '';
  assert.doesNotMatch(leftPanelBlock, /id="interaction-character-description"|id="interaction-character-parameters"/, 'left interaction panel should not render character details under the name');
  assert.match(interactionBlock, /<label class="chat-composer">\s*あなた\s*<textarea id="player-input"/, 'player input label should be play-facing Japanese text');
  assert.doesNotMatch(interactionBlock, /player input/, 'old small debug-like player input label should not remain in the play interaction panel');
  assert.doesNotMatch(interactionBlock, /INTERACTION|<h2 id="interaction-title">キャラクターと話す<\/h2>/, 'old interaction title block should be removed so the play box can move upward');
  assert.doesNotMatch(interactionBlock, /id="provider-select"|id="refresh-prompt"|id="conversation-log"/, 'provider, prompt refresh, and result log should not stay in the play interaction panel');
  const debugBlock = html.match(/<section id="debug-screen"[\s\S]*<\/main>/)?.[0] ?? '';
  assert.doesNotMatch(debugBlock, /runtime_state|asset resolver|continuity record status|Interaction Debug/, 'debug screen should remove the requested obsolete panels');
  assert.doesNotMatch(debugBlock, /id="state-json"|id="asset-json"|id="record-status"|id="provider-select"|id="refresh-prompt"|id="prompt-preview"|id="conversation-log"|id="work-record-recall-debug"/, 'debug screen should not keep obsolete runtime, asset, continuity, or interaction debug controls');
  assert.match(debugBlock, /id="set-all-flags-on"[\s\S]*id="flag-title-list"[\s\S]*id="llm-request-list"[\s\S]*id="save-slot-id"/, 'debug screen should keep flags with the all-on control at the top, recent LLM requests, and Save\/Load only');
  assert.match(html, /id="flag-detail-dialog"[\s\S]*id="toggle-flag-active"[\s\S]*id="toggle-flag-judgment-flow"[\s\S]*id="flag-detail-body"/, 'flag detail popup should include individual on\/off and judgment-flow toggles before details');
});

test('browser script wires field, interaction, and configured event-start routing', async () => {
  const js = await readFile(path.join(root, 'app.js'), 'utf8');

  for (const endpoint of [
    '/api/characters',
    '/api/characters/profile',
    '/api/world',
    '/api/training/run',
    '/api/event-flags',
    '/api/event-flags/set',
    '/api/event-flags/all-on',
    '/api/event-flags/all-off',
    '/api/event-flags/start',
    '/api/academy/week/start',
    '/api/debug/relationships',
    '/api/debug/weeks',
    '/api/flags/judgment-flow',
    '/api/inventory',
    '/api/shop',
    '/api/shop/buy',
    '/api/shop/sell',
    '/api/field/move',
    '/api/interaction/start',
    '/api/conversation/opening',
    '/api/records/status',
    '/api/records/reset',
    '/api/conversation',
    '/api/conversation/edit-user-message',
    '/api/conversation/stream',
    '/api/conversation/end',
    '/api/save',
    '/api/slots',
    '/api/slots/load'
  ]) {
    assert.match(js, new RegExp(endpoint.replaceAll('/', '\\/')), `missing endpoint ${endpoint}`);
  }

  assert.match(js, /renderPlayerParametersEditor/, 'world screen should render editable player parameter inputs');
  assert.match(js, /#player-name/, 'world screen should wire an editable player name input');
  assert.match(js, /player_name/, 'world settings API calls should carry the player name');
  assert.match(js, /function setPlayerParameterGroupToValue\(group, value\)/, 'world preset buttons should set every parameter in one group to the selected value');
  assert.match(js, /\[0, 25, 50, 75, 100\]/, 'world preset buttons should use 0, 25, 50, 75, and 100');
  assert.match(js, /data-parameter-preset-group/, 'browser script should wire group-specific parameter preset buttons');
  assert.match(js, /#start-field-character-from-detail/, 'field character detail popup should wire a direct conversation start button');
  assert.match(js, /const trainingOptions = \[/, 'browser script should define selectable training options');
  assert.equal([...js.matchAll(/id:\s*'[^']+'/g)].filter((match) => js.slice(Math.max(0, match.index - 120), match.index).includes('trainingOptions') || js.slice(match.index, match.index + 220).includes('effectPreview')).length >= 12, true, 'browser training list should include many selectable options');
  assert.match(js, /function renderTrainingScreen\(\)/, 'training screen should render player parameters and training choices');
  assert.match(js, /runTraining\(training\.id\)/, 'training buttons should apply the selected training');
  assert.match(js, /postJson\('\/api\/training\/run'/, 'training actions should call the training API');
  assert.match(js, /renderTrainingResult/, 'training results should show randomized increases and decreases');
  assert.match(js, /function renderInteractionCharacterParameters\(character\)/, 'interaction detail popup should render selected-character parameters');
  assert.match(js, /function characterSceneStandeeUrl\(character = activeCharacter\(\)\)/, 'browser script should resolve character standees through the canonical standee contract');
  assert.match(js, /return character\?\.standee_url \?\? '';/, 'scene standees should use the canonical standee_url field');
  assert.match(js, /const interactionStandee = document\.querySelector\('#character-standee'\);[\s\S]*interactionStandee\.src = characterSceneStandeeUrl\(selected\);[\s\S]*interactionStandee\.hidden = !interactionStandee\.src;/, 'changing selected character should refresh the main interaction standee from the canonical standee url');
  assert.match(js, /#field-character-detail-standee/, 'browser script should update the field character detail scene standee');
  assert.match(js, /#interaction-character-detail-standee/, 'browser script should update the interaction character detail scene standee');
  assert.match(js, /#interaction-character-parameters/, 'browser script should update the interaction character parameters element');
  assert.match(js, /function openInteractionLocationDetail\(\)/, 'clicking the location name should open a location detail popup');
  assert.match(js, /function openInteractionCharacterDetail\(\)/, 'clicking the character name should open a character detail popup');
  assert.match(js, /#field-current-location-button/, 'field movement panel should expose the current location as a detail popup trigger');
  assert.match(js, /#field-location-detail-title/, 'field location detail popup title should sync to the current stage name');
  assert.match(js, /function renderFieldLocationDetail\(location\)/, 'field should render the old upper-left location panel content into a detail popup');
  assert.match(js, /function openFieldLocationDetail\(\)/, 'field current location name should open the location detail popup');
  assert.match(js, /moveToLocation\(candidate\.id, \{ showDetail: true \}\)/, 'selecting a movement destination should open the destination detail popup after moving');
  assert.match(js, /#interaction-location-detail-title/, 'browser script should keep the location detail popup title synced to the current stage name');
  assert.match(js, /locationDetailTitle\.textContent = location\?\.display_name \?\? currentRuntimeState\?\.current_location_id \?\? '現在地'/, 'location detail popup title should be the current stage name');
  assert.match(js, /#interaction-location-detail-image/, 'browser script should populate the interaction location detail image element');
  assert.match(js, /function renderInteractionLocation\(location\)[\s\S]*detailImage\.style\.backgroundImage/, 'interaction location detail popup should use the same stage background as the left-panel preview');
  assert.match(js, /#interaction-location-detail-text/, 'browser script should populate the location detail text from the stage description');
  assert.match(js, /#interaction-character-detail-title/, 'browser script should keep the character detail popup title synced to the selected character name');
  assert.match(js, /characterDetailTitle\.textContent = selected\.display_name \?\? selected\.character_id/, 'character detail popup title should be the selected character name');
  assert.match(js, /#selected-character-name-button/, 'field selected character name should be clickable for the detail popup');
  assert.match(js, /#field-character-detail-title/, 'field character detail popup title should sync to the selected character name');
  assert.match(js, /fieldCharacterDetailTitle\.textContent = selected\.display_name \?\? selected\.character_id/, 'field character detail popup title should be the selected character name');
  assert.match(js, /function openFieldCharacterDetail\(\)/, 'field selected character name should open the character detail popup');
  assert.match(js, /button\.addEventListener\('click',[\s\S]*openFieldCharacterDetail\(\)/, 'character selection should open the field character detail popup after selection');
  assert.match(js, /showModal\(\)/, 'detail popups should use dialog showModal when available');
  assert.match(js, /character\.parameters\?\.magic/, 'character parameter rendering should consume the selected character magic parameters');
  assert.match(js, /character\.parameters\?\.abilities/, 'character parameter rendering should consume the selected character ability parameters');
  assert.match(js, /renderInteractionCharacterParameters\(selected\)/, 'changing selected character should refresh left-panel parameters');
  assert.match(js, /collectPlayerParameters/, 'world settings save should collect player parameter inputs');
  assert.match(js, /player_parameters/, 'world settings API calls should carry player parameters');
  assert.match(js, /function editableWorldDescription\(world = currentWorld\)[\s\S]*world\?\.world_description_base \?\? world\?\.world_description/, 'world settings editor should show the editable base text, not the flag-expanded prompt text');

  assert.doesNotMatch(js, /\/api\/events\/complete/);
  assert.match(js, /renderEventScreen/, 'event screen should render ready event flags and launch configured event interactions');
  assert.match(js, /event-pending-list/, 'event screen should show pending event flags');
  assert.match(js, /function startEventFlagInteractionFromScreen\(flagId, \{ screen = 'interaction' \} = \{\}\)/, 'event screen should be able to start the pending event interaction');
  assert.match(js, /postJson\('\/api\/event-flags\/start'/, 'event start should call the event interaction API');
  assert.match(js, /function openEventTab\(\)/, 'opening the Event tab should check for auto-startable pending events');
  assert.match(js, /autoStartFlag/, 'event tab should auto-start a ready event that has a source character and interaction location');
  assert.match(js, /showScreen\('interaction'\)/, 'starting an event should move to the Interaction screen');
  assert.doesNotMatch(js, /renderEventCard/);
  assert.doesNotMatch(js, /current_event\s*\?\s*showScreen\('event'\)/);
  assert.doesNotMatch(js, /completeCurrentEvent/);
  assert.match(js, /function moveToLocation\(locationId, \{ showDetail = false, nextScreen = 'field', selectedVisibleSituation = null \} = \{\}\)[\s\S]*showScreen\(nextScreen\)/, 'field movement should stay in the Field screen by default');
  assert.match(js, /field-route-list/, 'field movement choices should render in a dedicated route list');
  assert.match(js, /field\.locations/, 'field movement choices should render every stage candidate, not only the current location hotspots');
  assert.doesNotMatch(js, /hotspot\.target === 'interaction:lina'/, 'field routes must not contain the old silver-leaf interaction/event-like route');
  assert.doesNotMatch(js, /interaction:lina/, 'field routes must not hard-code the old Lina interaction hotspot');
  assert.match(js, /location-card/, 'field movement choices should look like selectable place cards');
  assert.match(js, /route_label/, 'field movement choices should explain where the route goes');
  assert.doesNotMatch(js, /narrationIconUrl/, 'ground-text narration should not use an icon in Interaction');
  assert.doesNotMatch(js, /narration-face/, 'ground-text narration should not render a face/icon frame');
  assert.doesNotMatch(js, /character_name:\s*'地の文'/, 'ground-text narration should not set a visible speaker name');
  assert.match(js, /message\.role !== 'user' && message\.role !== 'narration'/, 'ground-text narration should omit both face icon and message speaker line');
  assert.doesNotMatch(js, /<small>\$\{character\.visual_set_id\}<\/small>/, 'character selection list should not show visual set/image filenames under names');
  assert.match(js, /revealCompletedAssistantText/, 'completed narration or speech segments should be able to pop in during streaming before the final result');
  assert.match(js, /completedAssistantPrefix/, 'streaming should detect completed assistant bubble segments without growing unfinished bubbles');
  assert.match(js, /popFromDisplayIndex/, 'newly completed bubble segments should be animated in order rather than all assistant content popping only at the end');
  assert.match(js, /renderConversationResultSequentially/, 'opening utterance should stagger split bubbles instead of popping all initial bubbles together');
  assert.match(js, /await sleep\(500\)/, 'opening split bubbles should use a 500ms cooldown between pop-ins');
  assert.match(js, /await runOpeningConversationStream\(\{ provider, onAssistantStreamStart \}\)/, 'LM Studio opening utterance should use the streaming reveal path instead of waiting for a complete JSON response');
  assert.match(js, /\/api\/conversation\/opening\/stream/, 'opening utterance should have a streaming endpoint so first bubbles can pop as soon as their text is complete');
  assert.match(js, /commitConversationResultState\(finalResult\)/, 'opening final result should reconcile canonical state without replacing already revealed bubbles');
  assert.match(js, /scheduleAssistantSegmentReveal/, 'streaming should schedule completed bubble reveals at most once per animation frame');
  assert.match(js, /requestAnimationFrame\(\(\) => \{[\s\S]*revealCompletedAssistantText\(\)/, 'assistant delta handling should coalesce pop-in work through requestAnimationFrame');
  assert.doesNotMatch(js, /stream-status/, 'removed Interaction Debug panel should not keep a stream status DOM target');
  assert.match(js, /async function revealNextAssistantSegment/, 'streaming should reveal queued assistant bubble segments through one cooldown-controlled path');
  assert.match(js, /await sleep\(500\)/, 'streaming assistant bubble pop-ins should also use a 500ms cooldown');
  assert.match(js, /event === 'assistant_complete'/, 'streaming should receive the completed assistant text before work-record recall\/prewarm delays the final result');
  assert.match(js, /queueAssistantSegments\(assistantText\)/, 'completed assistant text should be queued for pop-in immediately, not only after the final result event');
  assert.match(js, /commitConversationResultState\(finalResult\)/, 'final stream result should update canonical state without re-rendering already revealed assistant bubbles');
  assert.match(js, /const CONVERSATION_EDIT_ITEM_ID = 'eternel_cube';/, 'past player message editing should be unlocked by the Eterneru Cube item');
  assert.match(js, /function hasConversationEditItem\(inventory = currentInventory\)/, 'browser script should centralize the inventory gate for message editing');
  assert.match(js, /if \(message\.role === 'user' && hasConversationEditItem\(\)\)/, 'past player messages should render an edit button only while the required item is owned');
  assert.match(js, /className = 'message-edit-button'/, 'eligible past player messages should render an edit button');
  assert.match(js, /function editUserMessageAtIndex\(messageIndex\)/, 'browser script should edit a past user message by conversation message index');
  assert.match(js, /if \(!hasConversationEditItem\(\)\) return;/, 'editing should be blocked client-side when the item is no longer owned');
  assert.match(js, /postJson\('\/api\/conversation\/edit-user-message'/, 'editing a user message should call the rewind-and-regenerate API');
  assert.match(js, /message_index: messageIndex/, 'edit API should send the selected conversation message index');
  assert.match(js, /await renderConversationResultSequentially\(result\)/, 'edited user input should resume conversation from the rewound turn and pop regenerated assistant bubbles in the normal sequential order');
  assert.doesNotMatch(js, /renderConversationResult\(result, \{ revealAssistant: true \}\);\n\s*setStreamStatus\('edit: completed'\)/, 'edited regenerated replies should not pop all assistant bubbles together through the immediate renderer');
  assert.match(js, /if \(conversationRequestInFlight\) \{[\s\S]*showProcessingToast\(\);[\s\S]*return;[\s\S]*\}/, 'editing should be blocked while a conversation request is still running');
  assert.match(js, /if \(!window\.confirm\(/, 'editing a past player message should confirm because later turns are discarded');
  assert.match(js, /if \(!completed\.trim\(\)\) return;/, 'streaming should not queue an empty assistant segment that renders as a name-only bubble before narration text');
  assert.match(js, /filter\(\(segment\) => \(segment\.content \?\? ''\)\.trim\(\)\)/, 'streaming should ignore blank split assistant segments before rendering pop-in bubbles');
  assert.match(js, /let assistantExpression = 'neutral'/, 'streaming should default assistant expression before the model-selected emotion arrives');
  assert.match(js, /event === 'assistant_emotion'/, 'streaming should accept the model-selected emotion before assistant deltas');
  assert.match(js, /face_emotion_variant_id:\s*`face_\$\{assistantExpression\}`/, 'streaming assistant bubbles should use the selected emotion icon');
  assert.doesNotMatch(js, /face_emotion_variant_id:\s*'face_neutral'/, 'streaming assistant bubbles should not force the neutral icon after emotion selection');
  assert.match(js, /\/canonical\/character_visual_sets\/\$\{visualSetId\}\/face_emotions\/\$\{expression\}\.png/, 'face icons should resolve canonical face_emotions routes');
  assert.doesNotMatch(js, /view === 'face'\) return character\.face_url/, 'face icons should not reuse the character-list neutral face_url for dialogue emotions');
  assert.doesNotMatch(js, /assistantText \+= data\.delta;[\s\S]*renderMessageStream\(nextMessages\)/, 'streaming deltas should not re-render a growing assistant bubble on every token');
  assert.match(js, /function renderInteractionLocation\(location\)/, 'interaction left panel should render the current location image/name from field state');
  assert.match(js, /#interaction-location-image/, 'interaction left panel should update the current location image element');
  assert.match(js, /#interaction-location-name/, 'interaction left panel should update the current location name element');
  assert.match(js, /renderInteractionLocation\(location\)/, 'field rendering should keep the interaction location preview in sync with the current field location');
  assert.match(js, /location\?\.background_url/, 'interaction location preview should use the same field background image URL when available');
  assert.match(js, /function startInteractionFromField\(characterId\) \{[\s\S]*if \(conversationRequestInFlight\) \{[\s\S]*showProcessingToast\(\);[\s\S]*return;[\s\S]*\}/, 'starting a new interaction from the field should be blocked while background conversation processing is still running');
  assert.match(js, /function openInteractionTab\(\) \{[\s\S]*if \(conversationRequestInFlight\) \{[\s\S]*showProcessingToast\(\);[\s\S]*return;[\s\S]*\}/, 'clicking the Interaction tab should also show the processing popup instead of entering while background work is running');
  assert.match(js, /function conversationShouldAutoEnd\(result\)[\s\S]*conversation_continuation\?\.continue_conversation === false/, 'browser should detect a false continuation judgment as an automatic conversation-end trigger');
  assert.match(js, /const FINAL_REPLY_AUTO_END_DELAY_MS = 3000;/, 'automatic conversation end should wait three seconds after the final reply popup so it remains readable');
  assert.match(js, /async function autoEndConversationAfterFinalReply\(result\)[\s\S]*await sleep\(FINAL_REPLY_AUTO_END_DELAY_MS\)[\s\S]*await endConversation\(\{ allowDuringInFlight: true \}\)/, 'automatic cutoff ending should wait after the final reply popup, then reuse the end-conversation process');
  assert.match(js, /let currentAssistantQueuedSegmentCount = 0;[\s\S]*let assistantCompleteCount = 0;/, 'streaming reveal should track completed assistant messages separately so a later cutoff reply is not suppressed by the normal reply segment count');
  assert.match(js, /function beginNextAssistantMessage\(\) \{[\s\S]*assistantText = '';[\s\S]*currentAssistantQueuedSegmentCount = 0;[\s\S]*\}/, 'a second assistant_complete event should reset per-assistant segment accounting before queueing the final cutoff reply');
  assert.match(js, /if \(event === 'assistant_complete'\) \{[\s\S]*if \(assistantCompleteCount > 0\) beginNextAssistantMessage\(\);[\s\S]*queueAssistantSegments\(assistantText\);[\s\S]*assistantCompleteCount \+= 1;[\s\S]*assistantRevealPromise = revealNextAssistantSegment\(\);/, 'each assistant_complete, including the cutoff final reply, should go through the pop-in reveal queue');
  assert.match(js, /const result = await runConversationStream\(\{ playerInput, provider, refreshAfter: false \}\)[\s\S]*if \(await autoEndConversationAfterFinalReply\(result\)\) return;[\s\S]*await refresh\(\)/, 'streaming conversation should auto-finalize after a false continuation result instead of only refreshing the active conversation');
  assert.match(js, /if \(conversationShouldAutoEnd\(result\)\) \{[\s\S]*await renderConversationResultSequentially\(result\)[\s\S]*\} else \{[\s\S]*renderConversationResult\(result, \{ revealAssistant: true \}\)[\s\S]*\}[\s\S]*if \(await autoEndConversationAfterFinalReply\(result\)\) return;/, 'non-streaming conversation should render the cutoff reply before auto-finalizing');
  assert.match(js, /function setConversationControlsDisabled\(disabled\)[\s\S]*#academy-conversation-session-run-conversation[\s\S]*#academy-conversation-session-end-conversation/, 'conversation in-flight guards should disable both the old interaction buttons and the academy session buttons');
  assert.match(js, /let conversationFinalizationInFlight = false;/, 'browser should track the conversation-end finalization phase separately so academy map navigation can be locked until placement reroll is safe');
  assert.match(js, /function setAcademyMapNavigationDisabled\(disabled\)[\s\S]*data-screen="academy-map"[\s\S]*aria-disabled/, 'academy map tab should be visibly disabled while conversation finalization is running');
  assert.match(js, /function showScreen\(name, \{ rerollAcademyMap = false \} = \{\}\)[\s\S]*if \(name === 'academy-map' && conversationFinalizationInFlight\) \{[\s\S]*showProcessingToast\(\);[\s\S]*return;[\s\S]*\}/, 'academy map cannot be opened while conversation-end processing is still running');
  assert.match(js, /function ensureAcademyMapCharacterAssignments\(\{ force = false \} = \{\}\)[\s\S]*if \(force \|\| !Object\.keys\(academyMapCharacterAssignments\)\.length\)/, 'academy map placement should only reroll on explicit force or initial empty setup, not on relationship or character signature changes elsewhere');
  assert.doesNotMatch(js, /signature !== academyMapAssignmentSignature/, 'relationship and character refreshes should not implicitly reroll academy map placement outside the conversation-end pass');
  assert.match(js, /async function endConversation\(\{ allowDuringInFlight = false \} = \{\}\)[\s\S]*conversationRequestInFlight && !allowDuringInFlight[\s\S]*showProcessingToast\(\);[\s\S]*return;[\s\S]*setConversationControlsDisabled\(true\)[\s\S]*conversationFinalizationInFlight = true;[\s\S]*setAcademyMapNavigationDisabled\(true\)[\s\S]*clearVisibleConversation\(\);[\s\S]*let transition = endingConversation[\s\S]*next_screen: 'academy-room'[\s\S]*const finalization = \(async \(\) => \{[\s\S]*postJson\('\/api\/conversation\/end'[\s\S]*const loadingReadiness = endingConversation \? finalization : Promise\.resolve\(\)[\s\S]*showAcademyLoadingScreenUntilReady\(\{[\s\S]*readiness:\s*loadingReadiness[\s\S]*nextScreen: transition\.next_screen[\s\S]*copyKey: transition\.loading_copy_key/, 'ending a conversation should route to 自室 after the fixed loading delay while still using finalization-backed loading for the graduation title transition');
  assert.match(js, /finalization_status:\s*'running'/, 'endConversation should record that memory\/skill\/work-record finalization is currently running');
  assert.match(js, /const finalization = \(async \(\) => \{[\s\S]*await refresh\(\);[\s\S]*ensureAcademyMapCharacterAssignments\(\{ force: true \}\)[\s\S]*finally \{[\s\S]*conversationFinalizationInFlight = false;[\s\S]*setAcademyMapNavigationDisabled\(false\);[\s\S]*\}\s*\}\)\(\);/, 'academy map placement should reroll only after conversation-end processing and refresh have finished, then unlock map navigation');
  assert.match(js, /async function endConversation\(\{ allowDuringInFlight = false \} = \{\}\)[\s\S]*finally \{[\s\S]*conversationRequestInFlight = false;[\s\S]*setConversationControlsDisabled\(false\);[\s\S]*\}/, 'ending a conversation should clear conversation controls after the fixed loading transition');
  assert.match(js, /showAcademyLoadingScreenUntilReady\(\{[\s\S]*readiness:\s*loadingReadiness[\s\S]*nextScreen: transition\.next_screen[\s\S]*copyKey: transition\.loading_copy_key[\s\S]*\}\);[\s\S]*finally \{\s*conversationRequestInFlight = false;\s*setConversationControlsDisabled\(false\);\s*\}/, 'conversation-end loading should clear the chat controls after the fixed room-loading or graduation title-loading transition completes; the map lock is still cleared inside the background finalization block');
  assert.doesNotMatch(js, /renderWorkRecordRecallDebug\(result\.conversation\?\.work_record_recall\)/, 'interaction debug recall output should not be wired to the removed debug panel');
  assert.doesNotMatch(js, /work-record-recall-debug/, 'browser script should not update the removed work-record recall debug panel');
});

test('training mode has full-screen compact rich cards, generated icons, six-action progress, effect guard, reset, and field return wiring', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const js = await readFile(path.join(root, 'app.js'), 'utf8');
  const css = await readFile(`${root}/style.css`, 'utf8');

  assert.match(html, /id="training-progress"/, 'training screen should show the six-action progress');
  assert.match(html, /id="training-weekday"/, 'training screen should show the current six-element weekday turn');
  assert.match(html, /id="training-day-transition"[\s\S]*aria-live="polite"/, 'training screen should include a day-transition animation layer');
  assert.match(html, /id="training-effect-overlay"[\s\S]*aria-live="polite"/, 'training screen should include a polite long effect overlay');
  assert.match(js, /const TRAINING_ACTION_LIMIT = 6;/, 'browser should know the six-action limit');
  assert.match(js, /let trainingEffectInFlight = false;/, 'browser should block repeated training actions while the effect is visible');
  assert.match(js, /let trainingActionInFlight = false;/, 'browser should block repeated training actions for the full click/effect/transition sequence');
  assert.match(js, /trainingCardImageUrls/, 'training cards should map canonical card_images files to training choices');
  assert.match(js, /className = 'training-card-image'/, 'training cards should render a canonical card image element');
  assert.match(js, /renderTrainingProgress/, 'training screen should render action progress');
  assert.match(js, /renderTrainingWeekday/, 'training screen should render the current weekday turn');
  assert.match(js, /weekdayBonusLabel/, 'training cards should explain which weekday doubles the matching elemental effect');
  assert.match(js, /direction === 'decrease'/, 'training results should display the new 50% one-point drawback rows');
  assert.match(js, /triggerTrainingDayTransition/, 'training should show a day-passing animation when the weekday advances');
  assert.match(js, /鍛錬後の自由時間です。学院マップへ遷移します。/, 'training completion copy should use the exact user-specified line');
  assert.doesNotMatch(js, /鍛錬が終わり、自由時間になりました。学院マップへと遷移します。/, 'training completion copy should no longer use the previous user wording');
  assert.doesNotMatch(js, /次の行動へ移ります。/, 'training completion copy should no longer use Air\'s generalized wording');
  assert.doesNotMatch(js, /フィールドへ戻ります。/, 'training completion copy should no longer mention returning to the old field flow');
  assert.match(js, /setTimeout\(\(\) => \{[\s\S]*trainingDayTransitionInFlight = false;[\s\S]*\}, 2000\)/, 'weekday transition should last about two seconds');
  assert.match(js, /await triggerTrainingEffect\(result\);[\s\S]*await refreshPrompt\(\);[\s\S]*await triggerTrainingDayTransition\(result\)/, 'weekday transition should wait until the numeric training effect has finished');
  assert.match(js, /triggerTrainingEffect/, 'clicking training should trigger a visible effect');
  assert.match(js, /return new Promise\(\(resolve\) => \{[\s\S]*setTimeout\(\(\) => \{[\s\S]*trainingEffectInFlight = false;[\s\S]*resolve\(\);[\s\S]*1000\)/, 'training click effect should keep the guard active for about one second and resolve only after it ends');
  assert.match(js, /function setTrainingButtonsDisabled\(disabled\)/, 'training buttons should share a central disabled-state helper');
  assert.match(js, /button\.disabled = disabled \|\| trainingActionInFlight \|\| trainingEffectInFlight \|\| trainingDayTransitionInFlight/, 'training buttons should stay disabled across the entire current action sequence');
  assert.match(js, /if \(trainingActionInFlight \|\| trainingEffectInFlight \|\| trainingDayTransitionInFlight\) \{[\s\S]*showProcessingToast\(\);[\s\S]*return;[\s\S]*\}/, 'clicking during the visible effect should not start the next action');
  assert.match(js, /trainingActionInFlight = true;[\s\S]*setTrainingButtonsDisabled\(true\);[\s\S]*const result = await postJson\('\/api\/training\/run'/, 'training clicks should disable the next action before the API request returns');
  assert.match(js, /finally \{[\s\S]*trainingActionInFlight = false;[\s\S]*setTrainingButtonsDisabled\(false\);[\s\S]*\}/, 'training action guard should always clear after the effect\/transition sequence settles');
  assert.match(js, /function resetTrainingResultDisplay\(\)/, 'training result display should have an explicit reset helper');
  assert.match(js, /function showScreen\(name, \{ rerollAcademyMap = false \} = \{\}\) \{[\s\S]*if \(name !== 'training'\) resetTrainingResultDisplay\(\);/, 'leaving Training should clear the previous training result');
  assert.match(js, /function runTraining\(trainingId\)[\s\S]*if \(result\.training_progress\?\.completed\) \{[\s\S]*routeAfterCompletedAcademyTraining\(\)/, 'sixth action should return through the event-aware academy loading route');
  assert.match(css, /#training-screen\.active[\s\S]*min-height: calc\(100vh - 140px\)/, 'training screen should be sized as a full-screen panel');
  assert.match(css, /\.training-grid[\s\S]*height: min\(720px, calc\(100vh - 220px\)\)/, 'training grid should fit within the viewport instead of growing indefinitely');
  assert.match(css, /\.training-options[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(180px, 1fr\)\)/, 'training cards should compact into a responsive grid');
  assert.match(css, /\.training-options[\s\S]*padding-top:\s*14px/, 'training option scroll area should reserve top room so first-row hover lift is not clipped');
  assert.match(css, /\.training-weekday[\s\S]*光曜/, 'training weekday badge should visually name the six-element weekday cycle');
  assert.match(css, /\.training-day-transition\.visible[\s\S]*animation: training-day-passage 2000ms/, 'weekday update should use an about two-second day-passing animation');
  assert.match(css, /@keyframes training-day-passage/, 'training day transition animation keyframes should exist');
  assert.match(css, /@keyframes training-day-passage[\s\S]*0% \{[^}]*blur\(4px\)[^}]*\}[\s\S]*18% \{[^}]*blur\(0\)[^}]*\}[\s\S]*58% \{[^}]*blur\(0\)[^}]*\}[\s\S]*100% \{[^}]*blur\(0\)[^}]*\}/, 'weekday transition should sharpen after the intro and stay sharp through the fade-out');
  assert.match(js, /\/canonical\/ui\/card_images\//, 'training cards should use canonical card image thumbnails');
  assert.match(css, /\.training-card-image[\s\S]*object-fit:\s*cover/, 'training cards should preserve thumbnail crop styling');
  assert.match(css, /\.training-effect-overlay\.visible[\s\S]*animation: training-effect-burst 1000ms/, 'training effect should have a one-second burst animation');
});

test('interaction composer sends on plain Enter but blocks Enter while conversation processing is still running', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const js = await readFile(path.join(root, 'app.js'), 'utf8');
  const css = await readFile(`${root}/style.css`, 'utf8');

  assert.match(html, /id="conversation-processing-toast"[\s\S]*role="status"[\s\S]*aria-live="polite"[\s\S]*処理中です。しばらくお待ちください。/, 'interaction screen should include a polite processing popup for blocked Enter submissions');
  assert.match(js, /let playerInputIsComposing = false;/, 'composer should track IME composition state explicitly for macOS Japanese input');
  assert.match(js, /let conversationRequestInFlight = false;/, 'composer should track whether a conversation request is still running');
  assert.match(js, /let processingToastTimer = null;/, 'processing popup should keep one timeout handle so repeated Enter does not stack timers');
  assert.match(js, /function showProcessingToast\(\)/, 'blocked Enter should use a centralized popup helper');
  assert.match(js, /conversation-processing-toast/, 'browser script should update the processing popup element');
  assert.match(js, /setTimeout\(\(\) => \{[\s\S]*classList\.remove\('visible'\)[\s\S]*\}, 1000\)/, 'processing popup should disappear after about one second');
  assert.match(js, /addEventListener\('compositionstart',[\s\S]*playerInputIsComposing = true/, 'compositionstart should mark the player input as composing');
  assert.match(js, /addEventListener\('compositionend',[\s\S]*playerInputIsComposing = false/, 'compositionend should mark the player input as no longer composing');
  assert.match(js, /function shouldSubmitPlayerInput\(event\)/, 'Enter submission decision should be centralized');
  assert.match(js, /event\.key !== 'Enter'[\s\S]*return false/, 'non-Enter keys should not submit');
  assert.match(js, /event\.shiftKey[\s\S]*return false/, 'Shift+Enter should remain available for inserting a newline');
  assert.match(js, /event\.isComposing \|\| playerInputIsComposing \|\| event\.keyCode === 229[\s\S]*return false/, 'Enter must not submit while IME composition\/conversion is active or reported as keyCode 229');
  assert.match(js, /if \(conversationRequestInFlight\) \{[\s\S]*showProcessingToast\(\);[\s\S]*return;[\s\S]*\}/, 'runConversation should return early while recall\/prewarm or conversation processing is still active');
  assert.match(js, /conversationRequestInFlight = true;[\s\S]*setConversationControlsDisabled\(true\)/, 'conversation processing should start before disabling the send buttons');
  assert.match(js, /finally \{[\s\S]*conversationRequestInFlight = false;[\s\S]*setConversationControlsDisabled\(false\);[\s\S]*\}/, 'conversation processing should always clear the Enter guard with the send buttons');
  assert.match(js, /if \(shouldSubmitPlayerInput\(event\)\) \{[\s\S]*event\.preventDefault\(\);[\s\S]*if \(conversationRequestInFlight\) \{[\s\S]*showProcessingToast\(\);[\s\S]*return;[\s\S]*\}[\s\S]*runConversation\(\)\.catch\(reportError\)/, 'plain Enter should prevent duplicate send and show the popup when the send button is already blocked');
  assert.match(css, /\.processing-toast\s*\{[\s\S]*position:\s*fixed[\s\S]*opacity:\s*0[\s\S]*pointer-events:\s*none/, 'processing popup should be a non-blocking fixed toast');
  assert.match(css, /\.processing-toast\.visible\s*\{[\s\S]*opacity:\s*1/, 'processing popup should become visible through a class');
});

test('processing toast remains outside inactive screens so blocked field interaction entry can display it', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const interactionBlock = html.match(/<section id="interaction-screen"[\s\S]*?<section id="training-screen"/)?.[0] ?? '';
  assert.doesNotMatch(interactionBlock, /id="conversation-processing-toast"/, 'processing toast should not be nested inside the inactive Interaction screen after returning to Field');
  assert.match(html, /<div id="conversation-processing-toast" class="processing-toast" role="status" aria-live="polite">処理中です。しばらくお待ちください。<\/div>/, 'shared processing toast should still exist once at document level');
});

test('conversation input lock guards opening generation and bounds post-turn refresh waits', async () => {
  const js = await readFile(path.join(root, 'app.js'), 'utf8');

  assert.match(js, /const REFRESH_TASK_TIMEOUT_MS = \d+;/, 'refresh path should define a bounded wait for post-turn API synchronization');
  assert.match(js, /async function runRefreshTask\(label, taskFactory, \{ timeoutMs = REFRESH_TASK_TIMEOUT_MS, fallbackValue = null \} = \{\}\)/, 'refresh path should funnel awaited sync work through a timeout-guarded helper');
  assert.match(js, /Promise\.race\(\[[\s\S]*setTimeout\(/, 'refresh guard should race each sync task against a timeout instead of waiting forever');
  assert.match(js, /reportError\(new Error\(`refresh timeout: \$\{label\}`\)\)/, 'timed-out refresh tasks should surface a concrete diagnostic label');
  assert.match(js, /await Promise\.all\(\[[\s\S]*runRefreshTask\('characters', \(\) => refreshCharacters\(\)\)[\s\S]*runRefreshTask\('world settings', \(\) => refreshWorldSettings\(\)\)[\s\S]*runRefreshTask\('economy', \(\) => refreshEconomy\(\)\)[\s\S]*\]\)/, 'initial refresh fan-out should use the timeout guard for the first post-turn API group');
  assert.match(js, /const \[state, field\] = await Promise\.all\(\[[\s\S]*runRefreshTask\('state', \(\) => getJson\('\/api\/state'\), \{ fallbackValue: currentRuntimeState \}\)[\s\S]*runRefreshTask\('field', \(\) => getJson\('\/api\/field'\), \{ fallbackValue: currentField \}\)[\s\S]*\]\)/, 'state and field refresh should fall back to the last known values when a post-turn fetch stalls');
  assert.match(js, /await Promise\.all\(\[[\s\S]*runRefreshTask\('record status', \(\) => refreshRecordStatus\(\)\)[\s\S]*runRefreshTask\('flag status', \(\) => refreshFlagStatus\(\)\)[\s\S]*runRefreshTask\('event flag status', \(\) => refreshEventFlagStatus\(\)\)[\s\S]*runRefreshTask\('llm request log', \(\) => refreshLlmRequestLog\(\)\)[\s\S]*runRefreshTask\('save slots', \(\) => refreshSaveSlots\(\)\)[\s\S]*\]\)/, 'secondary refresh fan-out should also be bounded so optional panels cannot keep the composer locked forever');
  assert.match(js, /async function runConversation\(\) \{[\s\S]*conversationRequestInFlight = true;[\s\S]*setConversationControlsDisabled\(true\);[\s\S]*const provider = conversationProvider\(\);[\s\S]*try \{[\s\S]*if \(messageHistory\.length === 0\) await ensureOpeningUtterance\(\);/, 'first-turn opening generation should run inside the guarded try/finally so a stall or throw cannot strand the input lock');
});

test('visual polish separates debug layout and gives field route cards clear affordance', async () => {
  const css = await readFile(`${root}/style.css`, 'utf8');

  assert.match(css, /\.world-settings-panel\s*\{[\s\S]*background:\s*#111827;[\s\S]*background-image:\s*none/, 'world settings panel should use a plain navy background');
  assert.match(css, /\.parameter-preset-row\s*\{[\s\S]*display:\s*grid[\s\S]*grid-template-columns:\s*repeat\(5, minmax\(0, 1fr\)\)/, 'world parameter presets should show five buttons in a row');
  assert.match(css, /\.parameter-preset-group\s*\{[\s\S]*margin-top/, 'world parameter preset groups should have compact spacing');
  assert.match(css, /\.message-stream\s*\{[\s\S]*height:\s*430px;[\s\S]*min-height:\s*430px;[\s\S]*max-height:\s*430px/, 'conversation message area should be taller while remaining fixed when messages appear');
  assert.match(css, /\.chat-composer\s*\{[\s\S]*font-size:\s*16px/, 'player input label should use the requested 16px size');
  assert.match(css, /#player-input\s*\{[\s\S]*font-size:\s*14px;[\s\S]*line-height:\s*1\.7/, 'player input text should use the requested 14px size');
  assert.match(css, /\.layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/, 'main layout should not reserve an always-visible debug column');
  assert.match(css, /\.field-card\s*\{[\s\S]*grid-template-columns:\s*minmax\(420px,\s*1fr\) minmax\(360px,\s*0\.9fr\)/, 'field should keep movement and character selection columns');
  assert.doesNotMatch(css, /\.background-panel\s*\{/, 'old upper-left current-location panel CSS should be removed after moving details to popup');
  assert.match(css, /\.field-location-detail-dialog\s*\{[\s\S]*width:\s*min\(1240px, 96vw\);[\s\S]*max-width:\s*min\(1240px, 96vw\)/, 'field movement destination detail popup should set its actual width, not only a max-width, so every stage image grows consistently');
  assert.match(css, /\.field-location-detail-image\s*\{[\s\S]*aspect-ratio:\s*16 \/ 9/, 'field location detail popup should display the former current-location image area');
  assert.match(css, /#interaction-location-detail-image\s*\{[\s\S]*aspect-ratio:\s*16 \/ 9/, 'interaction left-panel location detail popup should display the same large stage image area');
  assert.match(css, /\.field-left-column,\n\.field-right-column\s*\{[\s\S]*display:\s*grid/, 'left column should stack current location and movement choices');
  assert.match(css, /\.character-select-panel\s*\{[\s\S]*background:\s*#[0-9a-fA-F]{6}/, 'character selection panel should use a plain dark gray background');
  assert.match(css, /textarea\s*\{[\s\S]*box-sizing:\s*border-box/, 'textareas should stay inside their panels instead of overflowing right');
  assert.match(css, /\.narration-message\s*\{[\s\S]*justify-content:\s*flex-start/, 'ground-text narration should stay on the left character-message lane, not centered');
  assert.match(css, /\.narration-message \.message-bubble\s*\{[\s\S]*margin-left:\s*calc\(129px \+ 12px\)/, 'ground-text narration bubble should align its left edge with enlarged character speech bubbles');
  assert.match(css, /\.message-face\s*\{[\s\S]*width:\s*129px;[\s\S]*height:\s*129px;[\s\S]*flex:\s*0 0 129px/, 'conversation face images should be 1.5x the former 86px size');
  assert.match(css, /\.chat-message\.pop-in\s*\{[\s\S]*contain:\s*layout paint[\s\S]*animation:\s*bubble-pop-in\s+220ms[\s\S]*will-change:\s*transform, opacity/, 'SNS-style pop-in should animate the whole message row so the icon and bubble settle together');
  assert.doesNotMatch(css, /\.chat-message\.pop-in \.message-bubble\s*\{[\s\S]*animation:/, 'pop-in should not animate only the bubble because the icon can appear one pixel out of sync after settling');
  const bubbleKeyframes = css.match(/@keyframes bubble-pop-in[\s\S]*?\n\}/)?.[0] ?? '';
  assert.doesNotMatch(bubbleKeyframes, /scale\(/, 'SNS-style pop-in should avoid scale overshoot that can cause sub-pixel horizontal settling');
  assert.doesNotMatch(bubbleKeyframes, /filter:/, 'SNS-style pop-in should not animate filter because it causes expensive repaints');
  assert.doesNotMatch(bubbleKeyframes, /rotate\(/, 'SNS-style pop-in should avoid rotation because it increases paint/composition work for large bubbles');
  assert.match(css, /\.character-selection-list\s*\{[\s\S]*grid-template-columns:\s*repeat\(auto-fill, minmax\(260px, 1fr\)\)/, 'larger character icons may reduce the number of visible columns');
  assert.match(css, /\.character-option\s*\{[\s\S]*grid-template-columns:\s*112px 1fr/, 'character selection icons should be about twice the former width');
  assert.match(css, /\.character-option img\s*\{[\s\S]*width:\s*112px;[\s\S]*height:\s*112px/, 'character selection icons should be about twice the former size');
  assert.match(css, /\.asset-source-line\s*\{[\s\S]*display:\s*none/, 'selected character source/image filename line should be hidden');
  assert.match(css, /\.continuity-record-grid\s*\{[\s\S]*minmax\(min\(100%, 210px\), 1fr\)/, 'memory/skill/work record columns should shrink inside the panel');
  assert.match(css, /\.continuity-record-grid article\s*\{[\s\S]*min-width:\s*0/, 'memory cards should not force the panel wider');
  assert.match(css, /\.continuity-record-item\s*\{[\s\S]*overflow-wrap:\s*anywhere/, 'long memory text should wrap like skill/work-record text');
  assert.match(css, /\.field-route-list\s*\{[\s\S]*grid-template-columns/, 'field routes should use clear card layout');
  assert.match(css, /\.location-card\s*\{[\s\S]*min-height/, 'route choices should be large enough to read/click');
  assert.match(css, /\.location-card\.current/, 'current location should be visually marked');
  assert.match(css, /\.training-grid\s*\{[\s\S]*grid-template-columns/, 'training screen should organize choices and current player parameters');
  assert.match(css, /\.training-option-card\s*\{[\s\S]*text-align:\s*left/, 'training choices should read as selectable cards');
  assert.match(css, /\.training-effect-list\s*\{[\s\S]*display:\s*grid/, 'training effects should be shown as compact gain/loss rows');
  assert.match(css, /\.debug-grid\s*\{[\s\S]*grid-template-columns/, 'debug should have its own organized screen layout');
  assert.match(css, /\.app-card/, 'shared cards should use a polished card primitive');
  assert.match(css, /backdrop-filter/, 'UI should use glass-like depth rather than flat panels');
});

test('interaction neutral face remains pinned to the upper-left panel while chat grows', async () => {
  const css = await readFile(`${root}/style.css`, 'utf8');
  assert.match(css, /\.standee-frame\s*\{[\s\S]*position:\s*sticky/, 'standee frame should stay fixed near the top while the chat panel scrolls');
  assert.match(css, /\.standee-frame\s*\{[\s\S]*top:\s*20px/, 'standee sticky position should have a top offset');
  assert.match(css, /\.interaction-grid\s*\{[\s\S]*grid-template-columns:\s*minmax\(240px,\s*300px\) minmax\(0, 1fr\)/, 'left character panel should be rebuilt slightly narrower so the chat area has more room');
  assert.match(css, /\.chat-panel\s*\{[\s\S]*min-height:\s*680px/, 'interaction conversation box should be rebuilt taller after removing the heading');
  assert.match(css, /\.interaction-location-preview\s*\{[\s\S]*margin:\s*0 0 14px/, 'interaction location preview should sit above the character block with spacing');
  assert.match(css, /#interaction-location-image\s*\{[\s\S]*aspect-ratio:\s*16 \/ 9/, 'interaction location image should keep a compact map-like preview ratio');
  assert.match(css, /\.interaction-location-name-button\s*\{[\s\S]*font-size:\s*15px/, 'interaction location name button should be readable and matched with the character name');
  assert.match(css, /\.interaction-character-name-button\s*\{[\s\S]*font-size:\s*15px/, 'interaction character name button should match the location name button size');
  assert.match(css, /\.interaction-detail-dialog\s*\{[\s\S]*max-width:\s*min\(960px, 94vw\)/, 'interaction details should open in a wider popup with room for the square scene standee');
  assert.match(css, /\.field-character-detail-dialog\s*\{[\s\S]*width:\s*min\(1200px, 96vw\);[\s\S]*max-width:\s*min\(1200px, 96vw\)/, 'field character detail dialog should widen for the left square scene standee plus editable details');
  assert.match(css, /\.interaction-character-detail-dialog\s*\{[\s\S]*width:\s*min\(1040px, 96vw\)/, 'interaction character detail dialog should have room for the left square scene standee');
  assert.match(css, /\.character-detail-layout\s*\{[\s\S]*grid-template-columns:\s*minmax\(360px, 440px\) minmax\(0, 1fr\)/, 'character detail dialogs should give the square standee a wider left column');
  assert.match(css, /\.character-detail-standee-frame\s*\{[\s\S]*aspect-ratio:\s*1 \/ 1/, 'character detail scene standee frame should be square');
  assert.match(css, /\.character-detail-standee\s*\{[\s\S]*height:\s*100%;[\s\S]*object-fit:\s*cover/, 'character detail scene standees should fill the square display range exactly');
  assert.match(css, /\.interaction-detail-backdrop\s*\{[\s\S]*position:\s*fixed/, 'fallback interaction detail backdrop should cover the viewport');
  assert.match(css, /\.interaction-name-button\s*\{[\s\S]*cursor:\s*pointer/, 'clickable names should read as detail affordances');
  assert.match(css, /\.interaction-character-block\s*\{[\s\S]*border-top/, 'character image/name/description should remain grouped below the location preview');
  assert.match(css, /#character-standee\s*\{[\s\S]*width:\s*220px;[\s\S]*height:\s*220px/, 'left character image should be the selected character neutral face crop rather than a full-body standee');
  assert.match(css, /#character-standee\s*\{[\s\S]*object-fit:\s*cover/, 'left neutral face should fill its square crop frame');
  assert.match(css, /#character-standee\s*\{[\s\S]*border:\s*1px solid rgba\(211, 180, 105, 0\.42\)/, 'left standee image should have a warm academy-style border');
  assert.match(css, /#character-standee\s*\{[\s\S]*background:\s*linear-gradient/, 'left standee frame should use a subtle parchment/glass background behind the transparent PNG');
  assert.match(css, /#character-standee\s*\{[\s\S]*box-shadow:[\s\S]*inset/, 'left standee frame should include an inner frame shadow plus outer depth');
  assert.match(css, /\.interaction-character-name\s*\{[\s\S]*font-size:\s*16px/, 'left character name under the image should be 16px');
  assert.match(css, /\.interaction-character-description\s*\{[\s\S]*font-size:\s*14px/, 'left character description should be 14px');
  assert.match(css, /\.interaction-character-parameters\s*\{[\s\S]*margin-top:\s*12px/, 'left character parameters should sit directly below the description with small spacing');
  assert.match(css, /\.character-parameter-group\s*\{[\s\S]*grid-template-columns:\s*repeat\(2, minmax\(0, 1fr\)\)/, 'character parameter values should use a compact two-column grid in the left panel');
  assert.match(css, /\.character-parameter-item\s*\{[\s\S]*border:\s*1px solid rgba\(211, 180, 105, 0\.22\)/, 'character parameter chips should use the same warm academy border language');
});


test('debug screen keeps only flags, recent LLM requests, and organized save/load layout', async () => {
  const html = await readFile(path.join(root, 'index.html'), 'utf8');
  const js = await readFile(path.join(root, 'app.js'), 'utf8');
  const css = await readFile(`${root}/style.css`, 'utf8');
  const debugBlock = html.match(/<section id="debug-screen"[\s\S]*<\/main>/)?.[0] ?? '';

  assert.doesNotMatch(debugBlock, /runtime_state|asset resolver|continuity record status|Interaction Debug/, 'debug screen should remove the requested obsolete panel titles');
  assert.doesNotMatch(debugBlock, /id="state-json"|id="asset-json"|id="record-status"|id="provider-select"|id="refresh-prompt"|id="prompt-preview"|id="conversation-log"|id="work-record-recall-debug"|id="refresh-assets"|id="reset-memory"|id="reset-skills"|id="reset-work-records"/, 'debug screen should remove the requested obsolete panel controls');
  assert.doesNotMatch(js, /#state-json|#asset-json|#record-status|#provider-select|#refresh-prompt|#prompt-preview|#conversation-log|#work-record-recall-debug|#refresh-assets|#reset-memory|#reset-skills|#reset-work-records/, 'browser script should not query removed debug-only elements');

  assert.match(debugBlock, /id="flag-title-list"[\s\S]*aria-label="flag title list"/, 'flags should render as clickable title rows');
  assert.match(html, /id="flag-detail-dialog"[\s\S]*id="flag-detail-title"[\s\S]*id="flag-detail-body"/, 'flag title clicks should open a detail dialog');
  assert.match(js, /function openFlagDetail\(flagId\)/, 'browser script should open flag details by id');
  assert.match(js, /flag-title-button/, 'flag titles should be rendered as buttons like recent LLM requests');
  assert.doesNotMatch(debugBlock, /<pre id="flag-status">/, 'flags should not remain a raw JSON pre block');

  assert.match(debugBlock, /class="save-load-layout"[\s\S]*id="save-slot-id"[\s\S]*id="create-save"[\s\S]*id="save-slots"[\s\S]*id="load-save"/, 'save/load controls should be grouped in a clean layout');
  assert.match(css, /\.save-load-layout\s*\{[\s\S]*display:\s*grid/, 'save/load panel should use a grid layout');
  assert.match(css, /\.save-slot-list\s*\{[\s\S]*min-height/, 'save slot select should have a stable list area');

  assert.doesNotMatch(html, /v4 source_images mock|source-mock-preview|source-mock-variant|source-mock-expression|randomize-source-mock|source-mock-caption/, 'v4 source_images mock UI should be removed');
  assert.doesNotMatch(js, /sourceMock|source-character-mock|source-mocks|source-mock/, 'browser v4 source mock logic should be removed');
});

test('server no longer exposes v4 source_images mock routes or imports its mock logic', async () => {
  const server = await readFile(`${sourceRoot}/server.mjs`, 'utf8');
  assert.doesNotMatch(server, /sourceImageMock|buildSourceCharacterMockRecipe|renderSourceCharacterMockSvg/);
  assert.doesNotMatch(server, /api\/source-character-mock|source-mocks/);
});
test('slot-load cards render a dedicated per-slot memo column and preserve slot-level note APIs', async () => {
  const js = await readFile(path.join(root, 'app.js'), 'utf8');
  const css = await readFile(`${root}/style.css`, 'utf8');
  const saveLoad = await readFile(`${sourceRoot}/saveLoad.mjs`, 'utf8');
  const server = await readFile(`${sourceRoot}/server.mjs`, 'utf8');

  assert.match(js, /const SLOT_LOAD_NOTE_MAX_LENGTH = 2000;/, 'slot-load memo editor should allow around 2000 characters in the browser too');
  assert.match(js, /function renderSlotNoteEditor\(slot\)[\s\S]*heading\.textContent = 'メモ'[\s\S]*textarea[\s\S]*textarea\.name = `player_note_\$\{slot\.slot_id\}`[\s\S]*textarea\.maxLength = SLOT_LOAD_NOTE_MAX_LENGTH/, 'slot-load cards should render a dedicated note textarea per slot');
  assert.match(js, /function renderSlotNoteEditor\(slot\)[\s\S]*addEventListener\('blur',[\s\S]*saveSlotNote\(slot\.slot_id, textarea\.value\)/, 'slot memo should save on blur from the slot-specific textarea');
  assert.match(js, /async function saveSlotNote\(slotId, playerNote\)[\s\S]*\/api\/slots\/\$\{encodeURIComponent\(slotId\)\}\/note/, 'slot memo save should use a dedicated slot-note API');
  assert.match(js, /article\.className = 'continuity-record-item slot-load-item'[\s\S]*const body = document\.createElement\('div'\);[\s\S]*body\.className = 'slot-load-item-body'/, 'slot-load cards should split content into a left summary block and a right memo block');
  assert.match(js, /const graduationStatus = document\.createElement\('p'\);[\s\S]*graduationStatus\.className = 'slot-load-item-status';[\s\S]*graduationStatus\.textContent = '卒業済み';[\s\S]*graduationStatus\.hidden = slot\.graduation_completed !== true;/, 'slot-load summary should render a dedicated 卒業済み status line only for graduated slots');
  assert.match(js, /load\.disabled = slot\.graduation_completed === true;[\s\S]*load\.setAttribute\('aria-disabled', String\(slot\.graduation_completed === true\)\)/, 'graduated slot start buttons should be natively disabled and expose the same state to accessibility helpers');

  assert.match(css, /\.slot-load-item-body\s*\{[\s\S]*grid-template-columns:\s*minmax\(280px, 3fr\) minmax\(0, 7fr\)/, 'slot-load cards should devote most of the wide row to the memo column');
  assert.match(css, /\.slot-load-list\s*\{[\s\S]*gap:\s*0[\s\S]*overflow-y:\s*auto/, 'slot-load list should behave like one continuous full-height slot ledger rather than separated floating cards');
  assert.match(css, /\.slot-load-item \+ \.slot-load-item\s*\{[\s\S]*border-top:\s*1px solid/, 'slot-load rows should show a visible separator between neighboring slots');
  assert.match(css, /\.slot-load-note-editor\s*\{[\s\S]*border-left:\s*1px solid/, 'slot memo column should be visually separated from the save summary within the same slot');
  assert.match(css, /\.slot-load-note-editor textarea\s*\{[\s\S]*resize:\s*vertical[\s\S]*min-height:\s*96px/, 'slot memo textarea should be editable and tall enough for identification notes');
  assert.match(css, /\.slot-load-item-status\s*\{[\s\S]*font-size:\s*12px[\s\S]*color:\s*#b6c891/, 'graduated slot status text should use a compact secondary line in the slot summary');
  assert.match(css, /\.slot-load-item-summary \.dialog-action-row\s*\{[\s\S]*margin-top:\s*14px/, 'slot-load should add explicit vertical spacing between the description\/status area and the start button row');

  assert.match(saveLoad, /player_note:\s*meta\.player_note \?\? ''[\s\S]*graduation_completed:\s*meta\.graduation_completed === true/, 'slot summaries should preserve player notes while exposing graduation_completed');
  assert.match(saveLoad, /const slotNoteRoutePattern = \^\\\/api\\\/slots\\\/\[\^\/\]\+\\\/note\$\|slotNoteRoutePattern\.test\(url\.pathname\)|updateSaveSlotNote/, 'save-load API should expose a dedicated slot-note update route and handler');
});

