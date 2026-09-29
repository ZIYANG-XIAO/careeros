# CareerOS 竞争力审计与产品机会地图

> 日期：2026-09-28
> 状态：研究与产品建议，不代表已批准路线图或已实现功能
> 研究对象：Simplify、Teal、Huntr、Jobright、Careerflow、Jobscan、LoopCV，以及中国求职产品形态
> 仓库基线：以 `PRODUCT.md`、`PRD.md`、`USER_FLOW.md`、`ROADMAP.md` 和当前实现为准

> 实施校准（2026-09-28）：本审计完成后，能力补齐分支已合入本机。Greenhouse、Lever、Ashby 的 86 个北美公司看板已完成全量同步，本机共享职位库实测写入 10,111 条职位；Workday 表单适配、职位剪藏、简历附件、常用回答、申请联系人、日历导出和数据权利入口也已进入当前实现。下文仍保留完整机会地图，但“当前现状”以本校准说明与仓库代码为准。

## 1. 执行摘要

CareerOS 已经具备一个很好的“可信数据底座”：Career Brain、证据修订、不可变 Resume Version、Job Snapshot、解释型 Job Intelligence、Answer Engine、Application Memory，以及不会自动提交的浏览器助手。这些不是普通求职工具容易补齐的能力。

从用户可感知的竞争力看，产品底座和北美职位供给已明显增强，但仍需要把能力组织成每天会主动打开的求职操作系统。最大缺口不是视觉设计本身，而是三个核心循环需要继续做深：

1. **北美已有真实、可重复同步的职位供给，中国来源仍只有骨架**，双市场供给尚未对称。
2. **“理解我”已开始转化为首页行动简报、机会雷达和偏好匹配，但反馈、提醒与证据匹配仍需闭环**。
3. **“值得申请”到“高质量完成申请”的材料、回答与执行链路仍有断点**。

若要相对 Simplify 等产品形成竞争性，CareerOS 不应该把自己做成另一个“海量职位 + 自动填表 + ATS 分数”工具。建议采用下面的竞争定位：

> **CareerOS 是证据驱动、跨市场、全程可追溯的求职执行系统。它不仅帮用户更快申请，还能说明为什么值得申请、该用哪些真实经历、实际提交了什么，并利用结果逐步改善下一次行动。**

竞争策略不是追求功能数量最多，而是形成三层护城河：

- **达到市场门槛**：真实职位、可靠插件、简历选择/上传、回答记忆、保存搜索、通知、移动适配。
- **形成产品差异**：证据级职位匹配、诚实的未知项、申请包版本历史、中美双市场、机会投入等级。
- **建立长期复利**：从申请结果、面试反馈和用户纠正中学习，但不把相关性冒充成功概率。

## 2. 研究范围与判断限制

本审计基于 2026-09-28 可访问的竞品官网、帮助中心与公开产品说明，同时检查了 CareerOS 的文档、路由、核心 Web 页面和扩展结构。

重要限制：

- 竞品功能以公开资料为准，没有假装完成全部付费产品的真实账号操作。
- 竞品自己的效果数字属于其营销主张，不能作为独立验证结论。
- 中国市场公开产品资料质量参差不齐，功能判断应在真正立项前做登录态实测。
- 本文是机会地图，不自动改变 `ROADMAP.md` 的现行顺序。当前路线图规定的 M16 解包 Chrome 双路径验证仍然是 V1 最近的质量门槛。

## 3. 竞品不是同一种产品

### 3.1 Simplify：最完整的“发现—申请—追踪”消费级闭环

Simplify 的核心并不是一个 AI 聊天框，而是一个共享 Profile 驱动的连贯工作流：

- 数百万职位的 Job Board，支持位置、类别、经验、职位类型、近期发布、快速申请等过滤。
- 每日个性化 Job Matches，结合 Profile、偏好、简历、工作许可信息和历史反馈，并解释“为什么匹配”。
- Copilot 在外部 ATS 页面填表、选择简历、处理常见与独特问题，用户最终提交。
- 自动或手动进入 Job Tracker，支持看板/列表、筛选、收藏、归档、CSV 导入导出。
- 简历生成、ATS/关键词检查、职位定制、求职信和申请问题生成。
- 联系人、内推关系、跟进邮件、面试后感谢信等机会级协作上下文。
- 免费层保证 autofill、tracker、matches 和基础简历工具，从而先形成使用习惯；高级层出售“更强质量与更深上下文”。

它的体验设计有几个值得直接吸收的原则：

1. **日常价值前置**：每天有新匹配，而不是用户每次从空搜索开始。
2. **一次输入，多处复用**：Profile 的完整度能立刻改善推荐、填表和材料。
3. **场景内行动**：在职位详情、插件和 Tracker 内直接出现与当前阶段相关的操作。
4. **自动记录但保留确认**：填表之后提醒记录，最终提交仍由用户完成。
5. **不支持时仍然有用**：无法自动填时，插件仍提供可复制的 Profile 信息。

### 3.2 Teal：求职项目管理 + 简历质量工作台

Teal 的优势是把 Job Tracker、简历构建、关键词匹配、简历分析、邮件模板和面试练习组织成一套较成熟的“求职项目管理”体验。它对 CareerOS 的启示不是单纯增加更多 AI 工具，而是：

- 用户需要清楚看见每个职位对应的简历、任务和阶段。
- 免费层可以完成基本管理，高级层为深度分析与无限生成付费。
- 简历编辑与职位追踪必须相互连接，而不是两套孤立产品。

### 3.3 Huntr：Tracker 与“Application Packet”

Huntr 将职位追踪、Chrome Clipper、自动填表、简历、求职信与职位定制材料打包。其值得关注的产品概念是 **Application Packet**：用户关心的不是抽象的某份简历，而是“这个职位最终用的整套材料”。CareerOS 已经有不可变 Resume Version 和 Application Answer 历史，天然更适合做一个更可信的申请包。

### 3.4 Jobright：推荐密度、匹配解释与内推入口

Jobright 强调海量职位、实时提醒、匹配分、职位定制简历、自动填表、内部人脉和 AI Copilot。它代表了市场对“打开后立刻给我结果”的期待。其风险也很明显：过强的匹配分与效率承诺容易制造虚假确定性。CareerOS 应学习其低摩擦推荐体验，但用多维证据解释替代单一神秘分数。

### 3.5 Careerflow：功能广度型一站式套件

Careerflow 覆盖简历、LinkedIn 优化、Tracker、Networking CRM、求职信、模拟面试、邮件和浏览器扩展。它证明用户确实愿意为“一套工具替代多个工具”付费，但也说明功能堆叠会带来上下文割裂。CareerOS 的机会是让每项后续能力都围绕同一 Job、Application 和证据链产生，而不是做十个相互独立的生成器。

### 3.6 Jobscan：单点专业度

Jobscan 的定位非常清楚：把简历与具体职位和 ATS 规则对照，输出匹配与修复建议。它证明单一高频痛点也可以形成付费价值。CareerOS 的 Job Intelligence 已经比“关键词是否出现”更深入，但当前没有把分析自然转化成可执行的材料修改，因此价值没有完全显现。

### 3.7 LoopCV 与自动投递类产品：需求存在，但不应成为 CareerOS 主路线

LoopCV 代表自动找岗、自动填表甚至自动提交的效率极端。它满足“我要数量”的需求，却牺牲控制、适配质量和品牌风险。CareerOS 应明确占据另一侧：

- 可以批量发现和批量筛选；
- 可以快速完成重复劳动；
- 但材料选择、关键回答和最终提交必须可见、可追溯、由用户确认。

### 3.8 中国市场：不能只翻译北美产品

中国求职产品的竞争结构不同：

- 牛客的优势是校招日程、题库、面经、社区与模拟面试等“招聘准备内容”。
- 超级简历、职徒等产品强调中文简历模板、排版、智能优化、双语与移动/微信场景。
- BOSS 直聘等渠道更依赖即时沟通，不是纯 ATS 表单。
- 中国校招存在网申批次、笔试、群面、面试轮次、宣讲会和明确时间窗口。
- 微信、手机号、中文姓名、学校/学历、期望薪资、到岗时间等字段优先级不同。

因此 CareerOS 的双市场不能只做 `locale + market filter`。同一核心领域之上，应逐步形成不同的申请与跟进工作流。

## 4. 能力矩阵：市场门槛与 CareerOS 现状

说明：`强` 表示已具备有价值基础；`部分` 表示有模型或页面但尚未形成完整用户价值；`缺` 表示尚不能支持真实使用；竞品判断是综合代表性能力，不表示每个竞品都拥有该功能。

| 能力 | 市场成熟度 | CareerOS | 判断 |
|---|---:|---:|---|
| Resume-first onboarding | 高 | 强 | 已有可信解析、审阅、确认，优于直接把解析结果当真 |
| 统一职业档案 | 高 | 强 | Career Brain 与证据修订是核心资产 |
| 实时职位库 | 高 | 北美强 / 中国缺 | Greenhouse、Lever、Ashby 已接入共享职位库；中国来源仍待批准和实装 |
| 保存搜索/新职位提醒 | 高 | 缺 | Job Search Goal 只是输入，尚未变成持续结果 |
| 个性化职位推荐 | 高 | 部分 | 首页机会雷达和目标偏好匹配已具备；缺反馈学习、提醒和证据匹配联动 |
| 职位匹配解释 | 中高 | 强/部分 | Job Intelligence 深，但入口和速度需要产品化 |
| 一键保存外部职位 | 高 | 部分 | 扩展已有显式触发的 Job Clipper；仍需扩大真实站点验证 |
| ATS 自动填表 | 高 | 部分 | Greenhouse/Lever/Ashby/generic 基础已在，覆盖与真实验证不足 |
| Workday/iCIMS/Taleo | 高 | 部分 | Workday 已有适配；iCIMS/Taleo 仍缺 |
| 简历自动上传 | 高 | 部分 | 选定 Resume Version 的附件链路已实现，仍需持续实站验证 |
| 常用回答记忆 | 高 | 强/部分 | 已有可管理的非敏感复用答案；独特开放题和市场专属策略仍可增强 |
| 敏感信息显式复用 | 中 | 缺 | 可做，但需隐私、合规、撤销与逐字段授权 |
| 申请追踪看板 | 高 | 强 | 已有看板/列表、状态历史、CSV、活动 |
| 机会级任务与提醒 | 中高 | 部分 | 已有 follow-up/interview 数据，无通知渠道和完整日程视图 |
| 职位定制简历 | 高 | 缺 | 是当前“高质量申请”链路最大缺口之一 |
| 求职信/问答生成 | 中高 | 缺 | Answer Engine 有安全基础，可谨慎扩展 |
| 申请包版本历史 | 中 | 部分 | 数据底座强，缺统一产品对象与 UI |
| 联系人与内推 CRM | 中高 | 部分 | 已有申请级联系人；关系网络和沟通时间线仍缺 |
| 邮件/消息草稿 | 中 | 缺 | 可围绕 Application 阶段生成，不必先做邮箱同步 |
| 面试准备与复盘 | 高 | 缺/部分 | 有 interview record，没有准备内容、题库和复盘反馈 |
| 结果分析与策略反馈 | 中高 | 缺 | 必须等真实数据，避免伪科学成功率 |
| 多市场本地工作流 | 低 | 部分 | CareerOS 有先发基础，但还只是数据层和部分本地化 |
| 可解释与可追溯 | 低 | 强 | CareerOS 最可能形成独特护城河的部分 |

## 5. CareerOS 当前产品审计

### 5.1 已经做对的事情

1. **Career Brain 不等于 Resume**。这使得用户可以维护长期职业事实，再为不同职位选择表达，而不会把一份文档误当作完整身份。
2. **证据和版本不可变**。这为“当时为什么这样建议、最后交了什么”提供了竞品常缺失的可追溯性。
3. **Job Intelligence 是解释型而非单纯分数**。Strong / Hidden / Weak / Genuine Gap 比虚构的 87% 匹配更可信。
4. **Answer Engine 把来源、敏感性、置信度和动作分开**。这是扩展自动填表和生成问答时非常重要的安全基础。
5. **Apply Anywhere 与 Application Memory 已打通概念模型**。外部职位也能成为一等公民，不依赖 CareerOS 职位库。
6. **扩展权限克制、不会自动提交**。这对用户信任和长期品牌非常重要。
7. **Pipeline、FocusPanel、Home、Career Brain 的信息架构已经比早期“多个孤立页面”更连贯**。
8. **中英文与中美市场相互独立**。这是正确的模型，不把语言误当作求职市场。

### 5.2 当前 Web UI/UX 的主要问题

#### A. Home 更像状态汇总，不像“今天应该做什么”

当前 Home 汇总已拥有的 Application、Saved Job、Resume 和 Career Brain 信息，并显示用户明确录入的 follow-up/interview。这是诚实的，但日常吸引力仍弱。

建议将首页收敛成四个层次：

1. **Today**：3–5 个最高价值、可直接完成的动作。
2. **New for you**：新职位与变化，不是静态累计数。
3. **In motion**：需要跟进、面试准备或确认提交的申请。
4. **Improve once**：补一个档案缺口，可同时改善推荐与填表。

每个卡片必须有原因与单一主操作，例如：“这份申请 8 天前提交，尚未记录跟进；生成跟进草稿”。不要用空洞的“AI 建议”。

#### B. Discover 是一个合格的数据浏览页，但不是发现产品

当前页面已有真实共享职位、搜索、位置、市场、国家、办公模式、雇佣类型、保存、偏好匹配、分页去重与详情面板，但：

- 没有推荐 feed；
- 没有保存搜索和提醒；
- 没有 Hide / Not interested / Already applied 快捷反馈；
- 没有职位变化、重复职位、关闭和重新发布的明显呈现；
- 默认右侧空面板占据大量空间；
- “Add Job” 暴露在主浏览流中，像内部管理工具，而不是消费级体验。

推荐 IA：

```text
Discover
├── For You（每日推荐 + 为什么）
├── Search（完整搜索与过滤）
├── Saved Searches（新结果计数）
├── Saved Jobs
└── Hidden
```

职位行的首屏信息应聚焦：标题、公司、地点/模式、薪资、发布日期/验证状态、匹配理由摘要、关键阻断项、是否支持快速申请。详情面板再放公司背景、完整 JD、Evidence Fit、申请策略和历史。

#### C. Pipeline 能管理状态，但机会对象还不够“厚”

已有看板/列表、拖动、关闭状态、CSV、Action Center 和 FocusPanel，是可靠基础。下一步不是再加更多列，而是让每张 Application 成为一个完整 workspace：

- 角色与公司快照；
- 当前阶段与完整事件时间线；
- 本次申请包；
- 联系人与对话；
- 待办、跟进和面试；
- 用户复盘和结果原因；
- 下一最佳动作。

UI 上需要增强：

- 全局筛选、排序与保存视图；
- Favorite / priority；
- Archive 与批量操作；
- 日历/时间线视图；
- 卡片上显示“下一动作”和逾期状态，而不只是当前阶段；
- 移动端不要保留横向大看板，应默认列表/阶段筛选。

#### D. Career Brain 信息强，但反馈不足

不建议复制竞品的神秘 Profile Strength 百分比。可以提供 **可解释的准备度**：

- 可填表字段：已确认 18/24；
- 目标角色覆盖：哪些关键经历有证据、哪些未知；
- 联系方式：哪些市场需要补充；
- 简历解析：有多少未确认草稿；
- 影响说明：补充该字段会改善“推荐 / 自动填表 / 材料生成”中的哪些能力。

这既产生完成动机，又不把资料完整度伪装成求职成功概率。

#### E. FocusPanel 是好模式，但需处理响应式与任务深度

桌面双栏适合快速浏览；当用户开始编辑材料、准备面试或复盘时，520px 面板会限制任务。建议：

- 快速查看保留 side panel；
- 深任务可以“展开为 workspace”；
- URL 保留可分享/可恢复状态；
- 小屏统一使用全屏 sheet/page；
- 面板顶部固定主操作，底部不要堆积同等级按钮。

### 5.3 当前扩展 UI/UX 的主要问题

扩展技术边界是谨慎且正确的，但竞争体验取决于真实可靠性：

- 用户打开申请页后，应自动出现低干扰的可用状态提示，而不是先理解 popup 与快捷键。
- 面板应按任务分段：`Job context → Resume → Common fields → Questions → Review`。
- 必须逐字段解释：已填写、建议、需要确认、缺失、此站点不支持。
- 对不支持的页面提供“复制答案 / 复制 Profile 字段 / 保存职位 / 记录申请”的降级路径。
- 填表后应有 review checklist，指出真正需要用户注意的字段，而不是只有完成数量。
- 需显示当前选中的 Resume Version 与 Application，避免把正确答案填到错误机会。
- 提交后的记录应是轻量确认，而不是依赖难以理解的跨页面状态。

最重要的真实世界门槛依次是：

1. 完成 M16 双路径真实浏览器验证；
2. 自动上传选定简历；
3. Workday；
4. iCIMS / Taleo 等覆盖；
5. 自定义组件、重复经历块、多页表单和 SPA 导航；
6. 故障遥测与用户一键报告，但不得上传敏感表单值。

## 6. 建议的核心产品模型

### 6.1 从 Job Search Goal 生成 Opportunity Feed

Job Search Goal 已经存在，但目前只是能应用到 Discover 过滤器。应把它升级为持续工作的“搜索意图”：

```text
Goal
→ Saved Search / Source query
→ New canonical Jobs
→ Eligibility gate
→ Preference Fit
→ Evidence Fit
→ Explainable Opportunity
→ user feedback
```

推荐结果不要只给一个总分。至少显示四个独立维度：

- **Eligibility**：明确通过、阻断、未知、需确认；
- **Preference Fit**：地点、薪资、模式、行业、公司偏好；
- **Evidence Fit**：强证据、隐藏证据、弱证据、真实缺口；
- **Timing / Quality**：发布日期、来源、是否仍开放、是否重复。

用户可以分别反馈：“职位方向不对”“地点不对”“级别过高”“公司不想去”“推荐很好”。这些反馈只能调整排序和偏好，不能改写职业事实。

### 6.2 引入 Opportunity Effort，而不是所有职位都走同一路径

建议把每个机会分为用户可选择的投入模式：

- **Quick Apply**：直接使用已确认材料和 Answer Memory，最快完成。
- **Review & Apply**：查看差距、选择简历、确认关键问题。
- **Deep Apply**：定制材料、联系人、公司研究、面试准备。

这是 CareerOS 比 Simplify 更有机会做好的部分：深度能力不是强制收费站，而是针对高价值机会按需展开。

### 6.3 把 Application Packet 做成一等产品对象

每次申请应有可审阅、冻结、复用但不污染 Career Brain 的申请包：

- exact Job Snapshot；
- selected Resume Version；
- tailored Resume Version（如存在）；
- cover letter / supporting document；
- 标准回答、申请特定回答、敏感回答的不同来源；
- 用户最后编辑版本；
- 实际填入与提交确认时间；
- 生成依据与证据引用。

用户看到的不是数据库术语，而是：

> “你在 9 月 28 日向 Acme 的 Senior Engineer 职位提交了 Resume v4，并回答了 12 个问题；其中 8 个来自已确认资料，3 个由你本次输入，1 个未填写。”

### 6.4 Answer Memory 必须可管理

市场已经证明“回答一次，以后复用”是高频价值。建议分为：

1. **Canonical facts**：来自 Contact / Career Brain，不复制。
2. **Reusable standard answers**：用户显式保存，可查看来源、适用范围、最后使用时间、随时撤销。
3. **Market-specific eligibility answers**：工作许可、签证、薪资、到岗等，逐市场、逐字段确认，不允许推断。
4. **Protected demographic vault**：如果做，必须单独批准；默认不保存，逐字段选择是否复用，加密、审计、删除清晰。
5. **Application-specific answers**：只属于本次申请，不自动升级为可复用答案。

对独特开放题，不建议按“完全相同的字符串”简单复用。需要显示旧答案、目标公司/职位和创建日期，由用户选择“复用、改写或重新回答”。

## 7. 完整机会清单

以下不是同时开工的 backlog，而是完整能力地图。

### 7.1 Know Me

- 支持无简历用户的渐进式 Profile onboarding。
- 新简历导入时提供字段级 diff：新增、冲突、删除候选，不静默覆盖。
- Career Brain readiness checklist，明确每项会改善什么。
- 经历 bullet 的证据引用、量化数据来源与可信状态。
- 多语言职业事实与表达分离：事实相同，中文/英文表述可各自维护。
- 技能不仅是标签，还能链接到 Experience / Project 证据。
- 目标角色画像与现有证据覆盖，不宣称成功概率。
- 数据导出、账户删除、AI 使用范围和隐私控制中心。

### 7.2 Discover

- 一个经过许可审查的真实职位源，先打通质量而非数量。
- 保存搜索、多 Goal feed、新职位计数、每日/每周/关闭通知。
- 推荐 feed 与可解释“为什么”。
- Hide job / Hide company / Not interested / Already applied。
- 重复职位合并、canonical company、关闭/重开/描述变化。
- 新鲜度、来源、最后验证、直接申请链接。
- 薪资、资历、行业、公司规模、技术关键词过滤；字段未知时明确未知。
- Job Clipper：用户明确触发，抽取后先确认再保存。
- 公司页：基本信息、所有职位、用户已有 Applications；资金/签证等只有可靠来源才显示。
- 收藏夹/Watchlist 与机会变化提醒。
- 分享搜索或 shortlist，后置于核心个人体验之后。

### 7.3 Decide / Enhance

- 快速 Opportunity summary：职责、硬条件、优先项、风险。
- Eligibility 决策层，不推断工作许可与敏感信息。
- Preference Fit + Evidence Fit 双解释。
- 证据缺口与简历表达缺口严格分离。
- 推荐合适的 base resume，并解释原因。
- Quick / Review / Deep 三种投入路径。
- 公司研究卡与面试上下文，不做未经证实的“幽灵职位”判断。
- 用户可以纠正 requirement parse 和 match，纠正进入审计历史。

### 7.4 Materials

- 证据约束的 resume tailoring，先建议 diff，再生成版本。
- 每条修改显示：对应 JD 要求、使用的 Career Evidence、是否新增表述。
- 禁止为了关键词制造技能、数字、职责或资历。
- Tailored Resume 作为不可变 Resume Version 保存，可比较和回退。
- ATS 基础检查：结构、可解析性、必要字段；避免宣称知道所有 ATS 排名算法。
- 求职信生成，引用职位与证据，支持长度/语气/市场模板。
- 申请开放题草稿：why company、why role、project、strength 等。
- 用户修改可选择保存为 style preference，但不要自动变成职业事实。
- Application Packet review 与导出。
- 北美/中国市场不同的简历格式与表达指导。

### 7.5 Apply Anywhere

- M16 真实验证与持续兼容性测试。
- Resume Version 选择与可靠文件上传。
- Workday、iCIMS、Taleo，随后按真实流量决定下一个 ATS。
- 多页状态、重复工作经历/教育块、自定义下拉、日期控件。
- 页面内 Job Clipper。
- 可复制的 Profile/Answer fallback。
- 字段级来源提示与 review checklist。
- 用户编辑检测：不覆盖、可选择是否形成新的 Answer Memory。
- 提交后的轻量确认和准确 Application 关联。
- 隐私安全的故障报告与 adapter 版本遥测。
- Firefox/Edge 等浏览器仅在 Chrome 质量稳定后扩展。

### 7.6 Remember / Pipeline

- Application Packet 与 exact Job Snapshot 固定。
- 收藏、归档、批量操作、保存筛选视图。
- 日历视图与时间线视图。
- 下一动作、负责人、到期时间、完成状态。
- 面试轮次：类型、时间、联系人、题目、笔记、结果。
- Follow-up/thank-you/referral/email 草稿，不必先接管用户邮箱。
- 联系人实体与轻量 Networking CRM。
- 导入 Simplify/Teal/Huntr CSV 的映射向导，而不是猜列名。
- 面试后/拒绝后结构化复盘。
- 数据完整性提示：哪些申请没有 resume、job snapshot 或 applied_at。

### 7.7 Interview & Outcome

- 基于 Job requirement 和用户证据生成准备计划。
- STAR story library，每个故事仍链接到真实证据。
- 用户选择面试类型：行为、技术、系统设计、case、中文群面等。
- 文本模拟优先；语音/视频在价值验证后再做。
- 面试问题、用户答案、改进项与 Application 关联。
- 结果原因只收集用户明确知道的内容；“未收到回复”不是“简历失败”。
- 按 funnel、角色、市场、resume version 看客观转化，但必须标注样本量。
- 用结果推荐行动实验，例如调整目标级别或材料；不生成 offer 概率。

### 7.8 中国市场产品化

- 中国校招日历：网申、笔试、面试、Offer 时间节点。
- 公司/届次/批次与岗位的 canonical 关系。
- BOSS 类即时沟通的会话准备与记录，而非假装是标准 ATS。
- 中文姓名、微信、期望薪资、到岗时间、户籍/政治面貌等字段的敏感政策分级。
- 中文简历与英文简历不是简单翻译：允许市场化表达版本，但共享事实证据。
- 笔试、群面、技术面、HR 面等本地阶段模板。
- 面经/题库若引入，必须解决版权、时效与质量，不应先建社区。
- 微信通知或小程序只有在 Web/extension 核心闭环稳定后评估。

### 7.9 Trust, privacy and quality

- 每个 AI 输出显示来源和可编辑状态。
- 保存/复用敏感答案需要明确同意、撤销和删除。
- 浏览器扩展只处理当前明确激活页面，不扩大为全站持续读取。
- 不自动提交、不批量海投作为品牌承诺。
- 不使用“保证过 ATS”“面试率提升 X 倍”等未经验证的承诺。
- 模型/规则变更不重写历史输出。
- 用户可查看“CareerOS 记住了什么、从哪里来、在哪里被使用”。

## 8. 建议的路线优先级

### P0：把现有承诺变成真实可靠产品

目标：证明两个主路径在真实世界可重复完成。

1. 完成 M16 unpacked Chrome 双场景验证并修复问题。
2. 建立核心 funnel 遥测：onboarding、extension activation、form detection、fill、review、record；不采集答案值。
3. 自动 Resume upload + 明确 Resume Version 选择。
4. Web 与扩展剩余核心界面完整中英文本地化。
5. 移动/窄屏、键盘、读屏与空/错/慢状态审计。
6. 产品内 extension install/connection 状态与真实诊断。

**退出标准**：目标用户可以独立完成两条路径；关键失败可恢复；所有历史关联准确。

### P1：形成日常使用理由

目标：从“用户录入数据后偶尔使用”变成“每天有新价值”。

1. 选择并批准一个真实职位源和一个首发市场。
2. Saved Searches / Job Search Goal feeds / new job count。
3. Eligibility + Preference Fit 的可解释排序。
4. For You feed、Hide/feedback、Already Applied。
5. Job Clipper 与保存外部职位。
6. 日/周通知偏好；先邮件或产品内一种渠道。

**退出标准**：至少一半的活跃用户无需重新构造搜索即可看到值得处理的新机会；推荐负反馈原因可观察。

### P2：补齐市场必备的申请效率

目标：让 Apply Anywhere 的体验在常见流程上达到 Simplify 类产品的基本水平。

1. Answer Memory（先非敏感标准答案）。
2. Workday 支持；再按失败数据选择 iCIMS/Taleo。
3. 多页表单、重复经历块和主要 custom widgets。
4. 不支持页面的 copy fallback。
5. Application Packet v1。
6. 提交后记录体验与准确关联。

**退出标准**：支持站点的关键字段完成率、用户修改率、失败率和记录准确率达到预定阈值。

### P3：建立明显差异化

目标：把 CareerOS 的证据底座转化为用户愿意付费的高质量申请能力。

1. Evidence Fit 与 Preference Fit 同屏。
2. base resume recommendation。
3. 证据约束的 resume tailoring + diff review。
4. 求职信与开放题草稿。
5. Quick / Review / Deep Apply 模式。
6. 完整 Application Packet 历史。

**退出标准**：用户能在不制造事实的情况下完成一份可解释的定制申请，并明确知道每项内容来自哪里。

### P4：扩展申请后的成功支持

目标：从“申请工具”变成真正的求职操作系统。

1. 联系人与轻量 Networking CRM。
2. 阶段化邮件/消息草稿。
3. 日历与通知。
4. 证据驱动的面试准备与复盘。
5. 样本量透明的 outcome analytics。
6. 中美市场专属流程模板。

### P5：生态与商业扩展

只有在核心闭环留存成立后评估：

- recruiter visibility / talent marketplace；
- 教练或人工 resume review；
- 高校/机构版；
- 团队协作与导师共享；
- 多浏览器与移动应用；
- 社区、内容与题库。

这些都可能有效，但会引入双边市场、服务交付、审核、版权或新的销售模式，不能用来掩盖核心产品尚未闭环。

## 9. UI/UX 设计方向

### 9.1 设计原则

1. **Next action first**：页面首先回答“我现在应该做什么”。
2. **Reason adjacent to recommendation**：原因必须靠近建议，不藏在二级详情。
3. **Progressive depth**：默认简单，高价值机会允许进入深工作区。
4. **One primary action per state**：每个卡片/空状态只突出一个主动作。
5. **Unknown is designed, not treated as an error**：未知项要说明如何补充，而不是红色失败。
6. **Trust is visible**：来源、更新时间、版本、AI/用户编辑差异可查看。
7. **Cross-surface continuity**：Web 选择的 Job、Resume、Application 必须在 extension 中明确延续。

### 9.2 建议的信息架构

保留四个主入口，但调整内部重心：

```text
Home
├── Today
├── New for you
├── In motion
└── Improve once

Discover
├── For You
├── Search
├── Saved Searches
├── Saved
└── Hidden

Applications
├── Board
├── List
├── Calendar
├── Closed
└── Saved Views

Career Brain
├── Overview / Readiness
├── Experience & Evidence
├── Resumes
├── Answers
├── Goals & Preferences
└── Personal & Privacy
```

联系人、面试、材料等不建议立刻成为一级导航；它们先作为 Application workspace 内的上下文存在，直到使用频率证明需要独立入口。

### 9.3 视觉层建议

当前中性暖灰 + 紫色 accent、IBM Plex/Noto Sans SC、密度较高的工作台风格与产品定位一致，不需要重新换一套品牌。优先处理：

- 建立更清晰的 `page / section / card / row / metadata` 五级层次；
- 减少过多边框容器嵌套，使用留白和分组；
- 高密度页面使用 sticky filter/header；
- 状态色只表达状态，不同时承担主操作色；
- Job/Application 卡片统一元数据顺序；
- Skeleton、空状态和 error state 与最终布局同构，减少跳动；
- 中英双语下验证长文本、日期、货币、姓名顺序和窄屏；
- 深度工作使用全宽 workspace，而不是永远塞进右侧 panel。

## 10. 不建议照搬的竞品功能

- **自动提交 / 批量海投**：会破坏质量、控制感和品牌信任。
- **单一 ATS/匹配百分比**：用户会把它误解为成功概率；应展示维度与证据。
- **无依据的 Profile Strength**：可以做“已确认字段与能力准备度”，不能做人格化成功分。
- **过早的通用 AI 聊天助手**：会把明确任务重新变成 prompt 工作，应先把任务嵌进场景。
- **先建简历视觉设计器**：市场拥挤且不是 CareerOS 的核心差异；先做证据约束的内容定制与可靠导出。
- **广泛抓取职位**：未经许可、质量低、去重差的职位数量不会形成竞争力。
- **幽灵职位判定、Offer 概率**：目前没有足够可信数据。
- **社区/内推赏金/教练市场**：这是新的供给侧业务，不是一个普通 feature。

## 11. 商业化建议

先让免费层形成完整闭环，再对“质量、深度和自动持续价值”收费：

### Free

- Career Brain 与基础 resume import；
- 基础 Discover / save / tracker；
- 有限的 Job Intelligence；
- 基础 autofill；
- 非敏感 Answer Memory；
- 数据导入导出。

### Pro

- 更多 Goals / saved searches / 实时提醒；
- 完整 Evidence Fit 与深度公司/岗位分析；
- resume tailoring、cover letter、application Q&A；
- 高级 Application Packet 与版本比较；
- email drafts、interview prep、analytics；
- 更高 AI 使用额度，而不是限制用户访问自己的历史。

### 可选服务

- 人工简历评审、模拟面试或教练服务可单独收费，但应在核心软件留存证明后再引入。

不要把“导出用户数据、删除数据、基本隐私控制、自己的申请历史”放进付费墙。

## 12. 指标体系

### 北极星指标

建议使用：

> **每周完成的高质量求职推进数**

推进包括：保存一个高匹配机会、完成一份经审阅的申请、完成 follow-up、完成面试准备或记录真实结果。它比“申请数量”更符合 CareerOS 的质量定位。

### 核心 funnel

```text
Resume uploaded
→ Profile confirmed
→ First useful opportunity
→ First reviewed application
→ Application recorded
→ Follow-up / interview
→ Outcome recorded
```

### 各阶段关键指标

- Onboarding：time-to-first-value、解析确认率、放弃步骤。
- Discover：推荐查看率、save/apply/hide、负反馈原因、新职位新鲜度。
- Intelligence：分析完成时间、用户纠正率、解释展开率、Apply 转化。
- Extension：页面检测率、字段支持率、填充成功率、用户修改率、失败恢复率。
- Memory：提交记录准确率、重复率、resume version 关联率。
- Pipeline：每周回访、下一动作完成、过期任务、结果记录率。
- Outcome：按角色/市场/材料版本的阶段转化，必须同时显示样本量和观察窗口。

严禁把“填了多少字段”“投了多少份”当作唯一成功指标，否则会把产品推向低质量自动化。

## 13. 推荐的产品实验

在大规模实现前，用小实验降低风险：

1. **For You 假门实验**：用现有 demo/manual jobs 做解释型排序，观察用户是否理解四维匹配。
2. **Job Clipper 原型**：先只做明确触发、预览和保存，不做自动后台捕获。
3. **Answer Memory**：先覆盖 10–20 个最常见的非敏感问题，观察复用与编辑率。
4. **Resume tailoring concierge**：先生成证据引用的 diff，不做完整视觉编辑器。
5. **Workday 真实样本集**：基于获得许可的 fixtures 和真实用户报告决定适配范围。
6. **Today queue**：比较“静态 dashboard”与“最多五个下一动作”的完成率。
7. **通知频率**：每日/每周/关闭，默认不制造噪音，测打开后是否产生有效推进。

## 14. 最终判断

CareerOS 不缺一个宏大的产品故事，缺的是把已经很强的可信底座变成连续、可感知、可重复的用户价值。

短期与 Simplify 竞争，必须补齐：真实职位、每天的新机会、可靠 autofill、简历上传、回答记忆和通知。中期形成差异，必须推出：多维可解释匹配、证据约束的材料生成、Application Packet 和跨市场工作流。长期护城河则来自：用户确认的职业真相、每次申请的完整历史，以及只从真实结果中学习的策略系统。

一句话优先级：

> **先把“每天发现值得申请的职位并可靠完成申请”做到极好，再把 CareerOS 已有的证据与历史能力转化成竞品难以复制的申请质量。**

## 15. 主要公开来源

### Simplify

- [Copilot autofill](https://help.simplify.jobs/articles/2415391-using-copilot-to-autofill-applications)
- [Job Matches](https://help.simplify.jobs/articles/2166608-using-your-job-matches)
- [Job Board search and filters](https://help.simplify.jobs/articles/8339467-searching-and-filtering-jobs-on-simplify)
- [Job detail experience](https://help.simplify.jobs/en/help/articles/2830264-viewing-jobs-on-simplifys-job-board)
- [Job Tracker](https://help.simplify.jobs/en/articles/2140179-using-the-job-tracker)
- [Profile editing and shared context](https://help.simplify.jobs/articles/8396475-editing-your-profile-after-onboarding)
- [Auto-tailored resume](https://help.simplify.jobs/articles/0515607-auto-tailoring-your-resume-with-copilot)
- [AI Email](https://help.simplify.jobs/en/articles/7827896-using-ai-email)
- [Networking](https://help.simplify.jobs/en/help/articles/4158996-networking-on-simplify)
- [Simplify Copilot product page](https://simplify.jobs/copilot)

### Other international products

- [Teal free vs. Teal+](https://help.tealhq.com/en/articles/9530153-teal-vs-teal)
- [Huntr pricing and feature comparison](https://api.huntr.co/pricing)
- [Jobright](https://jobright.ai/)
- [Careerflow features](https://www.careerflow.ai/features)
- [Careerflow workflow](https://www.careerflow.ai/how-it-works)
- [Jobscan](https://www.jobscan.co/)
- [LoopCV knowledge base](https://loopcv.freshdesk.com/support/solutions/articles/103000399849-knowledge-base)

### China-market references

- [牛客求职产品入口](https://www.nowcoder.com/?lang=zh)
- [超级简历产品介绍](https://www.wondercv.com/welcome/about_us)
- [职悟空](https://z5k.com.cn/)
- [效招 Joblytic](https://xzjobs.cn/)
