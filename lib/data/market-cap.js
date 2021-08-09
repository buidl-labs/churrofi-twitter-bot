const fetch = require("node-fetch");

const fetchMarketCap = async () => {
  const req = await fetch(
    "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=celo"
  );
  const data = await req.json();
  return data[0]["market_cap"];
};

module.exports = fetchMarketCap;
