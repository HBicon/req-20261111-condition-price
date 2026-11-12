const grades = {
  excellent: {
    name: "靓机",
    price: 4923,
    description: "屏幕、边框、背板状态良好",
  },
  minor: {
    name: "小花",
    price: 4650,
    description: "仅少量细小划痕，不影响使用",
  },
  major: {
    name: "大花",
    price: 4180,
    description: "明显划痕或磕碰，功能正常",
  },
  outer: {
    name: "外爆",
    price: 3260,
    description: "外屏破损，显示及触控需复检",
  },
  inner: {
    name: "内爆",
    price: 2450,
    description: "内屏显示异常，需拆机复检",
  },
};

const currencyFormatter = new Intl.NumberFormat("zh-CN");
const estimateBasePrice = 4923;
const modeButtons = [...document.querySelectorAll("[data-price-mode]")];
const conditionButtons = [...document.querySelectorAll(".condition-option")];
const gradePriceElements = [...document.querySelectorAll("[data-grade-price]")];
const gradeOriginalElements = [...document.querySelectorAll("[data-grade-original]")];
const conditionPicker = document.querySelector("#conditionPicker");
const estimatePanel = document.querySelector("#estimatePanel");
const estimateHint = document.querySelector("#estimateHint");
const priceKicker = document.querySelector("#priceKicker");
const priceValue = document.querySelector("#priceValue");
const deltaBadge = document.querySelector("#deltaBadge");
const priceDescription = document.querySelector("#priceDescription");
const rangeNote = document.querySelector("#rangeNote");
const basePriceValue = document.querySelector("#basePriceValue");
const bandExtraValue = document.querySelector("#bandExtraValue");
const newEstimateValue = document.querySelector("#newEstimateValue");
const bandMatchText = document.querySelector("#bandMatchText");
const channelSourceText = document.querySelector("#channelSourceText");
const channelContextNote = document.querySelector("#channelContextNote");
const channelSelect = document.querySelector("#channelSelect");
const footnoteText = document.querySelector("#footnoteText");
const stickyLabel = document.querySelector("#stickyLabel");
const stickyPrice = document.querySelector("#stickyPrice");
const gradeDialog = document.querySelector("#gradeDialog");
const toast = document.querySelector("#toast");

let currentMode = "condition";
let currentGrade = "excellent";
let currentChannelId = getChannelFromUrl();
let toastTimer;

function formatPrice(value) {
  return currencyFormatter.format(value);
}

function getChannelFromUrl() {
  const channelId = new URLSearchParams(window.location.search).get("channel");
  return PricingConfig.getChannel(channelId) ? channelId : "app";
}

function getChannelOptionLabel(channel) {
  return `${"　".repeat(channel.depth)}${channel.depth > 0 ? "└ " : ""}${channel.name}`;
}

function populateChannelSelect() {
  channelSelect.innerHTML = PricingConfig.getChannelOptions()
    .map(
      (channel) =>
        `<option value="${channel.id}"${channel.id === currentChannelId ? " selected" : ""}>${getChannelOptionLabel(channel)}</option>`,
    )
    .join("");
  channelSelect.value = currentChannelId;
}

function syncChannelUrl(channelId) {
  try {
    const url = new URL(window.location.href);
    if (channelId === "app") {
      url.searchParams.delete("channel");
    } else {
      url.searchParams.set("channel", channelId);
    }
    window.history.replaceState(null, "", url);
  } catch (error) {
    // 静态原型在受限制的预览环境中仍可继续切换渠道。
  }
}

function getChannelName() {
  return PricingConfig.getChannel(currentChannelId)?.name || "当前渠道";
}

function formatBasePrice(quote) {
  if (quote.baseLow === quote.baseHigh) return `¥${formatPrice(quote.baseHigh)}`;
  return `¥${formatPrice(quote.baseLow)}–¥${formatPrice(quote.baseHigh)}`;
}

function renderConditionPriceTiles(rules) {
  gradePriceElements.forEach((element) => {
    const grade = grades[element.dataset.gradePrice];
    const quote = PricingConfig.calculate(grade.price, currentChannelId, rules);
    element.textContent = formatPrice(quote.final);
    element.title = `原估价 ${formatBasePrice(quote)}，虚拟加价 +¥${formatPrice(quote.extra)}，新估价 ¥${formatPrice(quote.newHigh)}`;
  });

  gradeOriginalElements.forEach((element) => {
    const grade = grades[element.dataset.gradeOriginal];
    const quote = PricingConfig.calculate(grade.price, currentChannelId, rules);
    element.textContent = `原价 ${formatBasePrice(quote)}`;
  });
}

function renderQuoteBreakdown(quote) {
  basePriceValue.textContent = formatBasePrice(quote);
  bandExtraValue.textContent = quote.matched ? `+¥${formatPrice(quote.extra)}` : "¥0";
  newEstimateValue.textContent = `¥${formatPrice(quote.newHigh)}`;
  channelSourceText.textContent = quote.matched
    ? quote.inherited
      ? `${getChannelName()} · 继承 ${quote.sourceChannel.name}`
      : `${getChannelName()} · 本渠道规则`
    : `${getChannelName()} · 当前区间未配规则`;
  channelContextNote.textContent = quote.matched
    ? quote.inherited
      ? `继承 ${quote.sourceChannel.name}`
      : "本渠道规则"
    : "当前区间未配置";
  channelContextNote.classList.toggle("is-inherited", quote.inherited);
  bandMatchText.textContent = quote.matched
    ? `命中 ${PricingConfig.formatBand(quote.rule)} · 系数 ${PricingConfig.formatCoefficient(quote.rule.coefficient)} · 封顶 ¥${formatPrice(quote.rule.cap)}${quote.capped ? " · 已触顶" : ""}`
    : "该估价区间未配置虚拟加价";
  bandMatchText.title = bandMatchText.textContent;
  deltaBadge.textContent = quote.matched ? `虚拟加价 +¥${formatPrice(quote.extra)}` : "未命中加价";
  deltaBadge.classList.toggle("is-deducted", !quote.matched);

  const isRange = quote.baseLow !== quote.baseHigh;
  rangeNote.hidden = !isRange;
  if (isRange) {
    rangeNote.textContent = `区间估价按最高值 ¥${formatPrice(quote.baseHigh)} 命中规则，区间首尾同步加价 +¥${formatPrice(quote.extra)}。`;
  }
}

function renderPrice() {
  const grade = grades[currentGrade];
  const { rules } = PricingConfig.loadState();
  renderConditionPriceTiles(rules);

  if (currentMode === "estimate") {
    const quote = PricingConfig.calculate(estimateBasePrice, currentChannelId, rules);
    priceValue.textContent = formatPrice(quote.final);
    stickyPrice.textContent = `¥${formatPrice(quote.final)}`;
    priceKicker.textContent = "新估价 · 今日检测";
    priceDescription.textContent = "综合 12 项检测状态与近期行情给出";
    renderQuoteBreakdown(quote);
    estimateHint.textContent = quote.matched
      ? `已叠加虚拟加价 ¥${formatPrice(quote.extra)}（${quote.inherited ? `继承 ${quote.sourceChannel.name}` : "本渠道规则"}），建议今天锁定报价。`
      : "当前应用渠道和估价区间未配置虚拟加价，展示原预估价。";
    footnoteText.textContent = quote.matched
      ? `新估价＝原预估价 ${formatBasePrice(quote)}＋虚拟加价 ¥${formatPrice(quote.extra)}${quote.capped ? "（已封顶）" : ""}，最终以质检结果为准`
      : "当前应用渠道和估价区间未配置虚拟加价，最终价格以质检结果为准";
    stickyLabel.textContent = "新预估价";
    return;
  }

  const quote = PricingConfig.calculate(grade.price, currentChannelId, rules);
  priceValue.textContent = formatPrice(quote.final);
  stickyPrice.textContent = `¥${formatPrice(quote.final)}`;
  priceKicker.textContent = `新估价 · ${grade.name}`;
  priceDescription.textContent = grade.description;
  renderQuoteBreakdown(quote);
  footnoteText.textContent = quote.matched
    ? `新估价＝原估价 ${formatBasePrice(quote)}＋虚拟加价 ¥${formatPrice(quote.extra)}${quote.capped ? "（已封顶）" : ""}，最终以质检结果为准`
    : "当前应用渠道和估价区间未配置虚拟加价，展示原估价，最终以质检结果为准";
  stickyLabel.textContent = `${grade.name}新估价`;
}

function setMode(mode) {
  currentMode = mode;
  modeButtons.forEach((button) => {
    const isActive = button.dataset.priceMode === mode;
    button.classList.toggle("is-active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
  const isConditionMode = mode === "condition";
  conditionPicker.hidden = !isConditionMode;
  estimatePanel.hidden = isConditionMode;
  renderPrice();
}

function setGrade(gradeKey, { shouldFocus = false } = {}) {
  if (!grades[gradeKey]) return;
  currentGrade = gradeKey;

  conditionButtons.forEach((button) => {
    const isSelected = button.dataset.grade === gradeKey;
    button.classList.toggle("is-selected", isSelected);
    button.setAttribute("aria-checked", String(isSelected));
    button.tabIndex = isSelected ? 0 : -1;
    if (isSelected && shouldFocus) {
      button.focus();
    }
  });

  if (currentMode !== "condition") {
    setMode("condition");
  } else {
    renderPrice();
  }
}

modeButtons.forEach((button) => {
  button.addEventListener("click", () => setMode(button.dataset.priceMode));
});

channelSelect.addEventListener("change", () => {
  const nextChannelId = PricingConfig.getChannel(channelSelect.value) ? channelSelect.value : "app";
  currentChannelId = nextChannelId;
  channelSelect.value = nextChannelId;
  syncChannelUrl(nextChannelId);
  renderPrice();
});

conditionButtons.forEach((button, index) => {
  button.addEventListener("click", () => setGrade(button.dataset.grade));
  button.addEventListener("keydown", (event) => {
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();

    let nextIndex = index;
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      nextIndex = (index - 1 + conditionButtons.length) % conditionButtons.length;
    } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      nextIndex = (index + 1) % conditionButtons.length;
    } else if (event.key === "Home") {
      nextIndex = 0;
    } else if (event.key === "End") {
      nextIndex = conditionButtons.length - 1;
    }

    setGrade(conditionButtons[nextIndex].dataset.grade, { shouldFocus: true });
  });
});

document.querySelectorAll("[data-choice-group]").forEach((group) => {
  const isMulti = group.dataset.multi === "true";
  const chips = [...group.querySelectorAll(".choice-chip")];

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      if (!isMulti) {
        chips.forEach((item) => {
          const isSelected = item === chip;
          item.classList.toggle("is-selected", isSelected);
          item.setAttribute("aria-pressed", String(isSelected));
        });
        return;
      }

      const nextState = chip.getAttribute("aria-pressed") !== "true";
      chip.classList.toggle("is-selected", nextState);
      chip.setAttribute("aria-pressed", String(nextState));
    });
  });
});

const functionToggle = document.querySelector("#functionToggle");
const functionBody = document.querySelector("#functionBody");

functionToggle.addEventListener("click", () => {
  const isExpanded = functionToggle.getAttribute("aria-expanded") === "true";
  functionToggle.setAttribute("aria-expanded", String(!isExpanded));
  functionBody.hidden = isExpanded;
});

function openDialog() {
  if (typeof gradeDialog.showModal === "function") {
    gradeDialog.showModal();
  } else {
    gradeDialog.setAttribute("open", "");
  }
}

function closeDialog() {
  if (typeof gradeDialog.close === "function") {
    gradeDialog.close();
  } else {
    gradeDialog.removeAttribute("open");
  }
}

document.querySelector("#openGradeDialog").addEventListener("click", openDialog);
document.querySelector("#closeGradeDialog").addEventListener("click", closeDialog);
document.querySelector("#confirmGradeDialog").addEventListener("click", closeDialog);
gradeDialog.addEventListener("click", (event) => {
  if (event.target === gradeDialog) closeDialog();
});

function showToast(message) {
  window.clearTimeout(toastTimer);
  toast.textContent = message;
  toast.hidden = false;
  toastTimer = window.setTimeout(() => {
    toast.hidden = true;
  }, 2600);
}

document.querySelector("#serviceButton").addEventListener("click", () => {
  showToast("在线客服为原型占位，当前未接入真实客服系统");
});

document.querySelector("#quoteButton").addEventListener("click", () => {
  const { rules } = PricingConfig.loadState();
  const base = currentMode === "estimate" ? estimateBasePrice : grades[currentGrade].price;
  const price = formatPrice(PricingConfig.calculate(base, currentChannelId, rules).final);
  showToast(`原型演示：已带入当前报价 ¥${price}，进入询高价流程`);
});

document.querySelector("#backButton").addEventListener("click", () => {
  showToast("返回功能将在真实 App 中生效");
});

document.querySelectorAll("[data-tip]").forEach((button) => {
  button.addEventListener("click", () => showToast(button.dataset.tip));
});

window.addEventListener("pageshow", () => {
  currentChannelId = getChannelFromUrl();
  channelSelect.value = currentChannelId;
  renderPrice();
});
window.addEventListener("popstate", () => {
  currentChannelId = getChannelFromUrl();
  channelSelect.value = currentChannelId;
  renderPrice();
});
window.addEventListener("storage", (event) => {
  if (event.key === PricingConfig.STORAGE_KEY) renderPrice();
});

populateChannelSelect();
renderPrice();
