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

  const [addy, setAddy] = React.useState(null);

  
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

    (async () => {
      if(props.signer && sharedState)
      {
        sharedState.address = await props.signer.getAddress();
        setAddy(sharedState.address);
      }
    })();

  }, [GameSocket, props.signer])



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
    if(SHAREDSTATE.time) SHAREDSTATE.last_frame = SHAREDSTATE.time;
    else SHAREDSTATE.last_frame = time;
    SHAREDSTATE.time = time;
    if(SHAREDSTATE.loadingState == 0 && SHAREDSTATE.loggedIn) {
      SetLoadingState(1);
      StartGame(this);
    }
    
    DrawPlayers(this, SHAREDSTATE);
  }

  function DrawPlayers(GAME, SHAREDSTATE) {
      const PLAYERS = SHAREDSTATE.$players.getValue();
      const HALF_WIDTH = GAME.sys.game.config.width / 2;
      const HALF_HEIGHT = GAME.sys.game.config.height / 2;
      PLAYERS.forEach(player => {
        // if player isnt spawned, create game object
        if(!player.isSpawned()) {
          console.log("adding rectangle", player);
          const UserGroup = GAME.add.group();
          const PlayerBody = GAME.add.circle((HALF_WIDTH) + (player.x), (HALF_HEIGHT) + (player.y), 24, 0x00ff00);
          const FORMATTED_NAME = player.id.substr(0, 5) + "..." + player.id.substr(player.id.length - 3, 3);
          const PlayerTitle = GAME.add.text(PlayerBody.x - ((FORMATTED_NAME.length / 2) * 24), PlayerBody.y - 24, FORMATTED_NAME, {
            fontSize: '20px',
            fill: '#fff'
          });
          UserGroup.add(PlayerBody);
          UserGroup.add(PlayerTitle);
          player.setGameObject(UserGroup);
          if(player.id == addy) {
            // animate camera to player
            const HALF_WIDTH = GAME.sys.game.config.width / 2;
            const HALF_HEIGHT = GAME.sys.game.config.height / 2;
            const x = player.destination?.x || player.x;
            const y = player.destination?.y || player.y;
  
            const CAMERA = GAME.cameras.main;
            const CURRENT_X = CAMERA.worldView.x + HALF_WIDTH;
            const CURRENT_Y = CAMERA.worldView.y + HALF_HEIGHT;
  
            const DISTANCE_X = CURRENT_X - ((x * 24) + HALF_WIDTH);
            const DISTANCE_Y = CURRENT_Y - ((y * 24) + HALF_HEIGHT);
            
            const TOTAL_DISTANCE = Math.sqrt(DISTANCE_X * DISTANCE_X + DISTANCE_Y * DISTANCE_Y);
  
            // have camera tracker player._gameObject
            if(player.isSpawned())
              CAMERA.startFollow(player._gameObject.getChildren()[0], false, 0.85, 0.85);
            // if(TOTAL_DISTANCE < 24) return;
            // else
            // GAME.cameras.main.pan((x * 24) + HALF_WIDTH, (y * 24) + HALF_HEIGHT, 200);
            
          } else {
            console.log(player.id, addy, "mushroom")
          }
        } else {
          player.UpdatePositionOnScreen(GAME, SHAREDSTATE);
        }

        // if player id is our wallet address, center camera on us
        
      });
      
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
