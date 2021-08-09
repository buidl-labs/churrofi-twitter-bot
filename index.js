const fetchMarketCapAndPrice = require("./lib/data/celo-market-details");

(async function main() {
  console.log(await fetchMarketCapAndPrice());
})();
