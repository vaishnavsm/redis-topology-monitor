#!/usr/bin/env node
const { Command } = require('commander');
const packageJson = require('../package.json');
const { findTopology, prettyPrintTopology } = require('./cmds/find-topology');
const program = new Command();

program
  .name(packageJson.name)
  .description(packageJson.description)
  .version(packageJson.version);

program.command('find-topology')
  .description('Find the topology information of a redis cluster. The provided nodes must be part of the same cluster.')
  .option('-u, --url <string>', 'Formatted redis url for the node to connect to. This takes precedence over host and port.')
  .option('-H, --host <string>', 'Host to connect to', 'localhost')
  .option('-p, --port <string>', 'Port to connect to', '6379')
  .option('-a, --auth <string>', 'The password, if required')
  .option('-U, --username <string>', 'The username, if required')
  .option('-r, --raw', 'print result json, not the prettified data')
  .action(async (options) => {
    // only support single node for now
    const node = {  };
    
    if(options.url) node.url = options.url;
    else node.url = `redis://${options.host}:${options.port}`

    if(options.auth) node.password = options.auth;
    if(options.username) node.username = options.username;
    
    const nodes = [node];

    try {
        const results = await findTopology({ nodes });
        if(options.raw) {
            console.log(JSON.stringify(results, null, 2));
        } else {
            prettyPrintTopology(results);
        }
        process.exit(0);
    } catch (err) {
        if(options.raw) {
            console.info(JSON.stringify({ status: 'fail', reason: 'unexpected_fail' }, null, 2))
        }
        console.error('error finding the topology of the redis cluster', err);
        process.exit(1);
    }
  });

program.parse();
