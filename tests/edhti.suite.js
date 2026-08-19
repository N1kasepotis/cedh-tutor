const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');

function readJpegDimensions(filePath) {
  const buffer = fs.readFileSync(filePath);
  let offset = 2;

  while (offset + 8 < buffer.length) {
    if (buffer[offset] !== 0xFF) {
      offset += 1;
      continue;
    }

    const marker = buffer[offset + 1];
    const segmentLength = buffer.readUInt16BE(offset + 2);
    if ([0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF].includes(marker)) {
      return {
        height: buffer.readUInt16BE(offset + 5),
        width: buffer.readUInt16BE(offset + 7),
      };
    }
    if (!segmentLength || marker === 0xDA || marker === 0xD9) break;
    offset += segmentLength + 2;
  }

  throw new Error(`Unable to read JPEG dimensions: ${filePath}`);
}

test('EDHTI config mirrors the downloaded repository content', () => {
  const {
    edhtiPersonaColors,
    edhtiPersonaOdds,
    edhtiPersonas,
    edhtiQuestions,
    edhtiTagLabels,
  } = require('../miniprogram/config/edhti');

  assert.equal(edhtiQuestions.length, 24);
  assert.equal(Object.keys(edhtiPersonas).length, 16);

  // 每个人格有出现概率（%）：数量对齐、取值合理、两位小数、总和约 100
  assert.equal(Object.keys(edhtiPersonaOdds).length, Object.keys(edhtiPersonas).length);
  let oddsSum = 0;
  Object.keys(edhtiPersonas).forEach((code) => {
    const odds = edhtiPersonaOdds[code];
    assert.equal(typeof odds, 'number', `${code} 缺出现概率`);
    assert.ok(odds > 0 && odds < 100);
    assert.equal(Number(odds.toFixed(2)), odds, `${code} 概率应为两位小数`);
    oddsSum += odds;
  });
  assert.ok(Math.abs(oddsSum - 100) < 0.5, `概率总和应约 100，实为 ${oddsSum}`);
  assert.equal(edhtiPersonaOdds.FTXO, 15.58);
  assert.equal(edhtiQuestions[0].id, 'q01');
  assert.equal(edhtiQuestions[0].prompt, '坐下前大家说这局是B桌强度，你心里最先确认什么？');
  assert.ok(edhtiQuestions.every((question) => question.answers.length >= 4));
  assert.ok(edhtiQuestions.every((question) => question.answers.length <= 5));
  assert.equal(edhtiPersonas.CTXM.name, 'Combo百科');
  assert.equal(edhtiPersonas.FTDM.name, '红温政客');
  assert.equal(edhtiPersonas.CTXM.color, edhtiPersonaColors.CTXM);
  assert.equal(edhtiPersonaColors.CTXM, '#28F6FF');
  assert.equal(Object.keys(edhtiPersonaColors).length, Object.keys(edhtiPersonas).length);
  assert.ok(Object.values(edhtiPersonas).every((persona) => /^#[0-9A-F]{6}$/i.test(persona.color)));
  assert.ok(Object.values(edhtiPersonas).every((persona) => persona.quote && persona.quote.length >= 8));
  assert.deepEqual(Object.keys(edhtiTagLabels), ['salt', 'talk', 'judge', 'combo', 'power', 'offbeat', 'aggro', 'politics']);
});

test('EDHTI 每个人格有 10 位不重复主将且默认主将在池内', () => {
  const { edhtiPersonas } = require('../miniprogram/config/edhti');

  Object.values(edhtiPersonas).forEach((persona) => {
    assert.equal(persona.commanderPool.length, 10, `${persona.code} 应保持 10 人池`);
    assert.equal(new Set(persona.commanderPool).size, 10, `${persona.code} 池内不应重复`);
    assert.ok(persona.commanderPool.includes(persona.commander.en), `${persona.code} 默认主将应在池内`);
  });

  // 主流卷王应是成熟 Goodstuff / Midrange，而不是复用拍怪莽夫的大生物池。
  assert.ok(edhtiPersonas.CSDM.commanderPool.includes('Kenrith, the Returned King'));
  assert.ok(edhtiPersonas.CSDM.commanderPool.includes("Atraxa, Praetors' Voice"));
  assert.ok(!edhtiPersonas.CSDM.commanderPool.includes('Ghalta, Primal Hunger'));
});

test('EDHTI 主将选择稳定、使用完整标签且 10 人池分布均衡', () => {
  const { edhtiPersonas } = require('../miniprogram/config/edhti');
  const {
    EDHTI_COMMANDER_TAG_ORDER,
    selectEdhtiCommander,
  } = require('../miniprogram/utils/edhti');

  Object.values(edhtiPersonas).forEach((persona) => {
    const counts = new Map(persona.commanderPool.map((name) => [name, 0]));
    let state = 12345;

    for (let sample = 0; sample < 5000; sample += 1) {
      const tags = {};
      EDHTI_COMMANDER_TAG_ORDER.forEach((key) => {
        state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
        tags[key] = state % 41;
      });

      const selected = selectEdhtiCommander(persona, tags);
      assert.equal(selectEdhtiCommander(persona, tags), selected, '相同画像必须稳定复现');
      counts.set(selected, counts.get(selected) + 1);
    }

    const values = [...counts.values()];
    assert.ok(values.every((count) => count > 0), `${persona.code} 的全部候选都应可达`);
    assert.ok(Math.max(...values) / Math.min(...values) < 1.4, `${persona.code} 池内分布不应过度偏斜`);
  });
});

test('EDHTI scoring returns the same persona codes as the source rules', () => {
  const { edhtiQuestions, edhtiPersonas } = require('../miniprogram/config/edhti');
  const {
    buildEdhtiResult,
    normalizeEdhtiTags,
    tallyEdhtiAnswers,
  } = require('../miniprogram/utils/edhti');

  const firstAnswerMap = Object.fromEntries(edhtiQuestions.map((question) => [question.id, 0]));
  const lastAnswerMap = Object.fromEntries(edhtiQuestions.map((question) => [question.id, 3]));
  const firstTally = tallyEdhtiAnswers(edhtiQuestions, firstAnswerMap);
  const lastTally = tallyEdhtiAnswers(edhtiQuestions, lastAnswerMap);
  assert.ok(/^[CF][TS][XD][MO]$/.test(firstTally.code));
  assert.ok(/^[CF][TS][XD][MO]$/.test(lastTally.code));
  assert.ok(buildEdhtiResult(edhtiQuestions, firstAnswerMap, edhtiPersonas).persona);
  assert.equal(buildEdhtiResult(edhtiQuestions, lastAnswerMap, edhtiPersonas).persona.name, '红温政客');
  assert.equal(normalizeEdhtiTags(firstTally.tags)[0].value, 100);
});

test('EDHTI table and solo-leaning answers keep rare personas reachable', () => {
  const { edhtiQuestions } = require('../miniprogram/config/edhti');
  const byId = Object.fromEntries(edhtiQuestions.map((question) => [question.id, question]));

  assert.deepEqual(byId.q09.answers[1].scores, { solo: 2, competitive: 1 });
  assert.deepEqual(byId.q10.answers[2].scores, { solo: 2, competitive: 1, direct: 1 });
  assert.deepEqual(byId.q11.answers[2].scores, { solo: 2, competitive: 2 });
  assert.deepEqual(byId.q12.answers[3].scores, { fun: 3, solo: 1 });
  assert.deepEqual(byId.q20.answers[3].scores, { direct: 3, fun: 1, solo: 1, mainstream: 1 });
  assert.deepEqual(byId.q33.answers[2].scores, { fun: 1, solo: 1 });
  assert.deepEqual(byId.q34.answers[3].scores, { direct: 1, solo: 2 });
  assert.deepEqual(byId.q37.answers[3].scores, { fun: 2, solo: 1 });
});

test('EDHTI page is registered and exposes quiz result export flow', () => {
  const appJson = JSON.parse(fs.readFileSync(path.join(root, 'miniprogram/app.json'), 'utf8'));
  const pageRoot = path.join(root, 'miniprogram/pages/edhti');

  assert.ok(appJson.pages.includes('pages/edhti/edhti'));
  ['edhti.js', 'edhti.wxml', 'edhti.wxss', 'edhti.json'].forEach((file) => {
    assert.ok(fs.existsSync(path.join(pageRoot, file)), `${file} should exist`);
  });

  const pageJson = JSON.parse(fs.readFileSync(path.join(pageRoot, 'edhti.json'), 'utf8'));
  const js = fs.readFileSync(path.join(pageRoot, 'edhti.js'), 'utf8');
  const canvasKitJs = fs.readFileSync(path.join(root, 'miniprogram/utils/canvas-kit.js'), 'utf8');
  const scryfallJs = fs.readFileSync(path.join(root, 'miniprogram/utils/scryfall.js'), 'utf8');
  const wxml = fs.readFileSync(path.join(pageRoot, 'edhti.wxml'), 'utf8');
  const wxss = fs.readFileSync(path.join(pageRoot, 'edhti.wxss'), 'utf8');
  const neonTheme = fs.readFileSync(path.join(root, 'miniprogram/styles/themes/neon-arcade.wxss'), 'utf8');
  const edhtiRootBlock = neonTheme.match(/\.edhti\s*{[\s\S]*?\n}/)[0];
  const commanderWithArtBlock = wxss.slice(
    wxss.indexOf('.commander-content.with-art'),
    wxss.indexOf('.commander-cn'),
  );
  const commanderTextShadowBlock = wxss.slice(
    wxss.indexOf('.commander-content.with-art .section-label'),
    wxss.indexOf('.tag-row'),
  );
  const commanderCnBlock = wxss.match(/\n\.commander-cn\s*{[\s\S]*?\n}/)[0];
  const commanderEnBlock = wxss.match(/\n\.commander-en\s*{[\s\S]*?\n}/)[0];
  const miniCodePath = path.join(root, 'miniprogram/assets/cT_logo_v.2.jpg');
  const cedhHouseQrPath = path.join(root, 'miniprogram/assets/cedh-house-qr.jpg');

  assert.equal(pageJson.navigationBarTitleText, 'EDHTI');
  assert.equal(pageJson.navigationBarBackgroundColor, '#080715');
  assert.equal(pageJson.navigationBarTextStyle, 'white');
  assert.doesNotMatch(wxml, /人格测试 EDHTI/);
  assert.doesNotMatch(wxml, /edhti-kicker|edhti-title/);
  assert.doesNotMatch(js, /人格测试 EDHTI/);
  assert.match(js, /function drawExportTitleLine/);
  // 标题文字兜底：贴图缺失时用内联串「Multiverse / EDHTI」实时绘制
  assert.match(js, /const suffixX = ctx\.measureText\('Multi'\)\.width/);
  assert.match(js, /drawExportTitleLine\(ctx,\s*'Multiverse',\s*startX,\s*0\)/);
  assert.match(js, /drawExportTitleLine\(ctx,\s*'EDHTI',\s*startX \+ suffixX,\s*92\)/);
  // 右上角赛博霓虹出现率贴纸
  assert.match(js, /function drawOddsSticker/);
  assert.match(js, /drawOddsSticker\(ctx,\s*result\.odds\)/);
  assert.match(js, /odds\.toFixed\(2\)/);
  assert.match(js, /人格稀有度/);
  assert.match(js, /odds:\s*edhtiPersonaOdds\[rawResult\.code\]/);
  assert.match(wxml, /{{currentQuestion\.prompt}}/);
  // 选项列表由共享组件渲染
  assert.match(wxml, /<option-list options="{{currentQuestion\.answers}}" bindselect="selectAnswer">/);
  assert.match(wxml, /{{result\.persona\.name}}/);
  assert.match(wxml, /style="{{result\.personaStyle}}"/);
  assert.match(wxml, /<text class="quote-text">“{{result\.quoteText}}”<\/text>/);
  assert.doesNotMatch(wxml, /result\.persona\.quote/);
  assert.doesNotMatch(wxml, /result-subtitle|result\.persona\.subtitle/);
  assert.match(wxml, /{{result\.descriptionText}}/);
  assert.doesNotMatch(wxml, /result\.persona\.description/);
  assert.doesNotMatch(wxml, /quote-mark/);
  assert.match(wxml, /class="commander-art-panel"/);
  assert.match(wxml, /src="{{result\.commanderArt\.artCrop \|\| result\.commanderArt\.normal}}"/);
  assert.doesNotMatch(wxml, /commander-art-fade/);
  assert.match(wxml, /玩家标签/);
  assert.doesNotMatch(wxml, /section-label mono">副标签/);
  assert.match(wxml, /bindtap="exportImage"/);
  assert.match(wxml, /id="edhtiExportCanvas"/);
  assert.match(js, /buildEdhtiResult/);
  assert.match(js, /drawEdhtiPoster/);
  // 导出保存与 Scryfall 请求能力已抽到共享模块，页面只保留接线
  assert.match(js, /require\('\.\.\/\.\.\/utils\/canvas-kit'\)/);
  assert.match(js, /require\('\.\.\/\.\.\/utils\/scryfall'\)/);
  assert.match(js, /exportPosterImage\(this,\s*{/);
  assert.match(canvasKitJs, /wx\.canvasToTempFilePath/);
  assert.match(canvasKitJs, /wx\.saveImageToPhotosAlbum/);
  assert.match(canvasKitJs, /scope\.writePhotosAlbum/);
  assert.match(scryfallJs, /api\.scryfall\.com\/cards\/named\?fuzzy=/);
  assert.match(scryfallJs, /function buildScryfallImageUrl/);
  assert.match(scryfallJs, /format=image/);
  assert.match(scryfallJs, /version=\$\{version \|\| 'normal'\}/);
  // 只带 Accept；不设 User-Agent（禁止的请求头，基础库会拒绝并报 Refused to set unsafe header）
  assert.match(scryfallJs, /header:\s*{[\s\S]*Accept:\s*'application\/json'/);
  assert.doesNotMatch(scryfallJs, /'User-Agent'/);
  // 结果页保持同一个直连图片 URL，避免 JSON 查询回写 src 后触发二次下载。
  assert.doesNotMatch(js, /fetchCardImageUris/);
  assert.doesNotMatch(js, /loadCommanderArt/);
  // 无字大画只允许一处构造：两个赋值点（人格默认主将、推荐池选中主将）必须共用
  // buildCommanderArt，否则改一处漏一处，结果页会先显示一张再跳变成另一张。
  assert.equal((js.match(/buildCommanderArt\(/g) || []).length, 3,
    'buildCommanderArt 应为一处定义 + 两处调用，共三次出现');
  // 顺序不能反：先问构建期烤好的直链，取不到才回落按名取图的 302 慢路。
  // 写反就等于永远走慢路，烤表白烤。
  assert.match(js, /artCrop: getCardArt\(commanderName, 'artCrop'\) \|\| buildScryfallImageUrl\(commanderName, 'art_crop'\)/,
    '无字大画必须直链优先、按名取图兜底');
  assert.match(js, /normal: getCardArt\(commanderName, 'normal'\) \|\| buildScryfallImageUrl\(commanderName, 'normal'\)/);
  assert.match(js, /commanderArt/);
  assert.match(js, /const EXPORT_HEIGHT = 1624/);
  assert.match(js, /EXPORT_PINK/);
  assert.match(js, /EXPORT_BLUE/);
  assert.match(js, /EXPORT_DEEP_BLUE/);
  assert.match(js, /EXPORT_ELECTRIC_CYAN/);
  assert.match(js, /EXPORT_HOT_MAGENTA/);
  assert.match(js, /const EXPORT_DISPLAY_FONT = '"cEDHDisplay", "Avenir Next Condensed", "Arial Black"/);
  assert.match(js, /function stripTerminalPeriod/);
  assert.match(js, /function hexToRgba/);
  assert.match(js, /const personaColor = rawResult\.persona\.color \|\| '#F8FBFF'/);
  assert.match(js, /function stripSentencePeriods/);
  assert.match(js, /function spaceSentencePeriods/);
  assert.match(js, /descriptionText:\s*spaceSentencePeriods\(rawResult\.persona\.description\)/);
  assert.match(js, /personaStyle:\s*`--edhti-persona-color: \$\{personaColor\};`/);
  assert.match(js, /quoteText:\s*stripSentencePeriods\(rawResult\.persona\.quote\)\.replace\(\/\\n\+\$\/g,\s*''\)/);
  assert.match(js, /ctx\.shadowColor = hexToRgba\(personaColor,\s*0\.34\)/);
  assert.match(js, /ctx\.fillStyle = personaColor/);
  assert.match(js, /prompt:\s*stripTerminalPeriod\(question\.prompt\)/);
  assert.match(js, /text:\s*stripTerminalPeriod\(answer\.text\)/);
  assert.match(canvasKitJs, /function drawTrackedText/);
  assert.match(canvasKitJs, /const originalAlign = ctx\.textAlign/);
  assert.match(canvasKitJs, /ctx\.textAlign = 'left'/);
  assert.match(canvasKitJs, /ctx\.textAlign = originalAlign/);
  assert.match(js, /function drawGlassPanel/);
  assert.match(js, /function drawEdhtiSplitGlowBackground/);
  assert.match(js, /drawEdhtiSplitGlowBackground\(ctx\)/);
  assert.match(js, /pinkWash\.addColorStop/);
  assert.match(js, /blueWash\.addColorStop/);
  assert.doesNotMatch(js, /ctx\.rotate\(-0\.17\)/);
  assert.doesNotMatch(js, /const seam = ctx\.createLinearGradient/);
  assert.doesNotMatch(js, /x:\s*112,\s*y:\s*180,\s*r:\s*420/);
  assert.match(js, /function drawNoiseTexture/);
  assert.doesNotMatch(js, /function drawDiagonalAccentLines/);
  assert.doesNotMatch(js, /function drawHolographicSticker|drawHolographicSticker\(/);
  assert.match(js, /function drawStatBar/);
  assert.match(js, /const STAT_BAR_X = EXPORT_MARGIN \+ 168/);
  assert.match(js, /const STAT_BAR_WIDTH = 360/);
  assert.match(js, /const STAT_VALUE_X = STAT_BAR_X \+ STAT_BAR_WIDTH \+ 52/);
  assert.match(js, /const TAG_HEX_CENTER_X = EXPORT_WIDTH \/ 4/);
  assert.match(js, /const TAG_HEX_RADIUS = 96/);
  assert.match(js, /const ALIGNMENT_GRID_CENTER_X = EXPORT_WIDTH \* 3 \/ 4/);
  assert.match(js, /const ALIGNMENT_GRID_X = ALIGNMENT_GRID_CENTER_X - ALIGNMENT_GRID_CELL \* 1\.5/);
  assert.match(js, /const ALIGNMENT_GRID_CELL = 48/);
  assert.match(js, /drawStatBar\(ctx,\s*tag,\s*STAT_BAR_X,\s*y,\s*STAT_BAR_WIDTH,\s*isTop\)/);
  assert.match(js, /ctx\.fillText\(String\(tag\.value\),\s*STAT_VALUE_X,\s*y\)/);
  assert.match(js, /ctx\.fillText\('玩家标签',\s*STAT_LABEL_X,\s*810\)/);
  assert.match(js, /const visibleTags = \(result\.topTags \|\| \[\]\)\.slice\(0,\s*6\)/);
  assert.match(js, /function drawTagHexagon/);
  assert.match(js, /drawTagHexagon\(ctx,\s*visibleTags/);
  assert.match(js, /const EDHTI_ALIGNMENT_MORAL_LABELS = \['善良', '中立', '邪恶'\]/);
  assert.match(js, /const EDHTI_ALIGNMENT_ORDER_LABELS = \['守序', '中立', '混乱'\]/);
  assert.match(js, /function buildEdhtiAlignment/);
  assert.match(js, /function drawAlignmentGrid/);
  // 中立中立特称「绝对中立」，其余按 守序/中立/混乱 × 善良/中立/邪恶 组合
  assert.match(js, /label:\s*orderIndex === 1 && moralIndex === 1[\s\S]*?'绝对中立'/);
  assert.match(js, /`\$\{EDHTI_ALIGNMENT_ORDER_LABELS\[orderIndex\]\}\$\{EDHTI_ALIGNMENT_MORAL_LABELS\[moralIndex\]\}`/);
  assert.doesNotMatch(js, /shortLabel:\s*`\$\{EDHTI_ALIGNMENT_ORDER_SHORT/);
  assert.match(js, /const alignment = buildEdhtiAlignment\(result\)/);
  assert.match(js, /drawAlignmentGrid\(ctx,\s*alignment,\s*ALIGNMENT_GRID_X,\s*ALIGNMENT_GRID_Y,\s*ALIGNMENT_GRID_CELL\)/);
  assert.match(js, /ctx\.fillText\('阵营'/);
  assert.doesNotMatch(js, /ctx\.fillText\('人格轴'/);
  assert.doesNotMatch(js, /const axisStartX = \(EXPORT_WIDTH - axisTotalWidth\) \/ 2/);
  assert.doesNotMatch(js, /AXIS_CHIP_GRADIENTS/);
  assert.doesNotMatch(js, /ctx\.fillText\('副标签'/);
  assert.match(js, /drawWrappedText\(ctx,\s*stripTerminalPeriod\(result\.persona\.subtitle\)/);
  assert.match(js, /drawWrappedText\(ctx,[^\n]*stripTerminalPeriod\(result\.persona\.quote\)/);
  assert.match(js, /700 21px -apple-system/);
  assert.doesNotMatch(js, /650 24px/);
  assert.match(js, /const maxTagValue = Math\.max/);
  assert.match(js, /tag\.value === maxTagValue/);
  assert.doesNotMatch(js, /endpointRadius/);
  assert.match(js, /shadowBlur = 18/);
  assert.match(js, /rgba\(255,\s*255,\s*255,\s*0\.58\)/);
  assert.match(js, /topHighlight:\s*true/);
  assert.match(js, /config\.topHighlight !== false/);
  assert.match(js, /topHighlight:\s*false/);
  assert.match(js, /drawGlassPanel\(ctx,\s*EXPORT_MARGIN,\s*760[\s\S]*topHighlight:\s*false/);
  assert.match(js, /drawRoundRect\(ctx,\s*x \+ 12,\s*y \+ 12,\s*width - 24,\s*height - 24/);
  assert.match(js, /rgba\(185,\s*232,\s*255,\s*0\.06\)/);
  assert.doesNotMatch(js, /EXPORT_DARK_RED|EXPORT_GOLD|EXPORT_BLOOD_RED/);
  assert.match(js, /ctx\.rotate/);
  assert.match(js, /ctx\.font = `900 108px \$\{EXPORT_DISPLAY_FONT\}`/);
  assert.match(js, /quote/);
  assert.match(js, /fillStyle = '#05060B'/);
  assert.doesNotMatch(js, /fillText\('“'|fillText\('”'|ctx\.arc\(x \+ fillWidth/);
  assert.match(js, /MINI_PROGRAM_CODE_SRC\s*=\s*'\/assets\/cT_logo_v\.2\.jpg'/);
  assert.match(js, /CEDH_HOUSE_QR_SRC\s*=\s*'\/assets\/cedh-house-qr\.jpg'/);
  assert.match(js, /const EXPORT_FOOTER_BACKGROUND = '#FFFFFF'/);
  assert.match(js, /function drawEdhtiFooter/);
  assert.match(js, /drawImageCover\(ctx,\s*assets\.miniProgramCode/);
  assert.match(js, /drawImageCover\(ctx,\s*assets\.cedhHouseQr/);
  assert.match(canvasKitJs, /function loadCanvasImageDirect/);
  assert.match(canvasKitJs, /fail:\s*\(\)\s*=>\s*loadCanvasImageDirect\(canvas,\s*src,\s*resolve\)/);
  assert.match(js, /drawWrappedText\(ctx,\s*'竞技 EDH 导师 × cedh 小屋'/);
  assert.doesNotMatch(js, /扫码打开小程序 \/ 关注 cedh 小屋/);
  assert.match(wxss, /\.edhti-quote/);
  assert.match(wxss, /\.edhti-quote\s*{[\s\S]*padding:\s*42rpx 48rpx/);
  assert.doesNotMatch(wxss, /\.result-subtitle/);
  assert.doesNotMatch(wxss, /\.quote-mark/);
  assert.match(wxss, /\.quote-text\s*{[\s\S]*padding:\s*0/);
  assert.match(wxss, /\.commander-art-panel\s*{[\s\S]*left:\s*0/);
  assert.match(wxss, /\.commander-panel\s*{[\s\S]*min-height:\s*208rpx/);
  assert.match(wxss, /\.commander-panel::before\s*{[\s\S]*repeating-linear-gradient/);
  assert.match(wxss, /\.commander-art-panel\s*{[\s\S]*right:\s*0/);
  assert.match(wxss, /\.commander-art-panel\s*{[\s\S]*width:\s*100%/);
  assert.match(wxml, /class="commander-art-image"[\s\S]*mode="widthFix"/);
  assert.match(wxss, /\.commander-art-image\s*{[\s\S]*height:\s*auto/);
  assert.match(wxss, /\.commander-art-image\s*{[\s\S]*min-height:\s*100%/);
  assert.match(wxss, /\.commander-art-image\s*{[\s\S]*transform:\s*translateY\(0\)/);
  assert.doesNotMatch(wxss, /object-position:\s*center 24%/);
  assert.doesNotMatch(wxss, /translateY\(-8%\)/);
  assert.match(wxss, /\.commander-art-image\s*{[\s\S]*opacity:\s*0\.86/);
  assert.doesNotMatch(wxss, /\.commander-art-fade/);
  assert.match(wxss, /\.commander-content\.with-art\s*{[\s\S]*var\(--cedh-space-5\)/);
  assert.doesNotMatch(commanderWithArtBlock, /background:|box-shadow:|border-radius:/);
  assert.match(wxss, /\.commander-content\.with-art \.section-label,\s*[\s\S]*\.commander-content\.with-art \.commander-cn,\s*[\s\S]*\.commander-content\.with-art \.commander-en\s*{/);
  assert.match(commanderTextShadowBlock, /font-family:[\s\S]*Courier New[\s\S]*monospace/);
  assert.match(commanderTextShadowBlock, /letter-spacing:\s*0\.1em/);
  assert.match(commanderTextShadowBlock, /text-shadow:[\s\S]*2rpx 0 0 rgba\(var\(--edhti-pink-rgb\),\s*0\.42\)[\s\S]*-2rpx 0 0 rgba\(var\(--edhti-blue-rgb\),\s*0\.4\)[\s\S]*3rpx 3rpx 0 rgba\(16,\s*28,\s*44,\s*0\.78\)/);
  assert.doesNotMatch(commanderCnBlock, /text-shadow:/);
  assert.doesNotMatch(commanderEnBlock, /text-shadow:/);
  // 页面主题变量收拢在 styles/themes/neon-arcade.wxss，页面通过 @import 引入
  assert.match(wxss, /@import "\.\.\/\.\.\/styles\/themes\/neon-arcade\.wxss"/);
  assert.match(neonTheme, /\.edhti\s*{[\s\S]*linear-gradient\(180deg,\s*#080715 0%,\s*#090d24 48%,\s*#03040c 100%\)/);
  assert.doesNotMatch(edhtiRootBlock, /radial-gradient/);
  assert.match(neonTheme, /\.edhti\s*{[\s\S]*--cedh-accent:\s*#ff7bc8/);
  assert.match(neonTheme, /--edhti-panel-wash:\s*linear-gradient\(145deg,\s*rgba\(22,\s*20,\s*58,\s*0\.84\),\s*rgba\(10,\s*20,\s*48,\s*0\.72\)\)/);
  assert.match(wxss, /\.edhti-question\s*{[\s\S]*background:\s*var\(--edhti-panel-wash\)/);
  assert.match(neonTheme, /--edhti-panel-wash-deep:\s*linear-gradient\(145deg,\s*rgba\(22,\s*20,\s*58,\s*0\.84\)/);
  assert.match(wxss, /\.edhti-result,\s*[\s\S]*\.tag-panel\s*{[\s\S]*background:\s*var\(--edhti-panel-wash-deep\)/);
  assert.match(wxss, /\.edhti-result,\s*[\s\S]*\.tag-panel\s*{[\s\S]*box-shadow:[\s\S]*rgba\(0,\s*0,\s*0,\s*0\.38\)/);
  // 人格轴小字（如「娱乐执行直接冷门」）已移除，避免与人格名重复
  assert.doesNotMatch(wxss, /axis-chip|axis-row/);
  assert.doesNotMatch(wxml, /axis-row|axisList/);
  assert.match(wxss, /\.result-code\s*{[\s\S]*color:\s*var\(--edhti-blue\)/);
  assert.match(wxss, /\.result-name\s*{[\s\S]*color:\s*var\(--edhti-persona-color,\s*var\(--cedh-text\)\)/);
  assert.match(wxss, /\.tag-track\s*{[\s\S]*height:\s*8rpx/);
  assert.match(wxss, /\.tag-fill\s*{[\s\S]*box-shadow:[\s\S]*rgba\(var\(--edhti-blue-rgb\),\s*0\.28\)/);
  assert.match(neonTheme, /--edhti-pink-rgb:\s*255,\s*123,\s*200/);
  assert.match(neonTheme, /--edhti-blue-rgb:\s*104,\s*199,\s*255/);
  assert.match(wxss, /rgba\(var\(--edhti-blue-rgb\)/);
  assert.match(wxss, /\.export-canvas/);
  assert.match(wxss, /\.export-canvas\s*{[\s\S]*height:\s*1624rpx/);
  assert.ok(fs.existsSync(miniCodePath), 'mini-program code asset should exist');
  assert.ok(fs.existsSync(cedhHouseQrPath), 'cedh house QR asset should exist');
  // 小程序码直接用微信后台导出的 258px 原件，不做重采样也不重压缩：
  // 海报按 codeSize=126 逻辑像素绘制，乘 EXPORT_PIXEL_SCALE(1080/750) 后实绘约 181px，
  // 258 仍是缩小而非放大。换码时照搬微信导出件即可，不要为了「和另一张一样大」而放大——
  // 放大可扫描码只会引入插值模糊，对 181px 的实绘没有任何收益。
  assert.deepEqual(readJpegDimensions(miniCodePath), { width: 258, height: 258 });
  assert.deepEqual(readJpegDimensions(cedhHouseQrPath), { width: 1024, height: 1024 });
  assert.ok(fs.statSync(miniCodePath).size < 160000, 'mini-program code asset should stay package-friendly');
  assert.ok(fs.statSync(cedhHouseQrPath).size < 160000, 'cedh house QR asset should stay package-friendly');
});

// 24 题不能一次性：中途被打断能续答，做完的结果能重建，不必为了再看一眼而重测
test('edhti persists answers and rebuilds the finished result on reentry', () => {
  const js = fs.readFileSync(path.join(root, 'miniprogram/pages/edhti/edhti.js'), 'utf8');

  assert.match(js, /const EDHTI_STATE_STORAGE_KEY = 'edhtiState'/);
  assert.match(js, /require\('\.\.\/\.\.\/utils\/storage'\)/);

  // 每一步落盘
  assert.match(js, /refreshState\(\)\s*{[\s\S]*this\.persistState\(\);\s*\n\s*}/);
  assert.match(js, /persistState\(options\)\s*{[\s\S]*writeStorage\(EDHTI_STATE_STORAGE_KEY, \{[\s\S]*currentIndex: this\.data\.currentIndex[\s\S]*answers: this\.data\.answers/);

  // 只存答案不存算好的结果：结果由答案确定性重建，配置更新后不会展示陈旧人格
  const persistBlock = js.slice(js.indexOf('persistState(options)'), js.indexOf('onShareAppMessage()'));
  assert.doesNotMatch(persistBlock, /result:/);

  // 完成态直接重建结果；未完成态才问要不要续答
  assert.match(js, /onLoad\(\)\s*{[\s\S]*if \(!this\.restoreState\(\)\) this\.refreshState\(\)/);
  const restoreBlock = js.slice(js.indexOf('restoreState()'), js.indexOf('persistState(options)'));
  assert.match(restoreBlock, /if \(!state \|\| !countEdhtiAnswers\(state\.answers\)\) return false/);
  assert.match(restoreBlock, /if \(state\.completed\)[\s\S]*this\.showResult\(\)/);
  assert.match(restoreBlock, /title: '继续上次测试'/);
  assert.match(restoreBlock, /confirmText: '继续'/);
  assert.match(restoreBlock, /cancelText: '重新开始'/);
  assert.match(restoreBlock, /removeStorage\(EDHTI_STATE_STORAGE_KEY\)/);

  assert.match(js, /showResult\(\)\s*{[\s\S]*this\.persistState\(\{ completed: true \}\)/);
  assert.match(js, /restart\(\)\s*{[\s\S]*removeStorage\(EDHTI_STATE_STORAGE_KEY\)/);
});
