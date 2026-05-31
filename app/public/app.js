const tabs = document.querySelectorAll('[data-screen]');
const screens = {
  title: document.querySelector('#title-screen'),
  'slot-load': document.querySelector('#slot-load-screen'),
  world: document.querySelector('#world-screen'),
  settings: document.querySelector('#settings-screen'),
  field: document.querySelector('#field-screen'),
  'academy-map': document.querySelector('#academy-map-screen'),
  'academy-companion': document.querySelector('#academy-companion-screen'),
  'academy-conversation-session': document.querySelector('#academy-conversation-session-screen'),
  'academy-training': document.querySelector('#academy-training-screen'),
  'academy-loading': document.querySelector('#academy-loading-screen'),
  'academy-room': document.querySelector('#academy-room-screen'),
  interaction: document.querySelector('#interaction-screen'),
  training: document.querySelector('#training-screen'),
  event: document.querySelector('#event-screen'),
  inventory: document.querySelector('#inventory-screen'),
  shop: document.querySelector('#shop-screen'),
  debug: document.querySelector('#debug-screen')
};

let currentField = null;
let selectableCharacters = [];
let characterAuthoringCapability = { enabled: true, reason: null, message: null };
let academyMapSelectedLocationId = null;
let academyCompanionLocationId = null;
let academyMapCharacterAssignments = {};
let academyMapStageSituationAssignments = {};
let academyMapAssignmentSignature = '';
let academyCompanionDetailCharacterId = null;

const LM_STUDIO_RUNTIME_ERROR_CODES = new Set([
  'LMSTUDIO_CONFIG_REQUIRED',
  'LMSTUDIO_CONNECTION_UNAVAILABLE'
]);

const magicParameterDefinitions = [
  ['light', '光'],
  ['dark', '闇'],
  ['fire', '火'],
  ['water', '水'],
  ['earth', '土'],
  ['wind', '風']
];
const abilityParameterDefinitions = [
  ['strength', '筋力'],
  ['agility', '瞬発力'],
  ['academics', '学力'],
  ['magical_power', '魔力'],
  ['charisma', 'カリスマ']
];
const PLAYER_PARAMETER_PRESET_VALUES = [0, 25, 50, 75, 100];
const TRAINING_ACTION_LIMIT = 6;
const trainingWeekdays = [
  { index: 0, id: 'light_day', name: '光曜', element: 'light', element_label: '光' },
  { index: 1, id: 'dark_day', name: '闇曜', element: 'dark', element_label: '闇' },
  { index: 2, id: 'fire_day', name: '火曜', element: 'fire', element_label: '火' },
  { index: 3, id: 'water_day', name: '水曜', element: 'water', element_label: '水' },
  { index: 4, id: 'earth_day', name: '土曜', element: 'earth', element_label: '土' },
  { index: 5, id: 'wind_day', name: '風曜', element: 'wind', element_label: '風' }
];
const CONVERSATION_EDIT_ITEM_ID = 'eternel_cube';
const FINAL_REPLY_AUTO_END_DELAY_MS = 3000;
const REFRESH_TASK_TIMEOUT_MS = 3000;
const ACADEMY_LOADING_MINIMUM_MS = 1000;
const ACADEMY_LOADING_IMAGE_ROTATION_MS = 3000;
const GRADUATION_ENDING_WEEK = 50;
const academyLoadingImageUrls = [
  '/canonical/load/ig_033f91085286e813016a0319d2efb88191a39d2495960760cc.png',
  '/canonical/load/ig_033f91085286e813016a03197e268c8191952e1295edcbfa61.png',
  '/canonical/load/ig_033f91085286e813016a031916c0e08191997b5243dce130a5.png',
  '/canonical/load/ig_033f91085286e813016a0318baa56c8191860aa50bfa51060a.png',
  '/canonical/load/ig_033f91085286e813016a031864189881919aba9025e2b7c178.png',
  '/canonical/load/ig_033f91085286e813016a03180e10788191a2815c90279bc1bb.png',
  '/canonical/load/ig_033f91085286e813016a031798d98c8191a68f5bfb16fe636a.png',
  '/canonical/load/ig_033f91085286e813016a03174207c88191858e6bbb4aac73c1.png',
  '/canonical/load/ig_033f91085286e813016a0316969af08191822aa201705b38e0.png',
  '/canonical/load/ig_033f91085286e813016a03163fd0c48191b22d0613616bf2f2.png',
  '/canonical/load/ig_033f91085286e813016a0315ef557c81918e398f1089de2a7c.png',
  '/canonical/load/ig_033f91085286e813016a03159b660c819182a4318d9a71cf34.png',
  '/canonical/load/ig_033f91085286e813016a03154f09d481919ea5756b38b10e06.png',
  '/canonical/load/ig_033f91085286e813016a0314f4d4688191ba6de7b78df9cd84.png',
  '/canonical/load/ig_033f91085286e813016a0314a61584819195d900d3bad566ce.png',
  '/canonical/load/ig_033f91085286e813016a03145b99388191bf9e4b98f6495add.png',
  '/canonical/load/ig_033f91085286e813016a03140ee89481918c18b0bd3de21872.png',
  '/canonical/load/ig_033f91085286e813016a0313c4358081919ced2a072fe95863.png',
  '/canonical/load/ig_033f91085286e813016a03135deecc8191a5f6410168c3e600.png',
  '/canonical/load/ig_033f91085286e813016a031309ed4c8191afdc7c4962488182.png'
];
let academyLoadingImageTimer = null;
let academyLoadingCurrentImageUrl = null;
let currentTrainingProgress = { actions_used: 0, actions_limit: TRAINING_ACTION_LIMIT, remaining_actions: TRAINING_ACTION_LIMIT, completed: false, next_day: trainingWeekdays[0] };
let currentTrainingDay = trainingWeekdays[0];
let trainingEffectTimer = null;
let trainingEffectInFlight = false;
let trainingActionInFlight = false;
let trainingDayTransitionInFlight = false;
let academyRoomActionInFlight = false;
const trainingCardImageUrls = {
  artifact_appraisal: '/canonical/ui/card_images/artifact_appraisal.png',
  barrier_weaving: '/canonical/ui/card_images/barrier_weaving.png',
  broom_flight: '/canonical/ui/card_images/broom_flight.png',
  earth_barrier: '/canonical/ui/card_images/earth_barrier.png',
  elemental_sparring: '/canonical/ui/card_images/elemental_sparring.png',
  familiar_bonding: '/canonical/ui/card_images/familiar_bonding.png',
  flame_focus: '/canonical/ui/card_images/flame_focus.png',
  healing_practice: '/canonical/ui/card_images/healing_practice.png',
  library_study: '/canonical/ui/card_images/library_study.png',
  mana_control: '/canonical/ui/card_images/mana_control.png',
  physical_drills: '/canonical/ui/card_images/physical_drills.png',
  potion_brewing: '/canonical/ui/card_images/potion_brewing.png',
  ritual_research: '/canonical/ui/card_images/ritual_research.png',
  rune_calligraphy: '/canonical/ui/card_images/rune_calligraphy.png',
  salon_practice: '/canonical/ui/card_images/salon_practice.png',
  shadow_control: '/canonical/ui/card_images/shadow_control.png',
  spirit_listening: '/canonical/ui/card_images/spirit_listening.png',
  star_observation: '/canonical/ui/card_images/star_observation.png',
  water_meditation: '/canonical/ui/card_images/water_meditation.png',
  wind_step: '/canonical/ui/card_images/wind_step.png'
};
const trainingOptions = [
  { id: 'physical_drills', name: '体術トレーニング', element: 'earth', description: '筋力と瞬発力が、それぞれ50%で1上がります。50%で魔力が1下がります。', effectPreview: '筋力50% / 瞬発力50% / 魔力50%で-1', weekdayBonusLabel: '土曜: 対応属性効果×2' },
  { id: 'library_study', name: '図書塔で座学', element: 'light', description: '学力は50%、光魔法は50%で1上がります。50%で筋力が1下がります。', effectPreview: '学力50% / 光50% / 筋力50%で-1', weekdayBonusLabel: '光曜: 光効果×2' },
  { id: 'mana_control', name: '魔力制御練習', element: 'water', description: '魔力・水・風が、それぞれ50%で1上がります。50%で筋力が1下がります。', effectPreview: '魔力50% / 水50% / 風50% / 筋力50%で-1', weekdayBonusLabel: '水曜: 水効果×2' },
  { id: 'elemental_sparring', name: '属性模擬戦', element: 'fire', description: '火・土・闇が、それぞれ50%で1上がります。50%でカリスマが1下がります。', effectPreview: '火50% / 土50% / 闇50% / カリスマ50%で-1', weekdayBonusLabel: '火曜: 火効果×2' },
  { id: 'salon_practice', name: '交流サロン実践', element: 'wind', description: 'カリスマと学力が、それぞれ50%で1上がります。50%で闇魔法が1下がります。', effectPreview: 'カリスマ50% / 学力50% / 闇50%で-1', weekdayBonusLabel: '風曜: 対応属性効果×2' },
  { id: 'healing_practice', name: '治癒魔法実習', element: 'light', description: '光魔法と魔力が、それぞれ50%で1上がります。50%で闇魔法が1下がります。', effectPreview: '光50% / 魔力50% / 闇50%で-1', weekdayBonusLabel: '光曜: 光効果×2' },
  { id: 'shadow_control', name: '影制御訓練', element: 'dark', description: '闇魔法と魔力が、それぞれ50%で1上がります。50%で光魔法が1下がります。', effectPreview: '闇50% / 魔力50% / 光50%で-1', weekdayBonusLabel: '闇曜: 闇効果×2' },
  { id: 'flame_focus', name: '火球集中練習', element: 'fire', description: '火魔法と瞬発力が、それぞれ50%で1上がります。50%で水魔法が1下がります。', effectPreview: '火50% / 瞬発力50% / 水50%で-1', weekdayBonusLabel: '火曜: 火効果×2' },
  { id: 'water_meditation', name: '水鏡瞑想', element: 'water', description: '水魔法と学力が、それぞれ50%で1上がります。50%で火魔法が1下がります。', effectPreview: '水50% / 学力50% / 火50%で-1', weekdayBonusLabel: '水曜: 水効果×2' },
  { id: 'earth_barrier', name: '土壁構築演習', element: 'earth', description: '土魔法と筋力が、それぞれ50%で1上がります。50%で風魔法が1下がります。', effectPreview: '土50% / 筋力50% / 風50%で-1', weekdayBonusLabel: '土曜: 土効果×2' },
  { id: 'wind_step', name: '風歩法トレーニング', element: 'wind', description: '風魔法と瞬発力が、それぞれ50%で1上がります。50%で土魔法が1下がります。', effectPreview: '風50% / 瞬発力50% / 土50%で-1', weekdayBonusLabel: '風曜: 風効果×2' },
  { id: 'ritual_research', name: '儀式魔法研究', element: 'dark', description: '学力は50%、光・闇魔法は10%で1上がります。50%で瞬発力が1下がります。', effectPreview: '学力50% / 光10% / 闇10% / 瞬発力50%で-1', weekdayBonusLabel: '闇曜: 闇効果×2' },
  { id: 'artifact_appraisal', name: '魔導具鑑定演習', element: 'light', description: '学力と光魔法が、それぞれ50%で1上がります。50%でカリスマが1下がります。', effectPreview: '学力50% / 光50% / カリスマ50%で-1', weekdayBonusLabel: '光曜: 光効果×2' },
  { id: 'barrier_weaving', name: '結界編み込み実習', element: 'earth', description: '土魔法と魔力が、それぞれ50%で1上がります。50%で火魔法が1下がります。', effectPreview: '土50% / 魔力50% / 火50%で-1', weekdayBonusLabel: '土曜: 土効果×2' },
  { id: 'broom_flight', name: '箒飛行訓練', element: 'wind', description: '風魔法と瞬発力が、それぞれ50%で1上がります。50%で筋力が1下がります。', effectPreview: '風50% / 瞬発力50% / 筋力50%で-1', weekdayBonusLabel: '風曜: 風効果×2' },
  { id: 'familiar_bonding', name: '使い魔絆結び', element: 'wind', description: 'カリスマと風魔法が、それぞれ50%で1上がります。50%で学力が1下がります。', effectPreview: 'カリスマ50% / 風50% / 学力50%で-1', weekdayBonusLabel: '風曜: 風効果×2' },
  { id: 'potion_brewing', name: '霊薬調合実習', element: 'water', description: '水魔法と学力が、それぞれ50%で1上がります。50%で瞬発力が1下がります。', effectPreview: '水50% / 学力50% / 瞬発力50%で-1', weekdayBonusLabel: '水曜: 水効果×2' },
  { id: 'rune_calligraphy', name: 'ルーン筆写鍛錬', element: 'light', description: '光魔法と学力が、それぞれ50%で1上がります。50%で闇魔法が1下がります。', effectPreview: '光50% / 学力50% / 闇50%で-1', weekdayBonusLabel: '光曜: 光効果×2' },
  { id: 'spirit_listening', name: '精霊傾聴訓練', element: 'dark', description: '闇魔法とカリスマが、それぞれ50%で1上がります。50%で筋力が1下がります。', effectPreview: '闇50% / カリスマ50% / 筋力50%で-1', weekdayBonusLabel: '闇曜: 闇効果×2' },
  { id: 'star_observation', name: '星詠み観測', element: 'light', description: '学力と光魔法が、それぞれ50%で1上がります。50%で水魔法が1下がります。', effectPreview: '学力50% / 光50% / 水50%で-1', weekdayBonusLabel: '光曜: 光効果×2' }
].map((training) => ({ ...training, cardImageUrl: trainingCardImageUrls[training.id] }));
let currentWorld = null;
let currentLmStudioSettings = null;
let lmStudioFetchedModelOptions = [];
let currentInventory = { money: 0, items: [] };
let currentShop = { shop_name: '学院購買部', items: [] };
let activeCharacterId = 'character_001';
let messageHistory = [];
let currentRuntimeState = null;
let currentActiveSlotId = null;
let slotLoadCanResumePlay = false;
let pendingDeleteSlotId = null;
const SLOT_LOAD_NOTE_MAX_LENGTH = 2000;
let playerInputIsComposing = false;
let conversationRequestInFlight = false;
let conversationFinalizationInFlight = false;
let activeConversationFinalizationPromise = null;
let processingToastTimer = null;
let economyMessageTimer = null;

function updateViewportMetrics() {
  const topbar = document.querySelector('.topbar');
  const topbarHeight = topbar && getComputedStyle(topbar).display !== 'none' ? topbar.getBoundingClientRect().height : 0;
  document.documentElement.style.setProperty('--runtime-topbar-height', `${Math.ceil(topbarHeight)}px`);
}

function activeCharacter() {
  return selectableCharacters.find((character) => character.character_id === activeCharacterId) ?? selectableCharacters[0] ?? { character_id: activeCharacterId, display_name: '選択中のキャラ' };
}

function characterAuthoringMessage() {
  return characterAuthoringCapability?.message ?? 'デスクトップ版ではキャラクター説明の編集は無効です。ブラウザ実行で編集してください。';
}

function characterAuthoringEnabled() {
  return characterAuthoringCapability?.enabled !== false;
}

function showScreen(name, { rerollAcademyMap = false } = {}) {
  document.body.classList.toggle('title-screen-active', name === 'title');
  document.body.classList.toggle('slot-load-screen-active', name === 'slot-load');
  document.body.classList.toggle('settings-screen-active', name === 'settings');
  updateViewportMetrics();
  if (name === 'academy-map' && conversationFinalizationInFlight) {
    showProcessingToast();
    return;
  }
  if (name !== 'academy-loading') stopAcademyLoadingImageRotation();
  if (name !== 'training') resetTrainingResultDisplay();
  if (name === 'academy-map') ensureAcademyMapCharacterAssignments({ force: rerollAcademyMap });
  for (const tab of tabs) tab.classList.toggle('active', tab.dataset.screen === name);
  for (const [screenName, element] of Object.entries(screens)) element.classList.toggle('active', screenName === name);
  if (name === 'academy-loading') startAcademyLoadingImageRotation();
  if (name === 'academy-companion') renderAcademyCompanionScreen();
  if (name === 'academy-conversation-session') renderAcademyConversationSessionScreen();
  if (name === 'academy-room') renderAcademyRoomScreen();
}

function requestedInitialScreen() {
  const initialScreen = new URLSearchParams(window.location.search).get('initialScreen');
  return initialScreen === 'title' ? 'title' : null;
}

function applyInitialScreenOverride() {
  if (requestedInitialScreen() === 'title') showScreen('title');
}

function clearVisibleConversation() {
  messageHistory = [];
  setConversationStatus('');
  renderMessageStream([]);
}

function setAcademyLoadingImage() {
  const image = document.querySelector('#academy-loading-image');
  if (!image || !academyLoadingImageUrls.length) return;
  let nextImageUrl = academyLoadingImageUrls[Math.floor(Math.random() * academyLoadingImageUrls.length)];
  if (academyLoadingImageUrls.length > 1) {
    while (nextImageUrl === academyLoadingCurrentImageUrl) {
      nextImageUrl = academyLoadingImageUrls[Math.floor(Math.random() * academyLoadingImageUrls.length)];
    }
  }
  academyLoadingCurrentImageUrl = nextImageUrl;
  image.src = nextImageUrl;
}

function startAcademyLoadingImageRotation() {
  setAcademyLoadingImage();
  if (academyLoadingImageTimer) clearInterval(academyLoadingImageTimer);
  academyLoadingImageTimer = setInterval(() => setAcademyLoadingImage(), ACADEMY_LOADING_IMAGE_ROTATION_MS);
}

function stopAcademyLoadingImageRotation() {
  if (!academyLoadingImageTimer) return;
  clearInterval(academyLoadingImageTimer);
  academyLoadingImageTimer = null;
}

function waitForConversationFinalization() {
  return activeConversationFinalizationPromise ?? Promise.resolve();
}

function waitForAcademyMapReadiness() {
  return waitForConversationFinalization();
}

function isEnteringGraduationEndingWeek() {
  return (currentRuntimeState?.elapsed_weeks ?? 0) + 1 >= GRADUATION_ENDING_WEEK
    && currentRuntimeState?.ending_completed !== true;
}

function setAcademyLoadingDestinationCopy(nextScreen, { copyKey = null, loadingCopy = null } = {}) {
  const copyByScreen = {
    'academy-conversation-session': {
      title: '会話セッションへ移動中',
      status: '会話の準備を待っています。'
    },
    'academy-training': {
      title: '次の一週間が始まります',
      status: '会話を終えて、次の一週間の鍛錬予定を整えています。'
    },
    'academy-room': {
      title: '自室へ移動中',
      status: '会話セッションの整理を続けながら自室を開いています。'
    },
    'academy-map': {
      title: '学院マップへ移動中',
      status: '会話セッションの整理と学院マップの準備を待っています。'
    }
  };
  const copyByKey = {
    'new-game-intro': {
      title: 'イントロダクションに進みます',
      status: 'メンター役の生徒があなたをお出迎えしてくれるようです'
    },
    'graduation-ending-start': {
      title: '卒業のときを迎えました',
      status: 'エンディングセッションに遷移します。'
    },
    'graduation-ending-complete': {
      title: '卒業しました。',
      status: 'スタート画面に遷移します。'
    }
  };
  const copy = loadingCopy ?? (copyKey ? copyByKey[copyKey] : null) ?? copyByScreen[nextScreen] ?? copyByScreen['academy-map'];
  const title = document.querySelector('#academy-loading-title');
  const status = document.querySelector('#academy-loading-status');
  if (title) title.textContent = copy.title;
  if (status) status.textContent = copy.status;
}

async function showAcademyLoadingScreenUntilReady({ readiness, nextScreen = null, refreshBeforeNextScreen = true, copyKey = null, loadingCopy = null }) {
  setAcademyLoadingDestinationCopy(nextScreen, { copyKey, loadingCopy });
  showScreen('academy-loading');
  const minimumDisplay = new Promise((resolve) => setTimeout(resolve, ACADEMY_LOADING_MINIMUM_MS));
  try {
    await Promise.all([minimumDisplay, readiness]);
  } catch (error) {
    reportLoadingError(error);
    throw error;
  }
  if (nextScreen == null) return;
  if (refreshBeforeNextScreen) await refresh();
  showScreen(nextScreen);
}

async function routeGraduationEndingSession(started, { loadingAlreadyVisible = false } = {}) {
  let openingStreamStartedResolve = null;
  let openingStreamStartedResolved = false;
  let openingPromise = Promise.resolve();
  const openingStreamStarted = new Promise((resolve) => {
    openingStreamStartedResolve = resolve;
  });
  const markOpeningStreamStarted = () => {
    if (openingStreamStartedResolved) return;
    openingStreamStartedResolved = true;
    openingStreamStartedResolve?.();
  };
  activeCharacterId = started.character_id ?? activeCharacterId;
  currentRuntimeState = started.state ?? currentRuntimeState;
  clearVisibleConversation();
  writeDebugLog({
    started_event_interaction: started.flag_id,
    character_id: started.character_id,
    location_id: started.location_id,
    state: started.state,
    screen: 'academy-conversation-session',
    route: 'graduation-ending'
  });
  const readiness = (async () => {
    await refresh();
    openingPromise = ensureOpeningUtterance({ onAssistantStreamStart: markOpeningStreamStarted });
    await Promise.race([openingStreamStarted, openingPromise]);
  })();
  try {
    conversationRequestInFlight = true;
    setConversationControlsDisabled(true);
    if (loadingAlreadyVisible) {
      try {
        await readiness;
      } catch (error) {
        reportLoadingError(error);
        throw error;
      }
      showScreen('academy-conversation-session');
    } else {
      await showAcademyLoadingScreenUntilReady({
        readiness,
        nextScreen: 'academy-conversation-session',
        refreshBeforeNextScreen: false,
        copyKey: 'graduation-ending-start'
      });
    }
    await openingPromise;
  } finally {
    conversationRequestInFlight = false;
    setConversationControlsDisabled(false);
  }
}

async function openAcademyRoomTraining() {
  if (academyRoomActionInFlight) {
    showProcessingToast();
    return;
  }
  academyRoomActionInFlight = true;
  setAcademyRoomActionButtonsDisabled(true);
  try {
    if (isEnteringGraduationEndingWeek()) {
      const readiness = (async () => {
        await waitForConversationFinalization();
        const started = await postJson('/api/academy/week/start', {});
        writeDebugLog(started);
        currentRuntimeState = started.state ?? currentRuntimeState;
        if (started.route === 'graduation-ending') {
          await routeGraduationEndingSession(started, { loadingAlreadyVisible: true });
          return;
        }
        showScreen('academy-training');
      })();
      await showAcademyLoadingScreenUntilReady({
        readiness,
        refreshBeforeNextScreen: false,
        copyKey: 'graduation-ending-start'
      });
      return;
    }
    const started = await postJson('/api/academy/week/start', {});
    writeDebugLog(started);
    currentRuntimeState = started.state ?? currentRuntimeState;
    if (started.route === 'graduation-ending') {
      await routeGraduationEndingSession(started);
      return;
    }
    await showAcademyLoadingScreenUntilReady({
      readiness: Promise.resolve(),
      nextScreen: 'academy-training',
      refreshBeforeNextScreen: false
    });
  } finally {
    academyRoomActionInFlight = false;
    setAcademyRoomActionButtonsDisabled(false);
  }
}

async function openAcademyRoomSkipTraining() {
  if (academyRoomActionInFlight) {
    showProcessingToast();
    return;
  }
  academyRoomActionInFlight = true;
  setAcademyRoomActionButtonsDisabled(true);
  try {
    if (isEnteringGraduationEndingWeek()) {
      const readiness = (async () => {
        await waitForConversationFinalization();
        const started = await postJson('/api/academy/week/start', {});
        writeDebugLog(started);
        currentRuntimeState = started.state ?? currentRuntimeState;
        if (started.route === 'graduation-ending') {
          await routeGraduationEndingSession(started, { loadingAlreadyVisible: true });
          return;
        }
        const skipped = await postJson('/api/training/skip', {});
        currentWorld = skipped.world;
        currentRuntimeState = skipped.state ?? currentRuntimeState;
        renderPlayerParametersEditor(currentWorld.player_parameters ?? {});
        renderTrainingPlayerParameters(currentWorld.player_parameters ?? {});
        renderTrainingProgress(skipped.training_progress);
        await refreshPrompt();
        await routeAfterCompletedAcademyTraining();
      })();
      await showAcademyLoadingScreenUntilReady({
        readiness,
        refreshBeforeNextScreen: false,
        copyKey: 'graduation-ending-start'
      });
      return;
    }
    const started = await postJson('/api/academy/week/start', {});
    writeDebugLog(started);
    currentRuntimeState = started.state ?? currentRuntimeState;
    if (started.route === 'graduation-ending') {
      await routeGraduationEndingSession(started);
      return;
    }
    const skipped = await postJson('/api/training/skip', {});
    currentWorld = skipped.world;
    currentRuntimeState = skipped.state ?? currentRuntimeState;
    renderPlayerParametersEditor(currentWorld.player_parameters ?? {});
    renderTrainingPlayerParameters(currentWorld.player_parameters ?? {});
    renderTrainingProgress(skipped.training_progress);
    await refreshPrompt();
    await routeAfterCompletedAcademyTraining();
  } finally {
    academyRoomActionInFlight = false;
    setAcademyRoomActionButtonsDisabled(false);
  }
}

async function routePendingEventFromAcademyMap() {
  const status = await refreshEventFlagStatus();
  const autoStartFlag = (status.pending_events ?? []).find((flag) => flag.interaction?.location_id && flag.character_id);
  if (!autoStartFlag) return false;
  await startAcademyConversationSessionFromPendingEvent(autoStartFlag.id);
  return true;
}

async function routeNewGameIntroFromTitle() {
  let openingStreamStartedResolve = null;
  let openingStreamStartedResolved = false;
  let openingPromise = Promise.resolve();
  const openingStreamStarted = new Promise((resolve) => {
    openingStreamStartedResolve = resolve;
  });
  const markOpeningStreamStarted = () => {
    if (openingStreamStartedResolved) return;
    openingStreamStartedResolved = true;
    openingStreamStartedResolve?.();
  };
  const status = await refreshEventFlagStatus();
  const introFlag = (status.pending_events ?? []).find((flag) => flag.id === 'event.opening_mentor_intro.ready' && flag.interaction?.location_id && flag.character_id);
  if (!introFlag) return false;
  const readiness = (async () => {
    const result = await postJson('/api/event-flags/start', { flag_id: introFlag.id, screen: 'academy-conversation-session' });
    activeCharacterId = result.character_id;
    currentRuntimeState = result.state ?? currentRuntimeState;
    clearVisibleConversation();
    writeDebugLog({
      started_event_interaction: introFlag.id,
      character_id: result.character_id,
      location_id: result.location_id,
      state: result.state,
      screen: 'academy-conversation-session',
      route: 'new-game-intro'
    });
    await refresh();
    openingPromise = ensureOpeningUtterance({ onAssistantStreamStart: markOpeningStreamStarted });
    await Promise.race([openingStreamStarted, openingPromise]);
  })();
  try {
    conversationRequestInFlight = true;
    setConversationControlsDisabled(true);
    await showAcademyLoadingScreenUntilReady({
      readiness,
      nextScreen: 'academy-conversation-session',
      refreshBeforeNextScreen: false,
      copyKey: 'new-game-intro'
    });
    await openingPromise;
    return true;
  } finally {
    conversationRequestInFlight = false;
    setConversationControlsDisabled(false);
  }
}

async function routeAfterCompletedAcademyTraining() {
  setAcademyLoadingDestinationCopy('academy-map');
  showScreen('academy-loading');
  const minimumDisplay = new Promise((resolve) => setTimeout(resolve, ACADEMY_LOADING_MINIMUM_MS));
  await Promise.all([minimumDisplay, waitForAcademyMapReadiness()]);
  const status = await refreshEventFlagStatus();
  const autoStartFlag = (status.pending_events ?? []).find((flag) => flag.interaction?.location_id && flag.character_id);
  if (autoStartFlag) {
    await startAcademyConversationSessionFromPendingEvent(autoStartFlag.id, { loadingAlreadyVisible: true });
    return;
  }
  await refresh();
  showScreen('academy-map');
}

for (const tab of tabs) {
  tab.addEventListener('click', () => {
    if (tab.dataset.screen === 'interaction') {
      openInteractionTab().catch(reportError);
      return;
    }
    if (tab.dataset.screen === 'event') {
      openEventTab().catch(reportError);
      return;
    }
    if (tab.dataset.screen === 'slot-load') {
      openLoadScreen({ canResumePlay: document.body.classList.contains('play-mode') }).catch(reportError);
      return;
    }
    if (tab.dataset.screen === 'settings') {
      showScreen('settings');
      loadLmStudioSettings().catch(reportError);
      return;
    }
    showScreen(tab.dataset.screen);
  });
}

async function getJson(url) {
  const response = await fetch(url);
  return readJsonResponse(response, url);
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  return readJsonResponse(response, url);
}

function createApiError({ url, status, payload, fallbackText = '' }) {
  const message = payload?.error ?? `${url}: ${status} ${fallbackText}`.trim();
  const error = new Error(message);
  error.statusCode = status;
  error.errorCode = payload?.error_code ?? null;
  error.payload = payload ?? null;
  return error;
}

function parseJsonText(text) {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function readJsonResponse(response, url) {
  const text = await response.text();
  const payload = parseJsonText(text);
  if (!response.ok) throw createApiError({ url, status: response.status, payload, fallbackText: text });
  return payload;
}

function defaultLmStudioSettings() {
  return {
    connection_mode: 'localhost',
    host: '127.0.0.1',
    port: 1234,
    base_url: 'http://127.0.0.1:1234/v1',
    model: '',
    chat_model: '',
    reflection_model: '',
    timeout_ms: null,
    stream: false,
    provider: 'lmstudio',
    mock_provider_enabled: false
  };
}

function lmStudioSettingsElements() {
  return {
    status: document.querySelector('#lmstudio-settings-status'),
    localhost: document.querySelector('#lmstudio-connection-mode-localhost'),
    lan: document.querySelector('#lmstudio-connection-mode-lan'),
    host: document.querySelector('#lmstudio-host'),
    port: document.querySelector('#lmstudio-port'),
    baseUrl: document.querySelector('#lmstudio-base-url'),
    model: document.querySelector('#lmstudio-model'),
    modelStatus: document.querySelector('#lmstudio-model-status'),
    fetchModelsButton: document.querySelector('#fetch-lmstudio-models'),
    saveButton: document.querySelector('#save-lmstudio-settings')
  };
}

function normalizeLmStudioHost(value) {
  return String(value ?? '').trim();
}

function normalizeLmStudioModelValue(value) {
  return String(value ?? '').trim();
}

function buildLmStudioBaseUrl({ connectionMode, host, port }) {
  const normalizedPort = Number(port);
  const normalizedHost = connectionMode === 'localhost' ? '127.0.0.1' : normalizeLmStudioHost(host);
  return `http://${normalizedHost}:${normalizedPort}/v1`;
}

function effectiveLmStudioModel(settings = currentLmStudioSettings) {
  return normalizeLmStudioModelValue(settings?.model ?? settings?.chat_model ?? settings?.reflection_model ?? '');
}

function normalizeLmStudioModelOptions(models = []) {
  return models
    .map((entry) => {
      const id = normalizeLmStudioModelValue(entry?.id);
      if (!id) return null;
      return {
        id,
        label: normalizeLmStudioModelValue(entry?.label) || id
      };
    })
    .filter(Boolean);
}

function setLmStudioSettingsStatus(message) {
  const { status } = lmStudioSettingsElements();
  if (status) status.textContent = message;
}

function setLmStudioModelStatus(message) {
  const { modelStatus } = lmStudioSettingsElements();
  if (modelStatus) modelStatus.textContent = message;
}

function syncLmStudioConnectionModeUi() {
  const { localhost, host, port, baseUrl } = lmStudioSettingsElements();
  const localhostMode = localhost?.checked === true;
  if (host) {
    host.disabled = localhostMode;
    if (localhostMode) host.value = '127.0.0.1';
  }
  const activeHost = localhostMode ? '127.0.0.1' : normalizeLmStudioHost(host?.value);
  const activePort = Number(port?.value || 1234);
  if (baseUrl) {
    baseUrl.textContent = activeHost && Number.isFinite(activePort)
      ? `接続URL: ${buildLmStudioBaseUrl({ connectionMode: localhostMode ? 'localhost' : 'lan', host: activeHost, port: activePort })}`
      : '接続URL: 入力待ち';
  }
}

function renderLmStudioModelOptions(settings = currentLmStudioSettings) {
  const { model } = lmStudioSettingsElements();
  if (!model) return;
  const selectedModel = effectiveLmStudioModel(settings);
  const fetchedOptions = normalizeLmStudioModelOptions(lmStudioFetchedModelOptions);
  const hasCurrentValue = fetchedOptions.some((option) => option.id === selectedModel);
  const options = fetchedOptions.slice();
  if (selectedModel && !hasCurrentValue) {
    options.unshift({ id: selectedModel, label: `${selectedModel}（現在の保存値・一覧外）` });
  }

  const placeholder = selectedModel
    ? { id: '', label: 'モデルを選択してください' }
    : { id: '', label: 'モデル一覧を取得してください' };
  model.innerHTML = '';
  model.append(new Option(placeholder.label, placeholder.id));
  for (const option of options) {
    model.append(new Option(option.label, option.id));
  }
  model.value = selectedModel || '';

  if (selectedModel && !hasCurrentValue && fetchedOptions.length > 0) {
    setLmStudioModelStatus(`現在モデル: ${selectedModel}（取得した一覧には見つかりませんでした）`);
  } else if (selectedModel) {
    setLmStudioModelStatus(`現在モデル: ${selectedModel}`);
  } else if (fetchedOptions.length > 0) {
    setLmStudioModelStatus('モデルを選択してください。');
  } else {
    setLmStudioModelStatus('モデル一覧を取得してください。');
  }
}

function renderLmStudioSettings(settings = currentLmStudioSettings ?? defaultLmStudioSettings()) {
  if (!settings) return;
  const { localhost, lan, host, port } = lmStudioSettingsElements();
  const connectionMode = settings.connection_mode === 'lan' ? 'lan' : 'localhost';
  if (localhost) localhost.checked = connectionMode === 'localhost';
  if (lan) lan.checked = connectionMode === 'lan';
  if (host) host.value = settings.host ?? '127.0.0.1';
  if (port) port.value = String(settings.port ?? 1234);
  syncLmStudioConnectionModeUi();
  renderLmStudioModelOptions(settings);
  setLmStudioSettingsStatus(`現在: ${settings.base_url}`);
}

async function loadLmStudioSettings() {
  setLmStudioSettingsStatus('現在の接続先を読み込み中です。');
  try {
    currentLmStudioSettings = await getJson('/api/settings/lmstudio');
  } catch (error) {
    if (error?.errorCode !== 'LMSTUDIO_CONFIG_REQUIRED') throw error;
    currentLmStudioSettings = defaultLmStudioSettings();
    lmStudioFetchedModelOptions = [];
    renderLmStudioSettings(currentLmStudioSettings);
    setLmStudioSettingsStatus('LM Studioの設定が必要です。設定画面で接続先とモデルを保存してください。');
    return currentLmStudioSettings;
  }
  lmStudioFetchedModelOptions = [];
  renderLmStudioSettings(currentLmStudioSettings);
  return currentLmStudioSettings;
}

async function fetchLmStudioModels() {
  const { localhost, host, port, fetchModelsButton } = lmStudioSettingsElements();
  const connectionMode = localhost?.checked ? 'localhost' : 'lan';
  setLmStudioModelStatus('モデル一覧を取得中です。');
  if (fetchModelsButton) fetchModelsButton.disabled = true;
  try {
    const response = await fetch('/api/settings/lmstudio/models', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        connection_mode: connectionMode,
        host: host?.value,
        port: Number(port?.value || 1234)
      })
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`/api/settings/lmstudio/models: ${response.status} ${text}`);
    const payload = text ? JSON.parse(text) : { models: [] };
    lmStudioFetchedModelOptions = normalizeLmStudioModelOptions(payload.models);
    renderLmStudioModelOptions(currentLmStudioSettings);
    setLmStudioSettingsStatus(`現在: ${payload.base_url ?? buildLmStudioBaseUrl({ connectionMode, host: host?.value, port: Number(port?.value || 1234) })}`);
    if ((lmStudioFetchedModelOptions ?? []).length === 0) {
      setLmStudioModelStatus('利用可能なモデルは返ってきませんでした。');
    }
    return payload;
  } finally {
    if (fetchModelsButton) fetchModelsButton.disabled = false;
  }
}

async function saveLmStudioSettings() {
  const { localhost, host, port, model, saveButton } = lmStudioSettingsElements();
  const connectionMode = localhost?.checked ? 'localhost' : 'lan';
  setLmStudioSettingsStatus('保存中です。');
  if (saveButton) saveButton.disabled = true;
  try {
    const response = await fetch('/api/settings/lmstudio', {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        connection_mode: connectionMode,
        host: host?.value,
        port: Number(port?.value || 1234),
        model: model?.value
      })
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`/api/settings/lmstudio: ${response.status} ${text}`);
    currentLmStudioSettings = text ? JSON.parse(text) : null;
    renderLmStudioSettings(currentLmStudioSettings);
    return currentLmStudioSettings;
  } finally {
    if (saveButton) saveButton.disabled = false;
  }
}

function normalizeSlotNoteValue(value) {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()
    .slice(0, SLOT_LOAD_NOTE_MAX_LENGTH);
}

function describeSlotNoteStatus(note) {
  const length = String(note ?? '').length;
  return length ? `${length}/${SLOT_LOAD_NOTE_MAX_LENGTH}文字` : '空欄のままでも保存できます。';
}

async function saveSlotNote(slotId, playerNote) {
  const response = await fetch(`/api/slots/${encodeURIComponent(slotId)}/note`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ player_note: playerNote })
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`/api/slots/${encodeURIComponent(slotId)}/note: ${response.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

function renderSlotNoteEditor(slot) {
  const editor = document.createElement('div');
  editor.className = 'slot-load-note-editor';

  const label = document.createElement('label');
  label.className = 'slot-load-note-label';

  const heading = document.createElement('span');
  heading.textContent = 'メモ';

  const textarea = document.createElement('textarea');
  textarea.name = `player_note_${slot.slot_id}`;
  textarea.placeholder = 'このスロットの進行メモ';
  textarea.maxLength = SLOT_LOAD_NOTE_MAX_LENGTH;
  textarea.value = slot.player_note ?? '';
  textarea.dataset.lastSaved = normalizeSlotNoteValue(slot.player_note ?? '');

  const status = document.createElement('small');
  status.className = 'slot-load-note-status';
  status.textContent = describeSlotNoteStatus(textarea.dataset.lastSaved);

  textarea.addEventListener('input', () => {
    const normalized = normalizeSlotNoteValue(textarea.value);
    status.textContent = normalized === (textarea.dataset.lastSaved ?? '')
      ? describeSlotNoteStatus(normalized)
      : '編集中…';
  });

  textarea.addEventListener('blur', () => {
    const run = async () => {
      const normalized = normalizeSlotNoteValue(textarea.value);
      if (normalized === (textarea.dataset.lastSaved ?? '')) {
        textarea.value = normalized;
        status.textContent = describeSlotNoteStatus(normalized);
        return;
      }
      textarea.disabled = true;
      status.textContent = '保存中…';
      const result = await saveSlotNote(slot.slot_id, textarea.value);
      const savedNote = result?.slot?.player_note ?? normalized;
      textarea.value = savedNote;
      textarea.dataset.lastSaved = savedNote;
      status.textContent = describeSlotNoteStatus(savedNote);
      await refreshSaveSlots();
    };
    run().catch(reportError).finally(() => {
      textarea.disabled = false;
    });
  });

  label.append(heading, textarea);
  editor.append(label, status);
  return editor;
}

function characterSceneStandeeUrl(character = activeCharacter()) {
  return character?.standee_url ?? '';
}

function sourceSheetImageUrl({ expression = 'neutral', view = 'standee', characterId = activeCharacterId } = {}) {
  const character = selectableCharacters.find((item) => item.character_id === characterId) ?? activeCharacter();
  const visualSetId = character.visual_set_id;
  if (view === 'standee') return characterSceneStandeeUrl(character);
  if (expression === 'neutral' && character.face_url) return character.face_url;
  return `/canonical/character_visual_sets/${visualSetId}/face_emotions/${expression}.png`;
}

function renderCharacterDetailStandees(character = activeCharacter()) {
  for (const selector of ['#field-character-detail-standee', '#interaction-character-detail-standee', '#academy-companion-character-detail-standee', '#academy-conversation-session-character-detail-standee']) {
    const image = document.querySelector(selector);
    if (!image) continue;
    image.src = characterSceneStandeeUrl(character);
    image.alt = `${character.display_name ?? character.character_id}の一枚絵`;
  }
}

function splitAssistantContent(message) {
  const content = message.content ?? '';
  const parts = [];
  let index = 0;
  const matcher = /（([^（）]+)）|\(([^()]+)\)/g;
  for (const match of content.matchAll(matcher)) {
    const before = content.slice(index, match.index).trim();
    if (before) parts.push({ ...message, content: before });
    const narration = (match[1] ?? match[2] ?? '').trim();
    if (narration) {
      parts.push({
        role: 'narration',
        content: narration,
        face_emotion_variant_id: 'narration_face',
        expression: 'narration'
      });
    }
    index = match.index + match[0].length;
  }
  const after = content.slice(index).trim();
  if (after) parts.push({ ...message, content: after });
  return parts.length ? parts : [message];
}

function displayMessages(messages) {
  return messages.flatMap((message, messageIndex) => {
    const withIndex = (entry) => ({ ...entry, __message_index: messageIndex });
    return message.role === 'assistant' ? splitAssistantContent(message).map(withIndex) : [withIndex(message)];
  });
}

function completedAssistantPrefix(content) {
  let completedEnd = 0;
  let index = 0;
  const matcher = /（([^（）]+)）|\(([^()]+)\)/g;
  for (const match of content.matchAll(matcher)) {
    if (match.index > index) completedEnd = match.index;
    index = match.index + match[0].length;
    completedEnd = index;
  }
  const nextParen = content.slice(index).search(/[（(]/);
  if (nextParen >= 0) completedEnd = index + nextParen;
  return content.slice(0, completedEnd).trim();
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function hasConversationEditItem(inventory = currentInventory) {
  return (inventory?.items ?? []).some((item) => item.item_id === CONVERSATION_EDIT_ITEM_ID && Number(item.quantity ?? 0) > 0);
}


function createMessageRows(displayList, popFromDisplayIndex = -1) {
  return displayList.map((message, index) => {
    const row = document.createElement('article');
    row.className = `chat-message ${message.role === 'user' ? 'player-message' : message.role === 'narration' ? 'narration-message' : 'character-message'}`;
    if (popFromDisplayIndex >= 0 && index >= popFromDisplayIndex && message.role !== 'user') row.classList.add('pop-in');
    if (message.role !== 'user' && message.role !== 'narration') {
      const faceFrame = document.createElement('div');
      faceFrame.className = 'message-face';
      const face = document.createElement('img');
      face.alt = `${message.character_name ?? activeCharacter().display_name} ${message.face_emotion_variant_id ?? 'face_neutral'}`;
      face.src = sourceSheetImageUrl({ expression: message.expression ?? 'neutral', view: 'face', characterId: message.character_id ?? activeCharacterId });
      faceFrame.append(face);
      row.append(faceFrame);
    }
    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    if (message.role !== 'user' && message.role !== 'narration') {
      const name = document.createElement('strong');
      name.className = 'message-speaker';
      name.textContent = message.character_name ?? activeCharacter().display_name;
      bubble.append(name);
    }
    const text = document.createElement('p');
    text.textContent = message.content ?? '';
    bubble.append(text);
    if (message.role === 'user' && hasConversationEditItem()) {
      const editButton = document.createElement('button');
      editButton.type = 'button';
      editButton.className = 'message-edit-button';
      editButton.textContent = '編集';
      editButton.addEventListener('click', () => editUserMessageAtIndex(message.__message_index).catch(reportError));
      bubble.append(editButton);
    }
    row.append(bubble);
    return row;
  });
}

function renderMessageStream(messages = messageHistory, { popFromDisplayIndex = -1 } = {}) {
  messageHistory = messages;
  const displayList = displayMessages(messages);
  for (const selector of ['#message-stream', '#academy-conversation-session-message-stream']) {
    const stream = document.querySelector(selector);
    if (!stream) continue;
    stream.replaceChildren(...createMessageRows(displayList, popFromDisplayIndex));
    stream.scrollTop = stream.scrollHeight;
  }
}

function messagesFromConversation(conversation) {
  return (conversation?.messages ?? []).map((message) => {
    if (message.role === 'assistant') {
      return {
        role: 'assistant',
        character_id: activeCharacterId,
        character_name: activeCharacter().display_name,
        content: message.content ?? '',
        face_emotion_variant_id: message.face_emotion_variant_id ?? 'face_neutral',
        expression: message.expression ?? 'neutral'
      };
    }
    return { role: 'user', content: message.content ?? '' };
  });
}

function writeDebugLog(_value) {
  // Debug result panel was removed from the screen.
}

function showProcessingToast() {
  const toast = document.querySelector('#conversation-processing-toast');
  if (!toast) return;
  toast.classList.add('visible');
  if (processingToastTimer) clearTimeout(processingToastTimer);
  processingToastTimer = setTimeout(() => {
    toast.classList.remove('visible');
    processingToastTimer = null;
  }, 1000);
}

function showEconomyMessage(message) {
  const box = document.querySelector('#economy-message-box');
  if (!box) return;
  box.textContent = message;
  box.classList.add('visible');
  if (economyMessageTimer) clearTimeout(economyMessageTimer);
  economyMessageTimer = setTimeout(() => {
    box.classList.remove('visible');
    economyMessageTimer = null;
  }, 1800);
}

function setAcademyMapNavigationDisabled(disabled) {
  const tab = document.querySelector('[data-screen="academy-map"]');
  if (!tab) return;
  tab.disabled = disabled;
  tab.setAttribute('aria-disabled', disabled ? 'true' : 'false');
}

function setConversationControlsDisabled(disabled) {
  for (const selector of ['#run-conversation', '#end-conversation', '#academy-conversation-session-run-conversation', '#academy-conversation-session-end-conversation']) {
    const button = document.querySelector(selector);
    if (button) button.disabled = disabled;
  }
}

function conversationProvider() {
  return 'lmstudio';
}

function conversationShouldAutoEnd(result) {
  return result?.conversation?.conversation_continuation?.continue_conversation === false;
}

async function autoEndConversationAfterFinalReply(result) {
  if (!conversationShouldAutoEnd(result)) return false;
  setStreamStatus('reflection: auto-ending after final reply');
  await sleep(FINAL_REPLY_AUTO_END_DELAY_MS);
  await endConversation({ allowDuringInFlight: true });
  return true;
}

function renderConversationResult(result, { revealAssistant = false } = {}) {
  const previousDisplayCount = displayMessages(messageHistory).length;
  renderMessageStream(messagesFromConversation(result.conversation), {
    popFromDisplayIndex: revealAssistant ? previousDisplayCount : -1
  });
  writeDebugLog({
    conversation_id: result.conversation.id,
    validator: result.validator,
    state: result.state
  });
}

function commitConversationResultState(result) {
  messageHistory = messagesFromConversation(result.conversation);
}

async function renderConversationResultSequentially(result) {
  const previousDisplay = displayMessages(messageHistory);
  const fullMessages = messagesFromConversation(result.conversation);
  const fullDisplay = displayMessages(fullMessages);
  const newSegments = fullDisplay.slice(previousDisplay.length);

  writeDebugLog({
    conversation_id: result.conversation.id,
    validator: result.validator,
    state: result.state
  });

  for (let index = 0; index < newSegments.length; index += 1) {
    renderMessageStream([
      ...previousDisplay,
      ...newSegments.slice(0, index + 1)
    ], { popFromDisplayIndex: previousDisplay.length + index });
    await sleep(500);
  }

  // Keep the revealed DOM in place after the last segment. Replacing it with
  // freshly split rows here subtly shifts character and narration bubbles at
  // the moment the reply finishes; only the canonical state needs to switch
  // back from display segments to raw conversation messages.
  commitConversationResultState(result);
}

async function ensureOpeningUtterance({ onAssistantStreamStart = null } = {}) {
  if (messageHistory.length > 0) return;
  const provider = conversationProvider();
  setStreamStatus(provider === 'lmstudio' ? 'opening: generating with LM Studio' : 'opening: generating');
  if (provider === 'lmstudio') {
    await runOpeningConversationStream({ provider, onAssistantStreamStart });
  } else {
    onAssistantStreamStart?.();
    const result = await postJson('/api/conversation/opening', { character_id: activeCharacterId, provider });
    await renderConversationResultSequentially(result);
  }
  setStreamStatus('opening: completed');
  await Promise.all([refreshPrompt(), refreshRecordStatus()]);
}

let lastStreamStatusAt = 0;
let pendingStreamStatus = null;
let streamStatusFrame = null;

function setConversationStatus(message, { tone = '' } = {}) {
  const status = document.querySelector('#academy-conversation-session-status');
  if (!status) return;
  const text = String(message ?? '').trim();
  if (!text) {
    status.hidden = true;
    status.textContent = '';
    delete status.dataset.tone;
    return;
  }
  status.hidden = false;
  status.textContent = text;
  if (tone) status.dataset.tone = tone;
  else delete status.dataset.tone;
}

function setStreamStatus(text, { immediate = false, tone = '' } = {}) {
  const normalized = String(text ?? '').trim();
  pendingStreamStatus = normalized;
  if (immediate) {
    lastStreamStatusAt = Date.now();
    if (normalized) setConversationStatus(normalized, { tone });
    return;
  }
  if (streamStatusFrame) cancelAnimationFrame(streamStatusFrame);
  streamStatusFrame = requestAnimationFrame(() => {
    streamStatusFrame = null;
    lastStreamStatusAt = Date.now();
  });
}


function playerParameterInput({ group, key, label, value }) {
  const wrapper = document.createElement('label');
  wrapper.className = 'parameter-input';
  wrapper.textContent = label;
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.max = '100';
  input.step = '1';
  input.value = String(value?.value ?? value ?? 0);
  input.dataset.parameterGroup = group;
  input.dataset.parameterKey = key;
  wrapper.append(input);
  return wrapper;
}

function renderPlayerParametersEditor(parameters = {}) {
  const container = document.querySelector('#player-parameters-editor');
  const magic = document.createElement('fieldset');
  const magicLegend = document.createElement('legend');
  magicLegend.textContent = 'プレイヤーの魔法習熟度（0〜100）';
  magic.append(magicLegend, ...magicParameterDefinitions.map(([key, label]) => playerParameterInput({ group: 'magic', key, label, value: parameters.magic?.[key] })));
  const abilities = document.createElement('fieldset');
  const abilitiesLegend = document.createElement('legend');
  abilitiesLegend.textContent = 'プレイヤーの基礎パラメーター（0〜100）';
  abilities.append(abilitiesLegend, ...abilityParameterDefinitions.map(([key, label]) => playerParameterInput({ group: 'abilities', key, label, value: parameters.abilities?.[key] })));
  container.replaceChildren(magic, abilities);
}

function setPlayerParameterGroupToValue(group, value) {
  const normalized = Math.max(0, Math.min(100, Number(value)));
  document.querySelectorAll(`#player-parameters-editor input[data-parameter-group="${group}"]`).forEach((input) => {
    input.value = String(normalized);
  });
}

function wirePlayerParameterPresets() {
  document.querySelectorAll('[data-parameter-preset-group][data-parameter-preset-value]').forEach((button) => {
    button.addEventListener('click', () => {
      const presetValue = Number(button.dataset.parameterPresetValue);
      if (!PLAYER_PARAMETER_PRESET_VALUES.includes(presetValue)) return;
      setPlayerParameterGroupToValue(button.dataset.parameterPresetGroup, presetValue);
    });
  });
}

function collectPlayerParameters() {
  const parameters = { magic: {}, abilities: {} };
  document.querySelectorAll('#player-parameters-editor input[data-parameter-group]').forEach((input) => {
    parameters[input.dataset.parameterGroup][input.dataset.parameterKey] = Number(input.value || 0);
  });
  return parameters;
}

function renderParameterGroup(title, definitions, values = {}) {
  const section = document.createElement('section');
  section.className = 'character-parameter-section';
  const heading = document.createElement('h4');
  heading.textContent = title;
  const grid = document.createElement('div');
  grid.className = 'character-parameter-group';
  const items = definitions.map(([key, shortLabel]) => {
    const stat = values?.[key];
    const value = Math.max(0, Math.min(100, Number(stat?.value ?? stat ?? 0)));
    const item = document.createElement('div');
    item.className = 'character-parameter-item';
    const label = document.createElement('span');
    label.textContent = shortLabel;
    const meter = document.createElement('meter');
    meter.min = 0;
    meter.max = 100;
    meter.value = value;
    const number = document.createElement('strong');
    number.textContent = String(value);
    item.append(label, meter, number);
    return item;
  });
  grid.replaceChildren(...items);
  section.append(heading, grid);
  return section;
}

function renderCharacterParametersInto(character, containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.replaceChildren(
    renderParameterGroup('魔法習熟度', magicParameterDefinitions, character.parameters?.magic),
    renderParameterGroup('基礎能力', abilityParameterDefinitions, character.parameters?.abilities)
  );
}

function renderInteractionCharacterParameters(character) {
  renderCharacterParametersInto(character, '#interaction-character-parameters');
  renderCharacterParametersInto(character, '#academy-conversation-session-character-parameters');
}

function renderTrainingPlayerParameters(parameters = {}) {
  renderPlayerParametersInto(parameters, '#training-player-parameters');
  renderPlayerParametersInto(parameters, '#academy-training-player-parameters');
  renderPlayerParametersInto(parameters, '#academy-room-player-parameters');
}

function renderPlayerParametersInto(parameters = {}, containerSelector) {
  const container = document.querySelector(containerSelector);
  if (!container) return;
  container.replaceChildren(
    renderParameterGroup('魔法習熟度', magicParameterDefinitions, parameters.magic),
    renderParameterGroup('基礎能力', abilityParameterDefinitions, parameters.abilities)
  );
}

function renderAcademyRoomInventoryItems(inventory = currentInventory) {
  const list = document.querySelector('#academy-room-inventory-items');
  const count = document.querySelector('#academy-room-item-count');
  if (!list || !count) return;
  const items = inventory.items ?? [];
  count.textContent = `${items.length}種類`;
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'economy-empty';
    empty.textContent = '所持品はありません。';
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(...items.map((item) => {
    const row = document.createElement('article');
    row.className = 'academy-room-item-row';
    const title = document.createElement('strong');
    title.textContent = item.name ?? item.item_id;
    const quantity = document.createElement('span');
    quantity.className = 'academy-room-item-quantity';
    quantity.textContent = `×${Number(item.quantity ?? 0).toLocaleString('ja-JP')}`;
    const description = document.createElement('p');
    description.textContent = item.description ?? '';
    row.append(title, quantity, description);
    if (item.stat_effect) {
      const use = document.createElement('button');
      use.type = 'button';
      use.className = 'academy-room-item-use-button';
      use.textContent = '1個使う';
      use.addEventListener('click', () => useInventoryItem(item.item_id).catch(reportError));
      row.append(use);
    }
    return row;
  }));
}

function renderAcademyRoomBuddy() {
  const card = document.querySelector('#academy-room-buddy-card');
  const emptyContainer = document.querySelector('#academy-room-buddy-empty');
  if (!card || !emptyContainer) return;
  const buddyId = selectedAcademyBuddyCharacterId();
  const buddy = selectableCharacters.find((character) => character.character_id === buddyId);
  if (!buddy) {
    const empty = document.createElement('p');
    empty.className = 'panel-help';
    empty.textContent = '現在のバディーはいません。';
    card.classList.add('is-empty');
    emptyContainer.replaceChildren();
    card.replaceChildren(empty);
    return;
  }
  card.classList.remove('is-empty');
  emptyContainer.replaceChildren();
  const image = document.createElement('img');
  image.src = buddy.selection_icon_url ?? buddy.face_url ?? sourceSheetImageUrl({ characterId: buddy.character_id, view: 'face' });
  image.alt = `${buddy.display_name ?? buddy.character_id}の顔`;
  const body = document.createElement('div');
  const name = document.createElement('strong');
  name.textContent = buddy.display_name ?? buddy.character_id;
  const meta = document.createElement('small');
  meta.textContent = [buddy.school_year, buddy.club].filter(Boolean).join(' / ') || buddy.character_id;
  body.append(name, meta);
  card.replaceChildren(image, body);
}

function renderAcademyRoomEnemies() {
  const enemyIds = selectedAcademyEnemyCharacterIds();
  const count = document.querySelector('#academy-room-enemy-count');
  const list = document.querySelector('#academy-room-enemy-list');
  if (!list || !count) return;
  const enemies = selectableCharacters.filter((character) => enemyIds.has(character.character_id));
  count.textContent = `${enemies.length}人`;
  if (!enemies.length) {
    const empty = document.createElement('p');
    empty.className = 'panel-help';
    empty.textContent = '現在のエネミーはいません。';
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(...enemies.map((enemy) => {
    const row = document.createElement('div');
    row.className = 'academy-room-enemy-row';
    const image = document.createElement('img');
    image.src = enemy.selection_icon_url ?? enemy.face_url ?? sourceSheetImageUrl({ characterId: enemy.character_id, view: 'face' });
    image.alt = `${enemy.display_name ?? enemy.character_id}の顔`;
    const body = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = enemy.display_name ?? enemy.character_id;
    const meta = document.createElement('small');
    meta.textContent = [enemy.school_year, enemy.club].filter(Boolean).join(' / ') || enemy.character_id;
    body.append(name, meta);
    row.append(image, body);
    return row;
  }));
}

function academyRoomDisplayedWeekNumber(state = currentRuntimeState) {
  return Math.max(1, Number(state?.elapsed_weeks ?? 0) + 1);
}

function academyRoomDisplayedWeekLabel(state = currentRuntimeState) {
  return `第${academyRoomDisplayedWeekNumber(state)}週`;
}

function renderAcademyRoomScreen() {
  const weekElement = document.querySelector('#academy-room-week');
  if (weekElement) weekElement.textContent = academyRoomDisplayedWeekLabel(currentRuntimeState);
  document.querySelector('#academy-room-money').textContent = moneyText(currentInventory.money);
  renderTrainingPlayerParameters(currentWorld?.player_parameters ?? {});
  renderAcademyRoomBuddy();
  renderAcademyRoomEnemies();
  renderAcademyRoomInventoryItems(currentInventory);
  setAcademyRoomActionButtonsDisabled(academyRoomActionInFlight);
}

function trainingDayForProgress(progress = currentTrainingProgress) {
  if (progress?.next_day && Number(progress.actions_used ?? 0) > 0 && progress.completed !== true) return progress.next_day;
  const used = Number(progress?.actions_used ?? 0);
  const index = progress?.completed === true ? TRAINING_ACTION_LIMIT - 1 : Math.max(0, Math.min(TRAINING_ACTION_LIMIT - 1, used));
  return trainingWeekdays[index] ?? trainingWeekdays[0];
}

function renderTrainingWeekday(day = currentTrainingDay) {
  currentTrainingDay = day ?? trainingWeekdays[0];
  for (const selector of ['#training-weekday', '#academy-training-weekday']) {
    const element = document.querySelector(selector);
    if (!element) continue;
    element.textContent = `${currentTrainingDay.name}（${currentTrainingDay.element_label}）`;
    element.dataset.element = currentTrainingDay.element;
  }
}

function renderAcademyTrainingProgressSummary(progress = currentTrainingProgress) {
  const container = document.querySelector('#academy-training-result');
  if (!container) return;
  const normalizedProgress = {
    actions_used: Number(progress?.actions_used ?? 0),
    actions_limit: Number(progress?.actions_limit ?? TRAINING_ACTION_LIMIT),
    remaining_actions: Number(progress?.remaining_actions ?? TRAINING_ACTION_LIMIT),
    completed: progress?.completed === true,
    next_day: progress?.next_day ?? null
  };
  const day = trainingDayForProgress(normalizedProgress);
  const remaining = Math.max(0, Math.min(normalizedProgress.actions_limit, normalizedProgress.remaining_actions));
  const title = document.createElement('h4');
  title.textContent = '鍛錬状況';
  const remainingRow = document.createElement('p');
  remainingRow.className = 'academy-training-summary-row';
  remainingRow.textContent = `訓練可能回数: 残り ${remaining} / ${normalizedProgress.actions_limit}`;
  const weekdayRow = document.createElement('p');
  weekdayRow.className = 'academy-training-summary-row';
  weekdayRow.textContent = `現在の曜日: ${day.name}（${day.element_label}）`;
  container.replaceChildren(title, remainingRow, weekdayRow);
}

function renderTrainingProgress(progress = currentTrainingProgress) {
  currentTrainingProgress = {
    actions_used: Number(progress?.actions_used ?? 0),
    actions_limit: Number(progress?.actions_limit ?? TRAINING_ACTION_LIMIT),
    remaining_actions: Number(progress?.remaining_actions ?? TRAINING_ACTION_LIMIT),
    completed: progress?.completed === true,
    next_day: progress?.next_day ?? null
  };
  document.querySelectorAll('#training-progress, #academy-training-progress').forEach((element) => {
    element.textContent = `行動 ${currentTrainingProgress.actions_used} / ${currentTrainingProgress.actions_limit}`;
    element.classList.toggle('completed', currentTrainingProgress.completed);
  });
  renderTrainingWeekday(trainingDayForProgress(currentTrainingProgress));
  renderAcademyTrainingProgressSummary(currentTrainingProgress);
}

function triggerTrainingEffect(result) {
  const overlays = document.querySelectorAll('#training-effect-overlay, #academy-training-effect-overlay');
  if (!overlays.length) return Promise.resolve();
  const changedLabels = (result.effects ?? [])
    .filter((effect) => effect.amount !== 0)
    .map((effect) => `${effect.label}${effect.amount > 0 ? '+' : ''}${effect.amount}${effect.weekday_bonus ? '（曜日ボーナス）' : ''}`);
  const message = changedLabels.length ? changedLabels.join(' / ') : '集中したけれど、今回は変化なし';
  overlays.forEach((overlay) => {
    overlay.textContent = message;
    overlay.classList.remove('visible');
    void overlay.offsetWidth;
    overlay.classList.add('visible');
  });
  trainingEffectInFlight = true;
  setTrainingButtonsDisabled(true);
  if (trainingEffectTimer) clearTimeout(trainingEffectTimer);
  return new Promise((resolve) => {
    trainingEffectTimer = setTimeout(() => {
      overlays.forEach((overlay) => overlay.classList.remove('visible'));
      trainingEffectInFlight = false;
      setTrainingButtonsDisabled(false);
      trainingEffectTimer = null;
      resolve();
    }, 1000);
  });
}

function triggerTrainingDayTransition(result) {
  const overlays = document.querySelectorAll('#training-day-transition, #academy-training-day-transition');
  if (!overlays.length) return Promise.resolve();
  const day = result.training_day;
  const nextDay = result.training_progress?.next_day;
  const message = nextDay
    ? `${day?.name ?? '今日'}の訓練が終わり、夜が明けて${nextDay.name}へ。`
    : '鍛錬後の自由時間です。学院マップへ遷移します。';
  overlays.forEach((overlay) => {
    overlay.textContent = message;
    overlay.classList.remove('visible');
    void overlay.offsetWidth;
    overlay.classList.add('visible');
  });
  trainingDayTransitionInFlight = true;
  setTrainingButtonsDisabled(true);
  return new Promise((resolve) => {
    setTimeout(() => {
      overlays.forEach((overlay) => overlay.classList.remove('visible'));
      trainingDayTransitionInFlight = false;
      setTrainingButtonsDisabled(false);
      resolve();
    }, 2000);
  });
}

function resetTrainingResultDisplay() {
  const fallbackTextBySelector = {
    '#training-result': 'まだトレーニングしていません。'
  };
  Object.entries(fallbackTextBySelector).forEach(([selector, text]) => {
    const container = document.querySelector(selector);
    if (container) container.textContent = text;
  });
  renderAcademyTrainingProgressSummary(currentTrainingProgress);
  document.querySelectorAll('#training-effect-overlay, #academy-training-effect-overlay, #training-day-transition, #academy-training-day-transition')
    .forEach((overlay) => overlay.classList.remove('visible'));
}

function setTrainingButtonsDisabled(disabled) {
  document.querySelectorAll('.training-option-card').forEach((button) => {
    button.disabled = disabled || trainingActionInFlight || trainingEffectInFlight || trainingDayTransitionInFlight;
  });
}

function setAcademyRoomActionButtonsDisabled(disabled) {
  document.querySelectorAll('#academy-room-start-training, #academy-room-skip-training, #academy-room-open-load').forEach((button) => {
    button.disabled = disabled || academyRoomActionInFlight;
  });
}

function renderTrainingResult(result) {
  const containers = document.querySelectorAll('#training-result');
  if (!containers.length) return;
  if (!result) {
    containers.forEach((container) => {
      container.textContent = 'まだトレーニングしていません。';
    });
    return;
  }
  const buildResultFragment = () => {
    const fragment = document.createDocumentFragment();
    const title = document.createElement('h4');
    title.textContent = `${result.training.name} の結果`;
    const list = document.createElement('div');
    list.className = 'training-effect-list';
    const rows = result.effects.map((effect) => {
      const row = document.createElement('p');
      row.className = `training-effect ${effect.direction === 'decrease' ? 'decrease' : effect.amount > 0 ? 'increase' : 'no-change'}`;
      const chance = Math.round(Number(effect.chance ?? 0) * 100);
      if (effect.direction === 'decrease') {
        row.textContent = `${effect.label}: ${effect.before} → ${effect.after} (${chance}%で-1 / ${effect.amount < 0 ? '-1' : '変化なし'})`;
      } else {
        const bonus = effect.weekday_bonus ? ` / ${effect.bonus_multiplier}倍曜日ボーナス` : '';
        row.textContent = `${effect.label}: ${effect.before} → ${effect.after} (${chance}%で+1${bonus} / ${effect.amount > 0 ? `+${effect.amount}` : '変化なし'})`;
      }
      return row;
    });
    list.replaceChildren(...rows);
    fragment.append(title, list);
    return fragment;
  };
  containers.forEach((container) => container.replaceChildren(buildResultFragment()));
}

function createTrainingOptionCard(training, { compact = false } = {}) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = compact ? 'training-option-card compact' : 'training-option-card';
  button.dataset.trainingElement = training.element;
  const cardImage = document.createElement('img');
  cardImage.className = 'training-card-image';
  cardImage.src = training.cardImageUrl;
  cardImage.alt = `${training.name}のイメージ`;
  cardImage.loading = 'lazy';
  const body = document.createElement('span');
  body.className = 'training-card-body';
  const name = document.createElement('strong');
  name.textContent = training.name;
  body.append(name);
  if (!compact) {
    const preview = document.createElement('span');
    preview.className = 'training-effect-preview';
    preview.textContent = training.effectPreview;
    const weekdayBonus = document.createElement('span');
    weekdayBonus.className = 'training-weekday-bonus';
    weekdayBonus.textContent = training.weekdayBonusLabel;
    const description = document.createElement('small');
    description.textContent = training.description;
    body.append(preview, weekdayBonus, description);
  }
  button.append(cardImage, body);
  button.disabled = trainingActionInFlight || trainingEffectInFlight || trainingDayTransitionInFlight;
  button.addEventListener('click', () => runTraining(training.id).catch(reportError));
  return button;
}

function renderTrainingScreen() {
  const trainingList = document.querySelector('#training-options');
  if (trainingList) trainingList.replaceChildren(...trainingOptions.map((training) => createTrainingOptionCard(training)));
  const academyTrainingList = document.querySelector('#academy-training-options');
  if (academyTrainingList) academyTrainingList.replaceChildren(...trainingOptions.map((training) => createTrainingOptionCard(training, { compact: true })));
  renderTrainingProgress(currentTrainingProgress);
  renderTrainingPlayerParameters(currentWorld?.player_parameters ?? {});
}

async function runTraining(trainingId) {
  if (trainingActionInFlight || trainingEffectInFlight || trainingDayTransitionInFlight) {
    showProcessingToast();
    return;
  }
  trainingActionInFlight = true;
  setTrainingButtonsDisabled(true);
  try {
    const result = await postJson('/api/training/run', { training_id: trainingId });
    currentWorld = result.world;
    currentRuntimeState = result.state ?? currentRuntimeState;
    renderPlayerParametersEditor(currentWorld.player_parameters ?? {});
    renderTrainingPlayerParameters(currentWorld.player_parameters ?? {});
    renderTrainingProgress(result.training_progress);
    renderTrainingResult(result);
    await triggerTrainingEffect(result);
    await refreshPrompt();
    await triggerTrainingDayTransition(result);
    if (result.training_progress?.completed) {
      await routeAfterCompletedAcademyTraining();
    }
  } finally {
    trainingActionInFlight = false;
    setTrainingButtonsDisabled(false);
  }
}

function moneyText(value) {
  return `${Number(value ?? 0).toLocaleString('ja-JP')} G`;
}

function economyItemName(item = {}) {
  return item.name ?? item.item_id ?? '不明なアイテム';
}

function renderInventory(inventory = currentInventory) {
  const hadConversationEditItem = hasConversationEditItem(currentInventory);
  currentInventory = inventory;
  const hasCurrentConversationEditItem = hasConversationEditItem(currentInventory);
  if (hadConversationEditItem !== hasCurrentConversationEditItem && messageHistory.length > 0) renderMessageStream(messageHistory);
  document.querySelector('#inventory-money').textContent = `所持金: ${moneyText(inventory.money)}`;
  if (screens['academy-room']?.classList.contains('active')) renderAcademyRoomScreen();
  const list = document.querySelector('#inventory-items');
  const items = inventory.items ?? [];
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'economy-empty';
    empty.textContent = '所持品はありません。';
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(...items.map((item) => {
    const card = document.createElement('article');
    card.className = 'economy-item-card';
    const title = document.createElement('strong');
    title.textContent = `${item.name ?? item.item_id} ×${item.quantity}`;
    const description = document.createElement('p');
    description.textContent = item.description ?? '';
    const use = document.createElement('button');
    use.type = 'button';
    use.textContent = item.stat_effect ? '1個使う' : '使えません';
    use.disabled = !item.stat_effect;
    use.addEventListener('click', () => useInventoryItem(item.item_id).catch(reportError));
    const sell = document.createElement('button');
    sell.type = 'button';
    sell.textContent = `1個売る（${moneyText(item.sell_price)}）`;
    sell.addEventListener('click', () => sellInventoryItem(item.item_id).catch(reportError));
    card.append(title, description, use, sell);
    return card;
  }));
}

function renderShopInventoryColumn(inventory = currentInventory) {
  currentInventory = inventory;
  const money = document.querySelector('#shop-inventory-money');
  if (money) money.textContent = `所持金: ${moneyText(inventory.money)}`;
  const list = document.querySelector('#shop-inventory-items');
  if (!list) return;
  const items = inventory.items ?? [];
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'economy-empty';
    empty.textContent = '売ったり使ったりできる所持品はまだありません。';
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(...items.map((item) => {
    const card = document.createElement('article');
    card.className = 'economy-item-card';
    const title = document.createElement('strong');
    title.textContent = `${economyItemName(item)} ×${item.quantity}`;
    const price = document.createElement('small');
    price.textContent = `売値 ${moneyText(item.sell_price)}`;
    const description = document.createElement('p');
    description.textContent = item.description ?? '';
    const actionRow = document.createElement('div');
    actionRow.className = 'button-row shop-item-action-row';
    const use = document.createElement('button');
    use.type = 'button';
    use.textContent = item.stat_effect ? '1個使う' : '使えません';
    use.disabled = !item.stat_effect;
    use.addEventListener('click', () => useInventoryItem(item.item_id).catch(reportError));
    const sell = document.createElement('button');
    sell.type = 'button';
    sell.textContent = `1個売る（${moneyText(item.sell_price)}）`;
    sell.addEventListener('click', () => sellInventoryItem(item.item_id).catch(reportError));
    actionRow.append(use, sell);
    card.append(title, price, description, actionRow);
    return card;
  }));
}

function renderShop(shop = currentShop) {
  currentShop = shop;
  const title = document.querySelector('#shop-money-title');
  if (title) title.textContent = shop.shop_name ?? '学院購買部';
  const list = document.querySelector('#shop-items');
  list.replaceChildren(...(shop.items ?? []).map((item) => {
    const card = document.createElement('article');
    card.className = 'economy-item-card';
    const title = document.createElement('strong');
    title.textContent = item.name ?? item.item_id;
    const price = document.createElement('small');
    price.textContent = `買値 ${moneyText(item.buy_price)} / 売値 ${moneyText(item.sell_price)}`;
    const description = document.createElement('p');
    description.textContent = item.description ?? '';
    const buy = document.createElement('button');
    buy.type = 'button';
    buy.textContent = '1個買う';
    buy.disabled = Number(currentInventory.money ?? 0) < Number(item.buy_price ?? 0);
    buy.addEventListener('click', () => buyShopItem(item.item_id).catch(reportError));
    card.append(title, price, description, buy);
    return card;
  }));
}

async function refreshEconomy() {
  const [inventory, shop] = await Promise.all([getJson('/api/inventory'), getJson('/api/shop')]);
  currentInventory = inventory;
  currentShop = shop;
  renderInventory(inventory);
  renderShopInventoryColumn(inventory);
  renderShop(shop);
}

async function buyShopItem(itemId) {
  const result = await postJson('/api/shop/buy', { item_id: itemId, quantity: 1 });
  renderInventory(result.inventory);
  renderShopInventoryColumn(result.inventory);
  renderShop(currentShop);
  showEconomyMessage(`${result.item.name ?? result.item.item_id}を${moneyText(result.item.buy_price)}で購入しました。`);
}

async function useInventoryItem(itemId) {
  const result = await postJson('/api/inventory/use', { item_id: itemId });
  currentWorld = result.world;
  renderPlayerParametersEditor(currentWorld.player_parameters ?? {});
  renderTrainingScreen();
  renderInventory(result.inventory);
  renderShopInventoryColumn(result.inventory);
  renderShop(currentShop);
  showEconomyMessage(`${result.item.name ?? result.item.item_id}を1個使用しました。`);
  await refreshPrompt();
}

async function sellInventoryItem(itemId) {
  const result = await postJson('/api/shop/sell', { item_id: itemId, quantity: 1 });
  renderInventory(result.inventory);
  renderShopInventoryColumn(result.inventory);
  renderShop(currentShop);
  showEconomyMessage(`${result.item.name ?? result.item.item_id}を${moneyText(result.item.sell_price)}で売却しました。`);
}

function renderCharacterSelector() {
  const list = document.querySelector('#character-selection-list');
  const description = document.querySelector('#character-prompt-description');
  const speakingBasis = document.querySelector('#character-speaking-basis');
  const saveButton = document.querySelector('#save-character-description');
  const selectedCharacterSource = document.querySelector('#selected-character-source');
  const selected = activeCharacter();
  const authoringEnabled = characterAuthoringEnabled();
  document.querySelector('#selected-character-name-button').textContent = selected.display_name ?? selected.character_id;
  const fieldCharacterDetailTitle = document.querySelector('#field-character-detail-title');
  fieldCharacterDetailTitle.textContent = selected.display_name ?? selected.character_id;
  document.querySelector('#interaction-speaker').textContent = selected.display_name ?? selected.character_id;
  document.querySelector('#interaction-character-name-button').textContent = selected.display_name ?? selected.character_id;
  document.querySelector('#academy-conversation-session-character-name-button').textContent = selected.display_name ?? selected.character_id;
  const characterDetailTitle = document.querySelector('#interaction-character-detail-title');
  characterDetailTitle.textContent = selected.display_name ?? selected.character_id;
  document.querySelector('#academy-conversation-session-character-detail-title').textContent = selected.display_name ?? selected.character_id;
  document.querySelector('#interaction-character-description').textContent = selected.prompt_description ?? '';
  const interactionStandee = document.querySelector('#character-standee');
  if (interactionStandee) {
    interactionStandee.src = characterSceneStandeeUrl(selected);
    interactionStandee.alt = `${selected.display_name ?? selected.character_id}の立ち絵`;
    interactionStandee.hidden = !interactionStandee.src;
  }
  renderInteractionCharacterParameters(selected);
  renderCharacterDetailStandees(selected);
  selectedCharacterSource.textContent = authoringEnabled ? '' : characterAuthoringMessage();
  description.value = selected.prompt_description ?? '';
  speakingBasis.value = selected.speaking_basis ?? '';
  description.readOnly = !authoringEnabled;
  speakingBasis.readOnly = !authoringEnabled;
  saveButton.disabled = !authoringEnabled;
  saveButton.title = authoringEnabled ? '' : characterAuthoringMessage();
  list.replaceChildren(...selectableCharacters.map((character) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = character.character_id === activeCharacterId ? 'selected character-option' : 'character-option';
    button.dataset.characterId = character.character_id;
    const thumb = document.createElement('img');
    thumb.src = character.selection_icon_url ?? character.face_url;
    thumb.alt = `${character.display_name} neutral face`;
    const label = document.createElement('span');
    label.innerHTML = `<strong>${character.display_name}</strong>`;
    button.append(thumb, label);
    button.addEventListener('click', () => {
      activeCharacterId = character.character_id;
      clearVisibleConversation();
      renderCharacterSelector();
      renderRelationshipDebugControls();
      refreshPrompt().catch(reportError);
      refreshRecordStatus().catch(reportError);
      openFieldCharacterDetail();
    });
    return button;
  }));
}

async function refreshCharacters() {
  const result = await getJson('/api/characters');
  selectableCharacters = result.characters ?? [];
  characterAuthoringCapability = result.capabilities?.character_authoring ?? { enabled: true, reason: null, message: null };
  if (!selectableCharacters.some((character) => character.character_id === activeCharacterId)) {
    activeCharacterId = selectableCharacters[0]?.character_id ?? activeCharacterId;
  }
  renderCharacterSelector();
  renderRelationshipDebugControls();
}

async function saveSelectedCharacterDescription() {
  if (!characterAuthoringEnabled()) return;
  const promptDescription = document.querySelector('#character-prompt-description').value;
  const speakingBasis = document.querySelector('#character-speaking-basis').value;
  const result = await postJson('/api/characters/profile', { character_id: activeCharacterId, prompt_description: promptDescription, speaking_basis: speakingBasis });
  selectableCharacters = selectableCharacters.map((character) => character.character_id === activeCharacterId
    ? { ...character, prompt_description: result.profile.prompt_description, speaking_basis: result.profile.speaking_basis }
    : character);
  renderCharacterSelector();
  await refreshPrompt();
}

function editableWorldDescription(world = currentWorld) {
  return world?.world_description_base ?? world?.world_description ?? '';
}

async function refreshWorldSettings() {
  currentWorld = await getJson('/api/world');
  document.querySelector('#player-name').value = currentWorld.player_name ?? '主人公';
  document.querySelector('#world-description').value = editableWorldDescription();
  renderPlayerParametersEditor(currentWorld.player_parameters ?? {});
  renderTrainingScreen();
  if (screens['academy-room']?.classList.contains('active')) renderAcademyRoomScreen();
}

async function saveWorldDescription() {
  currentWorld = await postJson('/api/world', {
    player_name: document.querySelector('#player-name').value,
    world_description: document.querySelector('#world-description').value,
    player_parameters: collectPlayerParameters()
  });
  document.querySelector('#player-name').value = currentWorld.player_name ?? '主人公';
  document.querySelector('#world-description').value = editableWorldDescription();
  renderPlayerParametersEditor(currentWorld.player_parameters ?? {});
  renderTrainingScreen();
  await refreshPrompt();
}

async function startInteractionFromField(characterId) {
  if (conversationRequestInFlight) {
    showProcessingToast();
    return;
  }
  activeCharacterId = characterId;
  const result = await postJson('/api/interaction/start', { character_id: characterId, source_type: 'field' });
  clearVisibleConversation();
  writeDebugLog({
    started_interaction: characterId,
    source_type: 'field',
    state: result.state
  });
  await refresh();
  showScreen('interaction');
  await ensureOpeningUtterance();
}

async function startAcademyConversationSessionFromCompanion(characterId) {
  if (conversationRequestInFlight) {
    showProcessingToast();
    return;
  }
  conversationRequestInFlight = true;
  setConversationControlsDisabled(true);
  let openingStreamStartedResolve = null;
  let openingStreamStartedResolved = false;
  const openingStreamStarted = new Promise((resolve) => {
    openingStreamStartedResolve = resolve;
  });
  const markOpeningStreamStarted = () => {
    if (openingStreamStartedResolved) return;
    openingStreamStartedResolved = true;
    openingStreamStartedResolve?.();
  };
  let openingPromise = Promise.resolve();
  const readiness = (async () => {
    activeCharacterId = characterId;
    const result = await postJson('/api/interaction/start', { character_id: characterId, source_type: 'field' });
    clearVisibleConversation();
    writeDebugLog({
      started_interaction: characterId,
      source_type: 'field',
      state: result.state,
      screen: 'academy-conversation-session'
    });
    await refresh();
    openingPromise = ensureOpeningUtterance({ onAssistantStreamStart: markOpeningStreamStarted });
    await Promise.race([openingStreamStarted, openingPromise]);
  })();
  try {
    await showAcademyLoadingScreenUntilReady({
      readiness,
      nextScreen: 'academy-conversation-session',
      refreshBeforeNextScreen: false
    });
    await openingPromise;
  } finally {
    conversationRequestInFlight = false;
    setConversationControlsDisabled(false);
  }
}

async function openInteractionTab() {
  if (conversationRequestInFlight) {
    showProcessingToast();
    return;
  }
  if (currentRuntimeState?.current_screen === 'interaction' && currentRuntimeState?.current_interaction_character_id === activeCharacterId) {
    showScreen('interaction');
    if (messageHistory.length === 0) await ensureOpeningUtterance();
    return;
  }
  if (messageHistory.length > 0) {
    showScreen('interaction');
    return;
  }
  await startInteractionFromField(activeCharacterId);
}

async function moveToLocation(locationId, { showDetail = false, nextScreen = 'field', selectedVisibleSituation = null } = {}) {
  const result = await postJson('/api/field/move', {
    location_id: locationId,
    selected_visible_situation: selectedVisibleSituation ?? selectedAcademyStageSituation(locationId) ?? undefined
  });
  currentField = null;
  writeDebugLog({
    moved_to: result.location.id,
    state: result.state
  });
  clearVisibleConversation();
  await refresh();
  showScreen(nextScreen);
  if (showDetail) openFieldLocationDetail();
}

function renderInteractionLocation(location) {
  const image = document.querySelector('#interaction-location-image');
  const detailImage = document.querySelector('#interaction-location-detail-image');
  const name = document.querySelector('#interaction-location-name-button');
  const detail = document.querySelector('#interaction-location-detail-text');
  const locationDetailTitle = document.querySelector('#interaction-location-detail-title');
  const sessionImage = document.querySelector('#academy-conversation-session-location-image');
  const sessionDetailImage = document.querySelector('#academy-conversation-session-location-detail-image');
  const sessionName = document.querySelector('#academy-conversation-session-location-name-button');
  const sessionDetail = document.querySelector('#academy-conversation-session-location-detail-text');
  const sessionLocationDetailTitle = document.querySelector('#academy-conversation-session-location-detail-title');
  name.textContent = location?.display_name ?? currentRuntimeState?.current_location_id ?? '現在地';
  locationDetailTitle.textContent = location?.display_name ?? currentRuntimeState?.current_location_id ?? '現在地';
  if (sessionName) sessionName.textContent = name.textContent;
  if (sessionLocationDetailTitle) sessionLocationDetailTitle.textContent = name.textContent;
  detail.textContent = location?.visible_situation ?? '舞台の説明文はまだありません。';
  if (sessionDetail) sessionDetail.textContent = detail.textContent;
  image.setAttribute('aria-label', `${name.textContent}の画像`);
  detailImage.setAttribute('aria-label', `${name.textContent}の画像`);
  if (sessionImage) sessionImage.setAttribute('aria-label', `${name.textContent}の画像`);
  if (sessionDetailImage) sessionDetailImage.setAttribute('aria-label', `${name.textContent}の画像`);
  if (location?.background_url) {
    const backgroundImage = `linear-gradient(180deg, rgba(21,26,38,0.04), rgba(21,26,38,0.52)), url('${location.background_url}')`;
    for (const target of [image, detailImage, sessionImage, sessionDetailImage]) {
      if (!target) continue;
      target.style.backgroundImage = backgroundImage;
      target.dataset.backgroundSourceImageUrl = location.background_source_image_url ?? location.background_url ?? '';
    }
    detailImage.style.backgroundImage = backgroundImage;
  } else {
    for (const target of [image, detailImage, sessionImage, sessionDetailImage]) {
      if (!target) continue;
      target.style.backgroundImage = '';
      delete target.dataset.backgroundSourceImageUrl;
    }
  }
}

function openInteractionDetailDialog(selector) {
  const dialog = document.querySelector(selector);
  if (!dialog) return;
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
    return;
  }
  dialog.setAttribute('open', '');
  dialog.classList.add('fallback-open');
  document.body.classList.add('interaction-detail-backdrop');
}

function openFieldCharacterDetail() {
  openInteractionDetailDialog('#field-character-detail-dialog');
}

function openInteractionLocationDetail() {
  openInteractionDetailDialog('#interaction-location-detail-dialog');
}

function openInteractionCharacterDetail() {
  openInteractionDetailDialog('#interaction-character-detail-dialog');
}

function openAcademyConversationSessionLocationDetail() {
  openInteractionDetailDialog('#academy-conversation-session-location-detail-dialog');
}

function openAcademyConversationSessionCharacterDetail() {
  openInteractionDetailDialog('#academy-conversation-session-character-detail-dialog');
}

function renderAcademyConversationSessionScreen() {
  const selected = activeCharacter();
  const standee = document.querySelector('#academy-conversation-session-character-standee');
  if (standee) {
    standee.src = characterSceneStandeeUrl(selected);
    standee.alt = `${selected.display_name ?? selected.character_id}の立ち絵`;
  }
  document.querySelector('#academy-conversation-session-character-name-button').textContent = selected.display_name ?? selected.character_id;
  document.querySelector('#academy-conversation-session-character-detail-title').textContent = selected.display_name ?? selected.character_id;
  renderCharacterDetailStandees(selected);
  renderInteractionCharacterParameters(selected);
  const location = currentField?.current_location ?? academyMapLocationById(academyCompanionLocationId);
  renderInteractionLocation(location);
  renderMessageStream(messageHistory);
}

function renderFieldLocationDetail(location) {
  const title = document.querySelector('#field-location-detail-title');
  const trigger = document.querySelector('#field-current-location-button');
  const detail = document.querySelector('#field-location-detail-text');
  const image = document.querySelector('#field-location-detail-image');
  const displayName = location?.display_name ?? currentRuntimeState?.current_location_id ?? '現在地';
  title.textContent = displayName;
  trigger.textContent = displayName;
  detail.textContent = location?.visible_situation ?? '舞台の説明文はまだありません。';
  image.setAttribute('aria-label', `${displayName}の画像`);
  if (location?.background_url) {
    image.style.backgroundImage = `linear-gradient(180deg, rgba(21,26,38,0.04), rgba(21,26,38,0.52)), url('${location.background_url}')`;
    image.dataset.backgroundSourceImageUrl = location.background_source_image_url ?? location.background_url ?? '';
  } else {
    image.style.backgroundImage = '';
    delete image.dataset.backgroundSourceImageUrl;
  }
}

function openFieldLocationDetail() {
  openInteractionDetailDialog('#field-location-detail-dialog');
}

const ACADEMY_MAP_PIN_DRAG_EDITING_ENABLED = false;
const ACADEMY_MAP_SHOP_NODE_ID = 'academy_shop';
const ACADEMY_MAP_EVENT_LOCATION_IDS = new Set([
  'sealed_ritual_room',
  'festival_plaza_night',
  'mirror_hall',
  'snowy_inner_garden',
  'rainy_cloister'
]);

const academyMapStagePinCoordinates = {
  // 学院マップのピン座標はここを編集します。x/y は背景画像内のパーセント位置です。
  courtyard_fountain: { x: 49.9, y: 45.8 },
  front_gate_morning: { x: 40.3, y: 91.7 },
  old_corridor: { x: 55.6, y: 33.8 },
  library_reading_room: { x: 26.4, y: 27.4 },
  forbidden_archive_door: { x: 32.7, y: 20.6 },
  herbology_garden: { x: 65.3, y: 58.7 },
  infirmary_soft_light: { x: 39.1, y: 40.7 },
  alchemy_lab: { x: 65.8, y: 43.4 },
  astronomy_tower_observatory: { x: 22.2, y: 10.9 },
  rooftop_wind_bells: { x: 45, y: 8.9 },
  dormitory_lounge: { x: 92.2, y: 45.6 },
  student_cafeteria_magic_lamps: { x: 34.7, y: 43.6 },
  training_ground_runes: { x: 86.7, y: 33.5 },
  dueling_arena_empty: { x: 70.2, y: 33.4 },
  chapel_of_stars: { x: 14.2, y: 28 },
  music_room_enchanted_piano: { x: 65, y: 29.4 },
  art_room_golem_models: { x: 64.9, y: 36.1 },
  magic_tool_workshop: { x: 62.6, y: 48.5 },
  map_room_suspended_globe: { x: 49.7, y: 16.6 },
  clocktower_staircase: { x: 54.1, y: 14.4 },
  underground_waterway: { x: 93.2, y: 60 },
  crystal_cave_below_school: { x: 12.5, y: 63.6 },
  snowy_inner_garden: { x: 86.9, y: 13.4 },
  rainy_cloister: { x: 91.6, y: 16.4 },
  festival_plaza_night: { x: 87.7, y: 19.8 },
  student_council_room: { x: 39.9, y: 15.9 },
  teacher_office_evening: { x: 45, y: 16.9 },
  familiar_stables: { x: 79.2, y: 60.7 },
  mirror_hall: { x: 85.1, y: 16.7 },
  sealed_ritual_room: { x: 84.6, y: 21.9 },
  academy_shop: { x: 35.9, y: 30.7 },
  unsealed_necromancer_ritual_room: { x: 88, y: 85 },
  age_of_gods_elixir_brewing_stage: { x: 42, y: 92 },
  main_hall_runaway_golem: { x: 58, y: 92 }
};

function academyMapPointFor(locationIdOrIndex, indexOrTotal, maybeTotal) {
  const locationId = typeof locationIdOrIndex === 'string' ? locationIdOrIndex : null;
  const index = locationId ? indexOrTotal : locationIdOrIndex;
  const total = locationId ? maybeTotal : indexOrTotal;
  const configuredPoint = locationId ? academyMapStagePinCoordinates[locationId] : null;
  if (configuredPoint) return configuredPoint;
  const columns = 5;
  const row = Math.floor(index / columns);
  const col = index % columns;
  const rows = Math.max(1, Math.ceil(total / columns));
  const x = 12 + col * (76 / Math.max(1, columns - 1));
  const y = 12 + row * (72 / Math.max(1, rows - 1));
  return { x, y };
}

function academyMapLocations() {
  return currentField?.locations ?? [];
}

function isAcademyEventMapLocation(locationOrId) {
  const locationId = typeof locationOrId === 'string' ? locationOrId : locationOrId?.id;
  return ACADEMY_MAP_EVENT_LOCATION_IDS.has(locationId);
}

function academyMapConversationLocations(locations = academyMapLocations()) {
  return locations.filter((location) => !isAcademyEventMapLocation(location));
}

function academyMapShopNode() {
  const referenceLocation = academyMapLocationById('student_cafeteria_magic_lamps');
  return {
    id: ACADEMY_MAP_SHOP_NODE_ID,
    display_name: '購買',
    description: '各種霊薬を取り揃えている学院購買部。必要な道具や品物を売買できる。',
    visible_situation: '各種霊薬を取り揃えている学院購買部。必要な道具や品物を売買できる。',
    background_url: referenceLocation?.background_url ?? '',
    background_source_image_url: referenceLocation?.background_source_image_url ?? ''
  };
}

function isAcademyMapShopNode(nodeOrId) {
  const nodeId = typeof nodeOrId === 'string' ? nodeOrId : nodeOrId?.id;
  return nodeId === ACADEMY_MAP_SHOP_NODE_ID;
}

function academyMapRenderableNodes(locations = academyMapLocations()) {
  return [...academyMapConversationLocations(locations), academyMapShopNode()];
}

function academyMapCurrentAssignmentSignature() {
  return JSON.stringify({
    locations: academyMapLocations().map((location) => ({
      id: location.id,
      variants: [location.visible_situation, ...(location.visible_situation_variants ?? [])].filter(Boolean).length
    })),
    characters: selectableCharacters.map((character) => character.character_id),
    buddy: selectedAcademyBuddyCharacterId(),
    enemies: Array.from(selectedAcademyEnemyCharacterIds()).sort()
  });
}

function academyMapLocationById(locationId) {
  return academyMapLocations().find((location) => location.id === locationId) ?? currentField?.current_location ?? null;
}

function shuffledAcademyCharacters() {
  const pool = [...selectableCharacters];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [pool[index], pool[swapIndex]] = [pool[swapIndex], pool[index]];
  }
  return pool;
}

function stageSituationVariants(location) {
  return Array.from(new Set([
    location?.visible_situation,
    ...(location?.visible_situation_variants ?? []),
    ...(location?.description_variants ?? [])
  ].map((value) => String(value ?? '').trim()).filter(Boolean)));
}

function randomStageSituation(location) {
  const variants = stageSituationVariants(location);
  if (!variants.length) return '';
  return variants[Math.floor(Math.random() * variants.length)];
}

function selectedAcademyStageSituation(locationOrId) {
  const location = typeof locationOrId === 'string' ? academyMapLocationById(locationOrId) : locationOrId;
  if (!location) return '';
  return academyMapStageSituationAssignments[location.id]
    ?? (location.id === currentRuntimeState?.current_location_id ? currentRuntimeState?.current_location_visible_situation : null)
    ?? location.visible_situation
    ?? location.description
    ?? '';
}

function withSelectedAcademyStageSituation(location) {
  if (!location) return location;
  return { ...location, visible_situation: selectedAcademyStageSituation(location) };
}

function academyMapNodeDescription(location) {
  if (!location) return '舞台の説明文はまだありません。';
  if (isAcademyMapShopNode(location)) {
    return location.description || location.visible_situation || '学院購買部です。必要な道具や品物を確認できます。';
  }
  return selectedAcademyStageSituation(location) || location.description || '舞台の説明文はまだありません。';
}

function rerollAcademyMapCharacterAssignments() {
  const locations = academyMapLocations();
  academyMapAssignmentSignature = academyMapCurrentAssignmentSignature();
  if (!locations.length || !selectableCharacters.length) {
    academyMapCharacterAssignments = {};
    academyMapStageSituationAssignments = {};
    renderAcademyMap(currentField);
    return;
  }
  const shuffled = shuffledAcademyCharacters();
  const locationBuckets = Object.fromEntries(locations.map((location) => [location.id, []]));
  const situationBuckets = Object.fromEntries(locations.map((location) => [location.id, randomStageSituation(location)]));
  const shuffledLocations = academyMapConversationLocations(locations).sort(() => Math.random() - 0.5);
  shuffled.forEach((character, index) => {
    const location = shuffledLocations[index % shuffledLocations.length];
    if (location) locationBuckets[location.id].push(character.character_id);
  });
  academyMapCharacterAssignments = locationBuckets;
  academyMapStageSituationAssignments = situationBuckets;
  renderAcademyMap(currentField);
}

function ensureAcademyMapCharacterAssignments({ force = false } = {}) {
  if (force || !Object.keys(academyMapCharacterAssignments).length) {
    rerollAcademyMapCharacterAssignments();
  } else {
    renderAcademyMap(currentField);
  }
}

function assignedAcademyMapCharactersFor(locationId) {
  const assignedIds = academyMapCharacterAssignments[locationId] ?? [];
  return assignedIds
    .map((characterId) => selectableCharacters.find((character) => character.character_id === characterId))
    .filter(Boolean);
}

function selectedAcademyBuddyCharacterId() {
  const explicit = String(currentRuntimeState?.current_buddy_character_id ?? '').trim();
  if (explicit) return explicit;
  return selectableCharacters.find((character) => character.is_buddy === true)?.character_id ?? null;
}

function selectedAcademyEnemyCharacterIds() {
  const explicit = Array.isArray(currentRuntimeState?.current_enemy_character_ids)
    ? currentRuntimeState.current_enemy_character_ids.map((id) => String(id ?? '').trim()).filter(Boolean)
    : [];
  if (explicit.length > 0) return new Set(explicit);
  return new Set(selectableCharacters.filter((character) => character.is_enemy === true)
    .map((character) => character.character_id));
}

function stageHasAssignedBuddy(locationId) {
  const buddyCharacterId = selectedAcademyBuddyCharacterId();
  return Boolean(buddyCharacterId) && assignedAcademyMapCharactersFor(locationId).some((character) => character.character_id === buddyCharacterId);
}

function stageHasAssignedEnemy(locationId) {
  const enemyCharacterIds = selectedAcademyEnemyCharacterIds();
  return assignedAcademyMapCharactersFor(locationId).some((character) => enemyCharacterIds.has(character.character_id));
}

function updateAcademyMapHoverPreview(location, point = null) {
  const tooltip = document.querySelector('#academy-map-hover-tooltip');
  const stage = document.querySelector('#academy-map-hover-stage');
  const description = document.querySelector('#academy-map-hover-description');
  if (!tooltip || !stage || !description) return;
  tooltip.classList.toggle('is-visible', Boolean(location && point));
  tooltip.classList.toggle('is-left', Boolean(point && point.x > 68));
  tooltip.classList.toggle('is-below', Boolean(point && point.y < 18));
  if (!location || !point) return;
  stage.textContent = location.display_name ?? location.id;
  description.textContent = academyMapNodeDescription(location);
  tooltip.style.left = `${point.x}%`;
  tooltip.style.top = `${point.y}%`;
}

function renderAcademyMapLocationPreview(location) {
  const title = document.querySelector('#academy-map-location-title');
  const text = document.querySelector('#academy-map-location-text');
  const image = document.querySelector('#academy-map-location-image');
  const goButton = document.querySelector('#academy-map-go-button');
  const displayName = location?.display_name ?? '舞台';
  title.textContent = displayName;
  text.textContent = academyMapNodeDescription(location);
  goButton.textContent = isAcademyMapShopNode(location) ? '購買に行く' : 'ここに行く';
  image.setAttribute('aria-label', `${displayName}の画像`);
  if (location?.background_url) {
    image.style.backgroundImage = `linear-gradient(180deg, rgba(8,9,10,0.02), rgba(8,9,10,0.72)), url('${location.background_url}')`;
  } else {
    image.style.backgroundImage = '';
  }
}

function openAcademyMapLocationDialog(location) {
  academyMapSelectedLocationId = location?.id ?? null;
  renderAcademyMapLocationPreview(location);
  openInteractionDetailDialog('#academy-map-location-dialog');
}

async function goToAcademyMapLocation() {
  if (!academyMapSelectedLocationId) return;
  if (isAcademyMapShopNode(academyMapSelectedLocationId)) {
    document.querySelector('#academy-map-location-dialog').close();
    showScreen('shop');
    return;
  }
  academyCompanionLocationId = academyMapSelectedLocationId;
  document.querySelector('#academy-map-location-dialog').close();
  await moveToLocation(academyCompanionLocationId, {
    showDetail: false,
    nextScreen: 'academy-companion',
    selectedVisibleSituation: selectedAcademyStageSituation(academyCompanionLocationId)
  });
  showScreen('academy-companion');
  renderAcademyCompanionScreen(academyCompanionLocationId);
}

function renderAcademyCompanionStageDetail(location) {
  const title = document.querySelector('#academy-companion-stage-detail-title');
  const text = document.querySelector('#academy-companion-stage-detail-text');
  const image = document.querySelector('#academy-companion-stage-detail-image');
  const displayName = location?.display_name ?? '舞台';
  title.textContent = displayName;
  text.textContent = selectedAcademyStageSituation(location) || location?.description || '舞台の説明文はまだありません。';
  image.setAttribute('aria-label', `${displayName}の画像`);
  if (location?.background_url) {
    image.style.backgroundImage = `linear-gradient(180deg, rgba(21,26,38,0.04), rgba(21,26,38,0.52)), url('${location.background_url}')`;
    image.dataset.backgroundSourceImageUrl = location.background_source_image_url ?? location.background_url ?? '';
  } else {
    image.style.backgroundImage = '';
    delete image.dataset.backgroundSourceImageUrl;
  }
}

function openAcademyCompanionStageDetail() {
  const location = academyMapLocationById(academyCompanionLocationId);
  renderAcademyCompanionStageDetail(location);
  openInteractionDetailDialog('#academy-companion-stage-detail-dialog');
}

function openAcademyCompanionCharacterDetail(character) {
  if (!character) return;
  academyCompanionDetailCharacterId = character.character_id;
  activeCharacterId = character.character_id;
  document.querySelector('#academy-companion-character-detail-title').textContent = character.display_name ?? character.character_id;
  const standee = document.querySelector('#academy-companion-character-detail-standee');
  const standeeUrl = characterSceneStandeeUrl(character);
  standee.hidden = true;
  standee.removeAttribute('src');
  standee.dataset.characterId = character.character_id;
  standee.alt = `${character.display_name ?? character.character_id}の一枚絵`;
  renderCharacterParametersInto(character, '#academy-companion-character-parameters');
  openInteractionDetailDialog('#academy-companion-character-detail-dialog');
  if (!standeeUrl) return;
  const preload = new Image();
  preload.addEventListener('load', () => {
    if (academyCompanionDetailCharacterId !== character.character_id) return;
    if (standee.dataset.characterId !== character.character_id) return;
    standee.src = standeeUrl;
    standee.hidden = false;
  }, { once: true });
  preload.addEventListener('error', () => {
    if (standee.dataset.characterId !== character.character_id) return;
    standee.hidden = true;
    standee.removeAttribute('src');
  }, { once: true });
  preload.src = standeeUrl;
}

function renderAcademyCompanionScreen(locationId = academyCompanionLocationId) {
  const location = academyMapLocationById(locationId);
  document.querySelector('#academy-companion-stage-name').textContent = location?.display_name ?? '舞台';
  document.querySelector('#academy-companion-stage-summary').textContent =
    selectedAcademyStageSituation(location) || location?.description || '舞台の説明文はまだありません。';
  const list = document.querySelector('#academy-companion-list');
  const characters = assignedAcademyMapCharactersFor(locationId);
  if (!characters.length) {
    const empty = document.createElement('p');
    empty.className = 'panel-help';
    empty.textContent = 'この舞台に会話候補はいません。学院マップに戻ってください。';
    list.replaceChildren(empty);
    return;
  }
  list.replaceChildren(...characters.map((character) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'academy-companion-card';
    button.classList.toggle('is-buddy', character.is_buddy === true);
    button.classList.toggle('is-enemy', character.is_enemy === true);
    button.dataset.characterId = character.character_id;
    const image = document.createElement('img');
    image.src = character.selection_icon_url ?? character.face_url ?? sourceSheetImageUrl({ characterId: character.character_id, view: 'face' });
    image.alt = `${character.display_name ?? character.character_id}の顔`;
    const label = document.createElement('span');
    label.innerHTML = `<strong>${character.display_name ?? character.character_id}</strong><small>この舞台にいる会話候補</small>`;
    button.replaceChildren(image, label);
    button.addEventListener('click', () => openAcademyCompanionCharacterDetail(character));
    return button;
  }));
}

function renderAcademyMap(field) {
  const layer = document.querySelector('#academy-map-stage-layer');
  if (!layer) return;
  const locations = field?.locations ?? [];
  const mapLocations = academyMapRenderableNodes(locations);
  updateAcademyMapHoverPreview(null);
  layer.replaceChildren(...mapLocations.map((candidate, index) => {
    const point = academyMapPointFor(candidate.id, index, mapLocations.length);
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'academy-map-node';
    button.classList.toggle('has-buddy', stageHasAssignedBuddy(candidate.id));
    button.classList.toggle('has-enemy', stageHasAssignedEnemy(candidate.id));
    button.style.left = `${point.x}%`;
    button.style.top = `${point.y}%`;
    button.title = candidate.display_name ?? candidate.id;
    button.setAttribute('aria-label', `${candidate.display_name ?? candidate.id}を確認`);

    const label = document.createElement('span');
    label.textContent = candidate.display_name ?? candidate.id;
    button.replaceChildren(label);
    button.addEventListener('mouseenter', () => updateAcademyMapHoverPreview(candidate, point));
    button.addEventListener('focus', () => updateAcademyMapHoverPreview(candidate, point));
    button.addEventListener('mouseleave', () => updateAcademyMapHoverPreview(null));
    button.addEventListener('blur', () => updateAcademyMapHoverPreview(null));
    button.addEventListener('click', () => {
      openAcademyMapLocationDialog(candidate);
    });
    return button;
  }));
}

function renderField(field) {
  currentField = field;
  const location = field.current_location ?? field.locations.find((item) => item.id === field.state.current_location_id);
  renderInteractionLocation(location);
  renderFieldLocationDetail(location);
  renderAcademyMap(field);
  const routeList = document.querySelector('#field-route-list');
  routeList.replaceChildren(...field.locations.map((candidate) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'location-card';
    button.classList.toggle('current', candidate.id === field.state.current_location_id);
    button.title = candidate.id;

    const label = document.createElement('strong');
    label.textContent = candidate.display_name ?? candidate.id;
    const route = document.createElement('span');
    route.className = 'route_label';
    route.textContent = candidate.id === field.state.current_location_id ? '現在地' : '舞台を切り替える';
    button.replaceChildren(label, route);

    button.addEventListener('click', () => moveToLocation(candidate.id, { showDetail: true }).catch(reportError));
    return button;
  }));
}

function canResumeFromSlotLoad() {
  return slotLoadCanResumePlay && Boolean(currentActiveSlotId);
}

function updateSlotLoadResumeButton() {
  const resumeButton = document.querySelector('#slot-load-resume-play');
  if (resumeButton) resumeButton.disabled = !canResumeFromSlotLoad();
}

function openDeleteSlotDialog(slotId) {
  const dialog = document.querySelector('#slot-load-delete-confirm-dialog');
  if (!dialog) return;
  pendingDeleteSlotId = slotId;
  document.body.classList.add('interaction-detail-backdrop');
  if (typeof dialog.showModal === 'function') {
    dialog.showModal();
    return;
  }
  dialog.setAttribute('open', '');
  dialog.classList.add('fallback-open');
}

function closeDeleteSlotDialog() {
  const dialog = document.querySelector('#slot-load-delete-confirm-dialog');
  pendingDeleteSlotId = null;
  if (!dialog) return;
  if (typeof dialog.close === 'function' && dialog.open) {
    dialog.close();
    return;
  }
  dialog.removeAttribute('open');
  dialog.classList.remove('fallback-open');
  document.body.classList.remove('interaction-detail-backdrop');
}

async function confirmDeleteSlot() {
  if (!pendingDeleteSlotId) return;
  const slotId = pendingDeleteSlotId;
  closeDeleteSlotDialog();
  await deleteSpecificSlot(slotId);
}

async function refreshSaveSlots() {
  const response = await getJson('/api/slots');
  const slots = response.slots ?? [];
  currentActiveSlotId = response.active_slot_id ?? null;
  updateSlotLoadResumeButton();
  const select = document.querySelector('#save-slots');
  select.replaceChildren(...slots.map((slot) => {
    const option = document.createElement('option');
    option.value = slot.slot_id;
    option.textContent = `${slot.slot_id} — ${slot.label}`;
    return option;
  }));

  const loadButton = document.querySelector('#open-load-screen');
  if (loadButton) loadButton.disabled = slots.length === 0;

  const list = document.querySelector('#slot-load-list');
  if (list) {
    if (!slots.length) {
      const empty = document.createElement('p');
      empty.className = 'continuity-empty';
      empty.textContent = 'まだロードできるセーブデータがありません。';
      list.replaceChildren(empty);
    } else {
      list.replaceChildren(...slots.map((slot) => {
        const article = document.createElement('article');
        article.className = 'continuity-record-item slot-load-item';

        const body = document.createElement('div');
        body.className = 'slot-load-item-body';

        const summary = document.createElement('div');
        summary.className = 'slot-load-item-summary';

        const title = document.createElement('strong');
        title.textContent = slot.label || slot.slot_id;
        const meta = document.createElement('p');
        meta.textContent = [slot.slot_id, slot.updated_at, slot.current_location_id].filter(Boolean).join(' / ');
        const graduationStatus = document.createElement('p');
        graduationStatus.className = 'slot-load-item-status';
        graduationStatus.textContent = '卒業済み';
        graduationStatus.hidden = slot.graduation_completed !== true;
        const actions = document.createElement('div');
        actions.className = 'dialog-action-row';
        const load = document.createElement('button');
        load.type = 'button';
        load.className = 'academy-map-action-button primary';
        load.textContent = 'このデータで始める';
        load.disabled = slot.graduation_completed === true;
        load.setAttribute('aria-disabled', String(slot.graduation_completed === true));
        load.addEventListener('click', () => loadSpecificSlot(slot.slot_id).catch(reportError));
        const remove = document.createElement('button');
        remove.type = 'button';
        remove.className = 'academy-map-action-button secondary';
        remove.textContent = '削除';
        remove.addEventListener('click', () => openDeleteSlotDialog(slot.slot_id));
        actions.append(load, remove);
        summary.append(title, meta, graduationStatus, actions);

        body.append(summary, renderSlotNoteEditor(slot));
        article.append(body);
        return article;
      }));
    }
  }

  return slots;
}

function renderRecordItems(elementId, record) {
  const container = document.querySelector(elementId);
  const items = record.items ?? [];
  if (!items.length) {
    const empty = document.createElement('p');
    empty.className = 'continuity-empty';
    empty.textContent = 'なし';
    container.replaceChildren(empty);
    return;
  }
  container.replaceChildren(...items.map((item) => {
    const article = document.createElement('article');
    article.className = 'continuity-record-item';
    const title = document.createElement('strong');
    title.textContent = item.name ?? item.title ?? item.id ?? 'record';
    const body = document.createElement('p');
    body.textContent = item.text ?? item.description ?? item.body ?? '';
    const meta = document.createElement('small');
    meta.textContent = [item.id, item.work_record_id, item.source_conversation_id].filter(Boolean).join(' / ');
    article.append(title, body, meta);
    return article;
  }));
}

function renderContinuityRecords(status) {
  const records = status.records ?? {};
  renderRecordItems('#character-memory-records', records.memory ?? { items: [] });
  renderRecordItems('#character-skill-records', records.skills ?? { items: [] });
  renderRecordItems('#character-work-records', records.work_records ?? { items: [] });
}

async function refreshRecordStatus() {
  const status = await getJson(`/api/records/status?character_id=${encodeURIComponent(activeCharacterId)}`);
  renderContinuityRecords(status);
}

let currentFlagStatus = { groups: [] };
let currentFlagDetail = null;
let currentEventFlagStatus = { flags: [], pending_events: [] };
let currentEventFlagDetail = null;

function findFlagStatus(flagId) {
  for (const group of currentFlagStatus.groups ?? []) {
    const flag = (group.flags ?? []).find((entry) => entry.id === flagId);
    if (flag) return { flag, group };
  }
  return null;
}

function updateFlagDetailToggle(flag) {
  const button = document.querySelector('#toggle-flag-active');
  button.dataset.flagId = flag.id;
  button.dataset.nextActive = flag.active ? 'false' : 'true';
  button.textContent = flag.active ? 'フラグをオフにする' : 'フラグをオンにする';
}

function updateFlagJudgmentFlowToggle(flag) {
  const button = document.querySelector('#toggle-flag-judgment-flow');
  button.dataset.flagId = flag.id;
  button.dataset.nextEnabled = flag.judgment_flow_enabled === false ? 'true' : 'false';
  button.textContent = flag.judgment_flow_enabled === false ? '判定フローを有効化する' : '判定フローを無効化する';
}

function updateFlagDetailControls(flag) {
  updateFlagDetailToggle(flag);
  updateFlagJudgmentFlowToggle(flag);
}

function describeFlag(flag, group) {
  return JSON.stringify({
    id: flag.id,
    title: flag.title,
    status: flag.status,
    group: group.title,
    description: flag.description,
    condition: flag.condition,
    current: flag.current,
    threshold: flag.threshold,
    reward: flag.reward,
    unlocked_at: flag.unlocked_at,
    judgment_flow_enabled: flag.judgment_flow_enabled !== false
  }, null, 2);
}

function openFlagDetail(flagId) {
  const found = findFlagStatus(flagId);
  if (!found) return;
  const { flag, group } = found;
  currentFlagDetail = { flagId };
  document.querySelector('#flag-detail-title').textContent = flag.title ?? flag.label ?? flag.id;
  document.querySelector('#flag-detail-body').textContent = describeFlag(flag, group);
  updateFlagDetailControls(flag);
  document.body.classList.add('interaction-detail-backdrop');
  document.querySelector('#flag-detail-dialog').showModal();
}

function renderFlagTitleList(status) {
  const groups = status.groups ?? (status.flags ? [{ id: 'stage_flags', title: 'stage flags', flags: status.flags }] : []);
  currentFlagStatus = { ...status, groups };
  const list = document.querySelector('#flag-title-list');
  list.innerHTML = '';
  if (!groups.length) {
    list.textContent = 'フラグはまだありません。';
    return;
  }
  for (const group of groups) {
    const heading = document.createElement('h4');
    heading.textContent = group.title ?? group.id ?? 'flag group';
    list.append(heading);
    for (const flag of group.flags ?? []) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `flag-title-button ${flag.status === 'unlocked' ? 'unlocked' : 'locked'}`;
      const statusLabel = flag.active ? 'ON' : flag.status === 'unlocked' ? '解放済み' : 'OFF';
      button.textContent = `${flag.title ?? flag.label ?? flag.id} (${statusLabel})`;
      button.addEventListener('click', () => openFlagDetail(flag.id));
      list.append(button);
    }
  }
}

async function refreshFlagStatus() {
  const status = await getJson('/api/flags');
  renderFlagTitleList(status);
}

async function setFlagActive(flagId, active) {
  const status = await postJson('/api/flags/set', { flag_id: flagId, active });
  renderFlagTitleList(status);
  const found = findFlagStatus(flagId);
  if (found) {
    document.querySelector('#flag-detail-body').textContent = describeFlag(found.flag, found.group);
    updateFlagDetailControls(found.flag);
  }
  writeDebugLog({ set_stage_flag: flagId, active });
}

async function toggleCurrentFlagFromDetail() {
  const button = document.querySelector('#toggle-flag-active');
  const flagId = button.dataset.flagId || currentFlagDetail?.flagId;
  if (!flagId) return;
  await setFlagActive(flagId, button.dataset.nextActive === 'true');
}

async function setStageFlagJudgmentFlow(flagId, enabled) {
  const status = await postJson('/api/flags/judgment-flow', { flag_id: flagId, enabled });
  renderFlagTitleList(status);
  const found = findFlagStatus(flagId);
  if (found) {
    document.querySelector('#flag-detail-body').textContent = describeFlag(found.flag, found.group);
    updateFlagDetailControls(found.flag);
  }
  writeDebugLog({ set_stage_flag_judgment_flow: flagId, enabled });
}

async function toggleCurrentFlagJudgmentFlowFromDetail() {
  const button = document.querySelector('#toggle-flag-judgment-flow');
  const flagId = button.dataset.flagId || currentFlagDetail?.flagId;
  if (!flagId) return;
  await setStageFlagJudgmentFlow(flagId, button.dataset.nextEnabled === 'true');
}

async function setAllFlagsOn() {
  const status = await postJson('/api/flags/all-on', {});
  renderFlagTitleList(status);
  if (currentFlagDetail?.flagId) {
    const found = findFlagStatus(currentFlagDetail.flagId);
    if (found) {
      document.querySelector('#flag-detail-body').textContent = describeFlag(found.flag, found.group);
      updateFlagDetailControls(found.flag);
    }
  }
  writeDebugLog({ set_all_stage_flags: true });
}

function renderRelationshipDebugControls() {
  const select = document.querySelector('#relationship-character-select');
  const status = document.querySelector('#relationship-debug-status');
  const weeksInput = document.querySelector('#debug-elapsed-weeks');
  const weeksStatus = document.querySelector('#debug-weeks-status');
  if (!select || !status) return;
  const previousValue = select.value;
  select.replaceChildren(...selectableCharacters.map((character) => {
    const option = document.createElement('option');
    option.value = character.character_id;
    const markers = [
      selectedAcademyBuddyCharacterId() === character.character_id ? 'BUDDY' : null,
      selectedAcademyEnemyCharacterIds().has(character.character_id) ? 'ENEMY' : null
    ].filter(Boolean).join(' / ');
    option.textContent = markers
      ? `${character.display_name ?? character.character_id} — ${markers}`
      : character.display_name ?? character.character_id;
    return option;
  }));
  if (previousValue && selectableCharacters.some((character) => character.character_id === previousValue)) {
    select.value = previousValue;
  }
  const buddy = selectableCharacters.find((character) => character.character_id === selectedAcademyBuddyCharacterId());
  const enemies = selectableCharacters.filter((character) => selectedAcademyEnemyCharacterIds().has(character.character_id));
  status.textContent = JSON.stringify({
    current_buddy_character_id: buddy?.character_id ?? currentRuntimeState?.current_buddy_character_id ?? null,
    current_buddy_name: buddy?.display_name ?? null,
    current_enemy_character_ids: enemies.map((character) => character.character_id),
    current_enemy_names: enemies.map((character) => character.display_name ?? character.character_id)
  }, null, 2);
  if (weeksInput) weeksInput.value = String(currentRuntimeState?.elapsed_weeks ?? 0);
  if (weeksStatus) {
    weeksStatus.textContent = JSON.stringify({
      elapsed_weeks: currentRuntimeState?.elapsed_weeks ?? 0,
      ending_started: currentRuntimeState?.ending_started ?? false,
      ending_completed: currentRuntimeState?.ending_completed ?? false,
      ending_character_id: currentRuntimeState?.ending_character_id ?? null
    }, null, 2);
  }
}

async function setDebugRelationships({ buddyCharacterId = selectedAcademyBuddyCharacterId(), enemyCharacterIds = Array.from(selectedAcademyEnemyCharacterIds()) } = {}) {
  const result = await postJson('/api/debug/relationships', {
    buddy_character_id: buddyCharacterId,
    enemy_character_ids: enemyCharacterIds
  });
  currentRuntimeState = result.state ?? currentRuntimeState;
  await refreshCharacters();
  renderRelationshipDebugControls();
  if (screens['academy-room']?.classList.contains('active')) renderAcademyRoomScreen();
  if (screens['academy-map']?.classList.contains('active')) ensureAcademyMapCharacterAssignments({ force: true });
  if (screens['academy-companion']?.classList.contains('active')) renderAcademyCompanionScreen();
  writeDebugLog({ set_debug_relationships: result.relationship });
}

function selectedRelationshipDebugCharacterId() {
  return document.querySelector('#relationship-character-select')?.value ?? null;
}

async function setSelectedDebugBuddy() {
  const characterId = selectedRelationshipDebugCharacterId();
  if (!characterId) return;
  await setDebugRelationships({ buddyCharacterId: characterId });
}

async function clearDebugBuddy() {
  await setDebugRelationships({ buddyCharacterId: null });
}

async function addSelectedDebugEnemy() {
  const characterId = selectedRelationshipDebugCharacterId();
  if (!characterId) return;
  const enemies = Array.from(selectedAcademyEnemyCharacterIds());
  if (!enemies.includes(characterId)) enemies.push(characterId);
  await setDebugRelationships({ enemyCharacterIds: enemies });
}

async function removeSelectedDebugEnemy() {
  const characterId = selectedRelationshipDebugCharacterId();
  if (!characterId) return;
  await setDebugRelationships({ enemyCharacterIds: Array.from(selectedAcademyEnemyCharacterIds()).filter((id) => id !== characterId) });
}

async function clearDebugEnemies() {
  await setDebugRelationships({ enemyCharacterIds: [] });
}

async function setDebugElapsedWeeks() {
  const input = document.querySelector('#debug-elapsed-weeks');
  if (!input) return;
  const elapsedWeeks = Number.parseInt(input.value, 10);
  const result = await postJson('/api/debug/weeks', {
    elapsed_weeks: Number.isFinite(elapsedWeeks) && elapsedWeeks >= 0 ? elapsedWeeks : 0
  });
  currentRuntimeState = result.state ?? currentRuntimeState;
  renderRelationshipDebugControls();
  if (screens['academy-room']?.classList.contains('active')) renderAcademyRoomScreen();
  writeDebugLog({ set_debug_elapsed_weeks: result.state?.elapsed_weeks ?? null });
}

function findEventFlagStatus(flagId) {
  return (currentEventFlagStatus.flags ?? []).find((entry) => entry.id === flagId) ?? null;
}

function updateEventFlagDetailControls(flag) {
  const button = document.querySelector('#toggle-event-flag-active');
  button.dataset.flagId = flag.id;
  button.dataset.nextActive = flag.active ? 'false' : 'true';
  button.textContent = flag.active ? 'イベントフラグをオフにする' : 'イベントフラグをオンにする';

  const completionButton = document.querySelector('#toggle-event-completion-active');
  completionButton.dataset.flagId = flag.id;
  completionButton.dataset.nextActive = flag.completed ? 'false' : 'true';
  completionButton.hidden = !flag.completed_flag_id;
  completionButton.textContent = flag.completed ? '完了フラグをオフにする' : '完了フラグをオンにする';
}

function describeEventFlag(flag) {
  return JSON.stringify({
    id: flag.id,
    label: flag.label,
    active: flag.active,
    ready: flag.ready,
    completed: flag.completed,
    condition: flag.condition,
    question: flag.question,
    required_global_flags: flag.required_global_flags,
    required_inventory_items: flag.required_inventory_items,
    completed_flag_id: flag.completed_flag_id,
    event_id: flag.event_id,
    character_id: flag.character_id,
    source_conversation_id: flag.source_conversation_id,
    achieved_at: flag.achieved_at,
    completion_source: flag.completion_source,
    description: flag.description,
    interaction: flag.interaction
  }, null, 2);
}

function openEventFlagDetail(flagId) {
  const flag = findEventFlagStatus(flagId);
  if (!flag) return;
  currentEventFlagDetail = { flagId };
  document.querySelector('#event-flag-detail-title').textContent = flag.label ?? flag.id;
  document.querySelector('#event-flag-detail-body').textContent = describeEventFlag(flag);
  updateEventFlagDetailControls(flag);
  document.body.classList.add('interaction-detail-backdrop');
  document.querySelector('#event-flag-detail-dialog').showModal();
}

function renderEventFlagTitleList(status) {
  currentEventFlagStatus = status ?? { flags: [], pending_events: [] };
  const list = document.querySelector('#event-flag-title-list');
  if (!list) return;
  const flags = currentEventFlagStatus.flags ?? [];
  list.innerHTML = '';
  if (!flags.length) {
    list.textContent = 'イベントフラグはまだありません。';
    return;
  }
  for (const flag of flags) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `flag-title-button ${flag.ready ? 'unlocked' : 'locked'}`;
    const statusLabel = flag.completed ? '完了' : flag.ready ? '発生可能' : flag.active ? 'ON' : 'OFF';
    const sourceLabel = flag.character_id ? ` / ${flag.character_id}` : '';
    button.textContent = `${flag.label ?? flag.id} (${statusLabel}${sourceLabel})`;
    button.addEventListener('click', () => openEventFlagDetail(flag.id));
    list.append(button);
  }
}

function renderEventScreen(status = currentEventFlagStatus) {
  const list = document.querySelector('#event-pending-list');
  const empty = document.querySelector('#event-empty-message');
  if (!list || !empty) return;
  const pending = status.pending_events ?? [];
  empty.hidden = pending.length > 0;
  if (!pending.length) {
    list.replaceChildren();
    return;
  }
  list.replaceChildren(...pending.map((flag) => {
    const article = document.createElement('article');
    article.className = 'economy-item-card event-ready-card';
    const title = document.createElement('strong');
    title.textContent = flag.label ?? flag.id;
    const description = document.createElement('p');
    description.textContent = flag.interaction?.location_id
      ? 'フラグ成立時の会話相手と、指定された舞台でインタラクションを開始できます。'
      : 'このイベントは成立済みですが、開始するインタラクションはまだ設定されていません。';
    const detail = document.createElement('small');
    detail.textContent = [
      flag.condition ?? flag.id,
      flag.character_id ? `成立キャラ: ${flag.character_id}` : null,
      flag.interaction?.location_id ? `舞台: ${flag.interaction.location_id}` : null
    ].filter(Boolean).join(' / ');
    const startButton = document.createElement('button');
    startButton.type = 'button';
    startButton.className = 'event-start-button';
    startButton.textContent = 'イベントを開始する';
    startButton.disabled = !flag.interaction?.location_id || !flag.character_id;
    startButton.addEventListener('click', () => startEventFlagInteractionFromScreen(flag.id).catch(reportError));
    article.append(title, description, detail, startButton);
    return article;
  }));
}

async function refreshEventFlagStatus() {
  const status = await getJson('/api/event-flags');
  renderEventFlagTitleList(status);
  renderEventScreen(status);
  return status;
}

async function startAcademyConversationSessionFromPendingEvent(flagId, { loadingAlreadyVisible = false } = {}) {
  if (conversationRequestInFlight) {
    showProcessingToast();
    return;
  }
  conversationRequestInFlight = true;
  setConversationControlsDisabled(true);
  let openingStreamStartedResolve = null;
  let openingStreamStartedResolved = false;
  const openingStreamStarted = new Promise((resolve) => {
    openingStreamStartedResolve = resolve;
  });
  const markOpeningStreamStarted = () => {
    if (openingStreamStartedResolved) return;
    openingStreamStartedResolved = true;
    openingStreamStartedResolve?.();
  };
  let openingPromise = Promise.resolve();
  const readiness = (async () => {
    const result = await postJson('/api/event-flags/start', { flag_id: flagId, screen: 'academy-conversation-session' });
    activeCharacterId = result.character_id;
    currentRuntimeState = result.state ?? currentRuntimeState;
    clearVisibleConversation();
    writeDebugLog({
      started_event_interaction: flagId,
      character_id: result.character_id,
      location_id: result.location_id,
      state: result.state,
      screen: 'academy-conversation-session'
    });
    await refresh();
    openingPromise = ensureOpeningUtterance({ onAssistantStreamStart: markOpeningStreamStarted });
    await Promise.race([openingStreamStarted, openingPromise]);
  })();
  try {
    if (loadingAlreadyVisible) {
      try {
        await readiness;
      } catch (error) {
        reportLoadingError(error);
        throw error;
      }
      showScreen('academy-conversation-session');
    } else {
      await showAcademyLoadingScreenUntilReady({
        readiness,
        nextScreen: 'academy-conversation-session',
        refreshBeforeNextScreen: false
      });
    }
    await openingPromise;
  } finally {
    conversationRequestInFlight = false;
    setConversationControlsDisabled(false);
  }
}

async function startEventFlagInteractionFromScreen(flagId, { screen = 'interaction' } = {}) {
  if (conversationRequestInFlight) {
    showProcessingToast();
    return;
  }
  const result = await postJson('/api/event-flags/start', { flag_id: flagId, screen });
  activeCharacterId = result.character_id;
  currentRuntimeState = result.state ?? currentRuntimeState;
  clearVisibleConversation();
  writeDebugLog({
    started_event_interaction: flagId,
    character_id: result.character_id,
    location_id: result.location_id,
    state: result.state
  });
  await refresh();
  showScreen(screen);
  await ensureOpeningUtterance();
}

async function openEventTab() {
  if (conversationRequestInFlight) {
    showProcessingToast();
    return;
  }
  const status = await refreshEventFlagStatus();
  const autoStartFlag = (status.pending_events ?? []).find((flag) => flag.interaction?.location_id && flag.character_id);
  if (autoStartFlag) {
    await startEventFlagInteractionFromScreen(autoStartFlag.id);
    return;
  }
  showScreen('event');
}

async function setEventFlagActive(flagId, active) {
  const status = await postJson('/api/event-flags/set', { flag_id: flagId, active });
  renderEventFlagTitleList(status);
  renderEventScreen(status);
  const flag = findEventFlagStatus(flagId);
  if (flag) {
    document.querySelector('#event-flag-detail-body').textContent = describeEventFlag(flag);
    updateEventFlagDetailControls(flag);
  }
  writeDebugLog({ set_event_flag: flagId, active });
}

async function toggleCurrentEventFlagFromDetail() {
  const button = document.querySelector('#toggle-event-flag-active');
  const flagId = button.dataset.flagId || currentEventFlagDetail?.flagId;
  if (!flagId) return;
  await setEventFlagActive(flagId, button.dataset.nextActive === 'true');
}

async function setEventCompletionActive(flagId, active) {
  const status = await postJson('/api/event-flags/completion/set', { flag_id: flagId, active });
  renderEventFlagTitleList(status);
  renderEventScreen(status);
  const flag = findEventFlagStatus(flagId);
  if (flag) {
    document.querySelector('#event-flag-detail-body').textContent = describeEventFlag(flag);
    updateEventFlagDetailControls(flag);
  }
  writeDebugLog({ set_event_completion_flag: flagId, active });
}

async function toggleCurrentEventCompletionFromDetail() {
  const button = document.querySelector('#toggle-event-completion-active');
  const flagId = button.dataset.flagId || currentEventFlagDetail?.flagId;
  if (!flagId) return;
  await setEventCompletionActive(flagId, button.dataset.nextActive === 'true');
}

async function setAllEventFlagsOn() {
  const status = await postJson('/api/event-flags/all-on', {});
  renderEventFlagTitleList(status);
  renderEventScreen(status);
  if (currentEventFlagDetail?.flagId) {
    const flag = findEventFlagStatus(currentEventFlagDetail.flagId);
    if (flag) {
      document.querySelector('#event-flag-detail-body').textContent = describeEventFlag(flag);
      updateEventFlagDetailControls(flag);
    }
  }
  writeDebugLog({ set_all_event_flags: true });
}

async function setAllEventFlagsOff() {
  const status = await postJson('/api/event-flags/all-off', {});
  renderEventFlagTitleList(status);
  renderEventScreen(status);
  if (currentEventFlagDetail?.flagId) {
    const flag = findEventFlagStatus(currentEventFlagDetail.flagId);
    if (flag) {
      document.querySelector('#event-flag-detail-body').textContent = describeEventFlag(flag);
      updateEventFlagDetailControls(flag);
    }
  }
  writeDebugLog({ set_all_event_flags: false });
}

let recentLlmRequests = [];

function openLlmRequestDetail(requestId) {
  const request = recentLlmRequests.find((entry) => entry.id === requestId);
  if (!request) return;
  document.querySelector('#llm-request-detail-title').textContent = request.title;
  document.querySelector('#llm-request-detail-meta').textContent = `${request.kind} / ${request.completed_at ?? request.started_at ?? ''}`;
  document.querySelector('#llm-request-detail-input').textContent = request.input ?? '';
  document.querySelector('#llm-request-detail-output').textContent = request.output ?? '';
  document.body.classList.add('interaction-detail-backdrop');
  document.querySelector('#llm-request-detail-dialog').showModal();
}

async function refreshLlmRequestLog() {
  const status = await getJson('/api/debug/llm-requests');
  recentLlmRequests = status.requests ?? [];
  const list = document.querySelector('#llm-request-list');
  list.innerHTML = '';
  if (recentLlmRequests.length === 0) {
    list.textContent = 'LLMリクエストはまだありません。';
    return;
  }
  for (const request of recentLlmRequests) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'llm-request-title-button';
    button.textContent = `${request.title} (${request.kind})`;
    button.addEventListener('click', () => openLlmRequestDetail(request.id));
    list.append(button);
  }
}

async function resetContinuityRecords(target) {
  const result = await postJson('/api/records/reset', { character_id: activeCharacterId, target });
  writeDebugLog({
    reset_continuity_records: target,
    removed: result.removed
  });
  renderContinuityRecords(result.status);
}

async function deleteCharacterRecords(target) {
  await resetContinuityRecords(target);
}

async function runRefreshTask(label, taskFactory, { timeoutMs = REFRESH_TASK_TIMEOUT_MS, fallbackValue = null } = {}) {
  let timedOut = false;
  const taskPromise = Promise.resolve()
    .then(taskFactory)
    .then((value) => ({ status: 'fulfilled', value }))
    .catch((error) => {
      if (!timedOut) reportError(error);
      return { status: 'rejected', value: fallbackValue };
    });
  const result = await Promise.race([
    taskPromise,
    new Promise((resolve) => setTimeout(() => {
      timedOut = true;
      resolve({ status: 'timeout', value: fallbackValue });
    }, timeoutMs))
  ]);
  if (result.status === 'timeout') reportError(new Error(`refresh timeout: ${label}`));
  return result.value;
}

async function refresh() {
  await Promise.all([
    runRefreshTask('characters', () => refreshCharacters()),
    runRefreshTask('world settings', () => refreshWorldSettings()),
    runRefreshTask('economy', () => refreshEconomy())
  ]);
  const [state, field] = await Promise.all([
    runRefreshTask('state', () => getJson('/api/state'), { fallbackValue: currentRuntimeState }),
    runRefreshTask('field', () => getJson('/api/field'), { fallbackValue: currentField })
  ]);
  currentRuntimeState = state ?? currentRuntimeState;
  renderRelationshipDebugControls();
  const trainingState = currentRuntimeState ?? {};
  currentTrainingProgress = {
    actions_used: Number(trainingState.training_actions_used ?? 0),
    actions_limit: Number(trainingState.training_actions_limit ?? TRAINING_ACTION_LIMIT),
    remaining_actions: Math.max(0, Number(trainingState.training_actions_limit ?? TRAINING_ACTION_LIMIT) - Number(trainingState.training_actions_used ?? 0)),
    completed: Number(trainingState.training_actions_used ?? 0) >= Number(trainingState.training_actions_limit ?? TRAINING_ACTION_LIMIT)
  };
  renderTrainingProgress(currentTrainingProgress);
  if (screens['academy-room']?.classList.contains('active')) renderAcademyRoomScreen();
  if (field) renderField(field);
  await Promise.all([
    runRefreshTask('record status', () => refreshRecordStatus()),
    runRefreshTask('flag status', () => refreshFlagStatus()),
    runRefreshTask('event flag status', () => refreshEventFlagStatus()),
    runRefreshTask('llm request log', () => refreshLlmRequestLog()),
    runRefreshTask('save slots', () => refreshSaveSlots())
  ]);
}

async function refreshPrompt() {
}

async function runAssistantSseStream({ endpoint, body, statusPrefix = 'stream', finalAssistantMode = 'last', refreshAfter = true, onAssistantStreamStart = null }) {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  if (!response.ok) {
    const text = await response.text();
    throw createApiError({ url: endpoint, status: response.status, payload: parseJsonText(text), fallbackText: text });
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let assistantText = '';
  let assistantExpression = 'neutral';
  let finalResult = null;
  const baseMessages = [...messageHistory];
  const visibleAssistantSegments = [];
  const pendingAssistantSegments = [];
  let assistantRevealPromise = Promise.resolve();
  let assistantRevealRunning = false;
  let assistantRevealFrame = null;
  let currentAssistantQueuedSegmentCount = 0;
  let assistantCompleteCount = 0;
  let assistantStreamStarted = false;

  function notifyAssistantStreamStarted() {
    if (assistantStreamStarted) return;
    assistantStreamStarted = true;
    onAssistantStreamStart?.();
  }

  const assistantMessage = (content) => ({
    role: 'assistant',
    character_id: activeCharacterId,
    character_name: activeCharacter().display_name,
    content,
    face_emotion_variant_id: `face_${assistantExpression}`,
    expression: assistantExpression
  });

  function queueAssistantSegments(content) {
    if (!content.trim()) return;
    const completedSegments = displayMessages([assistantMessage(content)])
      .filter((segment) => (segment.content ?? '').trim());
    const newSegments = completedSegments.slice(currentAssistantQueuedSegmentCount);
    pendingAssistantSegments.push(...newSegments);
    currentAssistantQueuedSegmentCount += newSegments.length;
  }

  function beginNextAssistantMessage() {
    assistantText = '';
    currentAssistantQueuedSegmentCount = 0;
  }

  function queueCompletedAssistantSegments() {
    const completed = completedAssistantPrefix(assistantText);
    if (!completed.trim()) return;
    queueAssistantSegments(completed);
  }

  async function revealNextAssistantSegment() {
    if (assistantRevealRunning) return assistantRevealPromise;
    assistantRevealRunning = true;
    try {
      while (pendingAssistantSegments.length > 0) {
        const previousDisplayCount = displayMessages(messageHistory).length;
        visibleAssistantSegments.push(pendingAssistantSegments.shift());
        renderMessageStream([
          ...baseMessages,
          ...visibleAssistantSegments
        ], { popFromDisplayIndex: previousDisplayCount });
        await sleep(500);
      }
    } finally {
      assistantRevealRunning = false;
    }
  }

  function revealCompletedAssistantText() {
    queueCompletedAssistantSegments();
    assistantRevealPromise = revealNextAssistantSegment();
  }

  function scheduleAssistantSegmentReveal() {
    if (assistantRevealFrame) return;
    assistantRevealFrame = requestAnimationFrame(() => {
      assistantRevealFrame = null;
      revealCompletedAssistantText();
    });
  }

  async function finishAssistantSegmentReveal() {
    const assistantMessages = messagesFromConversation(finalResult.conversation).filter((message) => message.role === 'assistant');
    const finalAssistant = finalAssistantMode === 'first' ? assistantMessages[0] : assistantMessages.at(-1);
    if (finalAssistant) assistantText = finalAssistant.content ?? assistantText;
    if (assistantRevealFrame) {
      cancelAnimationFrame(assistantRevealFrame);
      assistantRevealFrame = null;
    }
    queueAssistantSegments(assistantText);
    await assistantRevealPromise;
    await revealNextAssistantSegment();
  }

  function handleBlock(block) {
    const event = block.split('\n').find((line) => line.startsWith('event: '))?.slice(7);
    const dataText = block.split('\n').find((line) => line.startsWith('data: '))?.slice(6);
    const data = dataText ? JSON.parse(dataText) : null;
    if (event === 'status') setStreamStatus(`${statusPrefix}: ${data.phase}`);
    if (event === 'assistant_emotion') {
      assistantExpression = data.expression ?? 'neutral';
      setStreamStatus(`${statusPrefix}: emotion ${assistantExpression}`);
    }
    if (event === 'assistant_delta') {
      notifyAssistantStreamStarted();
      if (assistantCompleteCount > 0) {
        beginNextAssistantMessage();
        assistantCompleteCount = 0;
      }
      assistantText += data.delta;
      scheduleAssistantSegmentReveal();
      setStreamStatus(`${statusPrefix}: receiving assistant text (${assistantText.length} chars)`);
    }
    if (event === 'assistant_complete') {
      notifyAssistantStreamStarted();
      if (assistantCompleteCount > 0) beginNextAssistantMessage();
      assistantText = data.content ?? assistantText;
      assistantExpression = data.expression ?? assistantExpression;
      if (assistantRevealFrame) {
        cancelAnimationFrame(assistantRevealFrame);
        assistantRevealFrame = null;
      }
      queueAssistantSegments(assistantText);
      assistantCompleteCount += 1;
      assistantRevealPromise = revealNextAssistantSegment();
      setStreamStatus(`${statusPrefix}: assistant text completed`);
    }
    if (event === 'result') finalResult = data;
    if (event === 'error') throw createApiError({ url: endpoint, status: 503, payload: data, fallbackText: data?.error ?? '' });
  }

  while (true) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    const blocks = buffer.split('\n\n');
    buffer = blocks.pop() ?? '';
    for (const block of blocks) {
      if (block.trim()) handleBlock(block);
    }
    if (done) break;
  }
  if (buffer.trim()) handleBlock(buffer);
  if (!finalResult) throw new Error('stream ended without final result');
  await finishAssistantSegmentReveal();
  commitConversationResultState(finalResult);
  setStreamStatus(`${statusPrefix}: completed`);
  if (refreshAfter) await refresh();
  return finalResult;
}

async function runOpeningConversationStream({ provider, onAssistantStreamStart = null }) {
  return runAssistantSseStream({
    endpoint: '/api/conversation/opening/stream',
    body: { character_id: activeCharacterId, provider: provider },
    statusPrefix: 'opening',
    finalAssistantMode: 'first',
    refreshAfter: false,
    onAssistantStreamStart
  });
}

async function runConversationStream({ playerInput, provider, refreshAfter = true }) {
  return runAssistantSseStream({
    endpoint: '/api/conversation/stream',
    body: { character_id: activeCharacterId, player_input: playerInput, provider: provider },
    statusPrefix: 'stream',
    finalAssistantMode: 'last',
    refreshAfter
  });
}

async function editUserMessageAtIndex(messageIndex) {
  if (conversationRequestInFlight) {
    showProcessingToast();
    return;
  }
  if (!hasConversationEditItem()) return;
  const original = messageHistory[messageIndex];
  if (!original || original.role !== 'user') return;
  const editedContent = window.prompt('この発言を編集します。編集した発言まで会話を巻き戻し、以降の返答を再生成します。', original.content ?? '');
  if (editedContent === null) return;
  const content = editedContent.trim();
  if (!content || content === (original.content ?? '').trim()) return;
  if (!window.confirm('この発言より後の会話を破棄して、編集後の内容から再開します。よろしいですか？')) return;

  conversationRequestInFlight = true;
  setConversationControlsDisabled(true);
  try {
    renderMessageStream([
      ...messageHistory.slice(0, messageIndex),
      { ...original, content }
    ]);
    const provider = conversationProvider();
    setStreamStatus('edit: rewinding and regenerating');
    const result = await postJson('/api/conversation/edit-user-message', {
      character_id: activeCharacterId,
      message_index: messageIndex,
      content,
      provider
    });
    await renderConversationResultSequentially(result);
    setStreamStatus('edit: completed');
    await refresh();
  } finally {
    conversationRequestInFlight = false;
    setConversationControlsDisabled(false);
  }
}

function activeConversationInputElement() {
  if (screens['academy-conversation-session']?.classList.contains('active')) {
    return document.querySelector('#academy-conversation-session-player-input');
  }
  return document.querySelector('#player-input');
}

async function runConversation() {
  if (conversationRequestInFlight) {
    showProcessingToast();
    return;
  }
  const playerInputElement = activeConversationInputElement();
  const playerInput = playerInputElement.value.trim();
  if (!playerInput) return;
  conversationRequestInFlight = true;
  setConversationControlsDisabled(true);
  const provider = conversationProvider();
  try {
    if (messageHistory.length === 0) await ensureOpeningUtterance();
    playerInputElement.value = '';
    renderMessageStream([
      ...messageHistory,
      { role: 'user', content: playerInput }
    ]);
    setStreamStatus(provider === 'lmstudio' ? 'stream: starting' : 'non-stream: running');
    if (provider === 'lmstudio') {
      const result = await runConversationStream({ playerInput, provider, refreshAfter: false });
      if (await autoEndConversationAfterFinalReply(result)) return;
      await refresh();
      return;
    }
    const result = await postJson('/api/conversation', { character_id: activeCharacterId, player_input: playerInput, provider: provider });
    if (conversationShouldAutoEnd(result)) {
      await renderConversationResultSequentially(result);
    } else {
      renderConversationResult(result, { revealAssistant: true });
    }
    setStreamStatus('non-stream: completed');
    if (await autoEndConversationAfterFinalReply(result)) return;
    await refresh();
  } catch (error) {
    reportConversationError(error);
  } finally {
    conversationRequestInFlight = false;
    setConversationControlsDisabled(false);
  }
}

async function endConversation({ allowDuringInFlight = false } = {}) {
  if (conversationRequestInFlight && !allowDuringInFlight) {
    showProcessingToast();
    return;
  }
  const provider = conversationProvider();
  conversationRequestInFlight = true;
  setConversationControlsDisabled(true);
  conversationFinalizationInFlight = true;
  setAcademyMapNavigationDisabled(true);
  setStreamStatus('reflection: running');
  clearVisibleConversation();
  const runningLog = {
    finalization_status: 'running',
    character_id: activeCharacterId,
    state: { ...(currentRuntimeState ?? {}), current_screen: 'academy-room', current_interaction_character_id: null, pending_interaction_context: null }
  };
  writeDebugLog(runningLog);
  const endingConversation = currentRuntimeState?.pending_interaction_context?.event_flag_id === 'event.graduation_ending.ready';
  let transition = endingConversation
    ? { next_screen: 'title', loading_copy_key: 'graduation-ending-complete' }
    : { next_screen: 'academy-room', loading_copy_key: 'academy-room' };
  const finalization = (async () => {
    try {
      const result = await postJson('/api/conversation/end', { character_id: activeCharacterId, provider });
      writeDebugLog(result);
      transition = result.transition ?? transition;
      currentRuntimeState = result.state ?? currentRuntimeState;
      await refresh();
      if (transition.next_screen === 'title') {
        document.body.classList.remove('play-mode');
      } else {
        ensureAcademyMapCharacterAssignments({ force: true });
      }
      setStreamStatus('reflection: completed');
    } catch (error) {
      reportError(error);
    } finally {
      conversationFinalizationInFlight = false;
      if (activeConversationFinalizationPromise === finalization) {
        activeConversationFinalizationPromise = null;
      }
      setAcademyMapNavigationDisabled(false);
    }
  })();
  activeConversationFinalizationPromise = finalization;
  const loadingReadiness = endingConversation ? finalization : Promise.resolve();
  try {
    await showAcademyLoadingScreenUntilReady({
      readiness: loadingReadiness,
      nextScreen: transition.next_screen,
      refreshBeforeNextScreen: false,
      copyKey: transition.loading_copy_key
    });
  } finally {
    conversationRequestInFlight = false;
    setConversationControlsDisabled(false);
  }
}


async function startNewGame() {
  const startButton = document.querySelector('#start-new-game');
  setTitleActionStatus('新しいプレイを準備しています…', { tone: 'info' });
  if (startButton) startButton.disabled = true;
  try {
    const result = await postJson('/api/new-game', {});
    writeDebugLog(result);
    academyMapSelectedLocationId = null;
    academyCompanionLocationId = null;
    academyMapCharacterAssignments = {};
    academyMapStageSituationAssignments = {};
    academyMapAssignmentSignature = '';
    await refresh();
    await refreshSaveSlots();
    document.body.classList.add('play-mode');
    setTitleActionStatus('');
    if (await routeNewGameIntroFromTitle()) return;
    showScreen('academy-map', { rerollAcademyMap: true });
    await routePendingEventFromAcademyMap();
  } finally {
    if (startButton) startButton.disabled = false;
  }
}

async function openLoadScreen({ canResumePlay = false } = {}) {
  if (conversationFinalizationInFlight) {
    showProcessingToast();
    return;
  }
  slotLoadCanResumePlay = canResumePlay;
  await refreshSaveSlots();
  showScreen('slot-load');
}

async function loadSpecificSlot(slotId) {
  if (conversationFinalizationInFlight) {
    showProcessingToast();
    return;
  }
  const result = await postJson('/api/slots/load', { slot_id: slotId });
  writeDebugLog(result);
  await refresh();
  await refreshSaveSlots();
  document.body.classList.add('play-mode');
  showScreen('academy-room');
}

async function resumePlayFromSlotLoad() {
  if (!canResumeFromSlotLoad()) return;
  document.body.classList.add('play-mode');
  showScreen('academy-room');
}

async function deleteSpecificSlot(slotId) {
  const response = await fetch(`/api/slots/${encodeURIComponent(slotId)}`, { method: 'DELETE' });
  if (!response.ok) throw new Error(await response.text());
  const result = await response.json();
  writeDebugLog(result);
  const slots = await refreshSaveSlots();
  if (!slots.length) showScreen('title');
}

async function createSave() {
  const slotId = document.querySelector('#save-slot-id').value.trim();
  const result = await postJson('/api/save', { slot_id: slotId, label: slotId });
  writeDebugLog(result);
  await refreshSaveSlots();
}

async function loadSave() {
  const slotId = document.querySelector('#save-slots').value || document.querySelector('#save-slot-id').value.trim();
  await loadSpecificSlot(slotId);
}

function isLmStudioRuntimeError(error) {
  return LM_STUDIO_RUNTIME_ERROR_CODES.has(error?.errorCode);
}

function lmStudioRuntimeErrorMessage(error) {
  return error?.payload?.error ?? error?.message ?? 'LM Studioの接続が確認できません。LM Studioを起動し、設定画面で接続先とモデルを確認してください。';
}

function handleRuntimeApiError(error, { allowSettingsRedirect = false } = {}) {
  if (!isLmStudioRuntimeError(error)) return false;
  const message = lmStudioRuntimeErrorMessage(error);
  setStreamStatus(message, { immediate: true, tone: 'error' });
  if (!allowSettingsRedirect) return false;
  showScreen('settings');
  setLmStudioSettingsStatus(message);
  loadLmStudioSettings()
    .then(() => setLmStudioSettingsStatus(message))
    .catch((settingsError) => {
      setLmStudioSettingsStatus(message);
      console.error(settingsError);
    });
  return true;
}

function reportLoadingError(error) {
  if (handleRuntimeApiError(error, { allowSettingsRedirect: true })) return;
  reportError(error);
}

function setTitleActionStatus(message, options = {}) {
  const status = document.querySelector('#title-status');
  if (!status) return;
  const text = String(message ?? '').trim();
  if (!text) {
    status.hidden = true;
    status.textContent = '';
    delete status.dataset.tone;
    return;
  }
  status.hidden = false;
  status.textContent = text;
  const tone = String(options.tone ?? '').trim();
  if (tone) status.dataset.tone = tone;
  else delete status.dataset.tone;
}

function errorDisplayMessage(error) {
  const message = error?.payload?.error ?? error?.message ?? '';
  return String(message).trim() || '最初から始める処理に失敗しました。ゲームデータ配置と起動ログを確認してください。';
}

function reportConversationError(error) {
  const message = errorDisplayMessage(error);
  setConversationStatus(message, { tone: 'error' });
  setStreamStatus(message, { immediate: true, tone: 'error' });
  console.error(error);
}

function reportError(error) {
  setStreamStatus('error');
  if (handleRuntimeApiError(error)) return;
  if (document.querySelector('#title-screen')?.classList.contains('active')) {
    setTitleActionStatus(errorDisplayMessage(error), { tone: 'error' });
  }
  console.error(error);
}

document.querySelector('#save-character-description').addEventListener('click', () => saveSelectedCharacterDescription().catch(reportError));
document.querySelector('#save-world-description').addEventListener('click', () => saveWorldDescription().catch(reportError));
document.querySelector('#start-selected-character').addEventListener('click', () => startInteractionFromField(activeCharacterId).catch(reportError));
document.querySelector('#start-field-character-from-detail').addEventListener('click', () => {
  document.querySelector('#field-character-detail-dialog').close();
  startInteractionFromField(activeCharacterId).catch(reportError);
});
wirePlayerParameterPresets();
document.querySelector('#field-current-location-button').addEventListener('click', openFieldLocationDetail);
document.querySelector('#selected-character-name-button').addEventListener('click', openFieldCharacterDetail);
document.querySelector('#interaction-location-name-button').addEventListener('click', openInteractionLocationDetail);
document.querySelector('#interaction-character-name-button').addEventListener('click', openInteractionCharacterDetail);
document.querySelector('#field-location-detail-dialog').addEventListener('close', () => document.body.classList.remove('interaction-detail-backdrop'));
document.querySelector('#field-character-detail-dialog').addEventListener('close', () => document.body.classList.remove('interaction-detail-backdrop'));
document.querySelector('#interaction-location-detail-dialog').addEventListener('close', () => document.body.classList.remove('interaction-detail-backdrop'));
document.querySelector('#interaction-character-detail-dialog').addEventListener('close', () => document.body.classList.remove('interaction-detail-backdrop'));
document.querySelector('#academy-map-location-dialog').addEventListener('close', () => document.body.classList.remove('interaction-detail-backdrop'));
document.querySelector('#academy-companion-character-detail-dialog').addEventListener('close', () => document.body.classList.remove('interaction-detail-backdrop'));
document.querySelector('#academy-conversation-session-location-detail-dialog').addEventListener('close', () => document.body.classList.remove('interaction-detail-backdrop'));
document.querySelector('#academy-conversation-session-character-detail-dialog').addEventListener('close', () => document.body.classList.remove('interaction-detail-backdrop'));
document.querySelector('#llm-request-detail-dialog').addEventListener('close', () => document.body.classList.remove('interaction-detail-backdrop'));
document.querySelector('#flag-detail-dialog').addEventListener('close', () => document.body.classList.remove('interaction-detail-backdrop'));
document.querySelector('#event-flag-detail-dialog').addEventListener('close', () => document.body.classList.remove('interaction-detail-backdrop'));
document.querySelector('#slot-load-delete-confirm-dialog').addEventListener('close', () => {
  pendingDeleteSlotId = null;
  document.body.classList.remove('interaction-detail-backdrop');
});
document.querySelector('#set-all-flags-on').addEventListener('click', () => setAllFlagsOn().catch(reportError));
document.querySelector('#set-debug-buddy').addEventListener('click', () => setSelectedDebugBuddy().catch(reportError));
document.querySelector('#clear-debug-buddy').addEventListener('click', () => clearDebugBuddy().catch(reportError));
document.querySelector('#add-debug-enemy').addEventListener('click', () => addSelectedDebugEnemy().catch(reportError));
document.querySelector('#remove-debug-enemy').addEventListener('click', () => removeSelectedDebugEnemy().catch(reportError));
document.querySelector('#clear-debug-enemies').addEventListener('click', () => clearDebugEnemies().catch(reportError));
document.querySelector('#set-debug-weeks').addEventListener('click', () => setDebugElapsedWeeks().catch(reportError));
document.querySelector('#set-all-event-flags-on').addEventListener('click', () => setAllEventFlagsOn().catch(reportError));
document.querySelector('#set-all-event-flags-off').addEventListener('click', () => setAllEventFlagsOff().catch(reportError));
document.querySelector('#academy-map-go-button').addEventListener('click', () => goToAcademyMapLocation().catch(reportError));
document.querySelector('#academy-map-close-button').addEventListener('click', () => { academyMapSelectedLocationId = null; });
document.querySelector('#academy-companion-back-to-map').addEventListener('click', () => showScreen('academy-map', { rerollAcademyMap: false }));
document.querySelector('#shop-back-to-map').addEventListener('click', () => showScreen('academy-map', { rerollAcademyMap: false }));
document.querySelector('#academy-companion-stage-name').addEventListener('click', () => openAcademyCompanionStageDetail());
document.querySelector('#academy-conversation-session-location-name-button').addEventListener('click', () => openAcademyConversationSessionLocationDetail());
document.querySelector('#academy-conversation-session-character-name-button').addEventListener('click', () => openAcademyConversationSessionCharacterDetail());
document.querySelector('#start-academy-companion-character').addEventListener('click', () => {
  document.querySelector('#academy-companion-character-detail-dialog').close();
  if (academyCompanionDetailCharacterId) startAcademyConversationSessionFromCompanion(academyCompanionDetailCharacterId).catch(reportError);
});
document.querySelector('#toggle-flag-active').addEventListener('click', () => toggleCurrentFlagFromDetail().catch(reportError));
document.querySelector('#toggle-flag-judgment-flow').addEventListener('click', () => toggleCurrentFlagJudgmentFlowFromDetail().catch(reportError));
document.querySelector('#toggle-event-flag-active').addEventListener('click', () => toggleCurrentEventFlagFromDetail().catch(reportError));
document.querySelector('#toggle-event-completion-active').addEventListener('click', () => toggleCurrentEventCompletionFromDetail().catch(reportError));
document.querySelector('#run-conversation').addEventListener('click', () => runConversation().catch(reportError));
document.querySelector('#academy-conversation-session-run-conversation').addEventListener('click', () => runConversation().catch(reportError));
function shouldSubmitPlayerInput(event) {
  if (event.key !== 'Enter') return false;
  if (event.shiftKey) return false;
  if (event.isComposing || playerInputIsComposing || event.keyCode === 229) return false;
  return true;
}

const playerInputElement = document.querySelector('#player-input');
const academyConversationSessionInputElement = document.querySelector('#academy-conversation-session-player-input');
for (const inputElement of [playerInputElement, academyConversationSessionInputElement]) {
  inputElement.addEventListener('compositionstart', () => {
    playerInputIsComposing = true;
  });
  inputElement.addEventListener('compositionend', () => {
    playerInputIsComposing = false;
  });
  inputElement.addEventListener('keydown', (event) => {
    if (shouldSubmitPlayerInput(event)) {
      event.preventDefault();
      if (conversationRequestInFlight) {
        showProcessingToast();
        return;
      }
      runConversation().catch(reportError);
    }
  });
}
document.querySelector('#end-conversation').addEventListener('click', () => endConversation().catch(reportError));
document.querySelector('#academy-conversation-session-end-conversation').addEventListener('click', () => endConversation().catch(reportError));
document.querySelector('#academy-room-start-training').addEventListener('click', () => openAcademyRoomTraining().catch(reportError));
document.querySelector('#academy-room-skip-training').addEventListener('click', () => openAcademyRoomSkipTraining().catch(reportError));
document.querySelector('#academy-room-open-load').addEventListener('click', () => openLoadScreen({ canResumePlay: true }).catch(reportError));

document.querySelector('#start-new-game').addEventListener('click', () => startNewGame().catch(reportError));
document.querySelector('#open-load-screen').addEventListener('click', () => openLoadScreen({ canResumePlay: false }).catch(reportError));
document.querySelector('#open-settings-screen').addEventListener('click', () => {
  showScreen('settings');
  loadLmStudioSettings().catch(reportError);
});
document.querySelector('#settings-back-to-title').addEventListener('click', () => showScreen('title'));
for (const input of [document.querySelector('#lmstudio-host'), document.querySelector('#lmstudio-port')]) {
  input.addEventListener('input', () => syncLmStudioConnectionModeUi());
}
for (const radio of [document.querySelector('#lmstudio-connection-mode-localhost'), document.querySelector('#lmstudio-connection-mode-lan')]) {
  radio.addEventListener('change', () => syncLmStudioConnectionModeUi());
}
document.querySelector('#fetch-lmstudio-models').addEventListener('click', () => fetchLmStudioModels().catch(reportError));
document.querySelector('#lmstudio-settings-form').addEventListener('submit', (event) => {
  event.preventDefault();
  saveLmStudioSettings().catch(reportError);
});
document.querySelector('#slot-load-resume-play').addEventListener('click', () => resumePlayFromSlotLoad().catch(reportError));
document.querySelector('#back-to-title-screen').addEventListener('click', () => showScreen('title'));
document.querySelector('#slot-load-delete-confirm-submit').addEventListener('click', () => confirmDeleteSlot().catch(reportError));
document.querySelector('#slot-load-delete-confirm-cancel').addEventListener('click', () => closeDeleteSlotDialog());
document.querySelector('#create-save').addEventListener('click', () => createSave().catch(reportError));
document.querySelector('#load-save').addEventListener('click', () => loadSave().catch(reportError));
document.querySelector('#delete-character-memory').addEventListener('click', () => deleteCharacterRecords('memory').catch(reportError));
document.querySelector('#delete-character-skills').addEventListener('click', () => deleteCharacterRecords('skills').catch(reportError));
document.querySelector('#delete-character-work-records').addEventListener('click', () => deleteCharacterRecords('work_records').catch(reportError));
renderMessageStream();
updateViewportMetrics();
window.addEventListener('resize', updateViewportMetrics);
if ('ResizeObserver' in window) {
  new ResizeObserver(updateViewportMetrics).observe(document.querySelector('.topbar'));
}
Promise.all([
  refreshSaveSlots(),
  refresh()
]).then(() => applyInitialScreenOverride()).catch(reportError);
