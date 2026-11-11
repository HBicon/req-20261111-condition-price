(function attachPricingConfig(global) {
  const STORAGE_KEY = "condition-price-band-rules-v1";
  const DEFAULT_RULES = [
    { id: "band-1", min: 0, max: 2999, amount: 50, enabled: true },
    { id: "band-2", min: 3000, max: 3999, amount: 100, enabled: true },
    { id: "band-3", min: 4000, max: 4499, amount: 150, enabled: true },
    { id: "band-4", min: 4500, max: 4999, amount: 200, enabled: true },
    { id: "band-5", min: 5000, max: 5999, amount: 250, enabled: true },
    { id: "band-6", min: 6000, max: null, amount: 300, enabled: true },
  ];

  function cloneRules(rules) {
    return rules.map((rule) => ({ ...rule }));
  }

  function normalizeRule(rule, index) {
    const min = Number(rule.min);
    const max = rule.max === null || rule.max === "" ? null : Number(rule.max);
    const amount = Number(rule.amount);

    return {
      id: String(rule.id || `band-${Date.now()}-${index}`),
      min: Number.isFinite(min) ? Math.max(0, Math.round(min)) : 0,
      max: Number.isFinite(max) && max !== null ? Math.max(0, Math.round(max)) : null,
      amount: Number.isFinite(amount) ? Math.max(0, Math.round(amount)) : 0,
      enabled: rule.enabled !== false,
    };
  }

  function loadState() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) throw new Error("no saved rules");
      const parsed = JSON.parse(raw);
      const sourceRules = Array.isArray(parsed) ? parsed : parsed.rules;
      if (!Array.isArray(sourceRules) || sourceRules.length === 0) throw new Error("empty rules");
      return {
        rules: sourceRules.map(normalizeRule),
        updatedAt: parsed.updatedAt || new Date().toISOString(),
      };
    } catch (error) {
      return {
        rules: cloneRules(DEFAULT_RULES),
        updatedAt: new Date().toISOString(),
      };
    }
  }

  function saveState(rules) {
    const state = {
      rules: rules.map(normalizeRule),
      updatedAt: new Date().toISOString(),
    };
    global.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return state;
  }

  function resetState() {
    global.localStorage.removeItem(STORAGE_KEY);
    return {
      rules: cloneRules(DEFAULT_RULES),
      updatedAt: new Date().toISOString(),
    };
  }

  function isPriceInRule(price, rule) {
    return price >= rule.min && (rule.max === null || price <= rule.max);
  }

  function matchRule(price, rules) {
    return (
      rules
        .filter((rule) => rule.enabled && isPriceInRule(price, rule))
        .sort((a, b) => a.min - b.min)[0] || null
    );
  }

  function calculate(price, rules = loadState().rules) {
    const rule = matchRule(price, rules);
    const extra = rule ? rule.amount : 0;
    return {
      base: price,
      extra,
      final: price + extra,
      rule,
      matched: Boolean(rule),
    };
  }

  function formatBand(rule) {
    if (!rule) return "未命中价格段";
    const min = new Intl.NumberFormat("zh-CN").format(rule.min);
    if (rule.max === null) return `${min} 以上`;
    return `${min}–${new Intl.NumberFormat("zh-CN").format(rule.max)}`;
  }

  function findOverlaps(rules, candidate) {
    return rules.filter((rule) => {
      if (!rule.enabled || rule.id === candidate.id) return false;
      const candidateMax = candidate.max === null ? Infinity : candidate.max;
      const ruleMax = rule.max === null ? Infinity : rule.max;
      return candidate.min <= ruleMax && rule.min <= candidateMax;
    });
  }

  global.PricingConfig = {
    STORAGE_KEY,
    DEFAULT_RULES: cloneRules(DEFAULT_RULES),
    loadState,
    saveState,
    resetState,
    normalizeRule,
    calculate,
    matchRule,
    formatBand,
    findOverlaps,
    isPriceInRule,
  };
})(window);
