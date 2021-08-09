const { fetchEpochRewards, fetchChurroFiUsers } = require("../utils");
const { newKit } = require("@celo/contractkit");
const supabase = require("../supabase");
const { default: BigNumber } = require("bignumber.js");

async function fetchTotalRewardsAndTop3Holders() {
  const kit = newKit("https://forno.celo.org");

  const users = await fetchChurroFiUsers(supabase);
  let allUserRewards = await Promise.all(
    users.map(async (user) => ({
      address: user["address"],
      reward: await fetchEpochRewards(kit, user["address"]),
    }))
  );
  allUserRewards = allUserRewards.map((userReward) => ({
    ...userReward,
    totalReward: userReward.reward.reduce(
      (a, c) => a.plus(c.reward),
      new BigNumber(0)
    ),
  }));

  const totalReward = allUserRewards.reduce(
    (a, c) => a.plus(c.totalReward),
    new BigNumber(0)
  );
  const top3 = allUserRewards
    .sort((a, b) => b.totalReward.minus(a.totalReward))
    .slice(0, 3)
    .map((user) => ({ address: user.address, totalReward: user.totalReward }));
  return { top3, totalReward };
}

module.exports = fetchTotalRewardsAndTop3Holders;
