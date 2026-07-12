# 工单：重构新建追投弹窗，对齐千川乘方原生页面

## 背景

当前 `http://127.0.0.1:8788/preview.html` 的"新建追投"弹窗是一个自研的 4 步向导（类型选择→AI素材筛选→参数调整→预览确认），与千川乘方的实际新建追投页面 UX 不一致。运营人员反馈"看不懂，和千川自己点的不一样"。

## 目标

将新建追投弹窗重构为**千川乘方原生页面风格**：单页表单，字段名和交互逻辑与千川乘方保持一致。

## 参考：千川乘方真实页面结构

以下信息来自 CDP 执行器代码（`executor/action-executor.js:612-705`），该代码已在生产环境实际操作千川乘方页面成功执行追投，字段名和交互顺序是地面真相。

### 千川乘方的实际流程

```
素材 tab → 选择素材来源 → 勾选素材（如有） → 点击"新建追投"/"追投"
→ 可选：切换控成本模式 → 填写表单 → 点击"确定"
```

### 千川乘方实际表单字段

执行器代码（line 684-689）按以下模式匹配输入框：

| 字段 | 匹配关键词 |
|-----|-----------|
| 预算 | `["预算", "金额"]` |
| 时长 | `["时长", "小时", "持续"]` |
| 综合ROI目标 | `["ROI", "roi", "目标"]` |
| 成交成本出价 | `["我的出价", "成交成本", "出价"]` |

### 千川乘方实际按钮

| 步骤 | 匹配关键词 |
|-----|-----------|
| 素材tab | `["素材"]` |
| 视频素材来源 | `["视频"]` |
| 直播间画面来源 | `["直播间画面", "直播画面"]` |
| 打开追投表单 | `["追投", "新建追投"]` |
| 控成本模式 | `["控成本追投", "控成本", "成本控制"]` |
| ROI模式 | `["综合ROI", "综合 ROI"]` |
| 出价模式 | `["我的出价", "成交成本", "出价"]` |
| 确认按钮 | `["确定", "确认", "提交", "创建"]` |

## 改动范围

### 需要修改的文件

1. **`public/preview.html`** — 重构 `<dialog id="createTaskModal">` 的 HTML 结构
2. **`public/preview.js`** — 重构弹窗的 JS 逻辑（打开、切换、提交）
3. **`public/preview.css`** — 调整样式（可选，仅当布局变化需要）

### 不需要修改的

- 后端 API（`/api/action/command`、`/api/task/preview`、`/api/material/screen`）保持不变
- CDP 执行器代码（`executor/action-executor.js`）保持不变
- 其他弹窗（一键起量、任务操作对话框）保持不变

## 具体改动

### 改动 1：弹窗标题和结构 (`preview.html`)

将 4 步向导改为单页表单。

**删除**：
- 第一步：8 个类型 button（素材放量追投、素材控成本·综合ROI、素材控成本·直播间成交、一键起量·直播间购买、一键起量·直播间人气、画面追投·放量、画面追投·控成本·综合ROI、画面追投·控成本·直播间成交）
- 第二步：AI 筛选按钮（主跑素材、综合ROI、高点击、高转化）+ 手动输入素材ID
- 第四步：预览截图 + 确认执行

**改为**：单页表单，字段如下：

```html
<dialog id="createTaskModal">
  <div class="dialog-head">
    <p class="eyebrow">新建追投</p>
    <button id="createTaskClose">×</button>
  </div>

  <!-- 素材来源 -->
  <label>素材来源</label>
  <div class="source-tabs">
    <button data-source="video" class="active">视频素材</button>
    <button data-source="live">直播间画面</button>
  </div>

  <!-- 追投模式（根据来源动态显示） -->
  <label>追投模式</label>
  <div class="mode-tabs">
    <button data-mode="boost" class="active">放量追投</button>
    <button data-mode="cost_control">控成本追投</button>
  </div>

  <!-- 优化目标（仅控成本模式显示） -->
  <label>优化目标</label>
  <div class="target-tabs" id="optimizeTargetGroup" hidden>
    <button data-target="roi" class="active">综合ROI</button>
    <button data-target="bid">成交成本出价</button>
  </div>

  <!-- 选择素材（仅视频来源显示） -->
  <div id="materialSection">
    <label>选择素材</label>
    <div id="materialList"><!-- 素材checkbox列表 --></div>
  </div>

  <!-- 参数 -->
  <label>预算（元）<input id="createTaskBudget" type="number" min="1" value="200"></label>
  <label>时长（小时）<input id="createTaskDuration" type="number" min="0.5" step="0.5" value="1"></label>
  <label id="roiField">综合ROI目标<input id="createTaskRoi" type="number" min="0.1" step="0.1" value="6"></label>
  <label id="bidField" hidden>成交成本出价<input id="createTaskBid" type="number" min="0.1" step="0.1" value="52"></label>

  <div class="dialog-buttons">
    <button id="createTaskSubmit" type="button">确定</button>
    <button id="createTaskCancel" type="button">取消</button>
  </div>
</dialog>
```

### 改动 2：JS 逻辑 (`preview.js`)

#### 2.1 删除旧的步骤流转逻辑

删除或重构以下函数：
- `selectCreateTaskType()` — 8 选 1 的类型选择
- `screenCreateMaterials()` — AI 素材筛选
- `renderCreateCandidates()` — 素材候选项渲染
- `createTaskIsCostControl()` 及同类的类型判断 helper 函数
- `openCreateTaskModal()` 中的 4 步显示逻辑

#### 2.2 增加来源/模式/目标切换逻辑

```javascript
// 素材来源切换
$("createTaskSourceVideo")?.addEventListener("click", () => switchSource("video"));
$("createTaskSourceLive")?.addEventListener("click", () => switchSource("live"));

// 追投模式切换
$("createTaskModeBoost")?.addEventListener("click", () => switchMode("boost"));
$("createTaskModeCost")?.addEventListener("click", () => switchMode("cost_control"));

// 优化目标切换（仅控成本）
$("createTaskTargetRoi")?.addEventListener("click", () => switchTarget("roi"));
$("createTaskTargetBid")?.addEventListener("click", () => switchTarget("bid"));
```

切换规则：
- 视频来源 → 显示素材列表；直播间画面 → 隐藏素材列表
- 放量模式 → 隐藏优化目标组；控成本 → 显示优化目标组
- 优化目标 ROI → 显示 ROI 字段隐藏出价字段；出价 → 显示出价字段隐藏 ROI 字段

#### 2.3 素材列表加载

用现有 `/api/material/screen` 接口加载素材候选（保留后端逻辑），但将 AI 筛选按钮改为千川风格的表格式 checkbox 列表：

```javascript
async function loadMaterialList() {
  const result = await postJson("/api/material/screen", {
    type: buildType(),
    manualBoostOverride: true
  });
  // 渲染为 checkbox 表格，每行：☐ 素材ID | 素材描述 | 预估效果
  renderMaterialCheckboxList(result.candidates || []);
}
```

#### 2.4 提交流程

```javascript
$("createTaskSubmit")?.addEventListener("click", async () => {
  const payload = buildSubmitPayload(); // 复用现有的 payload 构建逻辑
  const result = await postJson("/api/action/command", {
    actionType: "create_boost_task",
    ...payload
  });
  $("createTaskModal").close();
  if (result.action) {
    showActionConfirmDialog([result.action], "新建追投已提交，请确认执行。");
  }
  await refresh();
});
```

### 改动 3：保持预览功能但不作为独立步骤

将 dryRun 预览作为提交后的确认弹窗中的一步（已有 `showActionConfirmDialog`），不需要用户在第 4 步手动预览。

## 注意事项

### 1. 字段名对齐千川乘方
- 用"综合ROI目标"而非"目标ROI"
- 用"成交成本出价"而非"出价"
- 用"预算（元）"而非"金额"
- 用"时长（小时）"而非"持续时长"
- 确认按钮用"确定"而非"确认执行"

### 2. 保留后端兼容
- `boostType` 映射保持不变：`materialBoost` / `materialCostControl` / `liveScreenBoost` / `liveScreenCostControl`
- 提交 payload 结构不变

### 3. 追投占比安全线
- 后端已有 `boost_ratio_guard`（28%），前端也需保留展示

### 4. 一键起量弹窗
- 此工单**仅改追投弹窗**，一键起量弹窗另行处理

## 验收标准

1. 打开新建追投弹窗，只有 1 个表单页（不是 4 步向导）
2. 素材来源可从"视频素材"和"直播间画面"中切换
3. 追投模式可从"放量追投"和"控成本追投"中切换
4. 控成本模式下显示优化目标选择（综合ROI / 成交成本出价）
5. 选择直播间画面时自动隐藏素材列表
6. 提交后直接进入审批确认弹窗，无需手动预览
7. 所有字段标签与千川乘方一致（见上方字段表）
8. 后端 API 调用不报错，功能正常
