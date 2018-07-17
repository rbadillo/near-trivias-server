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

var is_game_on= false;

var active_players_count_timer_interval = 10000
var question_timeout = 7000

// LB Health Check
app.get('/', function(req, res){
  res.send('health check')
});

// Players posting their answers
app.post('/answer', function(req, res){

  console.log("Player Posting Answer")
  console.log(req.body)

  var player = req.body.player;
  var answer = req.body.answer;

  redis_client.hincrby('players_answer_distribution',answer,1)

  var cache_key = "player_" +player

  redis_client.exists(cache_key, function(err, reply){
      if(err)
      {
        console.log("Error verifying key in redis cache: " +cache_key)
      }
      else if (reply == 1)
      {
          console.log('Player exist in Redis Cache');

          redis_client.hmset(cache_key, {
              'answer': answer,
              'last_msg': "null"
          });
      }
      res.end()
  })
});

// Players connecting to play
io.on('connection', function(socket){

  var player = socket.handshake.query.player
  var cache_key = "player_" +player

  console.log("User Connected: " +player +" - cache key: " +cache_key)

  redis_client.exists(cache_key, function(err, reply){
    if(err)
    {
      console.log("Error verifying key in redis cache: " +cache_key)
    }
    else if (reply == 0)
    {
      // Increment count only if player doesn't exist in cache
      redis_client.incr('active_players_count');
    }
  });
  

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
    
    var del_player = socket.handshake.query.player
    var del_cache_key = "player_" +del_player
    redis_client.del(del_cache_key)

    console.log("User disconnected: " +del_player)

    redis_client.get('active_players_count', function(err, reply) {
      if(err)
      {
        console.log("Error retriving active_players_count redis key")
      }
      else if(reply!=null && reply>0)
      {
        redis_client.decr('active_players_count');
      }
    });
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
}, active_players_count_timer_interval)

http.listen(port, function(){
  redis_client.on('connect', function() {
    console.log('appServer listening on *:' + port);
    console.log('Connected to redis server');

    redis_client.exists('is_game_on', function(err, reply){
      if(err)
      {
        console.log("Error verifying key in redis cache: is_game_on")
      }
      else if (reply == 1)
      {
        is_game_on = true
      } 
    });
  });
});


// Management Server Code
var management_server_url = "http://127.0.0.1:11000"
mgmt_socket_client = io_client(management_server_url)

mgmt_socket_client.on('connect', function(){
  console.log('Connected to Management Server')
})

mgmt_socket_client.on('disconnect', function(){
  console.log('Disconnected from Management Server')
})

mgmt_socket_client.on('reconnecting', function(attemptNumber){
  console.log('Reconnecting to Management Server - Attempt: ' +attemptNumber)
});

mgmt_socket_client.on('question', function(msg){

  // Emit question to App
  io.emit('contest',msg);
  var last_question = msg

  if(!is_game_on)
  {
    is_game_on = true
  }

  console.log("Begin Timeout")
  setTimeout(function () {
      console.log("End Timeout")
      // Emit Timeout Signal
      io.emit('timeout',last_question)
  }, question_timeout)
})

mgmt_socket_client.on('verify_answer', function(msg){

  // Emit question verification to App
  io.emit('verify_answer',msg);

})

mgmt_socket_client.on('end_game', function(msg){

  // Emit end game to App
  io.emit('end_game',msg);

})

