const nodeHTMLtoImage = require("node-html-to-image");
const fs = require("fs");
const fetchMarketCapAndPrice = require("./lib/data/celo-market-details");
const fetchTopEarningVGs = require("./lib/data/top-earning-vg");
const fetchTotalRewardsAndTop3Holders = require("./lib/data/user-rewards");
const { makeAddress, makeAmount } = require("./lib/utils");
require("dotenv").config();
const Twit = require("twit");

const formatter = new Intl.NumberFormat("en-US");

(async function main() {
  const { totalReward, top3 } = await fetchTotalRewardsAndTop3Holders();
  const { market_cap, price } = await fetchMarketCapAndPrice();
  const vg = await fetchTopEarningVGs();
  console.log("All data fetched, starting image generation.");

  await generateTotalRewardImage(totalReward, price);
  await generateMarketCapImage(market_cap);
  await generateTop3CH(top3);
  await generateTop3VG(vg, price);
  console.log("All images generated, start tweeting.");
  const T = Twit({
    consumer_key: process.env.consumer_key,
    consumer_secret: process.env.consumer_secret,
    access_token: process.env.access_token,
    access_token_secret: process.env.access_token_secret,
  });

  await postImage(
    T,
    "Total rewards earned by users through ChurroFi",
    "total-reward.png"
  );
  await postImage(T, "Celo's market cap", "market-cap.png");
  await postImage(
    T,
    "Top 3 Celo users who've made the most yield through ChurroFi in the past week.",
    "top-3-ch.png"
  );
  await postImage(
    T,
    "Top 3 earning groups on the Celo network in the past week.",
    "top-3-vg.png"
  );
})();

async function postImage(T, message, image) {
  var b64content = fs.readFileSync(image, { encoding: "base64" });

  // first we must post the media to Twitter
  T.post(
    "media/upload",
    { media_data: b64content },
    function (err, data, response) {
      // now we can assign alt text to the media, for use by screen readers and
      // other text-based presentations and interpreters
      var mediaIdStr = data.media_id_string;
      var altText = message;
      var meta_params = { media_id: mediaIdStr, alt_text: { text: altText } };

      T.post(
        "media/metadata/create",
        meta_params,
        function (err, data, response) {
          if (!err) {
            // now we can reference the media and post a tweet (media will attach to the tweet)
            var params = {
              status: message,
              media_ids: [mediaIdStr],
            };

            T.post("statuses/update", params, function (err, data, response) {
              if (err) {
                console.log(err);
              } else {
                console.log("Tweeted successfully.");
              }
            });
          }
        }
      );
    }
  );
}
async function generateMarketCapImage(market_cap) {
  const html = fs.readFileSync("./templates/market-cap.html").toString();

  await nodeHTMLtoImage({
    output: "./market-cap.png",
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

async function generateTotalRewardImage(totalReward, price) {
  const html = fs.readFileSync("./templates/total-reward.html").toString();

  await nodeHTMLtoImage({
    output: "./total-reward.png",
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
    output: "./top-3-ch.png",
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
    output: "./top-3-vg.png",
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
