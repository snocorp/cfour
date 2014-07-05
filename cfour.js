Games = new Meteor.Collection('games');

if (Meteor.isClient) {
  Template.games.list = function() {
    var list = [];
    var user = Meteor.user();
    
    if (user) {
      list = Games.find({'player1.id': {$ne: user._id}, 'player2.id': {$ne: user._id}}).fetch();
    }
    
    return list;
  };
  
  Template.games.events({
    'click #idNewGame': function () {
      var user = Meteor.user();
      
      var i;
      var b = new Array(49);
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
        started: new Date()
      });
      
      Meteor.users.update({_id: user._id}, {
        $set: {profile: {game: gameId}}
      });
    },
    'click ul.games-list a': function() {
      var game = this;
      var user = Meteor.user();
      
      if (user && game) {
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
  
  Template.board.game = function() {
    var game = null;
    var user = Meteor.user();
    
    if (user && user.profile && user.profile.game) {
      game = Games.findOne({_id: user.profile.game});
    }
    
    return game;
  };
  
  Template.board.rows = function() {
    var i;
    var game = Template.board.game();
    var rows = [];
    
    for (i = 0; i < 49; i += 7) {
      rows.push(game.board.slice(i, i+7));
    }
    
    return rows;
  };
  
  Template.board.events({
    'click .game-rack .circle.clear': function() {
      var user = Meteor.user();
      
      if (user) {
        var game = Template.board.game();
        
        var chipCount = 0;
        game.board.forEach(function(tile) {
          if (tile.state !== 'clear') {
            chipCount += 1;
          }
        });
        
        var player;
        var color;
        if (chipCount % 2 == 0) {
          //red turn
          player = game.player1;
          color = 'red';
        } else {
          player = game.player2;
          color = 'black';
        }
        
        if (player.id === user._id) {
          //drop the chip
          var i;
          for (i = 42; i >= 0; i -= 7) {
            if (game.board[i+this.column].state === 'clear') {
              console.log((i+this.column) + ': ' + color);
              
              game.board[i+this.column].state = color;
              Games.update({_id: game._id}, {
                $set: {board: game.board}
              });
              break;
            }
          }
        } else {
          console.log("Wait your turn");
        }
      }
    }
  });
}

if (Meteor.isServer) {
  Meteor.startup(function () {
    // code to run on server at startup
  });
}
