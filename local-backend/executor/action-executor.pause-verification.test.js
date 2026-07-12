const assert = require("assert");
const { buildFollowupExpression, isVerifiedPauseResult } = require("./action-executor");

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

console.log("pause_verification=ok");
