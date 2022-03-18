// generate a simple web socket server that exposes to port 9090
import { ethers } from "ethers";
import WebSocket, { WebSocketServer } from "ws";
import { GetSigner } from "./ethers.js";

const LOG = true;

const wss = new WebSocketServer({ port: 9090 });
let SIGNER; // ethers.Signer

const LOGIN_CODES = {};
const ACCESS_TOKENS = {};
const ADDRESS_CONNECTION_MAP = {}; // address -> ws
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

// when a client connects, send them a message
wss.on("connection", function connection(ws) {

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
      }
    } catch (err) {
      console.log(err);
    }

      function VerifyLoginCode() {
          GetLoginCode(message.data.address)
              .then((code) => Login(ws, message.data.address, message.data.code, code)
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
              .then(console.log.bind(null, `Sent login code to ${message.data.address}!`))
              .catch(console.warn);
      }
  }
});

async function GetLoginCode(address) {
  // check if user already has a code
  console.log(LOGIN_CODES);
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
