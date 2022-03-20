import React, { useEffect, useMemo } from "react";
import Phaser from "phaser";
import "./Game.css";
import { GameWebsocket } from "./GameWebsocket";
import { SharedState } from "./SharedState";

export default function Game(props) {
  const NECESSARY_PROPS = ["width", "height"];

  // Check if all necessary props are present
  const missingProps = NECESSARY_PROPS.filter(prop => !props.hasOwnProperty(prop));
  if (missingProps.length > 0) {
    throw new Error(`Missing props: ${missingProps.join(", ")}`);
  }

  const [renderedOnce, setRenderedOnce] = React.useState(false);
  const [game, setGame] = React.useState(null);
  const [sharedState, setSharedState] = React.useState(null);
  const [loggedIn, setLoggedIn] = React.useState(false);
  const Login = useMemo(() => {return () => setLoggedIn(true)}, [setLoggedIn])
  const GameSocket = useMemo(() => new GameWebsocket({url: "ws://localhost:9090/", onlogin: Login}), [Login]);

  
  // 0 init, 1 running, 2 error
  const [loadingState, SetLoadingState] = React.useState(0);

  useEffect(() => {
    if(!sharedState) return;
    sharedState.loggedIn = loggedIn;
    sharedState.loadingState = loadingState;
  }, [loggedIn, loadingState, sharedState]);


  useEffect(() => {
    console.log("SIGNER", props.signer);
    if(!GameSocket || !props.signer) return;
    // Intiate login process
    GameSocket.Login(props.signer).catch(err => {
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
      const _state = new SharedState({
        loadingState,
        GameSocket
      });
      GameSocket.SetSharedState(_state);
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
              return update.bind(this)(ms, _state)
            },
          },
        }),
      );
      setSharedState(_state);
    }
  }, [renderedOnce, props.width, props.height, loggedIn]);

  useEffect(() => setRenderedOnce(true), []);

  return (
    <div className="game">
      <div id="game-container" />
      <div className="game-overlay">
        <div className="col">
        {!loggedIn ? <button onClick={() => {
          GameSocket.Login(props.signer).catch(console.error);
        }}>LOGIN</button> : null}
        </div>
      </div>
    </div>
  );

  function preload() {}

  function create() {
    if(!sharedState) return;
    const BACKGROUND = 0x0c0b0b;
    const KEYBOARD = this.input.keyboard;

    this.add.rectangle(
      this.sys.game.config.width / 2,
      this.sys.game.config.height / 2,
      this.sys.game.config.width,
      this.sys.game.config.height,
      BACKGROUND,
    );

    KEYBOARD.on("keydown", event => {
      sharedState.UpdateKey(event.key.toLowerCase(), true)
    });
    KEYBOARD.on("keyup", event => {
      sharedState.UpdateKey(event.key  .toLowerCase(), false)
    });
  }

  function update(time, SHAREDSTATE) {
    if(!SHAREDSTATE) return;
    if(SHAREDSTATE.loadingState == 0 && SHAREDSTATE.loggedIn) {
      SetLoadingState(1);
      StartGame(this);
    }

    DrawPlayers(this);

    function DrawPlayers(GAME) {
      const PLAYERS = SHAREDSTATE.$players.getValue();
      PLAYERS.forEach(player => {
        // if player isnt spawned, create game object
        if(!player.isSpawned()) {
          console.log("adding rectangle", player);
          const gameObject = GAME.add.rectangle((GAME.sys.game.config.width / 2) + (player.x), (GAME.sys.game.config.height / 2) + (player.y), 24, 24, 0x00ff00);
          player.setGameObject(gameObject);
        } else {
          player.UpdatePosition(GAME);
        }
      });
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
