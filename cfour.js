Games = new Meteor.Collection('games');

if (Meteor.isClient) {
  Meteor.subscribe('games');
  
  /**
   * Returns the user's current game if it exists.
   */
  function getCurrentGame() {
    var game = null;
    var user = Meteor.user();
    
    if (user && user.profile && user.profile.game) {
      game = Games.findOne({_id: user.profile.game});
    }
    
    return game;
  }
  
  /**
   * Returns data about the given game's next turn.
   *
   * @param game The game
   *
   * @return a structure containing the player and color of the next turn.
   */
  function getNextTurn(game) {
    //use the number of chips to determine the next player
    var chipCount = 0;
    game.board.forEach(function(tile) {
      if (tile.state !== 'clear') {
        chipCount += 1;
      }
    });

    var turn;
    if (chipCount % 2 == 0) {
      //red turn
      turn = {
        player: game.player1,
        color: 'red'
      };
    } else {
      //black turn
      turn = {
        player: game.player2,
        color: 'black'
      };
    }
    
    return turn;
  }
  
  function abandonCurrentGame() {
    var game = getCurrentGame();
    if (game && game.state === 'active') {
      //set the current game to abandoned
      Games.update({_id: game._id}, {
        $set: {
          state: 'abandoned'
        }
      });
    }
  }
  
  /**
   * Returns a list of the available games. This includes those that are have onloy one player and that player is not the current user.
   */
  Template.games.list = function() {
    var list = [];
    var user = Meteor.user();
    
    if (user) {
      list = Games.find({
        'state': 'active',
        'player1.id': {$ne: user._id}, 
        'player2': null
      }).fetch();
    }
    
    return list;
  };
  
  /**
   * Event handlers
   */
  Template.games.events({
    /** Handle clicking the New Game link */
    'click #idNewGame': function () {
      var user = Meteor.user();
      
      if (user) {
        abandonCurrentGame();
        
        // setup a new board, all clear
        var i;
        var b = new Array(42);
        for (i = 0; i < b.length; i += 1) {
          b[i] = {
            state: 'clear',
            column: (i%7)
          };
        }

        var gameId = Games.insert({
          board: b,
          player1: {
            id: user._id,
            name: user.emails[0].address
          },
          player2: null,
          started: new Date(),
          state: 'active'
        });

        //put the game id in the user's profile
        Meteor.users.update({_id: user._id}, {
          $set: {profile: {game: gameId}}
        });
      }
    },
    /** Habndle a click on a game in the games list */
    'click ul.games-list a': function() {
      var game = this;
      var user = Meteor.user();
      
      if (user && game) {
        abandonCurrentGame();
        
        Meteor.users.update({_id: user._id}, {
          $set: {profile: {game: game._id}}
        });

        Games.update({_id: game._id}, {
          $set: {
            player2: {
              id: user._id,
              name: user.emails[0].address
            }
          }
        });
      }
    }
  });
  
  /**
   * Add the current game info to the template.
   */
  Template.board.game = getCurrentGame;
  
  /**
   * Returns a string describing the status of the game.
   */
  Template.board.status = function() {
    var status = '', game = getCurrentGame(), user = Meteor.user();
    if (game) {
      if (game.state === 'abandoned') {
        status = 'The game was abandoned by one of the players.';
      } else if (game.state === 'full') {
        status = 'Game over. Nobody wins.';
      } else if (game.state === 'red') {
        if (user._id === game.player1.id) {
          status = 'Game over. You win!';
        } else {
          status = 'Game over. You lose.';
        }
      } else if (game.state === 'black') {
        if (user._id === game.player2.id) {
          status = 'Game over. You win!';
        } else {
          status = 'Game over. You lose.';
        }
      } else if (!game.player2) {
        status = 'Waiting for another player to join the game.';
      } else {
        var turn = getNextTurn(game);
        if (turn.player.id === user._id) {
          status = "It's your turn.";
        } else {
          status = "It's " + turn.player.name + "'s turn.";
        }
      }
    }
    return status;
  };
  
  /**
   * Returns a list of rows in the game board.
   */
  Template.board.rows = function() {
    var i;
    var game = Template.board.game();
    var rows = [];
    
    for (i = 0; i < 42; i += 7) {
      rows.push(game.board.slice(i, i+7));
    }
    
    return rows;
  };
  
  /**
   * Event handlers
   */
  Template.board.events({
    /** Handle a click on a clear circle */
    'click .game-rack .circle.clear': function() {
      var user = Meteor.user();
      
      if (user) {
        var game = Template.board.game();
        
        if (game.player2) {
          if (game.state === 'active') {
            var turn = getNextTurn(game);

            if (turn.player.id === user._id) {
              //drop the chip
              var i, j;
              for (i = 35; i >= 0; i -= 7) {
                if (game.board[i+this.column].state === 'clear') {
                  console.log((i+this.column) + ': ' + turn.color);

                  game.board[i+this.column].state = turn.color;

                  var state, clearCount = 0;
                  for (j = 0; j < game.board.length; j += 1) {
                    state = game.board[j].state;

                    if (state !== 'clear') {
                      //horizontal win
                      if (game.board[j].column <= 3 && 
                          state === game.board[j+1].state &&
                          state === game.board[j+2].state &&
                          state === game.board[j+3].state) {
                        game.board[j].state = state + ' win';
                        game.board[j+1].state = game.board[j].state;
                        game.board[j+2].state = game.board[j].state;
                        game.board[j+3].state = game.board[j].state;

                        break;
                      } 
                      //vertical win
                      else if (j <= 20 &&
                                 state === game.board[j+7].state &&
                                 state === game.board[j+14].state &&
                                 state === game.board[j+21].state) {
                        game.board[j].state = state + ' win';
                        game.board[j+7].state = game.board[j].state;
                        game.board[j+14].state = game.board[j].state;
                        game.board[j+21].state = game.board[j].state;

                        break;
                      }
                      //diagonal nw to se
                      else if (j <= 17 &&
                               game.board[j].column <= 3 &&
                               state === game.board[j+8].state &&
                               state === game.board[j+16].state &&
                               state === game.board[j+24].state) {
                        game.board[j].state = state + ' win';
                        game.board[j+8].state = game.board[j].state;
                        game.board[j+16].state = game.board[j].state;
                        game.board[j+24].state = game.board[j].state;

                        break;
                      }
                      //diagonal sw to ne
                      else if (j > 17 &&
                               game.board[j].column <= 3 &&
                               state === game.board[j-6].state &&
                               state === game.board[j-12].state &&
                               state === game.board[j-18].state) {
                        game.board[j].state = state + ' win';
                        game.board[j-6].state = game.board[j].state;
                        game.board[j-12].state = game.board[j].state;
                        game.board[j-18].state = game.board[j].state;

                        break;
                      }
                    } else {
                      clearCount += 1;
                    }
                  }

                  if (j === game.board.length) {
                    if (clearCount === game.board.length) {
                      state = 'full'
                    } else {
                      state = 'active';
                    }
                  }

                  Games.update({_id: game._id}, {
                    $set: {
                      board: game.board,
                      state: state
                    }
                  });
                  break;
                }
              }
            } /*else {
              console.log("Wait your turn");
            }*/
          } /*else {
            console.log('The game has ended');
          }*/
        } /*else {
          console.log("The game hasn't started");
        }*/
      }
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    Games.allow({
      insert: function (userId, game) {
        return true;
      },
      update: function (userId, game) {
        return userId && (
          (game.player1 && game.player1.id === userId) ||
          (game.player2 && game.player2.id === userId) ||
          (!game.player2)
        );
      }
    });
    
    Meteor.publish('games', function () {
      return Games.find();
    });
  });
}
