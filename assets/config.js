const demoGrades = [
  { key: "excellent", name: "靓机", base: 4923 },
  { key: "minor", name: "小花", base: 4650 },
  { key: "major", name: "大花", base: 4180 },
  { key: "outer", name: "外爆", base: 3260 },
  { key: "inner", name: "内爆", base: 2450 },
];

const numberFormatter = new Intl.NumberFormat("zh-CN");
const currencyFormatter = new Intl.NumberFormat("zh-CN", {
  style: "currency",
  currency: "CNY",
  maximumFractionDigits: 0,
});

const rulesList = document.querySelector("#rulesList");
const ruleDialog = document.querySelector("#ruleDialog");
const ruleForm = document.querySelector("#ruleForm");
const ruleDialogTitle = document.querySelector("#rule-dialog-title");
const ruleMin = document.querySelector("#ruleMin");
const ruleMax = document.querySelector("#ruleMax");
const ruleAmount = document.querySelector("#ruleAmount");
const ruleEnabled = document.querySelector("#ruleEnabled");
const formError = document.querySelector("#formError");
const dialogBaseHint = document.querySelector("#dialogBaseHint");
const dialogAmountHint = document.querySelector("#dialogAmountHint");
const dialogFinalHint = document.querySelector("#dialogFinalHint");
const confirmDialog = document.querySelector("#confirmDialog");
const confirmTitle = document.querySelector("#confirm-title");
const confirmMessage = document.querySelector("#confirmMessage");
const confirmSubmit = document.querySelector("#confirmSubmit");
const toast = document.querySelector("#toast");

let state = PricingConfig.loadState();
let editingRuleId = null;
let pendingConfirmAction = null;
let toastTimer;

function formatMoney(value) {
  return currencyFormatter.format(value).replace("CN¥", "¥");
}

function formatNumber(value) {
  return numberFormatter.format(value);
}

function formatRuleRange(rule) {
  if (rule.max === null) return `¥${formatNumber(rule.min)} 以上`;
  return `¥${formatNumber(rule.min)}–${formatNumber(rule.max)}`;
}

function formatUpdatedTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "刚刚";
  const now = new Date();
  const time = new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
  if (date.toDateString() === now.toDateString()) return `今天 ${time}`;
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2800);
}

function getMatchedGrades(rule) {
  return demoGrades.filter((grade) => PricingConfig.isPriceInRule(grade.base, rule));
}

function renderOverview() {
  const enabledRules = state.rules.filter((rule) => rule.enabled);
  const coveredGrades = demoGrades.filter((grade) =>
    enabledRules.some((rule) => PricingConfig.isPriceInRule(grade.base, rule)),
  );
  const matchedGrades = demoGrades.filter((grade) => PricingConfig.calculate(grade.base, state.rules).matched);

  document.querySelector("#metricEnabled").textContent = String(enabledRules.length);
  document.querySelector("#metricCoverage").textContent = `${coveredGrades.length} / ${demoGrades.length}`;
  document.querySelector("#metricMatched").textContent = String(matchedGrades.length);
  document.querySelector("#metricUpdated").textContent = formatUpdatedTime(state.updatedAt);
  document.querySelector("#ruleCount").textContent = String(state.rules.length);
}

function renderRules() {
  const sortedRules = [...state.rules].sort((a, b) => a.min - b.min);

  if (sortedRules.length === 0) {
    rulesList.innerHTML = '<p class="empty-rules">暂无价格段规则，点击“新增价格段”开始配置。</p>';
    renderOverview();
    return;
  }

  rulesList.innerHTML = sortedRules
    .map((rule) => {
      const matchedGrades = getMatchedGrades(rule);
      const gradeChips = matchedGrades.length
        ? matchedGrades.map((grade) => `<span class="grade-chip matched">${grade.name}</span>`).join("")
        : '<span class="grade-chip">未覆盖示例成色</span>';
      const stateLabel = rule.enabled ? "启用中" : "已停用";

      return `
        <article class="rule-row${rule.enabled ? "" : " is-disabled"}" data-rule-id="${rule.id}">
          <div class="rule-range">
            <strong>${formatRuleRange(rule)}</strong>
            <small>${rule.max === null ? "不设上限 · 包含最低价" : "含上下边界"}</small>
          </div>
          <div class="rule-amount"><span>+¥</span><strong>${formatNumber(rule.amount)}</strong></div>
          <div class="rule-grades" aria-label="命中示例成色">${gradeChips}</div>
          <div class="rule-status">
            <button class="status-toggle" type="button" role="switch" aria-checked="${rule.enabled}" data-action="toggle" data-id="${rule.id}" aria-label="${rule.enabled ? "停用" : "启用"} ${formatRuleRange(rule)} 规则"></button>
            <span>${stateLabel}</span>
          </div>
          <div class="rule-actions">
            <button class="action-button" type="button" data-action="edit" data-id="${rule.id}">编辑</button>
            <button class="action-button delete" type="button" data-action="delete" data-id="${rule.id}">删除</button>
          </div>
        </article>
      `;
    })
    .join("");

  renderOverview();
}

function renderPreview() {
  const previewList = document.querySelector("#previewList");
  previewList.innerHTML = demoGrades
    .map((grade) => {
      const quote = PricingConfig.calculate(grade.base, state.rules);
      const extraText = quote.matched ? `+ ${formatMoney(quote.extra)}` : "未命中加价";
      return `
        <div class="preview-row">
          <span class="preview-grade">${grade.name}</span>
          <span class="preview-formula"><b>${formatMoney(grade.base)}</b><em>${extraText}</em></span>
          <strong class="preview-final">${formatMoney(quote.final)}</strong>
        </div>
      `;
    })
    .join("");
}

function renderAll() {
  renderRules();
  renderPreview();
}

function clearFormError() {
  formError.hidden = true;
  formError.textContent = "";
}

function setFormError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function updateDialogFormula() {
  const min = Number(ruleMin.value);
  const amount = Number(ruleAmount.value);
  const base = Number.isFinite(min) && min >= 0 ? Math.round(min) : 0;
  const extra = Number.isFinite(amount) && amount >= 0 ? Math.round(amount) : 0;
  dialogBaseHint.textContent = formatNumber(base);
  dialogAmountHint.textContent = formatNumber(extra);
  dialogFinalHint.textContent = formatMoney(base + extra);
}

function openRuleDialog(rule = null) {
  editingRuleId = rule ? rule.id : null;
  ruleDialogTitle.textContent = rule ? "编辑价格段" : "新增价格段";
  ruleMin.value = rule ? String(rule.min) : "";
  ruleMax.value = rule && rule.max !== null ? String(rule.max) : "";
  ruleAmount.value = rule ? String(rule.amount) : "";
  ruleEnabled.checked = rule ? rule.enabled : true;
  clearFormError();
  updateDialogFormula();

  if (typeof ruleDialog.showModal === "function") {
    ruleDialog.showModal();
  } else {
    ruleDialog.setAttribute("open", "");
  }
  window.setTimeout(() => ruleMin.focus(), 30);
}

function closeRuleDialog() {
  if (typeof ruleDialog.close === "function") {
    ruleDialog.close();
  } else {
    ruleDialog.removeAttribute("open");
  }
}

function askConfirm({ title, message, confirmText, action }) {
  confirmTitle.textContent = title;
  confirmMessage.textContent = message;
  confirmSubmit.textContent = confirmText;
  pendingConfirmAction = action;
  if (typeof confirmDialog.showModal === "function") {
    confirmDialog.showModal();
  } else {
    confirmDialog.setAttribute("open", "");
  }
}

function closeConfirmDialog() {
  pendingConfirmAction = null;
  if (typeof confirmDialog.close === "function") {
    confirmDialog.close();
  } else {
    confirmDialog.removeAttribute("open");
  }
}

function parseIntegerField(input) {
  if (input.value.trim() === "") return null;
  const value = Number(input.value);
  if (!Number.isInteger(value)) return Number.NaN;
  return value;
}

ruleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearFormError();

  const min = parseIntegerField(ruleMin);
  const max = parseIntegerField(ruleMax);
  const amount = parseIntegerField(ruleAmount);
  const enabled = ruleEnabled.checked;

  if (min === null || !Number.isFinite(min) || min < 0) {
    setFormError("请输入有效的最低价，需为不小于 0 的整数。");
    ruleMin.focus();
    return;
  }
  if (max !== null && (!Number.isFinite(max) || max <= min)) {
    setFormError("最高价需为整数且必须大于最低价；如需不设上限，请留空。");
    ruleMax.focus();
    return;
  }
  if (amount === null || !Number.isFinite(amount) || amount < 0) {
    setFormError("请输入有效的额外叠加金额，需为不小于 0 的整数。");
    ruleAmount.focus();
    return;
  }

  const candidate = PricingConfig.normalizeRule({
    id: editingRuleId || `band-${Date.now()}`,
    min,
    max,
    amount,
    enabled,
  });

  if (enabled) {
    const overlaps = PricingConfig.findOverlaps(state.rules, candidate);
    if (overlaps.length > 0) {
      setFormError(`价格段与已启用规则 ${formatRuleRange(overlaps[0])} 重叠，请调整范围或先停用原规则。`);
      return;
    }
  }

  const nextRules = editingRuleId
    ? state.rules.map((rule) => (rule.id === editingRuleId ? candidate : rule))
    : [...state.rules, candidate];

  state = PricingConfig.saveState(nextRules.sort((a, b) => a.min - b.min));
  closeRuleDialog();
  renderAll();
  showToast(editingRuleId ? "价格段已更新，前台最新估价已同步。" : "价格段已新增，前台最新估价已同步。");
  editingRuleId = null;
});

rulesList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-action]");
  if (!button) return;
  const rule = state.rules.find((item) => item.id === button.dataset.id);
  if (!rule) return;

  if (button.dataset.action === "edit") {
    openRuleDialog(rule);
    return;
  }

  if (button.dataset.action === "delete") {
    askConfirm({
      title: "删除价格段？",
      message: `删除 ${formatRuleRange(rule)} 后，落在此区间的成色将不再叠加该金额。`,
      confirmText: "确认删除",
      action: () => {
        state = PricingConfig.saveState(state.rules.filter((item) => item.id !== rule.id));
        renderAll();
        showToast("价格段已删除，前台最新估价已同步。");
      },
    });
    return;
  }

  if (button.dataset.action === "toggle") {
    const nextRule = { ...rule, enabled: !rule.enabled };
    if (nextRule.enabled) {
      const overlaps = PricingConfig.findOverlaps(state.rules, nextRule);
      if (overlaps.length > 0) {
        showToast(`无法启用：与 ${formatRuleRange(overlaps[0])} 规则重叠。`);
        return;
      }
    }
    state = PricingConfig.saveState(state.rules.map((item) => (item.id === rule.id ? nextRule : item)));
    renderAll();
    showToast(nextRule.enabled ? "规则已启用，前台已同步。" : "规则已停用，前台已同步。");
  }
});

document.querySelector("#addRule").addEventListener("click", () => openRuleDialog());
document.querySelector("#closeRuleDialog").addEventListener("click", closeRuleDialog);
document.querySelector("#cancelRuleDialog").addEventListener("click", closeRuleDialog);
ruleDialog.addEventListener("click", (event) => {
  if (event.target === ruleDialog) closeRuleDialog();
});

[ruleMin, ruleAmount].forEach((input) => input.addEventListener("input", updateDialogFormula));

document.querySelector("#resetRules").addEventListener("click", () => {
  askConfirm({
    title: "恢复默认价格段？",
    message: "将清除当前浏览器中的自定义配置，恢复为六档默认加价规则。",
    confirmText: "恢复默认",
    action: () => {
      state = PricingConfig.resetState();
      renderAll();
      showToast("已恢复默认价格段，前台最新估价已同步。");
    },
  });
});

document.querySelector("#confirmCancel").addEventListener("click", closeConfirmDialog);
confirmDialog.addEventListener("click", (event) => {
  if (event.target === confirmDialog) closeConfirmDialog();
});
confirmSubmit.addEventListener("click", () => {
  const action = pendingConfirmAction;
  closeConfirmDialog();
  if (action) action();
});

window.addEventListener("storage", (event) => {
  if (event.key !== PricingConfig.STORAGE_KEY) return;
  state = PricingConfig.loadState();
  renderAll();
});

window.addEventListener("pageshow", () => {
  state = PricingConfig.loadState();
  renderAll();
});

renderAll();
