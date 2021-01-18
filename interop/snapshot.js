require('dotenv').config();
var fs = require('fs');
var Web3 = require('web3');
var abi = require('../abi');
var BN = require('bignumber.js');
const csvWriter = require("./csvwriter");


const web3 = new Web3(new Web3.providers.HttpProvider(process.env.WEB3_URL));
let nerdVault = null;
let stakingPool = null;
let nerd = null;
const lpAddresses = ["0x3473C92d47A2226B1503dFe7C929b2aE454F6b22", "0x61E3FDF3Fb5808aCfd8b9cfE942c729c07b0fE21", "0x7Ad060bd80E088F0c1adef7Aa50F4Df58BAf58d5"];
const lpSupplys = [];
const nerdInPairs = [];
const userTotalStaked = {};
const userTotalFarmed = {};
const userTotalHold = {};

let columns = {
    id: 'Address',
    name: 'NERD Amount'
};

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

var filePath = 'interop/registerlist.txt';
function isValidAddress(a) {
    return web3.utils.isAddress(a);
}

async function howMuchNerdFarmed(addr) {
    for (var i = 0; i < lpAddresses.length; i++) {
        //stake before
        let reminingLP = await nerdVault.methods.getRemainingLP(i, addr).call();
        let nerdInVault = new BN(reminingLP).multipliedBy(new BN(nerdInPairs[i])).dividedBy(new BN(lpSupplys[i])).dividedBy(new BN('1e18')).toFixed(4);
        if (nerdInVault != '0.0000') {
            if (!userTotalFarmed[addr]) {
                userTotalFarmed[addr] = nerdInVault;
            } else {
                userTotalFarmed[addr] = new BN(userTotalFarmed[addr]).plus(new BN(nerdInVault)).toFixed(4);
            }
        }
    }

}

async function howMuchNerdStaked(addr) {
    //stake before
    let reminingNerd = await stakingPool.methods.getRemainingNerd(addr).call();
    reminingNerd = new BN(reminingNerd).dividedBy(new BN('1e18')).toFixed(4);
    if (reminingNerd != '0.0000')
        userTotalStaked[addr] = reminingNerd;
}

async function howMuchNerdHold(addr) {
    //stake before
    let nerdAmount = await nerd.methods.balanceOf(addr).call();
    nerdAmount = new BN(nerdAmount).dividedBy(new BN('1e18')).toFixed(4);
    if (nerdAmount != '0.0000')
        userTotalHold[addr] = nerdAmount;
}

fs.readFile(filePath, 'utf-8', async (err, file) => {
    await getContracts();
    const lines = file.split('\n')
    let validAddresses = [];
    let addressMap = {};
    for (let line of lines) {
        if (isValidAddress(line) && !addressMap[line]) {
            //0x2a76E27066D40dEDF94C6f1A05be450B5c81DB0E - the bot
            if (line.toLowerCase() != "0x2a76E27066D40dEDF94C6f1A05be450B5c81DB0E".toLowerCase()) {
                validAddresses.push(line);
                addressMap[line] = true;
            }
        }
    }
    //sort in alphabet
    let sumOfNerd = 0;
    validAddresses.sort();
    for (addr of validAddresses) {
        await howMuchNerdFarmed(addr);
        await howMuchNerdStaked(addr);
        await howMuchNerdHold(addr);
    }

    csvWriter.writeCSV('interop/staked.csv', userTotalStaked, columns);
    csvWriter.writeCSV('interop/farmed.csv', userTotalFarmed, columns);
    csvWriter.writeCSV('interop/hold.csv', userTotalHold, columns);
});