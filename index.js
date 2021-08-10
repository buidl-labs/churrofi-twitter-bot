const nodeHTMLtoImage = require("node-html-to-image");
const fs = require("fs");
const fetchMarketCapAndPrice = require("./lib/data/celo-market-details");
const fetchTopEarningVGs = require("./lib/data/top-earning-vg");
const { makeAddress, makeAmount } = require("./lib/utils");

const formatter = new Intl.NumberFormat("en-US");

(async function main() {})();

async function generateMarketCapImage(market_cap) {
  const html = fs.readFileSync("./templates/market-cap.html").toString();

  await nodeHTMLtoImage({
    output: "./image.png",
    html,
    selector: "#market-cap",
    waitUntil: "networkidle2",
    puppeteerArgs: {
      defaultViewport: {
        width: 1000,
        height: 675,
      },
    },
    content: { cap: formatter.format(market_cap) },
  });
}

async function generateTotalRewardImage(totalReward) {
  const { price } = await fetchMarketCapAndPrice();

  const html = fs.readFileSync("./templates/total-reward.html").toString();

  await nodeHTMLtoImage({
    output: "./image.png",
    html,
    selector: "#total-reward",
    waitUntil: "networkidle2",
    puppeteerArgs: {
      defaultViewport: {
        width: 1000,
        height: 675,
      },
    },
    content: {
      reward: formatter.format(totalReward.div(1e18).times(price).toNumber()),
    },
  });
}

async function generateTop3CH(top3) {
  const html = fs.readFileSync("./templates/top-3-ch.html").toString();

  await nodeHTMLtoImage({
    output: "./image.png",
    html,
    selector: "#top-3",
    waitUntil: "networkidle2",
    puppeteerArgs: {
      defaultViewport: {
        width: 1000,
        height: 675,
      },
    },
    content: {
      first: {
        address: makeAddress(top3[0].address),
        amount: makeAmount(top3[0].totalReward),
      },
      second: {
        address: makeAddress(top3[1].address),
        amount: makeAmount(top3[1].totalReward),
      },
      third: {
        address: makeAddress(top3[2].address),
        amount: makeAmount(top3[2].totalReward),
      },
    },
  });
}

async function generateTop3VG(vg, price) {
  const html = fs.readFileSync("./templates/top-3-vg.html").toString();
  await nodeHTMLtoImage({
    output: "./image.png",
    html,
    selector: "#top-vg",
    waitUntil: "networkidle2",
    puppeteerArgs: {
      defaultViewport: {
        width: 1000,
        height: 675,
      },
    },
    content: {
      first: {
        name: vg[0].name,
        amount: formatter.format(
          vg[0].reward.div(1e18).times(price).toFixed(0)
        ),
      },
      second: {
        name: vg[1].name,
        amount: formatter.format(
          vg[1].reward.div(1e18).times(price).toFixed(1)
        ),
      },
      third: {
        name: vg[2].name,
        amount: formatter.format(
          vg[2].reward.div(1e18).times(price).toFixed(1)
        ),
      },
    },
  });
}
