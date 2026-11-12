const numberFormatter = new Intl.NumberFormat("zh-CN");

const rulesList = document.querySelector("#rulesList");
const ruleDialog = document.querySelector("#ruleDialog");
const ruleForm = document.querySelector("#ruleForm");
const ruleDialogTitle = document.querySelector("#rule-dialog-title");
const ruleChannel = document.querySelector("#ruleChannel");
const ruleMin = document.querySelector("#ruleMin");
const ruleMax = document.querySelector("#ruleMax");
const ruleCoefficient = document.querySelector("#ruleCoefficient");
const ruleCap = document.querySelector("#ruleCap");
const ruleEnabled = document.querySelector("#ruleEnabled");
const channelInheritanceHint = document.querySelector("#channelInheritanceHint");
const formError = document.querySelector("#formError");
const dialogBaseHint = document.querySelector("#dialogBaseHint");
const dialogCoeffHint = document.querySelector("#dialogCoeffHint");
const dialogExtraHint = document.querySelector("#dialogExtraHint");
const dialogCapHint = document.querySelector("#dialogCapHint");
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

function formatNumber(value) {
  return numberFormatter.format(value);
}

function formatRuleRange(rule) {
  if (rule.max === null) return `¥${formatNumber(rule.min)} 以上`;
  return `¥${formatNumber(rule.min)}–¥${formatNumber(rule.max)}`;
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

function getChannelOptionLabel(channel) {
  return `${"　".repeat(channel.depth)}${channel.depth > 0 ? "└ " : ""}${channel.name}`;
}

function populateChannelSelect(select, selectedId) {
  select.innerHTML = PricingConfig.getChannelOptions()
    .map(
      (channel) =>
        `<option value="${channel.id}"${channel.id === selectedId ? " selected" : ""}>${getChannelOptionLabel(channel)}</option>`,
    )
    .join("");
}

function getChannelTag(rule) {
  const children = PricingConfig.getDescendantChannels(rule.channelId);
  const channel = PricingConfig.getChannel(rule.channelId);
  if (children.length > 0) return `${children.length} 个子渠道继承`;
  if (channel && channel.parentId) return "子渠道专属优先";
  return "独立渠道";
}

function getChannelTagClass(rule) {
  const children = PricingConfig.getDescendantChannels(rule.channelId);
  if (children.length > 0) return "inherited";
  if (PricingConfig.getChannel(rule.channelId)?.parentId) return "override";
  return "independent";
}

function renderOverview() {
  const enabledRules = state.rules.filter((rule) => rule.enabled);
  const configuredChannels = new Set(enabledRules.map((rule) => rule.channelId));
  const childChannels = PricingConfig.CHANNELS.filter((channel) => channel.parentId);

  document.querySelector("#metricEnabled").textContent = String(enabledRules.length);
  document.querySelector("#metricChannels").textContent = String(configuredChannels.size);
  document.querySelector("#metricInheritance").textContent = String(childChannels.length);
  document.querySelector("#metricUpdated").textContent = formatUpdatedTime(state.updatedAt);
  document.querySelector("#ruleCount").textContent = String(state.rules.length);
}

function renderRules() {
  const channelOrder = new Map(PricingConfig.getChannelOptions().map((channel, index) => [channel.id, index]));
  const sortedRules = [...state.rules].sort((a, b) => {
    const channelDelta = (channelOrder.get(a.channelId) ?? 99) - (channelOrder.get(b.channelId) ?? 99);
    return channelDelta || a.min - b.min;
  });

  if (sortedRules.length === 0) {
    rulesList.innerHTML = '<p class="empty-rules">暂无虚拟加价规则，点击“新增规则”开始配置。</p>';
    renderOverview();
    return;
  }

  rulesList.innerHTML = sortedRules
    .map((rule) => {
      const channel = PricingConfig.getChannel(rule.channelId);
      const channelName = channel ? channel.name : "未知渠道";
      const channelPath = PricingConfig.getChannelPath(rule.channelId);
      const tag = getChannelTag(rule);
      const tagClass = getChannelTagClass(rule);
      const stateLabel = rule.enabled ? "启用中" : "已停用";
      const maxText = rule.max === null ? "不设上限" : `¥${formatNumber(rule.max)}`;

      return `
        <article class="rule-row${rule.enabled ? "" : " is-disabled"}" data-rule-id="${rule.id}">
          <div class="rule-channel" data-label="应用渠道">
            <strong>${channelName}</strong>
            <small>${channelPath}</small>
            <span class="channel-tag ${tagClass}">${tag}</span>
          </div>
          <div class="rule-number rule-min" data-label="估价金额最低值">
            <span>¥</span><strong>${formatNumber(rule.min)}</strong>
          </div>
          <div class="rule-number rule-max" data-label="估价金额最高值">
            <strong>${maxText}</strong>
          </div>
          <div class="rule-number rule-coeff" data-label="虚拟加价系数">
            <span>×</span><strong>${PricingConfig.formatCoefficient(rule.coefficient)}</strong>
          </div>
          <div class="rule-number rule-cap" data-label="封顶金额">
            <span>¥</span><strong>${formatNumber(rule.cap)}</strong>
          </div>
          <div class="rule-status" data-label="状态">
            <button class="status-toggle" type="button" role="switch" aria-checked="${rule.enabled}" data-action="toggle" data-id="${rule.id}" aria-label="${rule.enabled ? "停用" : "启用"} ${channelName} ${formatRuleRange(rule)} 规则"></button>
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

function renderAll() {
  renderRules();
}

function clearFormError() {
  formError.hidden = true;
  formError.textContent = "";
}

function setFormError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function getSelectedChannelData() {
  const channel = PricingConfig.getChannel(ruleChannel.value);
  const descendants = PricingConfig.getDescendantChannels(ruleChannel.value);
  return { channel, descendants };
}

function updateChannelHint() {
  const { channel, descendants } = getSelectedChannelData();
  if (!channel) {
    channelInheritanceHint.textContent = "请选择需要应用虚拟加价的渠道。";
    return;
  }
  if (descendants.length > 0) {
    channelInheritanceHint.textContent = `应用到“${channel.name}”，其下 ${descendants.length} 个子渠道自动继承；子渠道匹配规则优先生效。`;
  } else {
    channelInheritanceHint.textContent = "子渠道专属规则优先；当前估价金额未命中本渠道规则时，继续向上继承父渠道规则。";
  }
}

function parseIntegerField(input) {
  if (input.value.trim() === "") return null;
  const value = Number(input.value);
  if (!Number.isInteger(value)) return Number.NaN;
  return value;
}

function getDialogSampleHigh() {
  const max = parseIntegerField(ruleMax);
  const min = parseIntegerField(ruleMin);
  if (Number.isFinite(max) && max !== null) return max;
  if (Number.isFinite(min) && min !== null) return min;
  return 0;
}

function updateDialogFormula() {
  const base = Math.max(0, getDialogSampleHigh() || 0);
  const coefficient = Number(ruleCoefficient.value);
  const cap = Number(ruleCap.value);
  const safeCoefficient = Number.isFinite(coefficient) && coefficient > 1 ? coefficient : 1;
  const safeCap = Number.isFinite(cap) && cap >= 0 ? Math.round(cap) : 0;
  const markupRate = Math.max(0, safeCoefficient - 1);
  const rawExtra = Math.round(base * (safeCoefficient - 1));
  const extra = Math.min(rawExtra, safeCap);

  dialogBaseHint.textContent = formatNumber(base);
  dialogCoeffHint.textContent = markupRate.toFixed(2);
  dialogExtraHint.textContent = formatNumber(rawExtra);
  dialogCapHint.textContent = `¥${formatNumber(safeCap)}`;
  dialogFinalHint.textContent = `¥${formatNumber(base + extra)}`;
}

function openRuleDialog(rule = null) {
  editingRuleId = rule ? rule.id : null;
  ruleDialogTitle.textContent = rule ? "编辑虚拟加价规则" : "新增虚拟加价规则";
  populateChannelSelect(ruleChannel, rule ? rule.channelId : "app");
  ruleMin.value = rule ? String(rule.min) : "";
  ruleMax.value = rule && rule.max !== null ? String(rule.max) : "";
  ruleCoefficient.value = rule ? PricingConfig.formatCoefficient(rule.coefficient) : "1.05";
  ruleCap.value = rule ? String(rule.cap) : "";
  ruleEnabled.checked = rule ? rule.enabled : true;
  clearFormError();
  updateChannelHint();
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

ruleForm.addEventListener("submit", (event) => {
  event.preventDefault();
  clearFormError();

  const channelId = ruleChannel.value;
  const min = parseIntegerField(ruleMin);
  const max = parseIntegerField(ruleMax);
  const coefficient = Number(ruleCoefficient.value);
  const cap = parseIntegerField(ruleCap);
  const enabled = ruleEnabled.checked;
  const channel = PricingConfig.getChannel(channelId);

  if (!channel) {
    setFormError("请选择有效的应用渠道。");
    ruleChannel.focus();
    return;
  }
  if (min === null || !Number.isFinite(min) || min < 0) {
    setFormError("请输入有效的估价金额最低值，需为不小于 0 的整数。");
    ruleMin.focus();
    return;
  }
  if (max !== null && (!Number.isFinite(max) || max <= min)) {
    setFormError("估价金额最高值需大于最低值；如需不设上限，请留空。");
    ruleMax.focus();
    return;
  }
  if (!Number.isFinite(coefficient) || coefficient <= 1 || coefficient > 9.99) {
    setFormError("虚拟加价系数需大于 1 且不超过 9.99，例如 1.05。");
    ruleCoefficient.focus();
    return;
  }
  if (cap === null || !Number.isFinite(cap) || cap < 0) {
    setFormError("请输入有效的封顶金额，需为不小于 0 的整数。");
    ruleCap.focus();
    return;
  }

  const candidate = PricingConfig.normalizeRule({
    id: editingRuleId || `rule-${Date.now()}`,
    channelId,
    min,
    max,
    coefficient,
    cap,
    enabled,
  });

  if (enabled) {
    const overlaps = PricingConfig.findOverlaps(state.rules, candidate);
    if (overlaps.length > 0) {
      setFormError(
        `${channel.name} 的估价金额区间与已启用规则 ${formatRuleRange(overlaps[0])} 重叠，请调整区间或先停用原规则。`,
      );
      return;
    }
  }

  const nextRules = editingRuleId
    ? state.rules.map((rule) => (rule.id === editingRuleId ? candidate : rule))
    : [...state.rules, candidate];

  state = PricingConfig.saveState(nextRules);
  closeRuleDialog();
  renderAll();
  showToast(editingRuleId ? "虚拟加价规则已更新并生效。" : "虚拟加价规则已新增并生效。");
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
      title: "删除虚拟加价规则？",
      message: `删除“${PricingConfig.getChannelPath(rule.channelId)} · ${formatRuleRange(rule)}”后，命中的渠道将回退父渠道规则或不再加价。`,
      confirmText: "确认删除",
      action: () => {
        state = PricingConfig.saveState(state.rules.filter((item) => item.id !== rule.id));
        renderAll();
        showToast("虚拟加价规则已删除，新估价将按剩余规则计算。");
      },
    });
    return;
  }

  if (button.dataset.action === "toggle") {
    const nextRule = { ...rule, enabled: !rule.enabled };
    if (nextRule.enabled) {
      const overlaps = PricingConfig.findOverlaps(state.rules, nextRule);
      if (overlaps.length > 0) {
        showToast(`无法启用：同渠道规则 ${formatRuleRange(overlaps[0])} 已存在。`);
        return;
      }
    }
    state = PricingConfig.saveState(state.rules.map((item) => (item.id === rule.id ? nextRule : item)));
    renderAll();
    showToast(nextRule.enabled ? "规则已启用并生效。" : "规则已停用，新估价将不再命中该规则。");
  }
});

document.querySelector("#addRule").addEventListener("click", () => openRuleDialog());
document.querySelector("#closeRuleDialog").addEventListener("click", closeRuleDialog);
document.querySelector("#cancelRuleDialog").addEventListener("click", closeRuleDialog);
ruleDialog.addEventListener("click", (event) => {
  if (event.target === ruleDialog) closeRuleDialog();
});

[ruleMin, ruleMax, ruleCoefficient, ruleCap].forEach((input) => input.addEventListener("input", updateDialogFormula));
ruleChannel.addEventListener("change", updateChannelHint);

document.querySelector("#resetRules").addEventListener("click", () => {
  askConfirm({
    title: "恢复默认虚拟加价？",
    message: "将清除当前浏览器中的渠道加价配置，恢复为默认父渠道规则与微信小程序专属规则。",
    confirmText: "恢复默认",
    action: () => {
      state = PricingConfig.resetState();
      renderAll();
      showToast("已恢复默认虚拟加价规则。");
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

populateChannelSelect(ruleChannel, "app");
renderAll();
