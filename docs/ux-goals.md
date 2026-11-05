# 产品体验准则（UX Goals）

这份清单是**评审与取舍时的判据**，不是待办列表。提出任何界面改动时，先回答它服务了哪一条、又可能牺牲了哪一条；两条准则冲突时（本项目最常见的是「粗野主义视觉」vs「可读性」），在 PR / 提交信息里写明为什么这样取舍。

英文条目是原始表述，保持不动；每组后面的「本项目口径」是落到这个小程序上的具体含义。

---

## A. 用户中心

- User-centered design
- Solve user problems, not technical problems
- Minimize cognitive load
- Simplicity and clarity
- Every screen should have a clear primary purpose
- Every interaction should have a clear outcome
- Every feature should justify its existence
- Remove unnecessary features before adding new ones
- Design for completion, not exploration
- Optimize for confidence, speed, and satisfaction

**本项目口径**：用户的真实场景是「牌桌上、对局中、手里还拿着牌」。每个页面要能一句话说清主任务（强度分级＝给我一个档位、血量记录＝别让我算错血）。评估器的方法论有多精细是技术问题，用户只需要档位 + 可信度 + 依据。

---

## B. 一致性与可预期

- Consistency across the interface
- Predictability of interactions
- Recognition over recall
- Familiar interaction patterns
- Consistent navigation
- Clear affordances
- Respect platform conventions
- Consistency between expectation and outcome

**本项目口径**：同一类操作在各页面必须同一种手势与同一种确认强度。「删除一条对局要二次确认，但清空全场血量不要」这种不对称就是 bug，不是风格。微信惯例（左滑返回、胶囊菜单位置、`showModal` 语气）优先于自创交互。

---

## C. 减少摩擦与用户成本

- Reduce friction at every step
- Minimize the number of user actions
- Progressive disclosure of complexity
- Respect users' time
- Respect users' attention
- Optimize for the most common user journeys
- Prioritize frequent tasks
- Minimize unnecessary decisions
- Minimize input effort
- Intelligent defaults and autofill
- Context-aware assistance
- Personalization without complexity
- Make the right action the easiest action
- Help users achieve their goals with the least effort possible

**本项目口径**：本项目最大的输入成本是**粘贴 100 行英文牌表**，出现在强度分级与套牌试玩两处。任何让用户第二次粘贴同一副牌的设计都算缺陷。第二大成本是长问卷（EDHTI 24 题、主将问卷 12 题）——问卷的每一步都必须可中断、可恢复、可回改。

---

## D. 反馈、状态与感知性能

- Fast perceived performance
- Immediate and meaningful feedback
- Clear system status and progress indication
- Responsive interactions
- Smooth transitions and continuity
- Reduce waiting through perceived performance techniques

**本项目口径**：所有等待都来自 Scryfall。规则是：**不确定的等待必须变成有终点的等待**。超过 1 秒的操作要有状态，超过 5 秒要有进度或分母，超过 10 秒要给用户一条出路（降级到本地规则、取消、后台继续）。动画不能代替进度——一条循环扫描线不告诉用户还剩多久。

---

## E. 容错与恢复

- Forgiving design (easy recovery from mistakes)
- Error prevention before error handling
- Clear and actionable error messages
- Safe defaults
- Undo whenever possible

**本项目口径**：牌桌场景下误触率高（手汗、匆忙、多人围观），且**丢失的状态无法重建**（对局血量、24 题答案、拖了一半的战场）。优先级：能撤销 > 二次确认 > 事后 toast。注意「二次确认」对高频合法操作（长局中重置）是负担，这类操作应该给撤销而不是拦截。

---

## F. 信息架构与可发现性

- Reduce information overload
- Clear visual hierarchy
- Logical information architecture
- Strong discoverability
- Seamless onboarding
- Low learning curve
- Progressive mastery for advanced users

**本项目口径**：首页是唯一的导航层，八个入口必须让**没用过的人**知道点进去会发生什么。功能名（火花觉醒、混沌工具）是品牌语汇，不是说明；语义靠副标题承载，因此副标题是功能文本，不是装饰文本，不能按装饰标准压小压淡。

---

## G. 可达性与阅读

- Accessibility by default
- Inclusive design
- Readability over decoration
- Mobile-first thinking
- Thumb-friendly interactions

**本项目口径**：区分**装饰文本**与**功能文本**。装饰文本（规则墙、版权 imprint、侧脊题词）可以极小极淡并 `aria-hidden`；功能文本（入口副标题、数值、按钮）必须满足正文对比度 4.5:1 且不小于 10px。触控热区不小于 44×44 CSS px，与视觉尺寸解耦。88rpx 仅在 375px 宽设备等于 44px，在 320px 宽设备只有约 37.5px；关键操作使用明确的 px 最小尺寸。Planechase 的规则正文采用 14px 下限。

---

## H. 信任与诚实

- Reliability and trustworthiness
- Transparency in system behavior
- Honest communication (no deceptive patterns)
- Respect users' privacy
- Delight through polish, not gimmicks

**本项目口径**：强度分级本质是在给别人的牌组下判断，**说清楚判断可能怎么错**比显得权威更重要——置信度体系与「判定依据」列表是这条准则的产物，不能为了页面好看而简化掉。可点击即承诺可用：点了只弹「开发中」的入口是失信。数据不出设备是既有承诺，不得因为便利而放宽。

---

## I. 真实条件与迭代

- Design for real-world conditions (poor network, interruptions, distractions)
- Optimize for edge cases without compromising the common case
- Data-informed iteration
- Continuous usability testing

**本项目口径**：真实条件＝**卡店弱网 + 随时被打断**。任何多步流程都要假设用户会在中途切后台。Node 测试覆盖不到运行时体验，提审前的真机检查清单（触摸/拖拽、相册授权、Canvas 导出、弱网卡图、前后台切换）是这条准则的执行手段，见 README「稳定性边界」。

---

## 首次对照审计（2026-07-25）

对照上述准则逐页检查的结论，按「丢失代价 × 触发概率 × 修复成本」排序，明细与建议见当次会话记录。

| 组 | 状态 | 主要缺口 |
| --- | --- | --- |
| A 用户中心 | 良好 | 08 环境梯度为不可用的死入口 |
| B 一致性 | **有缺口** | 确认强度不对称：删 1 条对局要确认，清空全场血量不要 |
| C 减少摩擦 | **有缺口** | 牌表需重复粘贴（分级 ↔ 试玩不互通）；无剪贴板导入；问卷答案不可回改 |
| D 反馈与感知性能 | **有缺口** | 分级读取无进度分母、不可取消、无降级出口 |
| E 容错 | **有缺口** | 撤销仅伊捷风暴一处；EDHTI 24 题零持久化；血量重置无防护 |
| F 信息架构 | **有缺口** | 01/02 语义重叠且无说明；无首次引导 |
| G 可达性 | **有缺口** | 入口副标题 9px（窄屏 8px）、对比度约 4.46:1，未达正文 4.5:1 |
| H 信任 | 良好 | 置信度与依据链条是同类工具中的优势项，继续保持 |
| I 真实条件 | 良好 | 离线降级、异步一致性、版本化存储与写失败显式提示均已到位 |

## 第二次全页视觉审查（2026-09-18）

用开发者工具自动化给 19 个页面截图（首屏，长页面再截中段和底部），逐页对照上面的准则。整体没有错位、溢出或被裁掉的控件，各模块的主题也守住了。改动分两类。

明显的毛病，直接修：

- 混沌工具页的导航标题写成“小工具”，和首页入口、竞逐时空里的“返回混沌工具”对不上，改成“混沌工具”（B 一致性）
- 调牌记录的“＋”虚线框看着能点、其实点不动，改成点了就能选牌（B 明确的可操作性）
- 套牌试玩导入页的输入框按固定高度预留空间，底部版权说明被挤到屏幕边缘；导入态改成锁定一屏高，输入框用可压缩的 flex 填满剩余高度（G、I）

用户拍板的三件，都选了推荐：

- 战情室的少用操作按 EDH hub 的做法整理：“删除套牌”从卡片右上角的红字挪到每张套牌卡片底部，“清空数据”从与“复制战绩文本”并排的大按钮挪到页面最下方，都是居中的次要文字，点了仍先弹窗确认；“＋”改成“＋ 添加套牌”（E 容错、F 可发现）
- 牌名与标签按 Scryfall 官方简中印刷写中文、英文原名放小字：伊捷风暴的风雨法师拉尔、风暴、掷硬币；卷心菜对账的树林之友贾希拉、大学院制造工人、佩里格林·图克和食品、线索、珍宝（官方简中牌文写“食品”，不是“食物”）；这手留不留的六位主将。The Cabbage Merchant 没有简中印刷，照旧写英文（F 信息架构、本项目术语口径）
- 套牌试玩的粘贴区改成强度分级的样子：同一张说明卡，右上角“粘贴”，“清除现套牌”挪到底部居中的次要文字；两页的说明文字提到不小于 10px，次要说明的对比度也提到可读（B、G）

## 第一批修复（2026-11-04）

来源是 Codex 当天的现场自检和决策文档。用户看过审查意见后说“你看着办”，其中三条和 7/29 既有决定有关的，按审查意见处理（第 3、4 条）。

| 改动 | 服务 | 牺牲 |
| --- | --- | --- |
| 1. 梯度详情改实色底；详情和竞逐时空卡面打开时粒子停下并隐藏 | G 可达性（字不再和背后的列表叠在一起）、I 真实条件（读字时不再多跑一路动画） | 弹层打开时背景是静止的，和页面其余时候的动态感不连续 |
| 2. 投票和选牌组件不再导入共享样式表，消掉编译器的选择器告警 | B 一致性（公共样式只有一条来路） | 组件不再自带公共样式，必须靠宿主页导入，由 shared.suite 守着 |
| 3. 梯度页尾改写“人工编辑榜　截至 日期”；删掉没有入口的方法说明开关 | H 信任（这份榜随包发布，不会自己更新，不再写“持续更新中”） | 少了 7/29 加的那句活跃感。方法说明入口按 7/29 的决定不恢复，等赛事榜有统计口径时再做 |
| 4. 长牌名字号固定，放不下在空格处换行；英文名和标签不小于 10px；详情给完整名字 | G 可达性（320 宽下不再有 8px 上下的小字，也不再有被裁掉的名字） | 撤回 7/29 的“一律单行”，少数长名那一行会高一些，列表节奏没那么整齐 |
| 5. 竞逐时空底栏写明下一步和待处理数，去掉当前时空页顶部那条重复入口 | A 用户中心（每个阶段只有一个清楚的主操作）、F 信息架构 | 当前时空页少了顶部提醒，待处理状态只靠底栏和结算台标签上的数字 |
| 6. 混沌工具的三个工具入口移到最上面，竞逐时空排第一，有进度时写继续对局 | C 减少摩擦（不用翻过几张表单才找到对局）、E 容错（对局还在，一眼看得到） | 随机数和先手判定往下移了大约三分之一屏 |

验证边界：组件告警用开发者工具自带的 wcsc 编译器对比过修改前后；布局在开发者工具模拟器（390 宽）和 Chromium（320、375、390 宽，用真实 WXSS 和全部 56 行数据）看过。Chromium 不是微信，字体也不同，所以这些都不能代替真机。README“只能人工验的”表格里列了要在手机上看的项。

## 赛事月报审查修订（2026-11-04 晚）

Codex 交付赛事月报后，我审查发现这些问题，用户说“全部自主决定”。

| 改动 | 服务 | 牺牲 |
| --- | --- | --- |
| 详情的档位色接上，全页默认字色改浅 | G 可达性（“来源赛事”标题原来近黑压深色底，对比度约 1.03:1） | 无 |
| 搜索时展开观察中，能搜套牌名和官方简中名 | A 用户中心、C 减少摩擦（绝大多数主将在观察中，折叠着等于搜不到） | 搜索时列表可能很长，用 150 毫秒防抖抵消传输量，打字后结果晚一点出现 |
| TopDeck 署名放到首屏和详情，点击复制链接，去掉 ↗ | H 信任（条款要求在看到数据的地方署名；↗ 暗示能打开，其实只能复制） | 首屏多一行，搜索框下移约 44px |
| 副标题改“公开赛事，以欧美为主”，统计口径写明分档的局限 | H 信任（约 75% 参赛在美国，中文地区 0 场，读者不该当成国内环境） | 少了“逐月追踪”这句宣传，页面显得没那么有把握 |
| 到 6 日还没有新一期就提示 | H 信任、D 反馈（任务卡住时没有别的告警） | 用户偶尔会看到一条系统状态提示 |
| 主将显示官方简中名，没有官方名的仍是英文 | B 一致性（全站按 Scryfall 官方简中写牌名） | 中英混排还在，官方中文名有时比英文长，少数行会变高 |

默认页保持赛事月报，小屋编辑榜在第二个标签。月报数据比 7 月的编辑榜新，但以欧美为主、没有文字分析。

## 全页复查和血量页（2026-11-05）

11/04 的审计只看了 7 页。这次给全部页面截图，并量了每页最小的字。血量页和投票组件是审计点名的两项，其余来自这次复查。

| 改动 | 服务 | 牺牲 |
| --- | --- | --- |
| 血量页每个座位有淡淡的 + 和 −，这个座位第一次记血后淡出 | A 用户中心（不用先按错一次才知道方向）、I 真实条件（围桌时每人看自己的，不靠定时消失，后来才看手机的人也看得到） | 一直没按过的座位会留着两个小符号 |
| 几个人同时按互不影响 | E 容错（原来后按的人会抹掉先按的人，抬手时那一点还会记到别人头上）、I 真实条件（“每位对手失去 2 点”时就是一起按） | 两根手指按同一半只算一次 |
| 手指滑开 24px 算没按，长按时滑开也停 | E 容错（伸手拿牌碰到屏幕不再记血） | 滑得很快的短按会被当成没按 |
| 中心菜单按钮下限 44pt，胶囊外观不变 | G 可达性（iPhone SE 上按钮原来只有 39pt 高） | 窄屏上菜单略高。胶囊的热区从 7 月起就是 88rpx，所以审计说的“菜单小”只落实到按钮上 |
| 读票失败留一行重试，读票途中选项能点 | D 反馈（原来失败时什么都不显示）、C 减少摩擦（云函数冷启动时选项要等几秒才点得动） | 票数区多一行状态。投票可能在读票结果回来之前发出，服务端按人替换选票，所以不会重复计票 |
| 系统减弱动效时粒子不再空转 | I 真实条件（画布隐藏了但脚本还在每帧计算，白耗电） | 无。读不到样式的环境照常画，不会把背景弄没 |
| EDH hub 卡片标题改主文字色 | F 信息架构（标题和说明原来一样暗，只靠字号区分） | 无 |
| 战情室中文说明下限 10px、改次要文字色；骰子按钮和 EDHTI 翻页改 14 号；伊捷风暴标签列放宽 | G 可达性（原来 9 到 10px，320 宽上不到 8px；“我的瞬间/法术”断在“法术”中间）、B 一致性（EDHTI 翻页和问卷同一分量） | 战情室统计块在 320 宽上可能多折一行 |

首页没动。九个入口都在第一屏，审计说的“常用任务第一屏可达”已经成立；压缩品牌区要动首页版式，那是用户亲自定的。“继续上次对局”已经放在混沌工具顶部。8px 的 TXT 小图标也留着，它只是装饰，旁边有完整说明。

验证边界：同时按、滑开和提示的行为用假时钟跑真实页面代码测过，模拟器不能多指，要在真机上再看一次。布局在模拟器（844×390）和 Chromium（568×320 到 1024×768 六种尺寸、四种人数、-999 这样的长数字）量过：提示都在自己那半边，不进中心菜单热区，菜单不出屏幕；只有 1024×768 的五人局长数字会压到提示。减弱动效在模拟器里强制打开媒体查询验证过，读到 `display: none`，画布撤掉，恢复后粒子回来。54 个变异全部抓到。
