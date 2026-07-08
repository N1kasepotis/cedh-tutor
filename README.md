# cEDH Tutor / 竞技EDH导师

微信小程序原生前端项目，辅助 cEDH / EDH 玩家：测人格、匹配主将、记录战绩、对局前随机、对局中计数、手机试玩牌组。不使用云开发 / 云函数 / 云数据库；运行时只请求 Scryfall 卡图，不请求 edhtop16 或 Reddit。

品牌：黑底橙切的 `cT` 字标（母版见 `tools/logo-export.html`）；主页 `cEDH Tutor` 大标题内嵌 Archivo Black 字体统一渲染（见「技术约束 · 标题字体」）。

## 当前模块（9 页）

1. **首页** `pages/index`
   展示 `cEDH Tutor` 字标 + 副标题「竞技指挥官导师」+ 五个主入口：人格测试、火花觉醒（主将问卷）、我的主将、混沌工具、套牌试玩。入口为半透明玻璃片堆叠，中文入口文字暗橙斜体衬线。仅首页启用粒子触碰交互。

2. **人格测试 / EDHTI** `pages/edhti`
   基于 `external/edhti` 整理成本地配置。**面向休闲 EDH（casual EDH），非 cEDH**——推荐主将池全为非拍档休闲指挥官，题库围绕桌游社交体验而非竞技强度。输出 EDHTI 类型、人格侧写、推荐主将（按玩家标签维度从 10 人主将池中选出最匹配的）、玩家标签。**玩家标签上方有醒目的「导出分析」大块按钮**（霓虹渐变，不用下滑就能看到），导出粉蓝赛博风结果图（英文标题 Multiverse EDHTI）：含人格稀有度霓虹贴纸、玩家标签雷达六边形、九宫格阵营网格（善↔邪 × 守↔混，由四轴分数派生）、`cT` 小程序码 + cedh小屋二维码。导出画布固定 1080×2338 像素（不乘 DPR，避免高分屏真机 `canvasToTempFilePath` 失败）。

3. **指挥官问卷 → 推荐结果** `pages/quiz` → `pages/result`
   12 步偏好问卷（速度 / 获胜方式 / 互动 / 颜色 / 拍档 / 资源累积）生成画像，从本地指挥官库推荐 5 个主将。结果页实时显示 Scryfall 卡图；edhtop16 链接只复制到剪贴板，不在小程序内开网页。result 页当前无图片导出。

4. **我的主将 / 战绩** `pages/tracker`
   本地战绩追踪，最多 5 套牌组，记录主将 / 日期 / 胜负平 / Seat 1-4，展示胜率曲线与轮次胜率。数据存 `wx.setStorageSync`。

5. **混沌工具** `pages/random`
   随机数、4×D20 先手判定、`_____ Goblin` 开局贴纸抽取（元音数运行时算）。下方两个**独立全屏计数器入口**（进入为独立页，便于长局记录，不会误滑到别的工具）：
   - **卷心菜对账** `pages/cabbage`：The Cabbage Merchant / Academy Manufactor 食物引擎，追踪 Food/Clue/Treasure 衍生物的未横置/横置与可造法术力（绿=有色 / 白=泛用分色）。
   - **伊捷风暴** `pages/izzet`：Krark / Ral 抛硬币风暴计数器，一键自动抛币（含 Krark's Thumb 抛 2 取 1 优势），统计 storm / 瞬间法术 / 复制 / 自伤，可手动 ±1 校正 + 撤销 + 新回合。

6. **套牌试玩** `pages/playtest`
   粘贴 MTGO / MTGGoldfish / Moxfield 纯文本牌表本机开局。支持 `Commander / Deck / Mainboard` 区段标题或空行分隔指挥官。六区（牌库/手牌/战场/指挥区/坟场/放逐），抓牌、打出、拖放、横置、Token、长按手牌/战场卡放大查看卡图（战场卡自定义拖拽会打断系统长按，用计时器兜底稳定触发）、长按牌库查找（带搜索框，选牌后自动洗牌关库；内含 **展示库顶** 开关，开启后牌库按钮以库顶卡 `art_crop` 无字大画铺底，服务 Bolas's Citadel / Mystic Forge 类「可见并从牌库顶施放」效应，随抓牌/洗牌实时跟随、新开局自动回隐藏）。**区域芯片卡图**：主将区按结算页方式呈现主将卡图（单主将居中、双拍档左右分屏），坟场/放逐区恒显最上方一张（最近置入）的 `art_crop` 大画。非牌库区卡面直显 Scryfall 卡图，Token 离场即消失。**战场下方横向五色+无色法术力栏**（WUBRG 惯例横排、回收战场满宽，零值时半透明；+/- 增减，数据 `wx.setStorageSync` 持久化）。右上角按钮：Token / 刷新 / 随机弃（手牌非空时显示，确认后随机弃一张至坟场）/ 重置。

## 技术约束

- 原生 WXML / WXSS / JS；单位 rpx，锁竖屏；个人主体，不用 `web-view`。
- 指挥官 / 问卷 / 贴纸 / EDHTI / 卷心菜 / 伊捷 / 粒子 / 性能阈值全是本地配置（`config/`）。
- **标题字体**：`assets/title-font.js` 内嵌 Archivo Black（OFL）base64 woff2，`pages/index/index.js` 用 `wx.loadFontFace` 注册字体族 `cEDHDisplay`。目的：修复各系统自带字体分歧（iOS 落 Avenir Next Condensed 压缩肥体、安卓落 Roboto）导致的标题粗细不一致。EDHTI 导出海报标题同样使用 `cEDHDisplay`（`pages/edhti/edhti.js` `onLoad` 注册，`global: true, scopes: ['webview', 'native']` 覆盖 Canvas 2D）。
- **Scryfall 卡图**：`utils/scryfall.js` 用 `?fuzzy=` + `format=image` 直连图片。`normalizeCardName` 把弯引号（Moxfield 导出）归一化为直引号，并把撇号编码为 `%27`（裸撇号会让微信 `<image>` 加载失败）。
- **分享**：全部页面声明 `onShareAppMessage` / `onShareTimeline`，经 `utils/share.js` 调 `wx.showShareMenu`。

## ✅ 上线合规（三项均已配置，保留说明备查）

- **相册保存**：✅ 已在 mp 后台 `设置 → 服务内容声明 → 用户隐私保护指引` 声明「相册（写入）」并发布；EDHTI「导出分析」的 `wx.saveImageToPhotosAlbum`（隐私接口）上线可正常保存。（备查：未声明时「开发者工具能存、上线后存不了」，属隐私指引缺失而非代码 bug，画布与保存流程本身正确；如需更稳可加 `wx.getPrivacySetting` + `wx.requirePrivacyAuthorize` 兜底。）
- **合法域名**：✅ 已配置 **request 合法域名** `https://api.scryfall.com`（`wx.request` JSON）、**downloadFile 合法域名** `https://api.scryfall.com` 与重定向目标 `https://cards.scryfall.io`（卡图经 `<image>` / 画布）。
- **AppID**：✅ 已配置正式 AppID `wx7b9be8205eb508e6`（根目录 `project.config.json`），非游客，可正常提审。

## 目录结构

```text
miniprogram/
  app.json / app.wxss              页面注册 / 全局样式、按钮反馈、通用 surface
  styles/tokens.wxss               设计 token
  styles/themes/                   页面主题（neon-arcade / noir-gold / dark-table），按钮走 --cedh-btn-* 变量
  components/particle-background/   Canvas 2D 背景粒子
  components/option-list/           EDHTI/quiz 共用选项列表组件

  config/questionnaire.js          主将问卷
  config/commanders.js             本地指挥官库（sourceStats、matchTags、edhtop16Url）
  config/recommendation-rules.js   推荐算法规则
  config/edhti.js                  EDHTI 题库/类型/文案
  config/tracker.js                战绩配置
  config/random.js / stickers.js   随机数先手 / 贴纸池
  config/cabbage.js                卷心菜引擎表（仅卡名）
  config/izzet-storm.js            伊捷引擎表（Krark, the Thumbless / Krark's Thumb / Ral, Monsoon Mage）
  config/particle.js / performance.js  粒子与性能分档

  utils/recommender.js + recommender/   推荐算法 facade + 拆分模块
  utils/result-display.js          推荐展示名、拍档排序、去重补位、卡图 URL 预填
  utils/edhti.js                   EDHTI 计分
  utils/tracker.js / tracker-charts.js  战绩统计 / 图表
  utils/random.js / stickers.js    随机 / 贴纸纯函数
  utils/playtest.js                试玩解析与区域状态机
  utils/playtest-mana.js           法术力池纯逻辑（增减/归零/持久化）
  utils/cabbage.js                 卷心菜 token 状态机 + 法术力计算
  utils/izzet-storm.js             伊捷抛币 + storm 计数聚合
  utils/canvas-kit.js              导出海报共用 Canvas 原语 + 保存流程（含相册权限）
  utils/scryfall.js                Scryfall URL 构造 + 卡名归一化
  utils/commander-meta.js          指挥官 meta 标签推导
  utils/quiz-flow.js               答题流程纯函数（quiz/edhti 共用）
  utils/share.js                   全页转发/朋友圈菜单

  pages/{index,edhti,quiz,result,tracker,random,cabbage,izzet,playtest}/

  assets/cT_logo_v.2.jpg           cT 小程序码，EDHTI 导出图底部用
  assets/cedh-house-qr.jpg         cedh小屋二维码，EDHTI 导出图用
  assets/title-font.js             内嵌 Archivo Black base64（标题字体）

tools/logo-export.html             logo/字标 PNG 导出器（144×144，微信头像用；非小程序包内容）
tools/edhti-title-export.html      EDHTI 海报标题 PNG 导出器（Multiverse EDHTI；缺图时页面回退实时文字）
external/edhti/                    EDHTI 来源仓库，仅备查，不入包
scripts/diagnose-coverage.js       推荐覆盖率与视觉复杂度自检
scripts/edhti-odds.js              EDHTI 人格出现率蒙特卡洛重算（改题库后重跑贴回 config/edhti.js）
tests/                             Node test 测试套件
```

## 可编辑配置

- **主将问卷** `config/questionnaire.js`：题面/选项/`weights`/多选衰减。别建空权重选项（测试会校验每个选项映射到真实标签）。
- **指挥官库** `config/commanders.js`：`name` `colorIdentity` `archetypeTags` `matchTags` `deckElements` `sourceStats` `edhtop16Url`。`sourceStats` 按 EDHTop16 近 6 个月统计；发布前以 `node scripts\diagnose-coverage.js` 输出为准（`deadCount` 应为 0）。
- **EDHTI** `config/edhti.js` + `utils/edhti.js`：题目/类型/侧写/引语 vs 计分逻辑。
- **战绩** `config/tracker.js` + `utils/tracker.js`：胜率 = 胜 /(胜+负)，平局不计分母；无 `seat` 显示「座位未知」。
- **混沌工具** `config/random.js` / `config/stickers.js` / `utils/stickers.js`。Goblin 元音：`A E I O U Y`，每词取不重复元音数，每卡取 3 词最高，每局抽 3 卡不重复。
- **卷心菜 / 伊捷** `config/cabbage.js` / `config/izzet-storm.js`（引擎只放卡名，无解释文字）+ 对应 `utils/`。
- **背景粒子** `config/particle.js` / `config/performance.js`：香槟金尘埃（帧率无关漂移、`twinkle` 微弱明灭、触碰 = 径向排斥 + `swirlRpx` 切向搅动、连线星座）。彻底关背景动效把 `performanceConfig.defaultMode` 设为 `off`。

### 套牌试玩牌表格式

```text
Commander
1 Tymna the Weaver
1 Kraum, Ludevic's Opus

Deck
1 Sol Ring
1 Command Tower
```

也支持空行分隔指挥官；`Sideboard / Maybeboard / Considering` 区段忽略。

## 视觉规则

- 非导出页面禁用 `radial-gradient` 背景光斑，只保留线性底色 + 玻璃层 + 粒子背景 + 语义色。
- 导出图是独立海报视觉，可用渐变/纹理/暗角。
- 按钮按压反馈集中在 `app.wxss` 的 `pressable-active`。
- 页面主题在 `styles/themes/`，卷心菜绿 `#2fa75d`、伊捷蓝 `#5aa9ff`、自伤/输红 `#e0655c`。

## 本地验证

```bash
node --test tests\*.js          # 全部测试
node scripts\diagnose-coverage.js   # 覆盖率与视觉复杂度自检
```

发布前应确认：测试全绿、`deadCount` 为 0、无非导出页 `radial-gradient`、Scryfall request + downloadFile 域名与隐私保护指引已配置、AppID 为正式主体。

## 导入微信开发者工具

导入项目目录 `...\Documents\xcx`（`project.config.json` 已设 `miniprogramRoot = miniprogram/`）；真机预览卡图与保存前，按上面「上线合规」配好域名与隐私指引。
