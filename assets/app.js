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
const conditionPicker = document.querySelector("#conditionPicker");
const estimatePanel = document.querySelector("#estimatePanel");
const estimateHint = document.querySelector("#estimateHint");
const priceKicker = document.querySelector("#priceKicker");
const priceValue = document.querySelector("#priceValue");
const deltaBadge = document.querySelector("#deltaBadge");
const priceDescription = document.querySelector("#priceDescription");
const basePriceValue = document.querySelector("#basePriceValue");
const bandExtraValue = document.querySelector("#bandExtraValue");
const bandMatchText = document.querySelector("#bandMatchText");
const footnoteText = document.querySelector("#footnoteText");
const stickyLabel = document.querySelector("#stickyLabel");
const stickyPrice = document.querySelector("#stickyPrice");
const gradeDialog = document.querySelector("#gradeDialog");
const toast = document.querySelector("#toast");

let currentMode = "condition";
let currentGrade = "excellent";
let toastTimer;

function formatPrice(value) {
  return currencyFormatter.format(value);
}

function renderConditionPriceTiles(rules) {
  gradePriceElements.forEach((element) => {
    const grade = grades[element.dataset.gradePrice];
    const quote = PricingConfig.calculate(grade.price, rules);
    element.textContent = formatPrice(quote.final);
    element.title = `基础价 ¥${formatPrice(quote.base)}，加价 ¥${formatPrice(quote.extra)}`;
  });
}

function renderQuoteBreakdown(quote) {
  basePriceValue.textContent = `¥${formatPrice(quote.base)}`;
  bandExtraValue.textContent = `+¥${formatPrice(quote.extra)}`;
  bandMatchText.textContent = quote.matched
    ? `命中 ${PricingConfig.formatBand(quote.rule)}`
    : "当前价格段未配置加价";
  deltaBadge.textContent = quote.matched ? `含加价 +¥${formatPrice(quote.extra)}` : "未命中加价";
  deltaBadge.classList.toggle("is-deducted", !quote.matched);
}

function renderPrice() {
  const grade = grades[currentGrade];
  const { rules } = PricingConfig.loadState();
  renderConditionPriceTiles(rules);

  if (currentMode === "estimate") {
    const quote = PricingConfig.calculate(estimateBasePrice, rules);
    priceValue.textContent = formatPrice(quote.final);
    stickyPrice.textContent = `¥${formatPrice(quote.final)}`;
    priceKicker.textContent = "最新估价 · 今日检测";
    priceDescription.textContent = "综合 12 项检测状态与近期行情给出";
    renderQuoteBreakdown(quote);
    estimateHint.textContent = quote.matched
      ? `已叠加价格段加价 ¥${formatPrice(quote.extra)}，建议今天锁定报价。`
      : "当前价格段未配置加价，展示基础预估价。";
    footnoteText.textContent = quote.matched
      ? `最新估价＝基础预估价 ¥${formatPrice(quote.base)}＋价格段加价 ¥${formatPrice(quote.extra)}，最终以质检结果为准`
      : "当前价格段未配置加价，最终价格以质检结果为准";
    stickyLabel.textContent = "最新预估价";
    return;
  }

  const quote = PricingConfig.calculate(grade.price, rules);
  priceValue.textContent = formatPrice(quote.final);
  stickyPrice.textContent = `¥${formatPrice(quote.final)}`;
  priceKicker.textContent = `最新估价 · ${grade.name}`;
  priceDescription.textContent = grade.description;
  renderQuoteBreakdown(quote);
  footnoteText.textContent = quote.matched
    ? `最新估价＝成色基础价 ¥${formatPrice(quote.base)}＋价格段加价 ¥${formatPrice(quote.extra)}，最终以质检结果为准`
    : "当前价格段未配置加价，展示成色基础价，最终以质检结果为准";
  stickyLabel.textContent = `${grade.name}最新估价`;
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
  const price = formatPrice(PricingConfig.calculate(grades[currentGrade].price, rules).final);
  showToast(`原型演示：已带入当前报价 ¥${price}，进入询高价流程`);
});

document.querySelector("#backButton").addEventListener("click", () => {
  showToast("返回功能将在真实 App 中生效");
});

document.querySelectorAll("[data-tip]").forEach((button) => {
  button.addEventListener("click", () => showToast(button.dataset.tip));
});

window.addEventListener("pageshow", renderPrice);
window.addEventListener("storage", (event) => {
  if (event.key === PricingConfig.STORAGE_KEY) renderPrice();
});

renderPrice();
