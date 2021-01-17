require('dotenv').config();
const { BADNAME } = require('dns');
var fs = require('fs');
var Web3 = require('web3');
var abi = require('../abi');
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
const userTotalRange = {};

//hash of block 11544493, the block right after Dec-28-2020 08:00:00 PM +UTC
const blockHash = "0x60b7f25372435bebd1961260cec866a46f21e7384da5bcb7ebae0429fcd420e9";
const rand = require('random-seed').create(blockHash);

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

var filePath = 'polkainsure/filtered.txt';
function isValidAddress(a) {
    return web3.utils.isAddress(a);
}

async function howMuchNerdFarmed(addr) {
    for (var i = 0; i < lpAddresses.length; i++) {
        //stake before
        let reminingLP = await nerdVault.methods.getRemainingLP(i, addr).call();
        let nerdInVault = new BN(reminingLP).multipliedBy(new BN(nerdInPairs[i])).dividedBy(new BN(lpSupplys[i])).dividedBy(new BN('1e18')).multipliedBy(2).toFixed(0);
        if (!userTotalStakedFarmed[addr]) {
            userTotalStakedFarmed[addr] = nerdInVault;
        } else {
            userTotalStakedFarmed[addr] = new BN(userTotalStakedFarmed[addr]).plus(new BN(nerdInVault)).toFixed(0);
        }
    }

}

async function howMuchNerdStaked(addr) {
    //stake before
    let reminingNerd = await stakingPool.methods.getRemainingNerd(addr).call();
    reminingNerd = new BN(reminingNerd).dividedBy(new BN('1e18')).toFixed(0);
    if (!userTotalStakedFarmed[addr]) {
        userTotalStakedFarmed[addr] = reminingNerd;
    } else {
        userTotalStakedFarmed[addr] = new BN(userTotalStakedFarmed[addr]).plus(new BN(reminingNerd)).toFixed(0);
    }
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
    let sumOfNerd = 0;
    validAddresses.sort();
    for (addr of validAddresses) {
        await howMuchNerdFarmed(addr);
        await howMuchNerdStaked(addr);
        userTotalRange[addr] = {};
        userTotalRange[addr].start = sumOfNerd;
        userTotalRange[addr].end = sumOfNerd + parseInt(userTotalStakedFarmed[addr]) - 1;
        console.log(userTotalRange[addr]);
        sumOfNerd = sumOfNerd + parseInt(userTotalStakedFarmed[addr]);
    }
    let selectedAddresses = {};
    while (Object.keys(selectedAddresses).length < 30) {
        let generated = rand(sumOfNerd);
        //find address
        for (addr of validAddresses) {
            if (userTotalRange[addr].start <= generated && userTotalRange[addr].end >= generated) {
                if (!selectedAddresses[addr]) {
                    console.log('selected address:', addr);
                    selectedAddresses[addr] = true;
                }
            }
        }
    }
    console.log('selected addresses:');
    console.log(Object.keys(selectedAddresses));

    // asyncForEach(
    //     validAddresses,
    //     async function (addr, i, next) {
    //         await howMuchNerdFarmed(addr);
    //         await howMuchNerdStaked(addr);
    //         if (userTotalStakedFarmed[addr] && userTotalStakedFarmed[addr] != '0') {
    //             eligibleAddresses.push(addr);
    //         }
    //         next();
    //     },
    //     function () {
    //         console.log('Num elible address:', eligibleAddresses.length)
    //     }
    // );
    // asyncForEach(validAddresses, async addr => {
    //     await howMuchNerdFarmed(addr);
    //     await howMuchNerdStaked(addr);
    //     if (userTotalStakedFarmed[addr] && userTotalStakedFarmed[addr] != '0') {
    //         eligibleAddresses.push(addr);
    //     }
    // }).then(() => {
    //     console.log('Num elible address:', eligibleAddresses.length)
    // })
});