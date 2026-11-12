(function attachPricingConfig(global) {
  const STORAGE_KEY = "virtual-markup-rules-v2";

  const CHANNELS = [
    { id: "app", name: "有得卖 App", parentId: null },
    { id: "app-wechat", name: "微信小程序", parentId: "app" },
    { id: "app-alipay", name: "支付宝小程序", parentId: "app" },
    { id: "app-douyin", name: "抖音小程序", parentId: "app" },
    { id: "store", name: "门店柜机", parentId: null },
    { id: "store-pad", name: "门店平板", parentId: "store" },
  ];

  const DEFAULT_RULES = [
    { id: "rule-app-1", channelId: "app", min: 0, max: 2999, coefficient: 1.02, cap: 60, enabled: true },
    { id: "rule-app-2", channelId: "app", min: 3000, max: 3999, coefficient: 1.03, cap: 100, enabled: true },
    { id: "rule-app-3", channelId: "app", min: 4000, max: 4999, coefficient: 1.05, cap: 200, enabled: true },
    { id: "rule-app-4", channelId: "app", min: 5000, max: null, coefficient: 1.06, cap: 300, enabled: true },
    { id: "rule-wechat-1", channelId: "app-wechat", min: 4000, max: 4999, coefficient: 1.04, cap: 180, enabled: true },
    { id: "rule-store-1", channelId: "store", min: 0, max: 5999, coefficient: 1.03, cap: 150, enabled: true },
  ];

  const numberFormatter = new Intl.NumberFormat("zh-CN");

  function cloneRules(rules) {
    return rules.map((rule) => ({ ...rule }));
  }

  function getChannel(channelId) {
    return CHANNELS.find((channel) => channel.id === channelId) || null;
  }

  function getChannelChain(channelId) {
    const chain = [];
    let current = getChannel(channelId);
    while (current) {
      chain.push(current);
      current = current.parentId ? getChannel(current.parentId) : null;
    }
    return chain;
  }

  function getChannelPath(channelId, separator = " › ") {
    return getChannelChain(channelId)
      .map((channel) => channel.name)
      .reverse()
      .join(separator);
  }

  function getChildChannels(channelId) {
    return CHANNELS.filter((channel) => channel.parentId === channelId);
  }

  function getDescendantChannels(channelId) {
    return getChildChannels(channelId).flatMap((child) => [child, ...getDescendantChannels(child.id)]);
  }

  function getLeafChannels() {
    return CHANNELS.filter((channel) => getChildChannels(channel.id).length === 0);
  }

  function getChannelOptions() {
    const options = [];
    const visit = (parentId = null, depth = 0) => {
      CHANNELS.filter((channel) => channel.parentId === parentId).forEach((channel) => {
        options.push({ ...channel, depth });
        visit(channel.id, depth + 1);
      });
    };
    visit();
    return options;
  }

  function normalizeRule(rule, index) {
    const min = Number(rule.min);
    const max = rule.max === null || rule.max === "" ? null : Number(rule.max);
    const coefficient = Number(rule.coefficient);
    const cap = Number(rule.cap);
    const channelId = getChannel(rule.channelId) ? rule.channelId : "app";

    return {
      id: String(rule.id || `rule-${Date.now()}-${index}`),
      channelId,
      min: Number.isFinite(min) ? Math.max(0, Math.round(min)) : 0,
      max: Number.isFinite(max) && max !== null ? Math.max(0, Math.round(max)) : null,
      coefficient: Number.isFinite(coefficient) ? Math.max(1, Math.round(coefficient * 100) / 100) : 1,
      cap: Number.isFinite(cap) ? Math.max(0, Math.round(cap)) : 0,
      enabled: rule.enabled !== false,
    };
  }

  function loadState() {
    try {
      const raw = global.localStorage.getItem(STORAGE_KEY);
      if (!raw) throw new Error("no saved rules");
      const parsed = JSON.parse(raw);
      const sourceRules = Array.isArray(parsed) ? parsed : parsed.rules;
      if (!Array.isArray(sourceRules)) throw new Error("invalid rules");
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

  function findRuleForChannel(channelId, price, rules) {
    return (
      rules
        .filter((rule) => rule.enabled && rule.channelId === channelId && isPriceInRule(price, rule))
        .sort((a, b) => b.min - a.min)[0] || null
    );
  }

  function resolveRule(channelId, price, rules = loadState().rules) {
    for (const channel of getChannelChain(channelId)) {
      const rule = findRuleForChannel(channel.id, price, rules);
      if (rule) {
        return {
          rule,
          sourceChannelId: channel.id,
          sourceChannel: channel,
          sourceChannelPath: getChannelPath(channel.id),
          inherited: channel.id !== channelId,
        };
      }
    }
    return {
      rule: null,
      sourceChannelId: null,
      sourceChannel: null,
      sourceChannelPath: "",
      inherited: false,
    };
  }

  function calculate(base, channelId, rules = loadState().rules) {
    const high = typeof base === "number" ? base : Number(base.high);
    const low = typeof base === "number" ? high : Number(base.low);
    const resolution = resolveRule(channelId, high, rules);
    const rule = resolution.rule;
    const rawExtra = rule ? Math.max(0, Math.round(high * (rule.coefficient - 1))) : 0;
    const extra = rule ? Math.min(rawExtra, rule.cap) : 0;

    return {
      baseLow: low,
      baseHigh: high,
      newLow: low + extra,
      newHigh: high + extra,
      rawExtra,
      extra,
      capped: Boolean(rule) && rawExtra > extra,
      final: high + extra,
      rule,
      sourceChannelId: resolution.sourceChannelId,
      sourceChannel: resolution.sourceChannel,
      sourceChannelPath: resolution.sourceChannelPath,
      inherited: resolution.inherited,
      matched: Boolean(rule),
    };
  }

  function formatBand(rule) {
    if (!rule) return "未命中估价区间";
    const min = numberFormatter.format(rule.min);
    if (rule.max === null) return `¥${min} 以上`;
    return `¥${min}–¥${numberFormatter.format(rule.max)}`;
  }

  function findOverlaps(rules, candidate) {
    return rules.filter((rule) => {
      if (!rule.enabled || rule.id === candidate.id || rule.channelId !== candidate.channelId) return false;
      const candidateMax = candidate.max === null ? Infinity : candidate.max;
      const ruleMax = rule.max === null ? Infinity : rule.max;
      return candidate.min <= ruleMax && rule.min <= candidateMax;
    });
  }

  function formatCoefficient(value) {
    return Number(value).toFixed(2);
  }

  global.PricingConfig = {
    STORAGE_KEY,
    CHANNELS,
    DEFAULT_RULES: cloneRules(DEFAULT_RULES),
    getChannel,
    getChannelChain,
    getChannelPath,
    getChildChannels,
    getDescendantChannels,
    getLeafChannels,
    getChannelOptions,
    loadState,
    saveState,
    resetState,
    normalizeRule,
    isPriceInRule,
    findRuleForChannel,
    resolveRule,
    calculate,
    formatBand,
    findOverlaps,
    formatCoefficient,
  };
})(window);
