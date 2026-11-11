const grades = {
  excellent: {
    name: "靓机",
    price: 4923,
    shortDelta: "最高成色价",
    description: "屏幕、边框、背板状态良好",
    deduction: 0,
  },
  minor: {
    name: "小花",
    price: 4650,
    shortDelta: "低 293",
    description: "仅少量细小划痕，不影响使用",
    deduction: 293,
  },
  major: {
    name: "大花",
    price: 4180,
    shortDelta: "低 743",
    description: "明显划痕或磕碰，功能正常",
    deduction: 743,
  },
  outer: {
    name: "外爆",
    price: 3260,
    shortDelta: "低 1,663",
    description: "外屏破损，显示及触控需复检",
    deduction: 1663,
  },
  inner: {
    name: "内爆",
    price: 2450,
    shortDelta: "低 2,473",
    description: "内屏显示异常，需拆机复检",
    deduction: 2473,
  },
};

const currencyFormatter = new Intl.NumberFormat("zh-CN");
const estimatePrice = 4923;
const modeButtons = [...document.querySelectorAll("[data-price-mode]")];
const conditionButtons = [...document.querySelectorAll(".condition-option")];
const conditionPicker = document.querySelector("#conditionPicker");
const estimatePanel = document.querySelector("#estimatePanel");
const priceKicker = document.querySelector("#priceKicker");
const priceValue = document.querySelector("#priceValue");
const deltaBadge = document.querySelector("#deltaBadge");
const priceDescription = document.querySelector("#priceDescription");
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

function renderPrice() {
  const grade = grades[currentGrade];

  if (currentMode === "estimate") {
    priceValue.textContent = formatPrice(estimatePrice);
    stickyPrice.textContent = `¥${formatPrice(estimatePrice)}`;
    priceKicker.textContent = "预估价 · 今日检测";
    deltaBadge.textContent = "下周预计 ↓ 383";
    deltaBadge.classList.add("is-deducted");
    priceDescription.textContent = "综合 12 项检测状态与近期行情给出";
    footnoteText.textContent = "预估价格随市场波动，实际价格以质检结果为准";
    stickyLabel.textContent = "当前预估价";
    return;
  }

  priceValue.textContent = formatPrice(grade.price);
  stickyPrice.textContent = `¥${formatPrice(grade.price)}`;
  priceKicker.textContent = `当前成色 · ${grade.name}`;
  deltaBadge.textContent = grade.shortDelta;
  deltaBadge.classList.toggle("is-deducted", grade.deduction > 0);
  priceDescription.textContent = grade.description;
  footnoteText.textContent =
    grade.deduction === 0
      ? "当前为最高成色价，实际价格以质检结果为准"
      : `比靓机价低 ¥${formatPrice(grade.deduction)}，实际价格以质检结果为准`;
  stickyLabel.textContent = `${grade.name}成色价`;
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
  const price = formatPrice(grades[currentGrade].price);
  showToast(`原型演示：已带入当前报价 ¥${price}，进入询高价流程`);
});

document.querySelector("#backButton").addEventListener("click", () => {
  showToast("返回功能将在真实 App 中生效");
});

document.querySelectorAll("[data-tip]").forEach((button) => {
  button.addEventListener("click", () => showToast(button.dataset.tip));
});

renderPrice();
