// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "./interfaces/IOracle.sol";

// this contract allows the user to register his info and then it contacts with the teeml to ask for an inference that aims to compare both the current and the past info

contract ThunderMarket {
    //0 init, 1 paid
    struct Task {
        string description;
        address owner;
        address worker;
        uint reward;
        bool lock;
    }
    address public owner;
    uint counter;
    address oracleAddress = 0x68EC9556830AD097D661Df2557FBCeC166a0A075;
    event TaskCreated(
        string description,
        uint256 taskId,
        uint256 reward
    );
    event TaskCompleted(uint256 taskId);
    event ChatCreated(address indexed owner, uint indexed chatId);

    mapping(uint => Task) public tracking;
    mapping(uint => ChatRun) public chatRuns;
    uint private chatRunsCount;
    IOracle.OpenAiRequest private config;

    struct ChatRun {
        address owner;
        IOracle.Message[] messages;
        uint messagesCount;
    }

    struct settings {
        uint mode;
    }
    address public oracle;
    mapping(address => bytes32) hashes;
    // @notice Event emitted when the oracle address is updated
    event OracleAddressUpdated(address indexed newOracleAddress);

    // @param initialOracleAddress Initial address of the oracle contract
    constructor(address initialOracleAddress) {
        owner = msg.sender;
        oracleAddress = initialOracleAddress;
        chatRunsCount = 0;

        config = IOracle.OpenAiRequest({
            model: "gpt-4-turbo",
            frequencyPenalty: 21, // > 20 for null
            logitBias: "", // empty str for null
            maxTokens: 1000, // 0 for null
            presencePenalty: 21, // > 20 for null
            responseFormat: '{"type":"text"}',
            seed: 0, // null
            stop: "", // null
            temperature: 10, // Example temperature (scaled up, 10 means 1.0), > 20 means null
            topP: 101, // Percentage 0-100, > 100 means null
            tools: "",
            toolChoice: "", // "none" or "auto"
            user: "" // null
        });
    }

    // @notice Ensures the caller is the contract owner
    modifier onlyOwner() {
        require(msg.sender == owner, "Caller is not owner");
        _;
    }

    // @notice Ensures the caller is the oracle contract
    modifier onlyOracle() {
        require(msg.sender == oracleAddress, "Caller is not oracle");
        _;
    }

    function setOracleAddress(address _newOracleAddress) public onlyOwner {
        oracleAddress = _newOracleAddress;
        emit OracleAddressUpdated(_newOracleAddress);
    }

    function startChat(
        string memory message,
        string[] memory imageUrls
    ) public returns (uint i) {
        ChatRun storage run = chatRuns[chatRunsCount];
        run.owner = msg.sender;
        IOracle.Message memory newMessage = IOracle.Message({
            role: "user",
            content: new IOracle.Content[](imageUrls.length + 1)
        });
        newMessage.content[0] = IOracle.Content({
            contentType: "text",
            value: message
        });
        for (uint u = 0; u < imageUrls.length; u++) {
            newMessage.content[u + 1] = IOracle.Content({
                contentType: "image_url",
                value: imageUrls[u]
            });
        }
        run.messages.push(newMessage);
        run.messagesCount = 1;
        uint currentId = chatRunsCount;
        chatRunsCount = chatRunsCount + 1;
        IOracle(oracleAddress).createOpenAiLlmCall(currentId, config);
        emit ChatCreated(msg.sender, currentId);
        return currentId;
    }

    function reset() public {
            if (tracking[0].reward == 0) {
                tracking[0].lock = false;
            }
    }

    function closeTask() public {
        require(tracking[0].owner == msg.sender, "Only owner can close task");
        payable(tracking[0].owner).transfer(tracking[0].reward);
        tracking[0].reward = 0;
        reset();
    }


    function createTask(
        string memory description
    ) public payable {
        require(tracking[0].lock != true, "Task creation is locked");
        require(msg.value > 0, "Reward must be greater than 0");
        Task memory newTask = Task({
            description: description,
            owner: msg.sender,
            worker: address(0),
            reward: msg.value,
            lock: false
        });
        tracking[0] = newTask;
        emit TaskCreated(
            description,
            counter,
            msg.value
        );
    }

    function attemptFullfillTask(string[] memory urls) public returns (bool) {
        require(tracking[0].lock == false);
        startChat(tracking[0].description, urls);
        tracking[0].worker = msg.sender;
        tracking[0].lock = true;
        return true;
    }

    function onOracleOpenAiLlmResponse(
        uint256 runId,
        IOracle.OpenAiResponse memory response,
        string memory errorMessage
    ) public onlyOracle {
        if (compareStrings(response.content, "yes")) {
            payable(tracking[runId].worker).transfer(tracking[runId].reward);
            tracking[runId] = tracking[0];
            tracking[runId].worker = address(0);
            tracking[0].lock = false;
        }

        ChatRun storage run = chatRuns[runId];
        require(
            keccak256(
                abi.encodePacked(run.messages[run.messagesCount - 1].role)
            ) == keccak256(abi.encodePacked("user")),
            "No message to respond to"
        );

        if (!compareStrings(errorMessage, "")) {
            IOracle.Message memory newMessage = IOracle.Message({
                role: "assistant",
                content: new IOracle.Content[](1)
            });
            newMessage.content[0].contentType = "text";
            newMessage.content[0].value = errorMessage;
            run.messages.push(newMessage);
            run.messagesCount++;
        } else {
            IOracle.Message memory newMessage = IOracle.Message({
                role: "assistant",
                content: new IOracle.Content[](1)
            });
            newMessage.content[0].contentType = "text";
            newMessage.content[0].value = response.content;
            run.messages.push(newMessage);
            run.messagesCount++;
        }
    }

    function getTaskInfo()
        public
        view
        returns (
            string memory taskDescription,
            uint256 reward,
            bool lock
        )
    {
        return (
            tracking[0].description,
            tracking[0].reward,
            tracking[0].lock
        );
    }

    function getMessageHistory(
        uint chatId
    ) public view returns (IOracle.Message[] memory) {
        return chatRuns[chatId].messages;
    }

    function addMessage(string memory message, uint runId) public {
        ChatRun storage run = chatRuns[runId];
        require(
            keccak256(
                abi.encodePacked(run.messages[run.messagesCount - 1].role)
            ) == keccak256(abi.encodePacked("assistant")),
            "No response to previous message"
        );
        require(run.owner == msg.sender, "Only chat owner can add messages");

        IOracle.Message memory newMessage = IOracle.Message({
            role: "user",
            content: new IOracle.Content[](1)
        });
        newMessage.content[0].contentType = "text";
        newMessage.content[0].value = message;
        run.messages.push(newMessage);
        run.messagesCount++;

        IOracle(oracleAddress).createOpenAiLlmCall(runId, config);
    }

    function compareStrings(
        string memory a,
        string memory b
    ) private pure returns (bool) {
        return (keccak256(abi.encodePacked((a))) ==
            keccak256(abi.encodePacked((b))));
    }
}
