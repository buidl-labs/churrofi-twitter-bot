const fetchMarketCapAndPrice = require("./lib/data/celo-market-details");
const fetchTopEarningVGs = require("./lib/data/top-earning-vg");

(async function main() {
  // console.log(await fetchMarketCapAndPrice());
  console.log(await fetchTopEarningVGs());
})();
