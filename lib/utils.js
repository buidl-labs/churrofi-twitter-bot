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
  console.log(fromBlock);
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

async function fetchChurroFiUsers(client) {
  const { data, error } = await client.from("wallets").select("address");

  return data;
}

const fetchEpochRewards = async (kit, address) => {
  const validators = await kit.contracts.getValidators();
  const epochSize = (await validators.getEpochSize()).toNumber();
  const blockN = await kit.web3.eth.getBlockNumber();
  const epochNow = getEpochFromBlock(blockN, epochSize);
  const fromEpoch = epochNow - 7;

  const unitsPerEpoch = await fetchUnitsPerEpoch(kit, [address], epochNow);

  const groupSet = new Set();
  unitsPerEpoch.forEach((v) => v.forEach((units, k) => groupSet.add(k)));
  const groups = Array.from(groupSet.values());
  if (groups.length == 0) return []; // no rewards

  const unitsByGroup = await fetchGroupUnitsPerEpoch(kit, groups, epochNow);

  const rewardsByGroup = await fetchGroupRewardsPerEpochForUserRewards(
    kit,
    groups
  );

  const byEpoch = new Map();
  unitsPerEpoch.forEach((unitsPerG, epoch) => {
    let asGold = byEpoch.get(epoch) || new BigNumber(0);
    unitsPerG.forEach((units, group) => {
      const unitsTotal = unitsByGroup.get(group)?.get(epoch);
      const rewardTotal = rewardsByGroup.get(group)?.get(epoch);
      if (rewardTotal) {
        const delta = rewardTotal
          .multipliedBy(units)
          .dividedToIntegerBy(unitsTotal);
        asGold = asGold.plus(delta);
      }
    });
    if (asGold.gt(0)) {
      byEpoch.set(epoch, asGold);
    }
  });

  return Array.from(byEpoch.entries())
    .filter(([epoch, _]) => epoch >= fromEpoch)
    .map(([epoch, v]) => ({
      epoch: epoch,
      reward: v,
    }));
  // return Array.from(byEpoch.entries()).map(([_, v]) => v);
};

async function fetchUnitsPerEpoch(kit, addresses, epochNow) {
  const validators = await kit.contracts.getValidators();
  const epochSize = (await validators.getEpochSize()).toNumber();
  const electionDirect = await kit._web3Contracts.getElection();

  const activateEvents = await electionDirect.getPastEvents(
    "ValidatorGroupVoteActivated",
    { fromBlock: 0, filter: { account: addresses } }
  );
  const revokeEvents = await electionDirect.getPastEvents(
    "ValidatorGroupActiveVoteRevoked",
    { fromBlock: 0, filter: { account: addresses } }
  );

  const unitsPerEpoch = new Map();
  for (const event of activateEvents) {
    const group = event.returnValues.group;
    const epochFirst = getEpochFromBlock(event.blockNumber, epochSize);
    const units = new BigNumber(event.returnValues.units);

    for (let epoch = epochFirst; epoch < epochNow; epoch += 1) {
      let unitsPerG = unitsPerEpoch.get(epoch);
      if (!unitsPerG) {
        unitsPerG = new Map();
        unitsPerEpoch.set(epoch, unitsPerG);
      }
      unitsPerG.set(group, units.plus(unitsPerG.get(group) || 0));
    }
  }

  for (const event of revokeEvents) {
    const group = event.returnValues.group;
    const epochFirst = getEpochFromBlock(event.blockNumber, epochSize);
    const units = new BigNumber(event.returnValues.units);
    for (let epoch = epochFirst; epoch < epochNow; epoch += 1) {
      let unitsPerG = unitsPerEpoch.get(epoch);
      if (!unitsPerG) {
        unitsPerG = new Map();
        unitsPerEpoch.set(epoch, unitsPerG);
      }
      const unitsNew = unitsPerG.get(group)?.minus(units);
      if (unitsNew.lt(0)) {
        throw new Error(`units must never be negative: ${group} ${epoch}`);
      } else if (unitsNew.eq(0)) {
        unitsPerG.delete(group);
        if (unitsPerG.size === 0) {
          unitsPerEpoch.delete(epoch);
        }
      } else {
        unitsPerG.set(group, unitsNew);
      }
    }
  }
  return unitsPerEpoch;
}

async function fetchGroupUnitsPerEpoch(kit, groups, epochNow) {
  const validators = await kit.contracts.getValidators();
  const epochSize = (await validators.getEpochSize()).toNumber();
  const electionDirect = await kit._web3Contracts.getElection();

  const activateEvents = await electionDirect.getPastEvents(
    "ValidatorGroupVoteActivated",
    { fromBlock: 0, filter: { group: groups } }
  );
  const revokeEvents = await electionDirect.getPastEvents(
    "ValidatorGroupActiveVoteRevoked",
    { fromBlock: 0, filter: { group: groups } }
  );
  const unitsByGroup = new Map();

  for (const event of activateEvents) {
    const group = event.returnValues.group;
    const epochFirst = getEpochFromBlock(event.blockNumber, epochSize);
    const units = new BigNumber(event.returnValues.units);

    let unitsPerEpoch = unitsByGroup.get(group);
    if (!unitsPerEpoch) {
      unitsPerEpoch = new Map();
      unitsByGroup.set(group, unitsPerEpoch);
    }
    for (let epoch = epochFirst; epoch < epochNow; epoch += 1) {
      unitsPerEpoch.set(epoch, units.plus(unitsPerEpoch.get(epoch) || 0));
    }
  }

  for (const event of revokeEvents) {
    const group = event.returnValues.group;
    const epochFirst = getEpochFromBlock(event.blockNumber, epochSize);
    const units = new BigNumber(event.returnValues.units);

    const unitsPerEpoch = unitsByGroup.get(group);
    for (let epoch = epochFirst; epoch < epochNow; epoch += 1) {
      const unitsNew = unitsPerEpoch.get(epoch)?.minus(units);
      if (unitsNew.lt(0)) {
        throw new Error(`units must never be negative: ${group} ${epoch}`);
      } else if (unitsNew.eq(0)) {
        unitsPerEpoch.delete(epoch);
        if (unitsPerEpoch.size === 0) {
          unitsByGroup.delete(group);
        }
      } else {
        unitsPerEpoch.set(epoch, unitsNew);
      }
    }
  }
  return unitsByGroup;
}

async function fetchGroupRewardsPerEpochForUserRewards(kit, groups) {
  const validators = await kit.contracts.getValidators();
  const epochSize = (await validators.getEpochSize()).toNumber();
  const electionDirect = await kit._web3Contracts.getElection();

  const events = await electionDirect.getPastEvents(
    "EpochRewardsDistributedToVoters",
    { fromBlock: 0, filter: { group: groups } }
  );

  const r = new Map();

  for (const event of events) {
    const group = event.returnValues.group;
    const epoch = getEpochFromBlock(event.blockNumber, epochSize);
    const value = new BigNumber(event.returnValues.value);
    let perEpoch = r.get(group);
    if (!perEpoch) {
      perEpoch = new Map();
      r.set(group, perEpoch);
    }
    perEpoch.set(epoch, value.plus(perEpoch.get(epoch) || 0));
  }
  return r;
}

function makeAmount(amount) {
  return amount.div(1e18).toFixed(4);
}

function makeAddress(address) {
  return (
    address.slice(0, address.length / 2) +
    " " +
    address.slice(address.length / 2)
  );
}

module.exports = {
  getEpochFromBlock,
  fetchGroupRewardsPerEpoch,
  getValidatorGroups,
  getVGName,
  fetchChurroFiUsers,
  fetchEpochRewards,
  makeAddress,
  makeAmount,
};
