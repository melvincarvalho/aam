# Location

GITMARK_DIR is a global directory that contains helper information

The default is ~/.gitmark/ (based on unix systems)

# Folders

## Tx

tx contains cached /tx/ directory

They are of the form txid.json


Example:

```JSON
{
  "hash": "9407680a09db7da5277e65277e03c214a1b3a992f9294f5713b6a54c12b77d67",
  "block": 1301355,
  "index": 1,
  "timestamp": 1636063509,
  "confirmations": 76,
  "fees": 1e-05,
  "total_input": 0.99402,
  "inputs": [
    {
      "addr": "bSz8gj4gcRX9yC9N4X6r4V6ufGFA1hhqcc",
      "amount": 0.99402,
      "received_from": {
        "tx": "bc8364dd52141edd86108e3b23e87f9f06fdc1e737cb4691ccae3c2ca5147fd6",
        "n": 0
      }
    }
  ],
  "total_output": 0.99401,
  "outputs": [
    {
      "addr": "bMRWUCuqpz6JbXdxcrmjYXVS35djSezv7f",
      "amount": 0.99401,
      "script": "76a9145f5d24d68c4a365c3ed9d1de68e5c73dee84cf3a88ac"
    }
  ]
}
```

## repo

repo contains a file `gitmark.json`

it contains one field `privkey`

This contains the secret exponent of the private key of the genesis txo

It is used to move forward each gitmark

The nesting of the repo dir by default follows the 3 directories in the git tree by default
ie
- project
- user
- provider (e.g. github.com)
