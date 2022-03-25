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
  created_at = Date.now();
  arrives_at;
  start_x;
  start_y;
  constructor({x, start_x, y, start_y, arrivesAt, id}) {
    super({x, y, id});
    this.start_x = start_x;
    this.start_y = start_y;
    this.arrives_at = arrivesAt;
  }

  lerp() {
    let t = (Date.now() - this.created_at) / (this.arrives_at - this.created_at);
    if (t > 1) t = 1;
    let x = this.start_x + (this.x - this.start_x) * t;
    let y = this.start_y + (this.y - this.start_y) * t;
    return {x, y}
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
      const {x, y} = this.destination.lerp();

      this.x = x;
      this.y = y;
    }

    if (this._gameObject) {
      const BODY = this._gameObject.getChildren()[0]
      const NAME_PLATE = this._gameObject.getChildren()[1]
      BODY.x = (GAME.sys.game.config.width / 2) + (this.x * 24)
      BODY.y = (GAME.sys.game.config.height / 2) + (this.y * 24)
      NAME_PLATE.x = BODY.x - (NAME_PLATE.width / 2)
      NAME_PLATE.y = BODY.y - (NAME_PLATE.height * 2.5)
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
  address; // the web3 address of the player
  time; // ms since epoch of canvas
  last_frame; // ms of last frame
  $keyboard = new BehaviorSubject({}); //RXJS BehaviorSubject for keyboard input
  $players = new BehaviorSubject([]);
  GameSocket; // ./GameWebsocket.js class object

  constructor(obj = {}) {
    this.address = null;
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
          start_x: PLAYER_EXISTS.x,
          y: player.position.y,
          start_y: PLAYER_EXISTS.y,
          arrivesAt: Date.now() + 95, // 95ms = 1 update
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
