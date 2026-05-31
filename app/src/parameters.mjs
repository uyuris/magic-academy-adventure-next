export const magicParameterDefinitions = [
  { key: 'light', label: '光魔法習熟度' },
  { key: 'dark', label: '闇魔法習熟度' },
  { key: 'fire', label: '火魔法習熟度' },
  { key: 'water', label: '水魔法習熟度' },
  { key: 'earth', label: '土魔法習熟度' },
  { key: 'wind', label: '風魔法習熟度' }
];

export const abilityParameterDefinitions = [
  { key: 'strength', label: '筋力' },
  { key: 'agility', label: '瞬発力' },
  { key: 'academics', label: '学力' },
  { key: 'magical_power', label: '魔力' },
  { key: 'charisma', label: 'カリスマ' }
];

const bounds = { min: 0, max: 100 };

function clamp(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.max(bounds.min, Math.min(bounds.max, Math.round(number)));
}

function normalizeGroup(definitions, values = {}, fallbackValue = 0) {
  return Object.fromEntries(definitions.map((definition) => {
    const raw = values?.[definition.key];
    const value = typeof raw === 'object' && raw !== null && 'value' in raw ? raw.value : raw;
    return [definition.key, { ...bounds, label: definition.label, value: clamp(value ?? fallbackValue) }];
  }));
}

export function normalizeParameters(parameters = {}, { fallbackValue = 0 } = {}) {
  return {
    magic: normalizeGroup(magicParameterDefinitions, parameters.magic, fallbackValue),
    abilities: normalizeGroup(abilityParameterDefinitions, parameters.abilities, fallbackValue)
  };
}

export function defaultPlayerParameters() {
  return normalizeParameters({}, { fallbackValue: 0 });
}

export function defaultCharacterParameters(index = 1) {
  const magic = Object.fromEntries(magicParameterDefinitions.map((definition, offset) => [
    definition.key,
    18 + ((index * 17 + offset * 13) % 73)
  ]));
  const abilities = Object.fromEntries(abilityParameterDefinitions.map((definition, offset) => [
    definition.key,
    20 + ((index * 19 + offset * 11) % 71)
  ]));
  return normalizeParameters({ magic, abilities });
}

function renderGroup(definitions, values) {
  return definitions.map((definition) => {
    const stat = values?.[definition.key] ?? { value: 0 };
    return `${definition.label}: ${clamp(stat.value)}/100`;
  }).join('、');
}

export function renderParametersForPrompt(parameters) {
  const normalized = normalizeParameters(parameters);
  return [
    renderGroup(magicParameterDefinitions, normalized.magic),
    renderGroup(abilityParameterDefinitions, normalized.abilities)
  ].filter(Boolean).join('\n');
}
