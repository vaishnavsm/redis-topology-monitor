const { createClient } = require("redis");

/**
 * @returns {Promise<import('redis').RedisClientType>} redisClient
 */
const redisConnectOrFail = async (config) =>
  new Promise((resolve, reject) => {
    const redis = createClient(config);
    redis.on("error", reject);
    redis.connect().then(resolve);
  });

const getStatsForSlot = (master) => {
  const nodes = [];
  const allocation = {};
  const masterId = {
    id: master.id,
    address: master.address,
    host: master.host,
    port: master.port,
    cport: master.cport,
    role: "master",
  };
  allocation[master.host] = [masterId];
  nodes.push(masterId);

  for (const replica of master.replicas) {
    const replicaId = {
      id: replica.id,
      address: replica.address,
      host: replica.host,
      port: replica.port,
      cport: replica.cport,
      role: "slave",
    };
    if (!(replica.host in allocation)) {
      allocation[replica.host] = [];
    }
    nodes.push(replicaId);
    allocation[replica.host].push(replicaId);
  }

  const num_hosts = Object.keys(allocation).length;
  const max_on_same_host = Object.values(allocation)
    .map((x) => x.length)
    .reduce((p, n) => Math.max(p, n));

  const risk = nodes.length === 1 ? 1 : (max_on_same_host - 1) / (nodes.length - 1);

  return {
    nodes,
    risk,
    num_hosts,
    max_on_same_host,
    allocation,
    slot: master.slots,
    master: masterId,
  };
};

const findTopologyFromNode = async ({ entryNode }) => {
  const redis = await redisConnectOrFail(entryNode);
  const nodes = await redis.CLUSTER_NODES();
  await redis.quit();
  const slotStats = nodes.map(getStatsForSlot);
  return slotStats;
};

const findClusterState = async ({ entryNode }) => {
  const redis = await redisConnectOrFail(entryNode);
  const data = await redis.CLUSTER_INFO();
  await redis.quit();
  return data.state;
};

const findTopology = async ({ nodes }) => {
  const state = await findClusterState({ entryNode: nodes[0] });
  if (state !== "ok") {
    return {
      status: "fail",
      reason: "state_not_ok",
    };
  }
  const stats = await findTopologyFromNode({ entryNode: nodes[0] });
  stats.sort((a, b) => b.risk - a.risk);
  return { status: "success", stats };
};

const prettyPrintOverviewMessages = (stats) => {
  if (stats[0].risk === 0) {
    console.info(
      "👏 Looks like your cluster is evenly distributed, and no host contains more than one instance of a hash slot"
    );
  }

  if (stats[0].risk === 1) {
    const riskySlots = stats.filter((x) => x.risk === 1);
    console.info(
      `😱 Oh no, looks like ${riskySlots.length} of your hash slots are in risk of single node failure!`
    );
  }

  console.table(
    stats.map((slot, idx) => ({
      "Slot Number": idx + 1,
      "Number of Hosts": slot.num_hosts,
      "Maximum on One Host": slot.max_on_same_host,
      Hosts: Object.keys(slot.allocation).join(", "),
      "Master Id": slot.master.id,
      "Master Address": slot.master.address,
    }))
  );
};

const prettyPrintSlotMessages = (slot, index) => {
  console.info(`\nSlot ${index + 1}`);
  if (slot.risk === 1) {
    console.info(`🔴 This slot is in risk of single node failure!`);
  } else if (slot.risk === 0) {
    console.info(`✅ This slot is perfectly evenly distributed`);
  } else {
    console.info(
      `⭕ This slot is partially skewed, distributed between ${slot.num_hosts} with a max of ${slot.max_on_same_host} on one host.`
    );
  }
};

const prettyPrintByHost = (stats) => {
  const hostToSlotData = {};
  stats.forEach((slot, idx) => {
    Object.entries(slot.allocation).forEach(([host, instances]) => {
      if (!hostToSlotData[host]) {
        hostToSlotData[host] = {};
      }
      hostToSlotData[host][idx + 1] = instances.length;
    });
  });
  const hostToSlotTable = Object.entries(hostToSlotData).map(
    ([host, slotMap]) => {
      const map = { Host: host };
      Object.entries(slotMap).forEach(([slot, count]) => {
        map[`Slot ${slot}`] = count;
      });
      return map;
    }
  );
  console.table(hostToSlotTable);
};

const prettyPrintTopology = ({ status, stats }) => {
  if (status === "fail") {
    console.info(
      "Failed finding cluster status. There may be something wrong with the cluster."
    );
    return;
  }

  if (stats.length === 0) {
    console.info("No stats were found for this cluster? Weird.");
    return;
  }

  console.info("Overview\n-------");
  prettyPrintOverviewMessages(stats);

  console.info("\nSlots by Host\n-------");
  prettyPrintByHost(stats);

  console.info("\nSlot Statuses\n-------");
  stats.forEach(prettyPrintSlotMessages);
};

module.exports = { findTopology, prettyPrintTopology };
