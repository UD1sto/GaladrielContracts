import { loadFixture, } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

const PROMPT = "You need to create the image of the result of the following mathematical calculation, 1 + 1 =?";
describe("CleverMark", function () {
    // We define a fixture to reuse the same setup in every test.
    // We use loadFixture to run this setup once, snapshot that state,
    // and reset Hardhat Network to that snapshot in every test.
    async function deploy() {
        // Contracts are deployed using the first signer/account by default
        const allSigners = await ethers.getSigners();
        const owner = allSigners[0];

        const AgentOracle = await ethers.getContractFactory("ChatOracle");
        const oracle = await AgentOracle.deploy();
        // Add owner to whitelist for these tests
        await oracle.updateWhitelist(owner.address, true);

        const Clever = await ethers.getContractFactory("CleverMark");
        const agent = await Clever.deploy(
            oracle.target
        );

        return { agent, oracle, owner, allSigners };
    }

    describe("run a task", function () {
        it("Should register marketplace task", async () => {
            const { agent, owner } = await loadFixture(deploy);

            // expect(await agent.oracleAddress()).to.equal("0x0000000000000000000000000000000000000000");
            const prompt = await agent.createTask(PROMPT, 50);
            expect(prompt).to.equal(PROMPT);
        });
        it("should allow fullfill request", async () => {
            const { agent, owner } = await loadFixture(deploy);

            // expect(await agent.oracleAddress()).to.equal("0x0000000000000000000000000000000000000000");
            const url = "https://th.bing.com/th/id/OIP.rxDyOLAWDKXJGVB8PSmd8AAAAA?rs=1&pid=ImgDetMain";
            const response = await agent.attemptFullfillTask(1, [url]);
            expect(response).to.equal(true);
        });
    });

    describe("Playing", function () {
        it("Should start game with 2 messages", async () => {
            const { agent, oracle, owner } = await loadFixture(deploy);

            await agent.startGame()
            const messages = await oracle.getMessages(0, 0);
            const roles = await oracle.getRoles(0, 0);

            expect(messages.length).to.equal(3);
            expect(roles.length).to.equal(3);
            expect(messages[0]).to.equal(PROMPT);
            expect(roles[0]).to.equal("system");
            expect(messages[1]).to.equal("Start now!");
            expect(roles[1]).to.equal("user");
        });
        it("Oracle can respond", async () => {
            const {
                agent,
                oracle,
                allSigners
            } = await loadFixture(deploy);

            const oracleAccount = allSigners[6];
            await oracle.updateWhitelist(oracleAccount, true);

            await agent.startGame();
            await oracle.connect(oracleAccount).addGroqResponse(
                0,
                0,
                {
                    id: "123",
                    content: "oracle response",
                    created: 1337,
                    model: "mixtral-8x7b-32768",
                    systemFingerprint: "asd",
                    object: "chat.completion",
                    completionTokens: 12,
                    promptTokens: 4,
                    totalTokens: 16,
                },
                ""
            );

            const messages = await oracle.getMessages(0, 0);
            const roles = await oracle.getRoles(0, 0);

            expect(messages.length).to.equal(4);
            expect(messages[3]).to.equal("oracle response");
            expect(roles[3]).to.equal("assistant");
        });
        it("Oracle can respond to multiple games", async () => {
            const {
                agent,
                oracle,
                allSigners
            } = await loadFixture(deploy);

            const oracleAccount = allSigners[6];
            await oracle.updateWhitelist(oracleAccount, true);

            await agent.startGame();
            await oracle.connect(oracleAccount).addGroqResponse(
                0,
                0,
                {
                    id: "123",
                    content: "oracle response",
                    created: 1337,
                    model: "mixtral-8x7b-32768",
                    systemFingerprint: "asd",
                    object: "chat.completion",
                    completionTokens: 12,
                    promptTokens: 4,
                    totalTokens: 16,
                },
                ""
            );

            await agent.startGame();
            await oracle.connect(oracleAccount).addGroqResponse(
                1,
                1,
                {
                    id: "123",
                    content: "oracle response2",
                    created: 1337,
                    model: "mixtral-8x7b-32768",
                    systemFingerprint: "asd",
                    object: "chat.completion",
                    completionTokens: 12,
                    promptTokens: 4,
                    totalTokens: 16,
                },
                ""
            );

            const messages = await oracle.getMessages(1, 1);
            const roles = await oracle.getRoles(1, 1);

            expect(messages.length).to.equal(4);
            expect(messages[3]).to.equal("oracle response2");
            expect(roles[3]).to.equal("assistant");
        });
        it("User can select answer", async () => {
            const {
                agent,
                oracle,
                allSigners
            } = await loadFixture(deploy);

            const oracleAccount = allSigners[6];
            await oracle.updateWhitelist(oracleAccount, true);

            await agent.startGame();
            await oracle.connect(oracleAccount).addGroqResponse(
                0,
                0,
                {
                    id: "123",
                    content: "oracle response",
                    created: 1337,
                    model: "mixtral-8x7b-32768",
                    systemFingerprint: "asd",
                    object: "chat.completion",
                    completionTokens: 12,
                    promptTokens: 4,
                    totalTokens: 16,
                },
                ""
            );
            const gameId: number = 0;
            await agent.addSelection(2, gameId);

            const messages = await oracle.getMessages(0, gameId);
            const roles = await oracle.getRoles(0, gameId);

            expect(messages.length).to.equal(5);
            expect(messages[4]).to.equal("C");
            expect(roles[4]).to.equal("user");

            const game = await agent.games(0);

            expect(game.isFinished).to.equal(false);
        });
        it("Game is finished", async () => {
            const {
                agent,
                oracle,
                allSigners
            } = await loadFixture(deploy);

            const oracleAccount = allSigners[6];
            await oracle.updateWhitelist(oracleAccount, true);

            await agent.startGame();
            await oracle.connect(oracleAccount).addGroqResponse(
                0,
                0,
                {
                    id: "123",
                    content: "oracle response\nYour HP: 0",
                    created: 1337,
                    model: "mixtral-8x7b-32768",
                    systemFingerprint: "asd",
                    object: "chat.completion",
                    completionTokens: 12,
                    promptTokens: 4,
                    totalTokens: 16,
                },
                ""
            );
            const gameId: number = 0;

            const game = await agent.games(0);

            expect(game.isFinished).to.equal(true);
        });
        it("Adds image generation function call", async () => {
            const {
                agent,
                oracle,
                allSigners
            } = await loadFixture(deploy);

            const oracleAccount = allSigners[6];
            await oracle.updateWhitelist(oracleAccount, true);

            await agent.startGame();
            await oracle.connect(oracleAccount).addGroqResponse(
                0,
                0,
                {
                    id: "123",
                    content: "oracle response\n<IMAGE fun image\n",
                    created: 1337,
                    model: "mixtral-8x7b-32768",
                    systemFingerprint: "asd",
                    object: "chat.completion",
                    completionTokens: 12,
                    promptTokens: 4,
                    totalTokens: 16,
                },
                ""
            );

            const functionInput = await oracle.functionInputs(0);

            expect(functionInput).to.equal("<IMAGE fun image");
        });
        it("Does not add image generation function call", async () => {
            const {
                agent,
                oracle,
                allSigners
            } = await loadFixture(deploy);

            const oracleAccount = allSigners[6];
            await oracle.updateWhitelist(oracleAccount, true);

            await agent.startGame();
            await oracle.connect(oracleAccount).addGroqResponse(
                0,
                0,
                {
                    id: "123",
                    content: "oracle response\n",
                    created: 1337,
                    model: "mixtral-8x7b-32768",
                    systemFingerprint: "asd",
                    object: "chat.completion",
                    completionTokens: 12,
                    promptTokens: 4,
                    totalTokens: 16,
                },
                ""
            );

            const functionsCount = await oracle.functionsCount();

            expect(functionsCount).to.equal(0);
        });
        it("Adds image url to list", async () => {
            const {
                agent,
                oracle,
                allSigners
            } = await loadFixture(deploy);

            const oracleAccount = allSigners[6];
            await oracle.updateWhitelist(oracleAccount, true);

            await agent.startGame();
            await oracle.connect(oracleAccount).addGroqResponse(
                0,
                0,
                {
                    id: "123",
                    content: "asd\n<IMAGE Description\n",
                    created: 1337,
                    model: "mixtral-8x7b-32768",
                    systemFingerprint: "asd",
                    object: "chat.completion",
                    completionTokens: 12,
                    promptTokens: 4,
                    totalTokens: 16,
                },
                ""
            );
            await oracle.connect(oracleAccount).addFunctionResponse(0, 0, "URL", "");

            const game = await agent.games(0);
            const images = await agent.getImages(0);
            expect(game.imagesCount).to.equal(1);
            expect(images[0]).to.equal("URL");
        });
        it("Adds error image url to list", async () => {
            const {
                agent,
                oracle,
                allSigners
            } = await loadFixture(deploy);

            const oracleAccount = allSigners[6];
            await oracle.updateWhitelist(oracleAccount, true);

            await agent.startGame();
            await oracle.connect(oracleAccount).addGroqResponse(
                0,
                0,
                {
                    id: "123",
                    content: "asd\n<IMAGE Description\n",
                    created: 1337,
                    model: "mixtral-8x7b-32768",
                    systemFingerprint: "asd",
                    object: "chat.completion",
                    completionTokens: 12,
                    promptTokens: 4,
                    totalTokens: 16,
                },
                ""
            );
            await oracle.connect(oracleAccount).addFunctionResponse(0, 0, "", "Error");

            const game = await agent.games(0);
            const images = await agent.getImages(0);
            expect(game.imagesCount).to.equal(1);
            expect(images[0]).to.equal("error");
        });
    });

    describe("Errors", function () {
        it("Cannot add multiple responses", async () => {
            const {
                agent,
                oracle,
                allSigners
            } = await loadFixture(deploy);

            const oracleAccount = allSigners[6];
            await oracle.updateWhitelist(oracleAccount, true);

            await agent.startGame();
            await oracle.connect(oracleAccount).addGroqResponse(
                0,
                0,
                {
                    id: "123",
                    content: "oracle response",
                    created: 1337,
                    model: "mixtral-8x7b-32768",
                    systemFingerprint: "asd",
                    object: "chat.completion",
                    completionTokens: 12,
                    promptTokens: 4,
                    totalTokens: 16,
                },
                ""
            );
            const randomAddress = allSigners[7];
            await agent.setOracleAddress(randomAddress);
            await expect(
                agent.connect(randomAddress).onOracleGroqLlmResponse(0,
                    {
                        id: "123",
                        content: "oracle response 2",
                        created: 1337,
                        model: "mixtral-8x7b-32768",
                        systemFingerprint: "asd",
                        object: "chat.completion",
                        completionTokens: 12,
                        promptTokens: 4,
                        totalTokens: 16,
                    },
                    "")
            ).to.be.revertedWith("No message to respond to");
        })
        it("Cannot add selection for finished game", async () => {
            const {
                agent,
                oracle,
                allSigners
            } = await loadFixture(deploy);

            const oracleAccount = allSigners[6];
            await oracle.updateWhitelist(oracleAccount, true);

            await agent.startGame();
            await oracle.connect(oracleAccount).addGroqResponse(
                0,
                0,
                {
                    id: "123",
                    content: "oracle response HP: 0",
                    created: 1337,
                    model: "mixtral-8x7b-32768",
                    systemFingerprint: "asd",
                    object: "chat.completion",
                    completionTokens: 12,
                    promptTokens: 4,
                    totalTokens: 16,
                },
                ""
            );
            await expect(
                agent.addSelection(3, 0)
            ).to.be.revertedWith("Game is finished");
        })
        it("Cannot add invalid selection", async () => {
            const {
                agent,
                oracle,
                allSigners
            } = await loadFixture(deploy);

            const oracleAccount = allSigners[6];
            await oracle.updateWhitelist(oracleAccount, true);

            await agent.startGame();
            await oracle.connect(oracleAccount).addGroqResponse(
                0,
                0,
                {
                    id: "123",
                    content: "oracle response",
                    created: 1337,
                    model: "mixtral-8x7b-32768",
                    systemFingerprint: "asd",
                    object: "chat.completion",
                    completionTokens: 12,
                    promptTokens: 4,
                    totalTokens: 16,
                },
                ""
            );
            await expect(
                agent.addSelection(8, 0)
            ).to.be.revertedWith("Selection needs to be 0-3");
        })
    })
});
