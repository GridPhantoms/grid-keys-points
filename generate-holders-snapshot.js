const fs = require('fs');
const fetch = require('node-fetch');

const ALCHEMY_KEY = "8_mRIGpe0XlWjl34sgVtb";   // ← your key is hard-coded here

const GENESIS_CONTRACT = "0xF26e168D053F6779f7172A1d0b0A6cD8d7446493";
const EXODUS_CONTRACT = "0xddF1d5f3A79ccbA74e284fD5b9Ee0FAdDB8993aa";

async function getTokenIds(wallet) {
  const url = `https://eth-mainnet.g.alchemy.com/nft/v3/${ALCHEMY_KEY}/getNFTsForOwner?owner=${wallet}&contractAddresses[]=${GENESIS_CONTRACT}&contractAddresses[]=${EXODUS_CONTRACT}&withMetadata=false&limit=100`;
  
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
  
  const data = await res.json();
  const nfts = data.ownedNfts || [];

  const genesisIds = nfts
    .filter(n => n.contract && n.contract.address.toLowerCase() === GENESIS_CONTRACT.toLowerCase())
    .map(n => n.tokenId);

  const exodusIds = nfts
    .filter(n => n.contract && n.contract.address.toLowerCase() === EXODUS_CONTRACT.toLowerCase())
    .map(n => n.tokenId);

  return { genesisIds, exodusIds };
}

async function main() {
  const genesisWallets = [
    "0xeac06820214b75a23038854495a8d07110341e48",
    "0x5e0effcd942fbab80567a623c25d3e8b795c0f38",
    "0xf1181727cab6b9754321b8fc3f40e99c3dad7925",
    "0xe7d43779c6a30c59c48f2a5dacb9acac0c0c0ed4",
    "0x60ae1a2f572c6681d1c52342c5785d4840e29e7f",
    "0xc8ef2e76deae8394a632cd8403ce4b0993fd615a",
    "0x1c2e4b068f69a46d8cf7995db90d38428163b979",
    "0x381da90cf81e58dcf92fec2446da393262bcd743",
    "0x855f3297d95e05d9257e8a72b58bfce3d6425942",
    "0xa81606199932d4f9cac41778c52e061a7f153c43",
    "0xe2876e6f82e946be5be75d6fdc3fc743340a9635",
    "0x4368679c4782fcdd52b42fabf9b8dea103170fba",
    "0xcdafe450ce9bafced67a9e1d2d036daa5dd1ac37",
    "0x16d82705f9bf5b9cc09fc1445d0269afd91b073e",
    "0x56e43eab9cea067feac0bc716e049eb53aa63b44",
    "0x6078564a9c657d56d93bdd415bb1922fc6ae4aaf",
    "0xc60a2f17867250df53a097f436a35e94d1a2e0c1",
    "0xebd09d39dd7a7d661cf84992008030c5cd592a08",
    "0x57af013384d969e4a838fdcecf6deee1d56172df",
    "0x952645c2f3e4cee95eb1342e590619d78679dc43",
    "0xae800b7e4353f0559ccbf2dc8568230fe99336ca",
    "0x00ef9bf87c7dc3b93e0dad2065ff4ce5c46ea1d4",
    "0x0b5bfb355f553a267460bb4cb1c768a8d4940687",
  ];

  const exodusWallets = [
    "0x5e0effcd942fbab80567a623c25d3e8b795c0f38",
    "0xeac06820214b75a23038854495a8d07110341e48",
    "0x1f200ba7b67f9618a34e11e3f67907407b7b54b5",
    "0xd6ca95805412a325430c9406769bbb0cc7b1f9db",
    "0x60ae1a2f572c6681d1c52342c5785d4840e29e7f",
    "0x855f3297d95e05d9257e8a72b58bfce3d6425942",
    "0xd5ebe7486713b9dc52e3ec74f53b76e7ba9b24bc",
    "0x0b5bfb355f553a267460bb4cb1c768a8d4940687",
    "0x0ff1c722c62479546755bf1b6ebe9b1d8c5f213b",
    "0xcfef99bc050ab98046ef6da31df863dcd858babf",
    "0x803cbb0323324f491b314b0b744ba99ae794d2db",
    "0xe44fc78b68558ba406e22a4059a22b7ebfd62da0",
    "0xf1181727cab6b9754321b8fc3f40e99c3dad7925",
    "0xcdafe450ce9bafced67a9e1d2d036daa5dd1ac37",
    "0x952645c2f3e4cee95eb1342e590619d78679dc43",
    "0xe2876e6f82e946be5be75d6fdc3fc743340a9635",
    "0x57af013384d969e4a838fdcecf6deee1d56172df",
    "0x96d24f4a636e47338142b012b2a89f1877f20a69",
    "0x68c311a6896ba62583875bbf823a712cb4a27bca",
    "0xae2d4f6ad739a3797f1fe03175fd5034b39098c4",
    "0xa0793dcfdc22f953d852c90ebc001db7b247e0a2",
    "0xebd09d39dd7a7d661cf84992008030c5cd592a08",
    "0xf7c27d1875e37f23a04adef80bb98aa270a73c6d",
    "0xad68c8fae0a6851ce4b654196a53d325da28c388",
    "0x5d39fe640cc2b886bef1ae7bc76d509e4fc2fc01",
    "0xc8ef2e76deae8394a632cd8403ce4b0993fd615a",
    "0x6f06f82a6400c8cd1ff008725e0698b42e5b8ffd",
    "0x3c3eac094694947c02d1251f4517e8c42b48b194",
    "0x390cc99e7bb9c6fcdf6d482bb55c445b04f73b82",
    "0x340143acb1dab779afd88e0d51c22e3eae963860",
    "0xddb3dc32e66d1f2192dfe11a64a5d2b2557673c6",
    "0x16d82705f9bf5b9cc09fc1445d0269afd91b073e",
    "0x736766b9a41aceea10c89aa93468d93b1aae1907",
    "0xe7d43779c6a30c59c48f2a5dacb9acac0c0c0ed4",
    "0x718622cf96bf6b3cd7060b4a33bef67bb171dc65",
    "0xbaa0ad1dbd8c02137764c87c4e6c28ea3285e18e",
    "0xc60a2f17867250df53a097f436a35e94d1a2e0c1",
    "0xf3be7ec74b6daa2c8af2e0fa17c4dc6ba7dee104",
    "0x9a20ae299bf41202dcd1ea37542bb9025178881b",
  ];

  const allWallets = [...new Set([...genesisWallets, ...exodusWallets])];

  console.log(`Fetching exact token IDs for ${allWallets.length} wallets... This may take 1-2 minutes.`);

  const snapshot = [];

  for (const wallet of allWallets) {
    console.log(`→ Fetching ${wallet}`);
    try {
      const { genesisIds, exodusIds } = await getTokenIds(wallet);
      snapshot.push({
        wallet: wallet.toLowerCase(),
        genesis_token_ids: genesisIds.join(','),
        exodus_token_ids: exodusIds.join(',')
      });
    } catch (err) {
      console.log(`⚠️ Failed for ${wallet}: ${err.message}`);
      snapshot.push({
        wallet: wallet.toLowerCase(),
        genesis_token_ids: "",
        exodus_token_ids: ""
      });
    }
  }

  let csv = "wallet,genesis_token_ids,exodus_token_ids\n";
  snapshot.forEach(row => {
    csv += `${row.wallet},"${row.genesis_token_ids}","${row.exodus_token_ids}"\n`;
  });

  fs.writeFileSync('./public/holders-snapshot.csv', csv);
  console.log("\n✅ SUCCESS! File created: public/holders-snapshot.csv");
  console.log("You can now use this in the leaderboard.");
}

main().catch(console.error);