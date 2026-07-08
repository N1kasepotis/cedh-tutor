// 重算 EDHTI 各人格出现概率（config/edhti.js 的 edhtiPersonaOdds）。
// 随机作答（每题 4 选项等概）下的分布，用真实计分函数 tallyEdhtiAnswers 做种子化蒙特卡洛。
// 问卷或权重改动后重跑：node scripts/edhti-odds.js  然后把输出的 JSON 贴回 config/edhti.js。
const { edhtiQuestions, edhtiTagLabels } = require('../miniprogram/config/edhti');
const { tallyEdhtiAnswers } = require('../miniprogram/utils/edhti');

function mulberry32(seed) {
  let a = seed;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SEED = 20260705;
const TRIALS = 2000000;
const rng = mulberry32(SEED);
const ids = edhtiQuestions.map((question) => question.id);
const counts = {};

for (let i = 0; i < TRIALS; i += 1) {
  const answerMap = {};
  for (const id of ids) answerMap[id] = Math.floor(rng() * 4);
  const { code } = tallyEdhtiAnswers(edhtiQuestions, answerMap, edhtiTagLabels);
  counts[code] = (counts[code] || 0) + 1;
}

const odds = {};
Object.keys(counts)
  .sort((a, b) => counts[b] - counts[a])
  .forEach((code) => {
    odds[code] = Number(((counts[code] / TRIALS) * 100).toFixed(2));
  });

console.log(`seed=${SEED} trials=${TRIALS}`);
console.log(JSON.stringify(odds, null, 2));
