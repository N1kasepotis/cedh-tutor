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

**本项目口径**：区分**装饰文本**与**功能文本**。装饰文本（规则墙、版权 imprint、侧脊题词）可以极小极淡并 `aria-hidden`；功能文本（入口副标题、数值、按钮）必须满足正文对比度 4.5:1 且不小于 10px。触控热区不小于 44×44px（88rpx），与视觉尺寸解耦。

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
