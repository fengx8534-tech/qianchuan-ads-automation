const assert = require("assert");
const { buildActiveTaskFilterExpression, buildCreateTaskExpression, buildFollowupExpression, buildPauseConfirmationExpression, isVerifiedPauseResult } = require("./action-executor");

assert.strictEqual(
  isVerifiedPauseResult({}, {}),
  false,
  "点击任务行暂停但未取得确认结果时，不能标记成功",
);

assert.strictEqual(
  isVerifiedPauseResult({ ok: true, step: "pause_confirm_clicked" }, { ok: false, error: "task_still_active" }),
  false,
  "确认后任务仍为调控中时，不能标记成功",
);

assert.strictEqual(
  isVerifiedPauseResult({ ok: true, step: "pause_confirm_clicked" }, { ok: true, status: "已暂停" }),
  true,
  "只有已点击确认且回读为已暂停时，才能标记成功",
);

assert.strictEqual(
  isVerifiedPauseResult({ ok: true, step: "pause_confirm_clicked" }, { ok: true, step: "pause_status_inferred_from_active_filter", status: "已从调控中列表移除" }),
  true,
  "在调控中筛选下任务消失且筛选状态已确认时，应视为暂停成功",
);

const budgetFollowup = buildFollowupExpression({
  type: "increase_task_budget",
  payload: { budget: 500 },
}, Date.now());
assert.match(
  budgetFollowup,
  /^\(async \(\) =>/,
  "预算编辑脚本必须使用 async IIFE，以支持等待异步查找输入框",
);
assert.doesNotThrow(
  () => new Function(`return ${budgetFollowup};`),
  "预算编辑脚本必须可被浏览器解析",
);

const materialCreate = buildCreateTaskExpression({
  type: "create_boost_task",
  payload: { materialIds: ["123456789012345678"], budget: 200, durationHours: 1, boostType: "materialBoost", useLiveRoomImage: false },
}, true);
assert.match(materialCreate, /choose_video_material/, "素材追投预览必须先进入视频素材页");
assert.match(materialCreate, /select_material/, "素材追投预览必须先勾选素材");
assert.match(materialCreate, /open_material_boost_form/, "素材追投预览必须从顶部追投按钮进入表单");
assert.doesNotThrow(() => new Function(`return ${materialCreate};`), "新建追投脚本必须可被浏览器解析");

const liveScreenCostControl = buildCreateTaskExpression({
  type: "create_boost_task",
  payload: { budget: 200, durationHours: 1, boostType: "liveScreenCostControl", useLiveRoomImage: true },
}, true);
assert.match(liveScreenCostControl, /choose_live_room_image/, "画面追投必须先选择直播间画面");
assert.match(liveScreenCostControl, /open_live_screen_boost_form/, "画面追投必须从画面行追投按钮进入表单");
assert.match(liveScreenCostControl, /choose_cost_control/, "画面控成本必须显式选择控成本追投");
assert.match(liveScreenCostControl, /fill_duration/, "画面控成本必须保留调控时长");
assert.match(liveScreenCostControl, /boostType !== "liveScreenCostControl"/, "画面控成本不应选择ROI或出价优化目标");

const oneClickPopularity = buildCreateTaskExpression({
  type: "create_oneclick_task",
  payload: { budget: 200, durationHours: 1, boostType: "oneClickLiftPopularity", useLiveRoomImage: true },
}, true);
assert.match(oneClickPopularity, /直播间人气/, "一键起量人气路线必须选择直播间人气");

const pauseConfirmation = buildPauseConfirmationExpression({ type: "pause_task" });
assert.match(pauseConfirmation, /confirmationStillOpen/, "暂停确认后必须检查弹窗是否仍然存在");
assert.match(pauseConfirmation, /confirmRect/, "暂停确认必须返回按钮坐标，以便必要时执行原生鼠标点击");
assert.doesNotThrow(() => new Function(`return ${pauseConfirmation};`), "暂停确认脚本必须可被浏览器解析");

const activeTaskFilter = buildActiveTaskFilterExpression();
assert.doesNotThrow(() => new Function(`return ${activeTaskFilter};`), "调控中筛选检测脚本必须可被浏览器解析");

console.log("pause_verification=ok");
