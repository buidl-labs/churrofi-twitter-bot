const fetchMarketCap = require("./lib/data/market-cap");

(async function main() {
  console.log(await fetchMarketCap());
})();
