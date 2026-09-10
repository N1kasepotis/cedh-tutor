# 牌友空间：实现与交付契约

## 产品边界

本轮在原生小程序中加入名片、名片对照、禁牌观察、牌桌约定、换牌备忘录和开手讨论；赛后复盘扩展现有 tracker。保持暗色桌面工具的配色、按钮和间距，主界面只增加一个统一入口。未引入 React、独立用户账号体系、强制微信头像授权或手机号。

本机数据不是云备份。删除小程序、本机清理或更换设备可能失去草稿和个人记录。名片发布与个人草稿保存是两个明确动作；社区断网时不会伪造票数或以本机选择冒充提交成功。

## 数据与代码归属

| 层 | 文件 / 内容 | 契约 |
|---|---|---|
| 领域 | `miniprogram/community/shared/contracts.js` | 字段验证、印刷版本归一化、投票替换、名片对照 |
| 内容 | `miniprogram/community/shared/catalog.js` | 有日期的禁牌快照与固定开手题；改变轮次才开启新的投票池 |
| 本机 | `community/utils/local.js` | 通过既有 storage envelope 读写，损坏或未来版本停止写入 |
| 社区 | `community/utils/api.js` | 显式云环境、统一错误、只通过云函数访问数据库 |
| 后端 | `cloudfunctions/community/service.js` | 服务端用户身份、字段白名单、审核、所有权、事务与限流 |
| 云适配 | `cloudfunctions/community/index.js` | wx-server-sdk、数据库事务、Scryfall HTTPS 与 msgSecCheck |

运行 `node scripts/sync-community.js` 将领域与目录文件复制到云函数根目录。CI 对两个副本逐字校验；生成文件不单独编辑。根目录布局也避免部署工具对嵌套业务模块路径的兼容问题。SDK 依赖由云端安装。

数据库仅需 `community` 集合，客户端规则必须是 `{"read":false,"write":false}`。业务读写全部经云函数完成。记录 ID 带类型前缀和 SHA-256 摘要，身份不从请求载荷读取，也不返回 OPENID。

- `poll-*` / `vote-*`：同一用户、题目、轮次只有一个当前选项。事务先撤销旧选项再加入新选项；重试、改视角和重复撤回都保持计数正确。
- `share-*`：经审核的名片或固定选项约定，携带版本；作者才能更新、撤回。撤回清除公开内容。
- `table-*` / `agree-*`：确认按约定版本隔离；重复确认只计一次。
- `report-*`：固定理由举报，供环境管理员在控制台处理，不开放自由评论。
- `limit-*`：每用户每分钟 90 次调用的服务端限制，独立于客户端按钮状态。

本机 `playerStudio` 保存名片、个人表态、最近 20 个牌桌和最多 100 条换牌记录。换牌观察以建立记录时的 match ID 集合为基线；删除已有对局会影响展示的新增场数。原套牌删除后保留备忘录，并明确标注。

## 已核对的微信限制

1. **云调用身份与内容审核**：使用 `cloud.getWXContext().OPENID`，不用客户端传入的身份。昵称、套牌名称和短评仅在 `msgSecCheck` 明确返回 `pass` 后公开；`review`、`risky`、超时与接口错误均不放行。接口要求用户最近两小时访问过小程序，未发布小程序的内容审核配额较小。实际权限与配额需要在目标 AppID 验证。[内容审核](https://developers.weixin.qq.com/miniprogram/dev/server/API/sec-center/sec-check/api_msgseccheck.html)、[云调用权限](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/guide/openapi/openapi.html)
2. **网络域名**：小程序前端需配置 request `https://api.scryfall.com`、downloadFile `https://cards.scryfall.io`。不开启生产域名校验豁免；每次请求检查 HTTP 状态码。搜索串行限速，失败允许重试。[网络说明](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/network.html)
3. **隐私与相册**：仅在用户点击保存图片时检查隐私状态；需要时展示说明并使用 `agreePrivacyAuthorization` 按钮。用户拒绝不会阻止名片编辑。管理后台需声明保存图片到相册的用途。[隐私授权](https://developers.weixin.qq.com/miniprogram/dev/framework/user-privacy/PrivacyAuthorize.html)、[getPrivacySetting](https://developers.weixin.qq.com/miniprogram/dev/api/open-api/privacy/wx.getPrivacySetting.html)
4. **分包依赖**：community 分包可以引用主包工具，主包通过路径导航进入分包，不直接 require 分包模块；云函数位于 miniprogramRoot 外。[分包配置](https://developers.weixin.qq.com/miniprogram/dev/framework/subpackages/basic.html)
5. **事务**：投票和确认使用服务端事务；审核、外部网络查询放在事务外，避免事务自动重试重复审核。[runTransaction](https://developers.weixin.qq.com/miniprogram/dev/wxcloudservice/wxcloud/reference-sdk-api/database/Database.runTransaction.html)

## 配置与部署

目标环境由项目所有者提供：`cloudbase-d6gvqujh4d0efe37f`。环境 ID 是公开配置，不是凭证。

1. 在目标环境创建 `community` 集合，客户端不可读写。部署不会自动改动已有集合或规则。
2. 同步领域文件，运行 `npm run check`。
3. 使用官方 DevTools CLI 部署 `cloudfunctions/community`，启用 remote npm install。函数调用权限在 `config.json` 中声明 `security.msgSecCheck`。
4. 在云控制台把函数超时配置为 **30 秒**。官方 CLI 在本机创建的函数默认是 **3 秒**，函数目录的 `config.json` 中填写 timeout 未改变实际配置，因此不保留无效字段。运行时优先选择平台支持的 Node.js 18 或更高版本。
5. 检查域名与隐私声明；在真实小程序中验证审核、投票与相册。仅“部署成功”不足以证明这些已接通。
6. 验证后同步原 DevTools 项目、GitHub 与开发版上传。上传开发版不包含提交审核或正式发布。

## 验证与运行检查

- `tests/community.suite.js` 覆盖领域输入边界、重复投票、改票/改视角、撤回、版本确认、所有权、审核失败、限流、部署副本一致性、分包依赖和旧战绩兼容。
- `tests/tracker.suite.js` 保留旧图表与卡图契约，异步卡图完成后使用当前战绩状态，避免覆盖刚添加的复盘。
- 原生 WXML/WXSS 编译之外，应从真实微信运行时打开六个新页面，检查搜索、实际语言版本、保存与重开、长文案、禁用按钮、海报生成和分享链接。
- 真正上线前应核验：客户端直读/直写被拒绝；两位不同玩家各一票；断线重试不重复计票；名片未过审不能读到；撤回后旧链接失效；约定更新后确认归零。
- 举报没有自动裁决；管理员需查看 `report-*`，处理时撤回对应分享。当前不提供公共名片目录或自由评论区。

## 2026-09-09 开发验收记录

- 本地 333 项测试通过，126 个 JavaScript 文件通过语法门禁；官方编译器通过 23 个 WXML 与 29 个 WXSS 文件；严格推荐诊断通过。
- 微信开发者工具基础库 3.17.3、390px 视口实际打开六个新页面，无页面状态错误。真实卡牌查询、选择简体中文印刷版本、本机保存和重开、牌桌保存已验证。测试后恢复原本机资料。
- 使用原生 WXML 编译结果与微信 v2 按钮默认样式做补充浏览器布局检查：320px / 135% 字号及 375、430px 下标题和按钮无横向溢出。单行编辑框内的长文本正常横向滚动；这组检查不替代手机真机验收。
- 云函数已通过官方 CLI 部署；早期云端共享模块加载错误已通过部署根目录布局修正。环境所有者创建集合并设置权限后，实际客户端直接读取和写入均返回 `DATABASE_PERMISSION_DENIED`；服务端查询正常。
- 官方 CLI 复查 `community` 为 Active、30 秒超时。真实云调用通过投票提交、重复提交、改票、撤回及重复撤回；牌桌发布重试、读取、重复确认、版本更新后确认归零、旧版本冲突与撤回后不可读也通过。测试结束恢复原投票并撤回测试分享。
- 玩家名片真实发布通过内容审核、Scryfall 印刷版本解析和公开读取；中文版本 ID 与语言保持一致。此处验证了正常文本获准发布；风险内容拦截、失败关闭由本地测试覆盖，尚未完成两位真实玩家的端到端验收。
- downloadFile 域名配置后，原测试会话仍沿用旧域名缓存；通过官方 CLI 重开独立测试项目后，真实卡图下载成功。微信原生 Canvas 生成 750 × 1200 名片海报，已检查图片中的卡画、中文文本、版本信息和布局。本机保存与重开再次通过，测试后恢复原资料。
- `getPrivacySetting` 返回有效隐私指引名称和 `needAuthorization: false`；开发者工具报告相册权限已授权。模拟器结果不能证明首次使用者的授权弹窗或手机相册落盘成功，仍需真机验证。

代码交付为 `97c76d51a6b8158d84fd331965f04f7ea9598dc8`，GitHub 检查通过，微信开发版 `2026.09.09.2` 上传成功（1,062,532 字节）。本次后台配置生效复查未改变运行代码，不需要为此重新上传开发版。尚未完成的真机和双用户验收不能用部署或模拟器成功替代。

## 数据来源与规则快照

Commander 禁表核对于 2026-09-09，包含 42 张全面禁用牌及 Lutri 的行侣限制，并另列类别限制；不以“未在列表中”推断合法性，不杜撰禁用理由。[官方列表](https://magic.wizards.com/en/banned-restricted-list)、[Lutri 限定说明](https://magic.wizards.com/en/news/announcements/commander-banned-and-restricted-february-9-2026)

名片保存具体 print ID 与其真实语言、卡图、画师；oracle ID 用来判断同牌不同版本。不会把某语言的文字贴到另一语言的卡图上。Scryfall 无该语言/卡图时明确展示空结果或错误。[卡牌搜索与印刷版本](https://scryfall.com/docs/api/cards/search)

开手题是署明条件的人工讨论情境，不是计算器证明的最优解，也不把社区多数票标成规则答案。
