# Redis Topology Monitor

Supplemented by the blog post [here]().

Tools to help monitor and change the redis topology

## Installation
Simply install from npm:

```
npm i -g redis-topology-monitor
```

## Finding the current topology

Use the `find-topology` command.

```bash
redis-topology-monitor find-topology -u redis://localhost:6379 -a password

# Or, if cli is not installed
npx redis-topology-monitor find-topology -u redis://localhost:6379 -a password
```

If you want to script using this, as of now, it is highly recommended that you fork this and modify the code to suit your purposes. This is a proof of concept. If you _really_ want to use this directly, you can use the `--raw` flag to get a json of the below shape in standard output. Note that standard error can still contain text, so you may want to pipe away standard error (for example, using `2>/dev/null`).

```yaml
# Shape of `id`
{
    "id": "redis id",
    "address": "redis address string",
    "host": "host addr",
    "port": port,
    "cport": cport,
    "role": "master" | "slave"
}

# Success
{
    "status": "success", # or "fail"
    "stats": [
        {
            "risk": 0, # number between 0 and 1, indicating the impact of the worst 1 node failure = (max_on_same_host - 1 / nodes.length - 1),
            "num_hosts": 0, # number of different hosts on which the instaces are present
            "max_on_same_host": 0, # maximum number of instances on one host
            "nodes": [], # array of `id` as defined above, list of all instances in this hash slot
            "allocation": {
                "host addr": [], # array of `id` as defined above, instances present on this host
                ...
            }
        }
    ]
}
---
# Failure
{
    "status": "fail",
    "reason": "reason string"
}
```
