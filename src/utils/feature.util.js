
const config = require("../config");

const hasFeature = (tier, feature, value) => {
  if (!tier || !config.tiers[tier]) {
    return false;
  }

  const tierConfig = config.tiers[tier];

  if (feature === "assets") {
    if (tierConfig.assets === "all") {
      return true;
    }
    return value <= tierConfig.assets;
  }

  if (feature === "timeframes") {
    return tierConfig.timeframes.includes(value);
  }

  return false;
};

module.exports = { hasFeature };
