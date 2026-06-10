import { renderParametersForPrompt } from '../parameters.mjs';
import { faceExpressionChoicesText } from '../faceExpressions.mjs';

function isCharacterKnown(item) {
  return !item.visibility || item.visibility === 'character_known' || item.visibility === 'public';
}

function bulletList(items, render, emptyLabel = 'なし') {
  const visible = items.filter(isCharacterKnown);
  if (visible.length === 0) return `- ${emptyLabel}`;
  return visible.map((item) => `- ${render(item)}`).join('\n');
}

function renderConversationLine(profile, message) {
  const speaker = message.role === 'assistant' ? profile.display_name : 'プレイヤー';
  return `- ${speaker}: ${message.content}`;
}

const parameterAttitudeTypes = {
  respect_any_superior: {
    label: 'タイプ1',
    rules: [
      'パラメーター差によって相手を軽蔑しない。',
      '一つでも自分を超えるパラメータを持っていると尊敬する。'
    ]
  },
  equal_any_respect_average: {
    label: 'タイプ2',
    rules: [
      '全てのパラメーターが自分未満である場合は相手を軽蔑する。',
      '一つでも自分を超えるパラメータを持っていると対等に扱う。',
      '平均パラメーターが自分を超えていると尊敬する。'
    ]
  },
  equal_average_respect_1_2: {
    label: 'タイプ3',
    rules: [
      '平均パラメーターが自分以下である場合は相手を軽蔑する。',
      '平均パラメーターが自分を超えていたら対等に扱う。',
      '平均パラメーターが自分の1.2倍を超えていると尊敬する。'
    ]
  },
  equal_1_2_respect_1_5: {
    label: 'タイプ4',
    rules: [
      '平均パラメーターが自分の1.2倍未満である場合は相手を軽蔑する。',
      '平均パラメーターが自分の1.2倍以上なら対等に扱う。',
      '平均パラメーターが自分の1.5倍を超えていると尊敬する。'
    ]
  }
};

const parameterAbilityGuidance = [
  '各パラメーターは、自分や相手の能力・得意不得意を表すものとして扱う。',
  '数値が高いほど、その能力が会話中の判断・態度・行動に自然に表れる。',
  '・プレイヤーの筋力の数値が高ければ高いほど、プレイヤーが肉体的に頑強であるものとして振る舞う。',
  '・自身の学力の数値が高ければ高いほど、自身が教養豊かであるように振る舞う。',
  '・プレイヤーの火魔法習熟度が高ければ高いほど、プレイヤーが火の扱いに慣れているものとして反応する。'
];

function renderParameterAttitudeGuidance(profile) {
  const typeId = profile.parameter_attitude_type ?? 'respect_any_superior';
  const type = parameterAttitudeTypes[typeId] ?? parameterAttitudeTypes.respect_any_superior;

  return [
    `パラメーター差に基づく態度・行動指針:${type.label}`,
    ...type.rules.map((rule) => `・${rule}`),
    ...parameterAbilityGuidance
  ].join('\n');
}

function renderEventContext(eventContext) {
  if (!eventContext || typeof eventContext !== 'object') return null;
  const lines = [
    eventContext.event_label ? `イベント: ${eventContext.event_label}` : null,
    eventContext.opening_context ? `イベント文脈: ${eventContext.opening_context}` : null,
    eventContext.source_work_record_body ? `成立元会話ワークレコード:\n${eventContext.source_work_record_body}` : '成立元会話ワークレコード: まだ作成されていない。'
  ].filter(Boolean);
  return lines.length ? lines.join('\n') : null;
}

function normalizeSpeechConstraintText(value) {
  return String(value ?? '').trim().replace(/^-+\s*/, '');
}

function renderCharacterSpeechConstraints(characterSpeechConstraints = []) {
  if (!Array.isArray(characterSpeechConstraints)) return null;
  const lines = characterSpeechConstraints
    .map(normalizeSpeechConstraintText)
    .filter(Boolean);
  if (lines.length === 0) return null;
  return `キャラクター発話上の禁止事項:\n${lines.map((line) => `- ${line}`).join('\n')}`;
}

export function buildCharacterPromptPrefix({ profile, scene, memories = [], skills = [], workRecords = [], currentConversation = [], eventContext = null, characterSpeechConstraints = [] }) {
  if (!profile?.display_name) throw new Error('profile.display_name is required');
  if (!scene?.academy_name || !scene?.location_name) throw new Error('scene academy and location are required');
  const schoolYear = profile.school_year ?? '生徒';
  const club = profile.club ?? '所属未設定';

  const memoryEmptyLabel = workRecords.length === 0 ? '初対面' : 'なし';
  const memoryText = bulletList(memories, (memory) => `${memory.text}${memory.work_record_id ? `\n  work_record_id: ${memory.work_record_id}` : ''}${memory.tags?.length ? `\n  tags: ${memory.tags.join(', ')}` : ''}`, memoryEmptyLabel);
  const skillText = bulletList(skills, (skill) => `${skill.name}: ${skill.description}${skill.work_record_id ? `\n  work_record_id: ${skill.work_record_id}` : ''}`);
  const workRecordText = bulletList(workRecords, (record) => `${record.title}\n  ${record.body}${record.tags?.length ? `\n  tags: ${record.tags.join(', ')}` : ''}`);
  const conversationText = currentConversation.length === 0 ? '- なし' : currentConversation.map((message) => renderConversationLine(profile, message)).join('\n');
  const eventContextText = renderEventContext(eventContext);
  const characterParameterText = renderParametersForPrompt(profile.parameters);
  const playerParameterText = renderParametersForPrompt(scene.player_parameters);
  const parameterAttitudeGuidance = renderParameterAttitudeGuidance(profile);
  const characterSpeechConstraintsText = renderCharacterSpeechConstraints(characterSpeechConstraints);

  const sceneLines = [
    scene.world_description ? `ワールド設定: ${scene.world_description}` : null,
    characterSpeechConstraintsText,
    `舞台: ${scene.location_name}`,
    scene.visible_situation ? `見えている状況: ${scene.visible_situation}` : null
  ].filter(Boolean);

  return [
    `${scene.academy_name}の${schoolYear}、${club}に所属する${profile.display_name}への完全な没入によって応答する。`,
    '',
    `あなたは${profile.display_name}である。`,
    profile.prompt_description ? `キャラクター説明（この内容を演技・応答方針として扱う）: ${profile.prompt_description}` : null,
    profile.speaking_basis ? `話し方: ${profile.speaking_basis}` : null,
    '',
    '能力値は0〜100で、大きいほどその能力が高い。',
    'キャラクター自身のパラメーター:',
    characterParameterText,
    'プレイヤーのパラメーター:',
    playerParameterText,
    '',
    parameterAttitudeGuidance,
    '',
    ...sceneLines,
    eventContextText ? `このイベントの文脈:\n${eventContextText}` : null,
    '',
    'この場で参照する記憶:',
    memoryText,
    '',
    'この場で使う技能:',
    skillText,
    '',
    'この場で参照する過去の記録:',
    workRecordText,
    '',
    '直前までの会話:',
    conversationText
  ].filter((line) => line !== null).join('\n');
}

export function buildCharacterPrompt({ profile, scene, memories = [], skills = [], workRecords = [], currentConversation = [], eventContext = null, characterSpeechConstraints = [], playerInput, openingTurn = false, turnType = null, candidateWorkRecordIds = [], generatedAssistantText = '' }) {
  const isOpeningTurn = openingTurn || turnType === 'opening';
  const isBetweenTurns = turnType === 'work_record_recall' || turnType === 'prefix_prewarm';
  const promptPrefix = buildCharacterPromptPrefix({ profile, scene, memories, skills, workRecords, currentConversation, eventContext, characterSpeechConstraints });
  const candidateIdsText = candidateWorkRecordIds.length ? candidateWorkRecordIds.join(', ') : '';
  const candidateIdsJsonExample = candidateWorkRecordIds[0] ? `"${candidateWorkRecordIds[0]}"` : '';

  let finalInstruction;
  if (turnType === 'emotion_choice') {
    finalInstruction = `${profile.display_name}として、彼我の能力値を参照した上で、数値と言動が矛盾しないよう注意しつつ、現在の場面に自然に続く感情を次から1つだけ選択する。選択肢: ${faceExpressionChoicesText}。返答本文はまだ書かない。JSONのexpressionだけを返す。`;
  } else if (turnType === 'conversation_continuation_judgment') {
    finalInstruction = `${profile.display_name}として、この発言を行ったプレイヤーとの会話を継続したいと思うか。回答はtrueもしくはfalseのみを返す。継続したい場合はtrue。継続したくない場合はfalse。`;
  } else if (turnType === 'conversation_cutoff_reply') {
    finalInstruction = `${profile.display_name}として、この会話を切り上げる。現在の場面に自然に続く、会話を終了させるための発言だけを書く。発話は一度に1〜3文程度にする。発言内容に鉤括弧はつけない。振る舞いなどには丸括弧をつける。`;
  } else if (turnType === 'work_record_recall') {
    finalInstruction = `${profile.display_name}として、現在の会話の流れから、より詳細化したい"この場で参照する記憶"があれば、それと対応するwork_record_idを次の形式で指定する。出力形式: {"work_record_ids":[${candidateIdsJsonExample}]}。指定できるwork_record_idは候補に含まれるIDだけ。候補work_record_id: ${candidateIdsText}。詳細化したい"この場で参照する記憶"がなければ空配列を返す。`;
  } else if (turnType === 'prefix_prewarm') {
    finalInstruction = `${profile.display_name}として、次のプレイヤー発言に備えて、追加された過去の記録を現在の会話文脈へ軽く接続する短い内部確認を1文だけ出力する。会話本文として表示する返答はまだ書かない。`;
  } else {
    finalInstruction = `${profile.display_name}として、彼我の能力値を参照した上で、数値と言動が矛盾しないよう注意しつつ、現在の場面に自然に続く返答だけを書く。発話は一度に1〜3文程度にする。発言内容に鉤括弧はつけない。振る舞いなどには丸括弧をつける。発話すること自体が不自然な場合は振る舞いなどのみを書く。`;
  }

  const turnLine = isOpeningTurn
    ? 'プレイヤーはまだ発言していない。現在の場面・記憶だけをもとに、会話開始時の最初の発言を生成する。'
    : isBetweenTurns
      ? 'プレイヤーの次の発言を待っている。'
      : `プレイヤーの発言: ${playerInput ?? ''}`;

  return [
    promptPrefix,
    '',
    turnLine,
    turnType === 'conversation_cutoff_reply' ? `先ほど自分が生成した発言: ${generatedAssistantText}` : null,
    '',
    finalInstruction
  ].filter((line) => line !== null).join('\n');
}
