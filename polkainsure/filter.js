require('dotenv').config();
const { BADNAME } = require('dns');
var fs = require('fs');
var Web3 = require('web3');
var abi = require('./abi');
var BN = require('bignumber.js');
const asyncForEach = require("async-for-each");

const web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_URL));
let nerdVault = null;
let stakingPool = null;
let nerd = null;
const lpAddresses = ["0x3473C92d47A2226B1503dFe7C929b2aE454F6b22", "0x61E3FDF3Fb5808aCfd8b9cfE942c729c07b0fE21", "0x7Ad060bd80E088F0c1adef7Aa50F4Df58BAf58d5"];
const lpSupplys = [];
const nerdInPairs = [];
const snapShotTime = 1609185600;
const userTotalStakedFarmed = {};
const eligibleAddresses = [];
function sleep(ms) {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}
async function getContracts() {
    if (nerdVault) return;
    nerdVault = await new web3.eth.Contract(abi.vault, "0x47cE2237d7235Ff865E1C74bF3C6d9AF88d1bbfF");
    stakingPool = await new web3.eth.Contract(abi.stakingPool, "0x357ADa6E0da1BB40668BDDd3E3aF64F472Cbd9ff");
    nerd = await new web3.eth.Contract(abi.erc20, "0x32C868F6318D6334B2250F323D914Bc2239E4EeE");
    for (var i = 0; i < lpAddresses.length; i++) {
        let lp = await new web3.eth.Contract(abi.erc20, lpAddresses[i]);
        let supply = await lp.methods.totalSupply().call();
        lpSupplys.push(supply);
        let nerdInPair = await nerd.methods.balanceOf(lpAddresses[i]).call();
        nerdInPairs.push(nerdInPair);
    }
}

var filePath = 'polkainsure/registerlist.txt';
function isValidAddress(a) {
    return web3.utils.isAddress(a);
}

async function check(addr) {
    for (var i = 0; i < lpAddresses.length; i++) {
        let depositTime = await nerdVault.methods.getDepositTime(i, addr).call();
        if (depositTime != '0' && new BN(depositTime).comparedTo(new BN(snapShotTime)) < 0) {
            return true;
        }
    }

    let depositTime = await stakingPool.methods.getDepositTime(addr).call();
    if (depositTime != '0' && new BN(depositTime).comparedTo(new BN(snapShotTime)) < 0) {
        return true;
    }
    return false;
}

fs.readFile(filePath, 'utf-8', async (err, file) => {
    await getContracts();
    const lines = file.split('\n')
    let validAddresses = [];
    let addressMap = {};
    for (let line of lines) {
        if (isValidAddress(line) && !addressMap[line]) {
            validAddresses.push(line);
            addressMap[line] = true;
        }
    }
    //sort in alphabet
    var i = 0;
    for (addr of validAddresses) {
        try {
            console.log('checking:', i, ', addr=', addr)
            i++
            let ok = await check(addr);
            if (ok) {
                eligibleAddresses.push(addr);
            }
        } catch (e) {

        }
    }

    var file = fs.createWriteStream('filtered.txt');
    file.on('error', function (err) { /* error handling */ });
    eligibleAddresses.forEach(function (v) { file.write(v + '\n'); });
    file.end();
});