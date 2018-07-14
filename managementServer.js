var app = require('express')();
var express = require('express');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 11000;
var bodyParser = require('body-parser')
var redis = require('redis');

app.use(bodyParser.json());
var redis_client = redis.createClient(6379, '127.0.0.1');

var last_question = null;
var active_players = {};

var player_object = {
  "answer": 0,
  "last_msg": null
}

var players_answer_distribution = {
  "1": "0",
  "2": "0",
  "3": "0",
  "4": "0"
}

// LB Health Check
app.get('/', function(req, res){
  res.send('health check')
});

// Trivia Near - Posting a new question
app.post('/', function(req, res){

  redis_client.exists('is_game_on', function(err, reply){
    if(err)
    {
      console.log("Error verifying key in redis cache: is_game_on")
    }
    else if (reply == 1)
    {
      console.log('is_game_on key already exist in Redis Cache');
    } 
    else 
    {
      redis_client.set('is_game_on',1);
    }

    redis_client.keys("player_*", function(err, keys) {

      for(var i=0;i<keys.length;i++){
          console.log("Initializing Player Object: " +keys[i])
          redis_client.hmset(keys[i], {
              'answer': "0",
              'last_msg': "null"
          });
      }

      // Emit question
      io.emit('question',req.body);
      res.end();
    })
  });
});

app.post('/verify', function(req, res){

  var last_question = req.body

  redis_client.keys("player_*", function(err, keys) {

    for(var i=0;i<keys.length;i++){

      var tmp_key = keys[i];
      console.log("Player Object: " +tmp_key)

      redis_client.hgetall(tmp_key, function(err, object) {

        if(object.answer != last_question.answer)
        {

          console.log("Game over for: " +tmp_key)
          redis_client.del(tmp_key, function(err, reply) {
              if(err)
              {
                console.log("Error deleting key: " +tmp_key)
              }
          });
        }
      });
    }

    redis_client.hgetall('players_answer_distribution', function(err, object) {

      var max_length = object["1"].length;

      for(var key in object){
        if(object[key].length>max_length)
        {
          max_length = object[key].length
        }
      }

      for(var key in object){
        if(object[key].length<max_length)
        {
          var tmp = object[key]
          tmp = tmp.padStart(max_length,"0")
          object[key] = tmp
        }
      }

      last_question["answer_distribution"] = object

      console.log("answer_distribution")
      console.log(object)

      redis_client.keys("player_*", function(err, keys) {

        console.log(keys)
        console.log(keys.length)

        if(keys.length==1)
        {
          console.log("WE HAVE A WINNER")

          var winner_player = keys[0].split("player_")[0]
          var winner_msg = "Felicidades, " +winner_player +" ganaste Trivias Near!"

          last_question["final_message"] = winner_msg

          //var winner_user = Object.keys(active_players)
          //active_players[winner_user[0]].last_msg = winner_msg

          io.emit('end_game',last_question)
        }
        else if(keys.length==0)
        {
          console.log("WE HAVE A TIE")

          last_question["final_message"] = "Lo sentimos pero tuvimos un empate"

          io.emit('end_game',last_question)
        }
        else
        {
          io.emit('verify_answer',last_question)
        }

        redis_client.hmset('players_answer_distribution', {
            '1': 0,
            '2': 0,
            '3': 0,
            '4': 0,
        });

        res.end();
      })
    });
  })

    /*
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
    */

    /*
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
    */

    /*
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
    */

})

io.on('connection', function(socket){

  var client_address = socket.handshake.address;
  console.log('New appServer connection from: ' +client_address);

  socket.on('disconnect', function(){
    var del_client_address = socket.handshake.address;
    console.log("appServer disconnected: "+del_client_address)
  });

});

http.listen(port, function(){
  redis_client.on('connect', function() {
    console.log('managementServer listening on *:' + port);
    console.log('Connected to redis server');

    redis_client.exists('active_players_count', function(err, reply){
      if(err)
      {
        console.log("Error verifying key in redis cache: active_players_count")
      }
      else if (reply == 1)
      {
        console.log('active_players_count key already exist in Redis Cache');
      } 
      else 
      {
        redis_client.set('active_players_count',0);
      }
    });

    redis_client.exists('players_answer_distribution', function(err, reply){
      if(err)
      {
        console.log("Error verifying key in redis cache: players_answer_distribution")
      }
      else if (reply == 1)
      {
        console.log('players_answer_distribution key already exist in Redis Cache');
      } 
      else 
      {
        redis_client.hmset('players_answer_distribution', {
            '1': 0,
            '2': 0,
            '3': 0,
            '4': 0,
        });
      }
    });
  });
});
