const BOOT_TIME = Date.now();
const LOG = true;

function clearStoredCache(key) {
  localStorage.removeItem(key);
}

// returns boolean if access token was set
function setCache(key, value, overwrite = false) {
  let exists = localStorage.getItem(key);
  if (exists && !overwrite) {
    return false;
  }
  localStorage.setItem(key, value);
  return true;
}

function UpdateAccessToken(token, address) {
  clearStoredCache("accessToken");
  clearStoredCache("address");
  setCache("accessToken", token, true);
  setCache("address", address, true);
}

export class GameWebsocket extends WebSocket {
  auth; // access token is the auth code
  code; // code to sign to get auth code
  signer; // ethers.Signer
  onlogin = () => {};

  constructor(url, onlogin) {
    if (url.includes("localhost")) console.warn("NOT MEANT FOR PRODUCTION: RUNNING ON LOCALHOST");
    super(url);
    console.log("BOOT WEBSOCKET")
    this.onlogin = onlogin;
    this.onmessage = this.HandleMessage;
  }

  async HandleMessage(message) {
    if (LOG) console.log("Received message: ", message);
    try {
      const MESSAGE = JSON.parse(message.data);
      try {
        switch (MESSAGE.type) {
          case "loginCode":
            this.code = MESSAGE.data.code;
            console.log("GOT CODE", this.code);
            break;
          case "loginSuccess":
            const { address, auth } = MESSAGE.data;
            const ADDR = await this.signer.getAddress();
            if (address != ADDR) throw new Error("Address mismatch!");
            // access token is the auth code
            // it needs to be stored in cache
            UpdateAccessToken(auth, address);
            this.auth = auth;
            console.log("LOGGED IN!")
            this.onlogin();
            break;
          case "loginSuccess":
            break;
        }
      } catch (err) {
        // if address mismatch, clearStoredCache and refresh page, else log error
        if (err.message.includes("Address mismatch!")) this.invalidate_auth(true);
        else console.log(err);
      }
    } catch (err) {
      console.warn("Invalid WS message!");
    }
  }

  async login(signer) {
      if(!signer) throw new Error("No signer!");
    const connected = this.readyState === WebSocket.OPEN;
    console.log("Logging in")
    if (!connected)
      await new Promise((res, rej) => {
        this.onopen = res;
        setTimeout(() => {
          rej("timeout");
        }, 10000);
      });
    if (this.auth) return console.warn("already logged in, please invalidate auth");
    if (this.code) return this.SignAndSendCode();

    this.signer = signer;
    // check cache for access token

    const auth = localStorage.getItem("accessToken");
    const address = localStorage.getItem("address");
    if (!!address && address == signer.address) {
      this.auth = auth;
      return this.SignAndSendCode();
    }
    this.invalidate_auth();

    // ask server for login code
    this.send(
      JSON.stringify({
        type: "getLoginCode",
        data: {
          address: await signer.getAddress(),
        },
      }),
    );
  }

  async SignAndSendCode() {
      console.log(new Error("Shouldbe implemented"))
    if (!this.code) throw new Error("No code!");
    const ADDR = await this.signer.getAddress();
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
    if(!ADDR || ADDR == ZERO_ADDRESS) throw new Error("No address!");
    const code = await this.signer.signMessage(this.code).catch(err => false);
    if (!code) throw new Error("Could not sign code");
    this.send(
      JSON.stringify({
        type: "login",
        data: {
          code: code,
          address: ADDR,
        },
      }),
    );
  }

  invalidate_auth(reload = false) {
    this.auth = undefined;
    this.code = undefined;
    clearStoredCache("accessToken");
    clearStoredCache("address");
    if (reload) window.location.reload();
  }
}
