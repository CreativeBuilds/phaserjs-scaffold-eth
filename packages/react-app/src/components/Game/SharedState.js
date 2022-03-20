import { BehaviorSubject } from "rxjs";
import { map, debounceTime, filter } from "rxjs/operators";

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

class Player extends Entity {

  /**
   * @description takes a phaser game object and updates state
   * @param {Phaser.GameObject} gameObject
   */
  setGameObject(gameObject) {
    this._gameObject = gameObject;
  }

  UpdatePosition(GAME) {
    this._gameObject.x = (GAME.sys.game.config.width / 2) + (this.x * 24);
    this._gameObject.y = (GAME.sys.game.config.height / 2) + (this.y * 24);
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
        player.x = player.position.x;
        player.y = player.position.y;
      }
    });
    

    const old_players = players.map(player => {
      const PLAYER_EXISTS = players_who_moved.find(p => p.address === player.id);
      if (PLAYER_EXISTS) {
        player.x = PLAYER_EXISTS.position.x;
        player.y = PLAYER_EXISTS.position.y;
      }
      return player;
    });
    const ALL_PLAYERS = [...old_players, ...new_players];
    console.log("ALL PLAYERS", ALL_PLAYERS);
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
      filter(val => Object.keys(val).length > 0),
      debounceTime(20)
    )
      .subscribe(val => {
        this.GameSocket.SendPlayerMovement(val);
      });
  }
}
