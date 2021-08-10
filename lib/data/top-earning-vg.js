const { newKit } = require("@celo/contractkit");
const {
  getVGName,
  getValidatorGroups,
  fetchGroupRewardsPerEpoch,
} = require("../utils");

async function fetchTopEarningVGs() {
  const kit = newKit("https://forno.celo.org");
  const groups = await getValidatorGroups(kit);
  const groupRewardsPerEpoch = await fetchGroupRewardsPerEpoch(
    kit,
    groups.map((g) => g.address),
    7
  );

  return await Promise.all(
    Object.entries(groupRewardsPerEpoch)
      .sort((a, b) => b[1].minus(a[1]))
      .slice(0, 3)
      .map(async (e) => ({
        address: e[0],
        reward: e[1],
        name: await getVGName(kit, e[0]),
      }))
  );
}

module.exports = fetchTopEarningVGs;
