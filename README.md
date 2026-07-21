# cEDH Tutor / 竞技EDH导师

微信小程序原生前端项目，辅助 cEDH / EDH 玩家：测人格、匹配主将、记录战绩、对局前随机、对局中计数、手机试玩牌组、评估 Commander Bracket。不使用云开发 / 云函数 / 云数据库；运行时只请求 Scryfall 卡图与卡牌元数据，不请求 edhtop16 或 Reddit。强度分级会把去重后的英文卡名批量发送至 Scryfall，以读取法术力值、牌张类型、Oracle 规则文本与非闪 USD 参考价；Oracle 文本只在请求返回时提取紧凑特征，不写入本地分析结果。原始牌表、区段与本地分析结果不会上传到项目自有服务。

品牌导出物继续使用黑底橙切的 `cT` 字标（母版见 `tools/logo-export.html`）；应用主页使用荧光黄绿的点阵索引页，以 `cEDH Tutor` 为主标题、「竞技指挥官导师」为中文副标题。

## 当前模块（11 页）

1. **首页** `pages/index`
   单屏酸性极简索引：满版 `#D0F03C`，不使用渐变、纹理、玻璃或图片，不加载粒子组件或连接动画。上方 45vh 顶部以工业注释风排出三段全大写英文小字——EDH 规则、cEDH 竞技与 cEDH 社交默契（玩就为赢、威胁评估结盟不做 kingmaker、欢迎 proxy）各一段、每段三个单行完整短句（每句不超过 46 个字符、任何机型都不折行，测试锁定；标题区另有 overflow 保护），只用字母数字与空格，不用冒号、斜杠或句号（7px Courier 半透明黑，600px 以下屏高降至 6px）；其下大片留白，底部锚定粗体前倾的 `cEDH Tutor`（内嵌 Archivo Black，纯白无投影，52px，窄屏 46px / 矮屏 42px / 600px 以下 38px）与点阵「竞技指挥官导师」。界面文字不使用分隔标点。自定义导航按微信胶囊实测位置留出顶部空间。下方是八行等分目录：编号、点阵中文（20px，取点阵字体 10px 网格的整数倍保证锐利）与右对齐英文副标题之间只以留白区隔（space-between，无点线、无中点）；按「认识偏好 → 构筑验证 → 桌面对局 → 记录复盘」排列：人格测试、火花觉醒、强度分级、套牌试玩、血量记录、混沌工具、我的主将、环境梯度，英文副标题依次为 `EDHTI PROFILE`、`COMMANDER FINDER`、`BRACKET ANALYSIS`、`DECK SANDBOX`、`LIFE COUNTER`、`CHAOS TOOLKIT`、`COMMANDER LOG`、`META TIER LIST`。按下整行在 60ms 内反相为黑底荧光字，不弹跳、不缩放。页面底部一行三段版权页 imprint：`MADE BY CPP123`、`MIT LICENSE`、`SCRYFALL API`（8px Courier 半透明黑、无标点，三列网格绝对对称——左贴边、中严格居中、右贴边，600px 以下降至 7px）。全页文字均不使用阴影。700px 以下屏高标题区收至 40vh。环境梯度仍只显示「功能还在开发中，敬请期待！」，没有空页面。

2. **人格测试 / EDHTI** `pages/edhti`
   基于 `external/edhti` 整理成本地配置。**面向休闲 EDH（casual EDH），非 cEDH**——推荐主将池全为非拍档休闲指挥官，题库围绕桌游社交体验而非竞技强度。输出 EDHTI 类型、人格侧写、推荐主将、玩家标签。每个人格维护 10 位语义一致且不重复的主将；完整 8 维标签画像通过稳定 rendezvous hashing 在池内选择，同一答案稳定复现、候选顺序变化不会整体洗牌，10 位主将均可达。**玩家标签上方有醒目的「导出分析」大块按钮**（霓虹渐变，不用下滑就能看到），导出粉蓝赛博风结果图（英文标题 Multiverse EDHTI）：含人格稀有度霓虹贴纸、玩家标签雷达六边形、九宫格阵营网格（善↔邪 × 守↔混，由四轴分数派生）、`cT` 小程序码 + cedh小屋二维码。导出画布固定 1080×2338 像素（不乘 DPR，避免高分屏真机 `canvasToTempFilePath` 失败）。

3. **指挥官问卷 → 推荐结果** `pages/quiz` → `pages/result`
   12 步偏好问卷（速度 / 获胜方式 / 互动 / 颜色 / 拍档 / 资源累积）生成画像，从本地指挥官库推荐 5 个主将。结果页实时显示 Scryfall 卡图；edhtop16 链接只复制到剪贴板，不在小程序内开网页。result 页当前无图片导出。

4. **我的主将 / 战绩** `pages/tracker`
   本地战绩追踪，最多 5 套牌组，记录主将 / 日期 / 胜负平 / Seat 1-4，展示胜率曲线与轮次胜率。单主将显示一枚头像；双拍档头像并排留隙显示，两位拍档均以完整单行名称显示，名称块与头像组中线对齐。图表更新合并到单次绘制且仅在对局数据变化时重绘；长记录展开时一次最多渲染最近 50 条，完整数据仍保留在本地。数据经 `utils/storage.js` 版本化保存在微信本地存储；兼容历史裸数据，并在首次读取时自动升级。

5. **强度分级 / Bracket Analysis** `pages/bracket`
   粘贴英文 Commander 纯文本牌表，在本机输出官方 Bracket 1–5 的**建议档位**与次级**规则下限**，不显示 1–10 分数。导入页与套牌试玩统一说明支持 MTGO / Moxfield / MTGso 纯文本及主将分隔方式；牌表编辑器以纯 Flex 布局填满首屏，矮屏或键盘弹出时分析入口仍保持可操作。“开始分析”为黑曜石与翡翠色立体分析台，移除左侧字母图标与英文副标题，仅保留绝对中置、始终单行的中文主文案；读取数据时只增加自上而下的单层扫描线，不再叠加多层纸屑动画。结果页以档位为视觉中心，将摘要、判定链条、曲线/造价、构筑效率、构筑信号总览、覆盖范围和完整依据列表分成明确层级。hero 底层嵌入主将 `art_crop` 卡图——单主将整幅、双拍档左右分屏（沿用套牌试玩主将区的分屏语汇），经「左实右虚 + 下坠 + 档位色染色」三层 scrim 压暗成环境底图，正文提层保持对比度，不新增任何版面区域；任一半卡图加载失败即整层隐藏，hero 回落为纯档位色底。**判定链条**在档位下方逐级展示复合推导：规则下限 → 结构强度 → 数据辅助 →（主将池 / 预算细分），每一级标注当级档位、升档节点以 accent 高亮，玩家能看见各因素如何叠加成终判；**构筑信号总览**列出全部命中的信号轴与张数（快速法术力 / 高效导师 / 免费互动 / Stax / 高效资源引擎 / 高效制胜 / 高效主将区引擎），不足以触发升档的信号也如实展示；**每条依据右侧标注其在链条中的作用**（下限 BX / 强度带 BX / 辅助上调 / B4→B5 / B5→B4.5 / 参考 / 置信度）。依据不设条数上限，规则与强度依据在前、参考观察（不改档位的曲线、主题与造价数据）压暗在后，每条附触发牌名；依据标题使用「高效构筑」「高密度主题主线」「合理法术力曲线」式的品质描述，不使用「××支持」措辞——并保留底部常驻的“修改牌表”入口；结果元信息只保留下限与右对齐的置信度。置信度衡量的是「档位判断有多可能出错」，不只是「输入有多完整」——除了数据缺口，还纳入判断本身的认知暴露。分高/中/低三级并由具体缺口驱动：结构不完整或零触发牌为「低」。以下任一因素出现则封顶「中」：法术力或构筑数据覆盖不足；**识别密度过低**（数据足以评估整副牌，但收录名单只识别到不到 25% 的非地牌，可能遗漏未收录的高强度变量单卡）；**检测到未确认的组合技结构**（牌表可能含有轻量规则集未收录的组合技，实际强度可能更高）；**档位来自软性辅助的临界上调而非硬性规则**（去掉该辅助会回落一档，判断更依赖启发式）；B5 边界悬置（缺可靠造价无法区分 B5 与 B4.5、或造价落在 $500 ±15% 边界带内）。只有结构完整、数据达标、识别大部分单卡、且档位由硬性规则或清晰结构锁定、没有任何上述悬置项时才是「高」——因此一副靠曲线或构筑效率临界上调支撑的档位、或一副大量使用未收录单卡的套牌，都不会被声称为高置信度。判定依据列表末尾固定有一条「判定置信度」参考行，逐项列出影响判断的缺口（不向用户指派补齐动作——补数据是本工具的职责）。识别密度阈值维护在 `RECOGNITION_DENSITY_FLOOR`。结果页 accent 按档位走色阶：B1 冷灰蓝 `#8CA8B4`、B2 翡翠 `#49B380`、B3 鎏金 `#D4B23F`、B4 燃橙 `#E0813C`、B4.5 橙红 `#E0684C`、B5 绯红 `#E04F5C`，档位越高颜色越显竞技；导入页保持模块翡翠色，派生的半透明底、描边与曲线颜色随档位自动跟随。判定依据不展示横置地数量，页面说明以逗号分隔，不使用句号。B1 只在牌表结构完整且未命中高档触发时自动建议；常规 B5 仍要求完整、无已收录禁牌，并具备高密度快速法术力、高效导师、互动/压制及早期组合技或极高多轴信号。另有一条精确规则：完整、无已收录禁牌的牌表若原判定为 B4，且单主将或完整 Partners 配置命中主将问卷现有 100 条主将池，则升为 B5；单独命中其中一位 Partner 不生效。官方五档之外另设一个工具细分档 **B4.5（预算竞技 / Budget cEDH）**：牌表按上述判断应归 B5，且造价数据可靠（覆盖 ≥75% 且 ≥20 张计价牌）而「非基本地预估造价」低于 $500 时细分为 B4.5——结构是竞技的、造价是预算的，介于 B4 与 cEDH 之间；细分不改变规则下限，档位色阶在燃橙与绯红之间取橙红，摘要与依据会写明预算线；造价数据不可靠时保持 B5，并由置信度说明缺口。检测到完整组合技后自动计入规则下限与推荐档位。已确认组合技还会做**速度分档**：当 Scryfall 元数据可用时，按全套牌张法术力值合计定档（0 费=5、≤4 费=4、≤6 费=3、≤8 费=2、9 费以上=1，多变体取最快一线），合计不超过 4 费即构成客观「早期组合技」，并入 B5 的早期组合技条件、写入依据文案（「全套法术力值合计 X，前期即可启动」）；元数据缺失时退回变体上的人工速度标注，离线输出逐字不变。版本化轻量数据集当前包含 2026-02-09 规则快照、53 张 Game Changers、42 张具名 Commander 禁牌，以 Top 15 组合技家族作为主干，收录 42 条精确变体、6 条 Top 家族可变组件模式与 6 条额外结构模式。同家族多变体同时命中只计一次；Underworld Breach、Laboratory Maniac、Bloodchief Ascension、Thassa's Oracle 和 Brain Freeze 始终归入高效制胜，其他出口只在完整家族与所需附加条件同时命中时动态归类，避免普通单卡误报。快速法术力、高效导师、免费互动、Stax、资源引擎和主将区引擎继续补充结构强度信号。

   Scryfall 特征覆盖达到 80% 后，系统进一步观察三条紧凑效率轴：前期法术力就绪度（T1 可用地、无条件横置地、1–2 费常规加速）、低费互动与保护（0–2 费互动、坟场互动、保护）及牌张流速与选择（0–2 费抓牌、滤牌），并加入主题稳定性与未收录组合技结构两项辅助。主题稳定性要求同一主线同时具备足够的成员密度与独立支援/收益牌，首批覆盖武具、灵气、弃牌、+1/+1 指示物和神器；普通法术力石、单张灵气或只有弃牌动作而没有收益件都不会单独命中。未收录组合技只在不同牌张分别提供免费牺牲出口、可重复递归/重施放与死亡终结收益时标记为“组合技结构”，不冒充已确认的完整组合技，不改变规则下限，也不作为 B5 的早期组合技条件。土地按实际数量计算，非地功能牌按唯一牌名计算；已命中的完整组合技牌会从未收录结构中排除，其他与既有强度信号重叠的牌也只能通过共享辅助额度影响一次。土地轴还要求至少 20 个已识别地牌位，其余 Oracle 特征要求至少 40 个已识别非地牌位。曲线、构筑效率、主题稳定性与组合技结构共享一个辅助额度，合计最多在既有结构强度上上调一档并封顶 B4；覆盖不足时只展示已有信息，不把缺失项当作零。价格覆盖至少 75% 时仍只作弱辅助，只有完整牌表已经具备多轴 B3 结构信号且页面所示“非基本地预估造价（美元）”达到 $1,200 才可能支持 B3→B4；该字段的实际计算口径是整副牌扣除基本地后的其余牌，并非只计算非基本地。所有辅助项都不改变规则下限，造价与推断结构不直接参与 B5。全部依据与触发牌直接列在判定依据内，不设二级展开；依据句子只描述牌表本身，覆盖率只出现在「覆盖范围」指标区；界面不显示内部版本或非操作性的边界提示。

   方法论分四层：本地硬规则下限（Game Changers / 禁牌 / 大规模炸地与锁地 / 完整组合技）→ 结构强度信号（快速法术力、高效导师、免费互动、压制、引擎、主将区引擎的密度带）→ 元数据辅助轴（曲线、构筑效率、主题稳定性、组合技结构与造价共享一次上调额度）→ B5 竞技特征（核心效率 + 早期组合技或极高多轴信号）。这一「硬下限 + 软信号」分层与社区主流工具同构；组合技速度分档参考了开源的 Commander Spellbook `estimate-bracket` 方法论（MIT），但全部判定仍在本地完成、不调用其服务。这是本地规则评估加在线元数据辅助，不是绝对强度或匹配系统。Scryfall 卡牌查询按最多 75 个卡名顺序分批；临时失败只做一次受控重试，当前印次缺少非闪 USD 时再按 Oracle 身份合并查询其他纸牌印次，避免逐卡重复请求。网络仍不可用时自动退回本地规则结果；轻量数据集不包含完整英文 Oracle 名字索引，因此未命中不等于弱牌，也不承诺完整拼写、色组、类别禁牌或单卡合法性校验。输入不完整或元数据覆盖不足时会保留覆盖率与解析问题；缺失价格不会按 `$0` 计入。

6. **混沌工具** `pages/random`
   随机数、4×D20 先手判定、`_____ Goblin` 开局贴纸抽取（元音数运行时算）。下方两个**独立全屏计数器入口**（进入为独立页，便于长局记录，不会误滑到别的工具）：
   - **卷心菜对账** `pages/cabbage`：The Cabbage Merchant / Academy Manufactor 食物引擎，追踪 Food/Clue/Treasure 衍生物的未横置/横置与可造法术力（绿=有色 / 白=泛用分色）。
   - **伊捷风暴** `pages/izzet`：Ral, Monsoon Mage 专用风暴计数器；Ral 默认不在场，确认正面在场后手动开启。施放瞬间/法术时记录抛币与自伤；当本回合瞬间/法术达到 6 次或以上且抛赢时，提示「转化可开大」。统计 storm / 瞬间法术 / 抛币胜负 / 自伤，可手动 ±1 校正、撤销与新回合。

7. **血量记录** `pages/life-tracker`
   横屏分区血量计，支持 **2 / 3 / 4 人**三种模式：两人上下对坐（上位反转）、三人上一下二（第一位横跨整行且反转）、四人十字四分；分隔线随模式增减（两人无竖线、三人竖线只画下半）。三人 / 四人默认每人 40 点，两人对决按 1v1 惯例自动 20 点（切换人数即按新默认重开，重置同理）；点击 / 长按快速增减并限制在 -999～999。中心 RGB 椭圆菜单提供返回主页、重置对局与人数切换（当前档高亮；切换按新人数重开对局并按序保留座位名）；触发胶囊视觉仍为 36×28rpx，但可点热区扩至 88rpx 见方，菜单胶囊 44rpx 高、16rpx 字号；进入页面时请求系统常亮，退出时恢复默认熄屏，并用版本化本地存储尽可能恢复当前对局（旧版四人存档无 `playerCount` 字段仍自动兼容）。

8. **套牌试玩** `pages/playtest`
   粘贴 MTGO / MTGGoldfish / Moxfield 纯文本牌表本机开局。支持 `Commander / Deck / Mainboard` 区段标题或空行分隔指挥官。六区（牌库/手牌/战场/主将区/坟场/放逐），抓牌、打出、拖放、横置、Token、长按手牌/战场卡放大查看卡图（战场卡自定义拖拽会打断系统长按，用计时器兜底稳定触发）、长按牌库查找（带搜索框，40 张一页按需加载，选牌后自动洗牌关库；内含 **展示库顶** 开关，开启后牌库按钮以库顶卡 `art_crop` 无字大画铺底，服务 Bolas's Citadel / Mystic Forge 类「可见并从牌库顶施放」效应，随抓牌/洗牌实时跟随、新开局自动回隐藏）。**区域芯片卡图**：主将区按结算页方式呈现主将卡图（单主将居中、双拍档左右分屏），坟场/放逐区恒显最上方一张（最近置入）的 `art_crop` 大画。非牌库区卡面使用 `small` 尺寸 Scryfall 卡图，Token 离场即消失；收到系统内存告警后自动撤下非必要卡图并保留文字操作。导入限制为 50,000 字符、250 张总牌与最多 3 张主将，避免异常数量展开占满内存。**战场下方横向五色+无色法术力栏**（WUBRG 惯例横排、回收战场满宽，零值时半透明；+/- 增减，牌表与法术力池均经版本化存储持久化）。右上角按钮：Token / 刷新 / 随机弃（手牌非空时显示，确认后随机弃一张至坟场）/ 重置。

## 技术约束

- 原生 WXML / WXSS / JS；默认竖屏，四人血量记录页单独横屏；个人主体，不用 `web-view`。
- 指挥官 / 问卷 / Bracket 规则 / 贴纸 / EDHTI / 血量 / 卷心菜 / 伊捷 / 粒子 / 性能阈值全是本地配置（`config/`）。
- **标题字体**：首页中文与入口使用 Fusion Pixel Font 10px Monospaced `zh_hans` 2026.07.01 的受控子集，包含主页所需中文、ASCII 与数字（顶部注释与底部 imprint 使用 Courier 等宽栈）；`assets/home-pixel-font.js` 内嵌约 14KB TTF 并注册为 `HomePixel`。`cEDH Tutor` 单独使用 `assets/title-font.js` 内嵌的 Archivo Black WOFF2，注册为 `cEDHDisplay`，并以系统粗体栈兜底。两种字体均由 `pages/index/index.js` 本地加载，失败时直接显示回退字体，不遮挡首帧。Fusion Pixel 完整 OFL 随发布包放在 `assets/FUSION_PIXEL_OFL.txt`，源子集、授权副本与再生成脚本分别位于 `tools/fonts/`、`scripts/build-home-pixel-font.js`；Archivo 也继续供 EDHTI 导出海报与血量数字使用。
- **Scryfall 卡图 / 元数据**：`utils/scryfall.js` 用 `?fuzzy=` + `format=image` 直连图片。`normalizeCardName` 把弯引号（Moxfield 导出）归一化为直引号，并把撇号编码为 `%27`（裸撇号会让微信 `<image>` 加载失败）。JSON 卡图请求设 8 秒超时、全局最多 4 个并发请求，并校验 HTTP 状态与响应结构；同卡并发请求复用 Promise，成功缓存上限 64 项，失败会清缓存以允许重试。`utils/bracket-metadata.js` 通过 `/cards/collection` 以 75 张为上限顺序分批读取 `cmc`、正面 `type_line`、`oracle_id` 与 `prices.usd`；只对超时、请求失败、408、429 和 5xx 做一次受控重试。当前印次没有非闪 USD 时，以多个 Oracle ID 合并搜索其他纸牌非闪印次；成功、明确未找到和本轮无价结果会话内去重，网络失败仍允许下次重试。
- **本地存储**：页面不直接读写 `wx.*StorageSync`，统一经 `utils/storage.js`。新数据保存为 `{ schemaVersion, updatedAt, data }` envelope；历史裸值自动升级，损坏数据安全回退，未来版本数据禁止被旧版覆盖。写入/删除失败返回显式结果，由页面提示用户而非静默丢数据。
- **异步一致性**：推荐结果页用「主将 + 分数 + 契合度」签名识别当前结果；强度分级用递增请求编号识别当前牌表。旧 Scryfall 请求即使延迟返回，也不会写入新一轮问卷卡位或已修改的牌表。
- **分享**：全部页面声明 `onShareAppMessage` / `onShareTimeline`，经 `utils/share.js` 调 `wx.showShareMenu`。

## 稳定性边界

- 核心推荐、Bracket 解析与分级、牌区状态机、战绩统计、计数器和法术力池均放在可由 Node 直接测试的纯逻辑模块中；页面层负责微信生命周期、渲染和用户反馈。
- 首页不挂载粒子组件；各粒子页面以 `palette` 属性使用与页面主题一致的点、线配色，并随帧率自动降档，收到系统内存告警后固定使用低档并缩减粒子池，页面隐藏或组件卸载时停止动画并释放画布引用。
- 本地数据仅保存在当前微信设备，没有云同步；清理微信数据或换机前应先使用功能内已有的导出能力保存重要记录。
- Scryfall 不可用时，推荐与本地工具仍可运行；强度分级回退到本地规则且明确显示 0% 元数据覆盖，卡图区域保留预填直连地址或结束 loading，不会阻塞主流程。
- Node 测试不能替代微信运行时验证。提审前仍需在开发者工具和至少一台真机检查触摸/拖拽、相册授权、Canvas 导出、弱网卡图和前后台切换。

## 上线合规

- **相册保存**：在 mp 后台 `设置 → 服务内容声明 → 用户隐私保护指引` 声明「相册（写入）」并发布；EDHTI「导出分析」的 `wx.saveImageToPhotosAlbum`（隐私接口）上线可正常保存。（备查：未声明时「开发者工具能存、上线后存不了」，属隐私指引缺失而非代码 bug，画布与保存流程本身正确；如需更稳可加 `wx.getPrivacySetting` + `wx.requirePrivacyAuthorize` 兜底。）
- **合法域名**：配置 **request 合法域名** `https://api.scryfall.com`（`wx.request` JSON）、**downloadFile 合法域名** `https://api.scryfall.com` 与重定向目标 `https://cards.scryfall.io`（卡图经 `<image>` / 画布）。
- **AppID**：配置正式 AppID （根目录 `project.config.json`），非游客，可正常提审。

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
  config/bracket-data.js           Bracket 规则版本、Game Changers、禁牌、组合与效率信号
  config/cabbage.js                卷心菜引擎表（仅卡名）
  config/izzet-storm.js            伊捷引擎表（仅 Ral, Monsoon Mage）
  config/particle.js / performance.js  粒子与性能分档

  utils/recommender.js + recommender/   推荐算法 facade + 拆分模块
  utils/result-display.js          推荐展示名、拍档排序、去重补位、卡图 URL 预填
  utils/edhti.js                   EDHTI 计分
  utils/tracker.js / tracker-charts.js  战绩统计 / 图表
  utils/random.js / stickers.js    随机 / 贴纸纯函数
  utils/bracket.js                 英文牌表解析、规则下限、辅助信号与建议 Bracket 纯逻辑
  utils/bracket-card-profile.js    Oracle 文本的紧凑构筑效率特征与覆盖门槛
  utils/bracket-commander-pool.js  100 条问卷主将配置的精确、顺序无关匹配
  utils/bracket-metadata.js        Scryfall 批量元数据、部分失败与内存缓存
  utils/playtest.js                试玩解析与区域状态机
  utils/playtest-mana.js           法术力池纯逻辑（增减/归零/持久化）
  utils/storage.js                 版本化本地存储、旧数据升级、校验与故障隔离
  utils/cabbage.js                 卷心菜 token 状态机 + 法术力计算
  utils/izzet-storm.js             伊捷抛币 + storm 计数聚合
  utils/canvas-kit.js              导出海报共用 Canvas 原语 + 保存流程（含相册权限）
  utils/scryfall.js                Scryfall URL 构造 + 卡名归一化
  utils/commander-meta.js          指挥官 meta 标签推导
  utils/quiz-flow.js               答题流程纯函数（quiz/edhti 共用）
  utils/share.js                   全页转发/朋友圈菜单

  pages/{index,edhti,quiz,result,tracker,bracket,random,life-tracker,cabbage,izzet,playtest}/

  assets/cT_logo_v.2.jpg           cT 小程序码，EDHTI 导出图底部用
  assets/cedh-house-qr.jpg         cedh小屋二维码，EDHTI 导出图用
  assets/home-pixel-font.js        首页 Fusion Pixel 受控子集 base64
  assets/FUSION_PIXEL_OFL.txt      随小程序包发布的点阵字体完整授权
  assets/title-font.js             内嵌 Archivo Black base64（首页字标 / 海报 / 血量字体）

tools/logo-export.html             logo/字标 PNG 导出器（144×144，微信头像用；非小程序包内容）
tools/edhti-title-export.html      EDHTI 海报标题 PNG 导出器（Multiverse EDHTI；缺图时页面回退实时文字）
tools/fonts/                       首页字体受控 TTF 子集 + OFL 开发副本
external/edhti/                    EDHTI 来源仓库，仅备查，不入包
scripts/build-home-pixel-font.js   从受控 TTF 子集重建首页 base64 模块
scripts/diagnose-coverage.js       推荐覆盖率与视觉复杂度自检
scripts/check-syntax.js            零依赖 JS 语法门禁（含未被 Node require 的页面脚本）
scripts/edhti-odds.js              EDHTI 人格出现率蒙特卡洛重算（改题库后重跑贴回 config/edhti.js）
tests/                             Node test 测试套件（含存储迁移与网络故障路径）
package.json                       统一的 syntax / test / diagnose / check 命令
```

## 可编辑配置

- **主将问卷** `config/questionnaire.js`：题面/选项/`weights`/多选衰减。别建空权重选项（测试会校验每个选项映射到真实标签）。
- **指挥官库** `config/commanders.js`：`name` `colorIdentity` `archetypeTags` `matchTags` `deckElements` `sourceStats` `edhtop16Url`。`sourceStats` 按 EDHTop16 近 6 个月统计；发布前以 `node scripts\diagnose-coverage.js` 输出为准（`deadCount` 应为 0）。
- **EDHTI** `config/edhti.js` + `utils/edhti.js`：题目/类型/侧写/引语 vs 计分逻辑。
- **战绩** `config/tracker.js` + `utils/tracker.js`：胜率 = 胜 /(胜+负)，平局不计分母；无 `seat` 显示「座位未知」。
- **强度分级** `config/bracket-data.js` + `utils/bracket*.js`：只维护可解释的精确英文卡名触发器、受限 Oracle 语义和命名阈值；更新官方规则、Game Changers、禁牌、组合技、主将池匹配、曲线、构筑效率、主题稳定性、组合技结构或价格辅助阈值时必须同步内部版本与对应测试。组合技数据以 `familyId` 聚合，精确变体和可变组件模式都必须有正例、缺件反例与跨变体去重测试；条件式高效制胜不得写入全局静态列表。Oracle 推断只能标记结构线索，不能进入精确组合技家族、规则下限或 B5 条件。面向用户统一使用“组合技”，不使用“胜法”“组合包”或“组合技包”。牌价只读取 Scryfall 实时非闪 USD 参考字段，不写入本地规则集，不得改成独立强度分数或 1–10 分数。新 Oracle 规则必须同时加入正例、近似措辞反例与覆盖不足测试，避免把指示物、坟场利用、自带辟邪、普通法术力石或单纯同类型牌误算为强度闭环。`comboSpeedConfig` 维护组合技速度分档表与早期阈值（默认 ≤4 费）；调整档表、阈值或速度文案时必须同步速度分档测试与 `evaluatorVersion`。
- **混沌工具** `config/random.js` / `config/stickers.js` / `utils/stickers.js`。Goblin 元音：`A E I O U Y`，每词取不重复元音数，每卡取 3 词最高，每局抽 3 卡不重复。
- **卷心菜 / 伊捷** `config/cabbage.js` / `config/izzet-storm.js`（引擎只放卡名，无解释文字）+ 对应 `utils/`。
- **背景粒子** `config/particle.js` / `config/performance.js`：默认是香槟金尘埃（帧率无关漂移、`twinkle` 微弱明灭、触碰 = 径向排斥 + `swirlRpx` 切向搅动、连线星座）。首页不注册或挂载该组件；其余功能页在 wxml 以 `palette` 属性取 `palettes` 中与页面主题一致的配色（neon-arcade 粉蓝 / noir-gold 橙金 / tracker 金 / random 玫红 / playtest 长春花 / bracket 翡翠 / cabbage 绿 / izzet 蓝，各含 accent、neutral、connection 三色），未指定或未收录时回退香槟金默认，性能仍按原 30 / 55 / 80 粒子分档；系统开启「减弱动态效果」时画布经媒体查询整体隐藏；彻底关闭全部背景动效可把 `performanceConfig.defaultMode` 设为 `off`。

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

强度分级支持同样的 `Commander / Deck / Mainboard` 标题和「数量 + 英文卡名」行；无标题时可在主牌后空一行，再列出 1 位主将或 2 位 Partners。显式区段始终优先；既无标题也无空行时不会猜测主将，并会明确降低置信度。

## 视觉规则

- 首页以 `#D0F03C`、`#FFFFFF`、`#0A0A0A` 加半透明黑双档为全部色板——`rgba(0,0,0,0.35)` 只作装饰（注释、分隔线），`rgba(0,0,0,0.55)` 用于信息性文字（编号、英文副标题、imprint，对荧光绿约 4.4:1）；全页不使用投影；禁用渐变、纹理、玻璃与图片，首页不加载粒子或连接效果，全部中文不使用阴影；目录行与底部 imprint 不引入新色；入口使用专属 `home-index-active` 进行 60ms 反相。
- 除首页外的非导出页面禁用 `radial-gradient` 背景光斑，只保留线性底色 + 玻璃层 + 粒子背景 + 语义色。
- 导出图是独立海报视觉，可用渐变/纹理/暗角。
- 通用按钮按压反馈集中在 `app.wxss` 的 `pressable-active`；首页目录行不继承其位移反馈。
- 页面主题在 `styles/themes/`，卷心菜绿 `#2fa75d`、伊捷蓝 `#5aa9ff`、自伤/输红 `#e0655c`。
- **技术仪表语汇（dark-table 工具页：tracker/random/playtest/cabbage/izzet）**：关键数值是英雄——超大等宽 `tabular-nums` 数字（tracker 胜率、random 随机数/骰点、cabbage 现可造绿、izzet storm/瞬间/自伤、playtest 法术力与区计数），段标题与数值标签退为等宽大写 tracked「微标签」（`--cedh-font-mono`、`letter-spacing` 0.14–0.2em、`text-transform: uppercase`、模块 accent 色）。不使用装饰性刻线或短横。首页与导出海报保持各自语汇；result/quiz 是展示型页面不套用此语汇。

## 本地验证

要求 Node.js 18 或更高版本；项目无 npm 运行时依赖，不需要安装依赖即可执行检查。

```bash
npm run check                       # 语法门禁 + 全部测试 + 覆盖率/视觉复杂度诊断
npm test                            # 仅运行全部测试
npm run syntax                      # 仅检查全部 JavaScript 语法
npm run diagnose                    # 严格推荐覆盖率与视觉复杂度诊断
```

当前基线：79 个 JavaScript 文件通过语法门禁，279 项测试全绿；推荐诊断覆盖 100/100 位主将，`deadCount = 0`。

诊断默认使用确定性的基准覆盖集：基线/单项变化、按主将标签构造的目标画像、固定种子的组合画像，以及颜色/资源引擎组合。排序复用生产逻辑中的拍档惩罚和低使用率多样性尾位，避免诊断模型与实际推荐分叉。需要离线穷举全部单选组合时使用 `node scripts/diagnose-coverage.js --mode=full`；该模式组合量很大，不用于日常 CI。

发布前应确认：测试全绿、`deadCount` 为 0、无非导出页 `radial-gradient`、Scryfall request + downloadFile 域名与隐私保护指引已配置、AppID 为正式主体。

## 导入微信开发者工具

导入项目目录 `...\Documents\xcx`（`project.config.json` 已设 `miniprogramRoot = miniprogram/`）；真机预览卡图与保存前，按上面「上线合规」配好域名与隐私指引。
