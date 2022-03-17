import React, { useEffect, useMemo } from "react";
import Phaser from "phaser";
import "./Game.css";
import { GameWebsocket } from "./GameWebsocket";

/**
 * @description Used to share information between React and Phaser
 *              without instatiating a new object
 */
class SharedState {
  constructor(obj = {}) {
    for(let key in obj) {
      this[key] = obj[key];
    }
  }
}


export default function Game(props) {
  const NECESSARY_PROPS = ["width", "height"];

  // Check if all necessary props are present
  const missingProps = NECESSARY_PROPS.filter(prop => !props.hasOwnProperty(prop));
  if (missingProps.length > 0) {
    throw new Error(`Missing props: ${missingProps.join(", ")}`);
  }

  const [renderedOnce, setRenderedOnce] = React.useState(false);
  const [game, setGame] = React.useState(null);
  const [info, setInfo] = React.useState(null);
  const [loggedIn, setLoggedIn] = React.useState(false);
  const Login = useMemo(() => {return () => setLoggedIn(true)}, [setLoggedIn])
  const GameSocket = useMemo(() => new GameWebsocket("ws://localhost:9090/", Login), [Login]);

  
  // 0 init, 1 running, 2 error
  const [loadingState, SetLoadingState] = React.useState(0);

  useEffect(() => {
    if(!info) return;
    info.loggedIn = loggedIn;
    info.loadingState = loadingState;
  }, [loggedIn, loadingState, info]);


  useEffect(() => {
    console.log("SIGNER", props.signer);
    if(!GameSocket || !props.signer) return;
    // Intiate login process
    GameSocket.login(props.signer).catch(err => {
      console.log("Error logging in", err);
    });
  }, [GameSocket, props.signer])

  useEffect(() => {
    console.log("Game!: ", game);
  }, [game]);

  /**
   * After frist render, create a new game object whenever width/height changes but not before removing the last
   */
  useEffect(() => {
    if (renderedOnce) {
      if (game) {
        game.destroy();
        document.getElementById("game-container").innerHTML = "";
      }
      const info = new SharedState({
        loadingState
      });
      setGame(
        new Phaser.Game({
          type: Phaser.AUTO,
          width: props.width,
          height: props.height,
          parent: "game-container",
          scene: {
            preload: preload,
            create: create,
            update: function (ms) {
              return update.bind(this)(ms, info)
            },
          },
        }),
      );
      setInfo(info);
    }
  }, [renderedOnce, props.width, props.height, loggedIn]);

  useEffect(() => setRenderedOnce(true), []);

  useEffect(() => {
    if(!info) return;
    setInterval(() => {info[1] += "a"}, 1000)
  }, [info])

  return (
    <div className="game">
      <div id="game-container" />
      <div className="game-overlay">
        <div className="col">
        {!loggedIn ? <button onClick={() => {
          GameSocket.login(props.signer).catch(console.error);
        }}>LOGIN</button> : null}
        </div>
      </div>
    </div>
  );

  function preload() {}

  function create() {
    const BACKGROUND = 0x0c0b0b;
    this.add.rectangle(
      this.sys.game.config.width / 2,
      this.sys.game.config.height / 2,
      this.sys.game.config.width,
      this.sys.game.config.height,
      BACKGROUND,
    );
  }

  function update(time, info) {
    const GAME = this;
    if(info.loadingState == 0 && info.loggedIn) {
      SetLoadingState(1);
      StartGame(this);
    }
  }

  function StartGame(GAME) {
    // blue background
    console.log("STARTED GAME")
    const BACKGROUND = 0x0c0b2b;
    GAME.add.rectangle(
      GAME.sys.game.config.width / 2,
      GAME.sys.game.config.height / 2,
      GAME.sys.game.config.width,
      GAME.sys.game.config.height,
      BACKGROUND,
    );
  }
}
