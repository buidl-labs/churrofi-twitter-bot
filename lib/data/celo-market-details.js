const fetch = require("node-fetch");

const fetchMarketCapAndPrice = async () => {
  const req = await fetch(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=celo"
  );
  const data = await req.json();

  return { market_cap: data[0]["market_cap"], price: data[0]["current_price"] };
};

module.exports = fetchMarketCapAndPrice;
