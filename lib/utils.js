const BigNumber = require("bignumber.js");

function getEpochFromBlock(block, epochSize) {
  if (block == 0) return 0;

  let epochNumber = Math.floor(block / epochSize);
  if (block % epochSize == 0) {
    return epochNumber;
  } else {
    return epochNumber + 1;
  }
}

async function fetchGroupRewardsPerEpoch(kit, groups) {
  const validators = await kit.contracts.getValidators();
  const epochSize = (await validators.getEpochSize()).toNumber();
  const electionDirect = await kit._web3Contracts.getElection();
  const currentBlock = await kit.web3.eth.getBlockNumber();
  const currentEpoch = getEpochFromBlock(currentBlock, epochSize);

  const fromBlock = (currentEpoch - 7) * epochSize;
  const events = await electionDirect.getPastEvents(
    "EpochRewardsDistributedToVoters",
    { fromBlock: fromBlock, filter: { group: groups } }
  );

  const r = {};
  for (const event of events) {
    const group = event.returnValues.group;
    const value = new BigNumber(event.returnValues.value);
    if (Object.keys(r).includes(group)) {
      r[group] = r[group].plus(value);
    } else {
      r[group] = value;
    }
  }
  return r;
}

async function getValidatorGroups(kit) {
  const validators = await kit.contracts.getValidators();
  return await validators.getRegisteredValidatorGroups();
}

const getVGName = async (kit, address) => {
  const validators = await kit.contracts.getValidators();
  const group = await validators.getValidatorGroup(address, false);
  return group.name;
};

module.exports = {
  getEpochFromBlock,
  fetchGroupRewardsPerEpoch,
  getValidatorGroups,
  getVGName,
};
