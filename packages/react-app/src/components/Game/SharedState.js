import { BehaviorSubject } from "rxjs";
import { map, debounceTime, filter, distinctUntilChanged } from "rxjs/operators";

class Entity {
  x;
  y;
  id;
  _gameObject;

  constructor({x, y, id}) {
    this.x = x;
    this.y = y;
    this.id = id;
  }
}

class Destination extends Entity {
  arrives_at;
  constructor({x, y, arrivesAt, id}) {
    super({x, y, id});
    this.arrives_at = arrivesAt;
  }
}

class Player extends Entity {
  destination; // Destination object or null
  /**
   * @description takes a phaser game object and updates state
   * @param {Phaser.GameObject} gameObject
   */
  setGameObject(gameObject) {
    this._gameObject = gameObject;
  }

  UpdatePositionOnScreen(GAME, SHAREDSTATE)  {
    const TIME_SINCE_LAST_FRAME = SHAREDSTATE.MSOnLastFrame();
    const DELTA_S = TIME_SINCE_LAST_FRAME / 1000;

    if(this.destination) {
      const DESTINATION_X = this.destination.x;
      const DESTINATION_Y = this.destination.y;
      const DESTINATION_ARRIVES_AT = this.destination.arrives_at;
      const CURRENT_TIME = Date.now();
      const DESTINATION_ARRIVED = CURRENT_TIME >= DESTINATION_ARRIVES_AT + 50;
      if(DESTINATION_ARRIVED) {
        this.destination = null;
        this.x = DESTINATION_X;
        this.y = DESTINATION_Y;
      } else {
        const DESTINATION_X_DELTA = DESTINATION_X - this.x;
        const DESTINATION_Y_DELTA = DESTINATION_Y - this.y;
        this.x += DESTINATION_X_DELTA * DELTA_S * TIME_SINCE_LAST_FRAME;
        this.y += DESTINATION_Y_DELTA * DELTA_S * TIME_SINCE_LAST_FRAME;
      }
    }
    console.log(this.x, this.y);

    if (this._gameObject) {
      let index = 0;
      this._gameObject.getChildren().forEach(part => {
        part.x = (GAME.sys.game.config.width / 2) + (this.x * 24)
        part.y = (GAME.sys.game.config.height / 2) + (this.y * 24)
        index++;
      })
    }
  }

  isSpawned() {
    return !!this._gameObject;
  }
}


/**
 * @description Used to share information between React and Phaser
 *              without instatiating a new object
 */
export class SharedState {
  time; // ms since epoch of canvas
  last_frame; // ms of last frame
  $keyboard = new BehaviorSubject({}); //RXJS BehaviorSubject for keyboard input
  $players = new BehaviorSubject([]);
  GameSocket; // ./GameWebsocket.js class object

  constructor(obj = {}) {
    for (let key in obj) {
      this[key] = obj[key];
    }

    this.SubscribeToPlayerMovement();
    // detect when "enter" is true on $keyboard
    this.$keyboard.pipe(
      filter(({ enter }) => enter),
      debounceTime(100)
    ).subscribe(() => {
      if (this.GameSocket)
        this.GameSocket.SpawnPlayer();
    });
  }

  UpdateKey(key, isPressed = false) {
    const val = this.$keyboard.getValue();
    val[key] = isPressed;
    if (!isPressed)
      delete val[key];
    this.$keyboard.next(val);
  }

  // Takes list of players and updates inner state
  UpdatePlayerPositions(players_who_moved) {
    // {address, position: {x, y}}[]
    const players = this.$players.getValue();
    const new_players = [];
    
    players_who_moved.forEach(player => {
      // Check if they are already in the list, if so update, else spawn player
      const PLAYER_EXISTS = players.find(p => p.id === player.address);
      if (!PLAYER_EXISTS) {
        new_players.push(new Player({x: player.position.x, y: player.position.y, id: player.address}));
      } else {
        // create destination object
        const DESTINATION = new Destination({
          x: player.position.x,
          y: player.position.y,
          arrivesAt: Date.now() + 40, // 95ms = 1 update
        })
        // update player
        PLAYER_EXISTS.destination = DESTINATION;
      }
    });
    

    const old_players = players.map(player => {
      const PLAYER_EXISTS = players_who_moved.find(p => p.address === player.id);
      // if (PLAYER_EXISTS) {
      //   player.x = PLAYER_EXISTS.position.x;
      //   player.y = PLAYER_EXISTS.position.y;
      // }
      return player;
    });
    const ALL_PLAYERS = [...old_players, ...new_players];
    this.$players.next(ALL_PLAYERS);
  }

  SubscribeToPlayerMovement() {
    const MOVEMENT_KEYS = ['a', 'd', 'w', 's'];
    this.$keyboard.pipe(
      map(val => {
        return Object.keys(val).reduce((acc, key) => {
          if (MOVEMENT_KEYS.includes(key)) {
            acc[key] = val[key];
          }
          return acc;
        }, {});
      }),
      distinctUntilChanged((a, b) => JSON.stringify(a) === JSON.stringify(b)),
      debounceTime(20)
    )
      .subscribe(val => {
        this.GameSocket.SendPlayerMovement(val).catch(err => null);
    });
  }

  MSOnLastFrame() {
    if(this.time && this.last_frame)
    return this.time - this.last_frame;
    else return 0;
  }
}
