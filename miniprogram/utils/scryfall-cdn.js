// Scryfall 图片 CDN 的地址形状，全项目只在这里定义一次。
//
// 形状：https://cards.scryfall.io/<档位>/front/<id[0]>/<id[1]>/<id>.jpg?<版本时间戳>
// 同一张卡的三个档位只差「档位」那一段，时间戳完全相同（拿 213 条真实快照数据核对过）。
//
// 这条规则**只用来压缩已经拿到手的地址**，不用来凭卡名瞎猜：
//   · scripts/build-commander-art.js 拿到真实 image_uris 后逐档比对，对得上才压缩存
//   · utils/card-art.js 落盘运行时解析结果时同理
// 压缩的收益是实打实的：三条完整地址约 300 字节，压成 <id, 时间戳> 约 45 字节。
// 主将表 123 个键因此从约 37KB 降到 12.6KB，落盘的牌表缓存同理缩到四分之一——
// setStorageSync 是同步调用，写多少字节直接卡多少毫秒的 JS 线程。
//
// 规则哪天被 Scryfall 改掉也不会坏：compactCdnArt 比对不上就返回 null，
// 调用方原样存三条地址（生成物里叫 LITERAL_ART），只是体积回到压缩前。

const CDN_PREFIX = 'https://cards.scryfall.io/';
// 键是本项目内部的档位名，值是 Scryfall 路径里的目录名——两者只有 artCrop 不同
const VERSION_DIRS = { small: 'small', normal: 'normal', artCrop: 'art_crop' };
const CDN_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function buildCdnArt(id, stamp) {
  if (!CDN_ID_PATTERN.test(String(id || ''))) return null;
  const tail = `/front/${id[0]}/${id[1]}/${id}.jpg${stamp ? `?${stamp}` : ''}`;
  return {
    small: `${CDN_PREFIX}${VERSION_DIRS.small}${tail}`,
    normal: `${CDN_PREFIX}${VERSION_DIRS.normal}${tail}`,
    artCrop: `${CDN_PREFIX}${VERSION_DIRS.artCrop}${tail}`,
  };
}

// 反向：三条地址能不能压成 <id, 时间戳>。任何一档对不上就返回 null，
// 由调用方原样保存——宁可多占字节，也不能存一条拼错的地址。
function compactCdnArt(images) {
  if (!images || !images.small || !images.normal || !images.artCrop) return null;

  const parts = String(images.small).split('?');
  const match = parts[0].match(/^https:\/\/cards\.scryfall\.io\/small\/front\/[0-9a-f]\/[0-9a-f]\/([0-9a-f-]{36})\.jpg$/);
  if (!match) return null;

  const id = match[1];
  const stamp = parts[1] || '';
  const rebuilt = buildCdnArt(id, stamp);
  if (!rebuilt) return null;
  if (rebuilt.small !== images.small
    || rebuilt.normal !== images.normal
    || rebuilt.artCrop !== images.artCrop) {
    return null;
  }
  return { id, stamp };
}

module.exports = {
  CDN_PREFIX,
  VERSION_DIRS,
  buildCdnArt,
  compactCdnArt,
};
