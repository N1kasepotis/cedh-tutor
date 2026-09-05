const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { buildRows, writeSnapshot } = require('../scripts/build-planechase');
const { prioritizeVariants } = require('../scripts/build-spellbook-combos');
const { buildCdnArt } = require('../miniprogram/utils/scryfall-cdn');
const { PLANECHASE_CARDS } = require('../miniprogram/config/planechase');

function fixture() {
  return PLANECHASE_CARDS.map((row) => {
    const art = buildCdnArt(row[4], row[5]);
    return { set: 'moc', lang: 'zhs', id: row[4], oracle_id: row[6],
      printed_name: row[1], printed_type_line: row[2], printed_text: row[3],
      type_line: row[0] === 'X' ? 'Phenomenon' : 'Plane — Test',
      image_uris: { small: art.small, normal: art.normal, art_crop: art.artCrop } };
  });
}

test('Planechase 构建：全量字段、语言、混沌、唯一身份和 CDN 一致性均为硬门禁', () => {
  assert.deepEqual(buildRows(fixture().reverse()), PLANECHASE_CARDS);
  assert.throws(() => buildRows(fixture().slice(1)), /50/);
  const alterations = [
    (card) => { card.lang = 'en'; },
    (card) => { card.oracle_id = 'unknown'; },
    (card) => { card.printed_text = '中文正文缺少混沌'; },
    (card) => { card.printed_name = ''; },
    (card) => { card.image_uris.normal += 'bad'; },
  ];
  alterations.forEach((alter) => {
    const source = fixture(); alter(source[0]);
    assert.throws(() => buildRows(source));
  });
  const duplicate = fixture(); duplicate[1] = duplicate[0];
  assert.throws(() => buildRows(duplicate), /重复/);
});

test('Planechase 构建：错误源数据保留原文件，合法快照先校验再替换', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cedh-snapshot-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, 'planechase.js');
  fs.writeFileSync(output, 'original');
  assert.throws(() => writeSnapshot([], output));
  assert.equal(fs.readFileSync(output, 'utf8'), 'original');
  writeSnapshot(fixture(), output);
  assert.deepEqual(require(output).PLANECHASE_CARDS, PLANECHASE_CARDS);
  assert.deepEqual(fs.readdirSync(directory), ['planechase.js']);
});

test('Spellbook 构建：重复配对按最高档位与稳定产出优先级排序，不依赖 API 顺序', () => {
  const variant = (id, tag, feature) => ({ id, bracketTag: tag, produces: [{ feature: { name: feature } }] });
  const rows = [variant('a', 'S', 'Infinite mana'), variant('b', 'R', 'Infinite mana'), variant('c', 'R', 'Win the game')];
  assert.deepEqual(prioritizeVariants(rows).map((row) => row.id), ['c', 'b', 'a']);
  assert.deepEqual(prioritizeVariants(rows.reverse()).map((row) => row.id), ['c', 'b', 'a']);
});
