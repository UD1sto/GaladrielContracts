// Import ethers from Hardhat package
import readline from "readline";
import { parseEther, BigNumberish } from 'ethers'

const { ethers } = require("hardhat");

async function main() {
    const contractABI = [
        "function createTask(string memory description) public payable",
        "function attemptFullfillTask(string[] memory urls) public returns (bool)",
        "function getTaskInfo() public view returns (string memory taskDescription, uint256 deadline, uint256 reward, bool lock)"
    ];

    if (!process.env.QUICKSTART_CONTRACT_ADDRESS) {
        throw new Error("QUICKSTART_CONTRACT_ADDRESS env variable is not set.");
    }

    const contractAddress = process.env.QUICKSTART_CONTRACT_ADDRESS;
    const [signer] = await ethers.getSigners();

    // Create a contract instance
    const contract = new ethers.Contract(contractAddress, contractABI, signer);

    // CreateTask Function which also transfers eth
    
    const transactionResponse = await contract.createTask('Your task is to receive and confirm that an image result is 1+1', { value: parseEther("0.01") });

    const receipt = await transactionResponse.wait(); console.log(`Transaction sent, hash: ${receipt.hash}.\nExplorer: https://explorer.galadriel.com/tx/${receipt.hash}`)

    await new Promise((resolve) => setTimeout(resolve, 10000));

    //Attempt to fullfill task
    console.log('Printer go brrrr');
    const transactionResponse2 = await contract.attemptFullfillTask(['https://th.bing.com/th/id/R.1202babb5de4d91506077c42003eb950?rik=Hg7cFwUGeT5%2bWg&pid=ImgRaw&r=0']);
    const receipt2 = await transactionResponse2.wait();
    console.log(`Transaction sent, hash: ${receipt2.hash}.\nExplorer: https://explorer.galadriel.com/tx/${receipt2.hash}`);
    console.log('chill a bit')
    await new Promise((resolve) => setTimeout(resolve, 10000));
    // Call the getTaskInfo function
    console.log('get task info')
    const taskInfo = await contract.getTaskInfo()
    console.log('Task Info:', taskInfo)
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });