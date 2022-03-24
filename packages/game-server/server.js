// generate a simple web socket server that exposes to port 9090
import { ethers } from "ethers";
import WebSocket, { WebSocketServer } from "ws";
import { GetSigner } from "./ethers.js";

const LOG = true;

const wss = new WebSocketServer({ port: 9090 });

const LOGIN_CODES = {};
const ACCESS_TOKENS = {};
const ADDRESS_CONNECTION_MAP = {}; // address -> ws

const PLAYERS = {}; // address -> Player
let LAST_FRAME;

function UpdateGameState() {
		// Run once per 20ms
		const DELTA = 100;
		const DELTA_S = DELTA / 1000;
	``
		// log time since last frame
		const now = Date.now();
		if(!LAST_FRAME) LAST_FRAME = now;

		// Loop through and move all players
		UpdatePlayerPositions(now, DELTA_S);
		

		const END = Date.now();
		const DIFF = END - LAST_FRAME;
		if (DIFF < DELTA) {
			setTimeout(() => {
				LAST_FRAME = Date.now();
				UpdateGameState();
			}, DELTA - DIFF);
		} else {
			console.log("Frame took too long!", DIFF - DELTA);
			LAST_FRAME = Date.now();
			UpdateGameState();
		}
}

function UpdatePlayerPositions(NOW, DELTA_S) {
	let updated_players = [];
	for (const address in PLAYERS) {
		const player = PLAYERS[address];
		// if(NOW - player.movement.last_updated > 250) return;
		const previous_position = {x: player.x, y: player.y};
		player.move(DELTA_S);
		const new_position = {x: player.x, y: player.y};
		const delta = {x: new_position.x - previous_position.x, y: new_position.y - previous_position.y};
		// if moved, log "User moved x:, y: from previous position"
		if (previous_position.x !== new_position.x || previous_position.y !== new_position.y) {
			console.log(player.x, "player")
			updated_players.push(player);
		}
	}

	if(updated_players.length > 0) {
		console.log("Updated player positions", updated_players.length);
		BroadcastPlayerPositions(updated_players);
	}

	// log operations that take more than 2ms
	if(Date.now() - NOW >= 2)
	console.log(`Time to update ${updated_players.length} positions: ${Date.now() - NOW}ms`);
}

function BroadcastPlayerPositions(players) {
	// given a list of player classes, broadcast their positions to anyone within 50 units
	const BROADCAST_RADIUS = 50;
	const BROADCAST_RADIUS_SQ = BROADCAST_RADIUS * BROADCAST_RADIUS;

	let broadcast_players = [];

	for (const address in PLAYERS) {
		const player = PLAYERS[address];
		const player_position = {x: player.x, y: player.y};
		const player_position_sq = player_position.x * player_position.x + player_position.y * player_position.y;
		if (player_position_sq > BROADCAST_RADIUS_SQ) continue;
		
		broadcast_players.push({
			address: address,
			position: player_position,
		})
		
	}

	const message = JSON.stringify({
		type: "updated_positions",
		data: {players: broadcast_players},
	});

	for (const ws of Object.values(ADDRESS_CONNECTION_MAP)) {
		ws.send(message);
	}

}

UpdateGameState();

class Entity {
		id;
		x;
		y;

		constructor(id) {
			this.id = id;
		}

		isSpawned() {
			return this.x !== undefined;
		}
	
		spawn(x, y) {
			this.x = x;
			this.y = y;
		}
}

class Player extends Entity {
	movement = {w: false, a: false, s: false, d: false};	

	/**
	 * @description applies all move speed buffs and then
	 *              moves the user based on their movement
	 */
	move(DELTA_S) {
		const BASE_SPEED = 1 / 1.5 * 24; // 1 square per 1.5 seconds * 24px per square
			
		if(this.movement.d) this.x += MY_SPEED("d");
		if(this.movement.a) this.x -= MY_SPEED("a");
		if(this.movement.s) this.y += MY_SPEED("s");
		if(this.movement.w) this.y -= MY_SPEED("w");

		if(this.x !== 0)
			this.x = Math.floor(this.x * 1000) / 1000;
		if(this.y !== 0)
			this.y = Math.floor(this.y * 1000) / 1000;

		return this;

		function MY_SPEED(direction) {
			return BASE_SPEED * DELTA_S;
		}
	}
}

// when a client connects, send them a message
wss.on("connection", function connection(ws) {
	let PLAYER_ADDRESS;
	let PLAYER;
  // when a client sends a message, broadcast it to everyone else
  ws.on("message", HandleMessage);

  function HandleMessage(buffer) {
	// convert message from buffer to string
	const data = buffer.toString("utf8");
	const message = JSON.parse(data);
	if (LOG) console.log("Received message: ", message);

	try {
	  switch (message.type) {
		case "getLoginCode":
		  GenerateAndSendLoginCode();
		  break;
		case "login":
		  VerifyLoginCode();
		  break;
		case "spawn":
			SpawnPlayer();
			break;
		case "movement":
			MovePlayer();
			break;
	  }
	} catch (err) {
	  console.log(err);
	}

	  function MovePlayer() {
			if(!PLAYER) return;
			if(!message.data.w && !message.data.a && !message.data.s && !message.data.d) {
				if(Date.now() - PLAYERS[PLAYER_ADDRESS].movement.last_updated > 100) {
				// if all false, update, else, return and dont update 
					PLAYERS[PLAYER_ADDRESS].movement =  {
						w: false,
						a: false,
						s: false,
						d: false,
						last_updated: Date.now(),
					}
					return;
				} else {
					setTimeout(() => {
						PLAYERS[PLAYER_ADDRESS].movement =  {
							w: false,
							a: false,
							s: false,
							d: false,
							last_updated: Date.now(),
						}
					}, Date.now() - PLAYERS[PLAYER_ADDRESS].movement.last_updated + 5);
				}
			} else {
				PLAYERS[PLAYER_ADDRESS].movement =  {
					w: message.data.w,
					a: message.data.a,
					s: message.data.s,
					d: message.data.d,
					last_updated: Date.now(),
				}
			}
		}

		function SpawnPlayer() {
			if(!PLAYER_ADDRESS) return;
			if(!!PLAYERS[PLAYER_ADDRESS]) return;

			const player = new Player(PLAYER_ADDRESS);
			PLAYERS[PLAYER_ADDRESS] = player;
			
			const spawnPoint = FindSpawnPoint();
			player.spawn(spawnPoint.x, spawnPoint.y);

			PLAYER = player;
		}

		function FindSpawnPoint() {
			return {x: 0, y: 0};
		}

	  function VerifyLoginCode() {
		  GetLoginCode(message.data.address)
			  .then((code) => Login(ws, message.data.address, message.data.code, code)
			  ).then(() => {PLAYER_ADDRESS = message.data.address})
				.then(() => {
					if(!PLAYER_ADDRESS) return;
					if(!PLAYERS[PLAYER_ADDRESS]) return;
					PLAYER = PLAYERS[PLAYER_ADDRESS];
					}
				)
			  .catch(console.warn);
	  }

	  function GenerateAndSendLoginCode() {
		  GetLoginCode(message.data.address)
			  .then(async (code) => {
				  await ws.send(
					  JSON.stringify({
						  type: "loginCode",
						  data: {
							  code: code,
						  },
					  })
				  );
				  return code;
			  })
			  .catch(console.warn);
	  }
  }
});

async function GetLoginCode(address) {
  // check if user already has a code
  if (!address) throw new Error("No address!");
  if (!!LOGIN_CODES[address]) return LOGIN_CODES[address];
  // generate a new code
  const code = ethers.utils.randomBytes(32);
  const signer = await GetSigner();
  const signedCode = `Let me in!\n\nhash: ${await signer.signMessage(code)}`;
  LOGIN_CODES[address] = signedCode;

  return signedCode;
}

async function Login(ws, address, code, loginCode) {
  if (Object.keys(LOGIN_CODES).length > 10000) {
	console.warn("Too many tokens!");
	return ws.send(
	  JSON.stringify({
		type: "loginFailed",
		data: {
		  message: "Too many tokens!",
		},
	  })
	);
  }
  
  // check that code is signed by address
  const actual_address = ethers.utils.verifyMessage(loginCode, code);

  if (LOGIN_CODES[actual_address] === loginCode) {
	// generate access token
	const signedToken = await GenerateAccessToken();
	// send access token to client
	SendTokenToClient(signedToken);
	HandleLoginOnOtherTabs();
	ADDRESS_CONNECTION_MAP[address] = ws;
  } else {
	LoginFailed();
  }

  delete LOGIN_CODES[address];

	function LoginFailed() {
		console.log("Login failed!", address, actual_address);
		ws.send(
			JSON.stringify({
				type: "loginFailed",
				data: {
					message: "Invalid code",
				},
			})
		);
	}

	function SendTokenToClient(signedToken) {
		console.log("Client is now connected!", address);
		ws.send(
			JSON.stringify({
				type: "loginSuccess",
				data: {
					address: address,
					auth: signedToken,
				},
			})
		);
		LOGIN_CODES[address] = null;
	}

	async function GenerateAccessToken() {
		const accessToken = ethers.utils.randomBytes(32);
		const signer = await GetSigner();
		const signedToken = await signer.signMessage(accessToken);
		ACCESS_TOKENS[address] = signedToken;
		return signedToken;
	}

	function HandleLoginOnOtherTabs() {
		if (ADDRESS_CONNECTION_MAP[address]) {
			ADDRESS_CONNECTION_MAP[address].send(
				JSON.stringify({
					type: "loginOnOtherDevice",
					data: {}
				})
			);
			ADDRESS_CONNECTION_MAP[address].close();
			delete ADDRESS_CONNECTION_MAP[address];
		}
	}
}
