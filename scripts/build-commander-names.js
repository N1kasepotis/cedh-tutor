// Official Simplified Chinese commander names, keyed by Oracle ID. Wizards stopped Simplified Chinese printings
// with Bloomburrow in 2024, so this list barely moves and a checked-in snapshot is enough. Re-run if new printings appear.
const fs = require('fs');
const path = require('path');
const network = require('../cloudfunctions/metaMonthly/network');

const OUTPUT = path.join(__dirname, '../cloudfunctions/metaMonthly/commander-names.json');
const QUERY = 'lang:zhs (is:commander or t:background)';
// Scryfall answered 429 at about 8 requests per second on search, and warns that ignoring it leads to a network block.
const PAGE_DELAY_MS = 700;

function namesFromPage(cards) {
  const names = {};
  for (const card of cards) {
    const face = card.card_faces && card.card_faces[0];
    const oracleId = card.oracle_id || (face && face.oracle_id);
    const name = (face && face.printed_name) || (!face && card.printed_name) || '';
    if (oracleId && /[一-鿿]/.test(name)) names[oracleId] = name;
  }
  return names;
}

async function build({ request = network.jsonRequest, sleep = network.sleep } = {}) {
  const names = {};
  let url = `https://api.scryfall.com/cards/search?unique=cards&order=name&q=${encodeURIComponent(QUERY)}`;
  while (url) {
    const page = await request(url, { timeout: 20000 });
    if (!Array.isArray(page.data)) throw new Error('INVALID_CARD_LIST');
    Object.assign(names, namesFromPage(page.data));
    url = page.has_more ? page.next_page : null;
    if (url) await sleep(PAGE_DELAY_MS);
  }
  return Object.fromEntries(Object.entries(names).sort(([a], [b]) => a.localeCompare(b)));
}

if (require.main === module) {
  build().then((names) => {
    const count = Object.keys(names).length;
    if (count < 500) throw new Error(`TOO_FEW_NAMES_${count}`);
    fs.writeFileSync(OUTPUT, `${JSON.stringify(names, null, 1)}\n`);
    console.log(`wrote ${count} names`);
  }).catch((error) => { console.error(error.message); process.exitCode = 1; });
}

module.exports = { build, namesFromPage };
