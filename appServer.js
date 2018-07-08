var app = require('express')();
var express = require('express');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var io_client = require('socket.io-client');
var port = process.env.PORT || 10000;
var bodyParser = require('body-parser')
var redis = require('redis');

app.use(bodyParser.json());
var redis_client = redis.createClient(6379, '127.0.0.1');
var mgmt_socket_client = null;

var last_question = null;
var is_game_on= false;
var active_players = {};

var player_object = {
  "answer": 0,
  "last_msg": null
}

var active_players_count = {
  "count":0
}

var players_answer_distribution = {
  "1": "0",
  "2": "0",
  "3": "0",
  "4": "0"
}

// Get Client HTML
app.get('/', function(req, res){
  res.send('health check')
});

// Trivia Near - Posting a new question
app.post('/', function(req, res){

  for(var player in active_players) {
      active_players[player].answer = 0;
      active_players[player].last_msg = null;
  }

  console.log("Active Players After Posting a question")
  console.log(active_players)


});



app.post('/verify', function(req, res){

    for(var player in active_players)
    {
      console.log("Player: " +player +" - Player Answer: " +active_players[player].answer +" - Real Answer: " +last_question.answer)
      if(last_question.answer != active_players[player].answer)
      {
        delete active_players[player]
      }
    }

    console.log("Active Players Count")
    console.log(Object.keys(active_players).length)

    console.log("players_answer_distribution")
    console.log(players_answer_distribution)

    var max_length = players_answer_distribution["1"].length;

    for(var key in players_answer_distribution){
      if(players_answer_distribution[key].length>max_length)
      {
        max_length = players_answer_distribution[key].length
      }
    }

    for(var key in players_answer_distribution){
      if(players_answer_distribution[key].length<max_length)
      {
        var tmp = players_answer_distribution[key]
        tmp = tmp.padStart(max_length,"0")
        players_answer_distribution[key] = tmp
      }
    }

    last_question["answer_distribution"] = players_answer_distribution

    // WE HAVE A WINNER
    if(Object.keys(active_players).length == 1)
    {
      console.log("WE HAVE A WINNER")

      var winner_player = Object.keys(active_players)[0]
      var winner_msg = "Felicidades, " +winner_player +" ganaste Trivias Near!"

      last_question["final_message"] = winner_msg

      var winner_user = Object.keys(active_players)
      active_players[winner_user[0]].last_msg = winner_msg

      io.emit('end_game',last_question)
    } 
    else if(Object.keys(active_players).length == 0)
    {
      console.log("WE HAVE A TIE")

      last_question["final_message"] = "Lo sentimos pero tuvimos un empate"

      io.emit('end_game',last_question)
    }
    else
    {
      io.emit('verify_answer',last_question)
    }

    players_answer_distribution = {
        "1":0,
        "2":0,
        "3":0,
        "4":0
    }

    res.end();

})

app.post('/answer', function(req, res){

  console.log("Answer")
  console.log(req.body)

  var user = req.body.user;
  var answer = req.body.answer;

  active_players[user].answer = answer;

  players_answer_distribution[answer] = (parseInt(players_answer_distribution[answer]) + 1).toString()

  if(active_players[user].last_msg == null)
  {
    var response = {
    	msg : ""
    }

    if(answer == last_question.answer)
    {
    	response.msg = "CONGRATULATIONS, KEEP PLAYING"
    	res.end(JSON.stringify(response))
    }
    else
    {
    	response.msg = "GAME OVER"
    	res.end(JSON.stringify(response))
    }

    active_players[user].last_msg = response.msg
  }

  console.log("Activa Players - After Answer POST")
  console.log(active_players)
});

// Players connecting to play

io.on('connection', function(socket){

  var player = socket.handshake.query.username
  var cache_key = "player_" +player

  console.log("User Connected: " +player +" - cache key: " +cache_key)

  if(!is_game_on)
  {
    redis_client.exists(cache_key, function(err, reply){
      if(err)
      {
        console.log("Error verifying key in redis cache: " +cache_key)
      }
      else if (reply == 1)
      {
          console.log('Player already in Redis Cache');
      } 
      else 
      {
          redis_client.hmset(cache_key, {
              'answer': "0",
              'last_msg': "null"
          });

          redis_client.incr('active_players_count');
      }
    });
  }

  if(is_game_on)
  {
    redis_client.exists(cache_key, function(err, reply){
        if(err)
        {
          console.log("Error verifying key in redis cache: " +cache_key)
        }
        else if (reply == 0)
        {
            console.log('Player is not in redis cache');
            console.log("Sorry, You are late: " +player)
            var late_msg = {
              "sorry_message" : "Lo sentimos pero el juego de esta noche ya comenzó, nos vemos a la próxima!"
            }
            socket.emit("game_is_already_on",late_msg)
        }
    });
  }

  socket.on('disconnect', function(){
    console.log("User disconnected")
    redis_client.decr('active_players_count');
  });
});

// Active Players
setInterval(function () {
    redis_client.get('active_players_count', function(err, reply) {
      if(err)
      {
        console.log("Error retriving active_players_count redis key")
      }
      else if(reply!=null)
      {
        console.log("Emiting active_players_count: " +reply)
        io.emit('active_players_count',reply)
      }
    });
}, 10000)

http.listen(port, function(){
  redis_client.on('connect', function() {
    console.log('appServer listening on *:' + port);
    console.log('Connected to redis server');
  });
});


// Management Server Code
var management_server_url = "http://127.0.0.1:11000"
mgmt_socket_client = io_client(management_server_url)

mgmt_socket_client.on('connect', function(){
  console.log('Connected to Management Server')
})

mgmt_socket_client.on('question', function(msg){

  // Emit question to App
  io.emit('contest',msg);
  last_question = msg

  is_game_on = true

  console.log("Begin Timeout")
  setTimeout(function () {
      console.log("End Timeout")
      // Emit Timeout Signal
      io.emit('timeout',last_question)
  }, 10000)

})
