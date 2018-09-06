var app = require('express')();
var express = require('express');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 11000;
var bodyParser = require('body-parser')
var redis = require('redis');
var mysql = require('mysql');
var morgan = require('morgan')

// JSON parser
app.use(bodyParser.json());
// Server Logging
app.use(morgan(':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :response-time ms - :res[content-length] ":referrer" ":user-agent"'));

// Redis Client
var redis_client = redis.createClient(6379, '127.0.0.1');

// Mysql Client
var pool  = mysql.createPool({
  connectionLimit : 50,
  host            : '127.0.0.1',
  user            : 'root',
  password        : 'EstaTrivialDb!',
  database        : 'trivias_near'
});

// Helper Functions

// Delete all the players who got the question wrong
function deletePlayers(player_array){
  for(var i=0; i<player_array.length; i++)
  {
      var tmp_key = player_array[i];

      redis_client.del(tmp_key, function(err, reply) {
          if(err)
          {
            console.log("Error deleting key: " +tmp_key)
          }
          else
          {
            console.log("Key deleted: " +tmp_key)
          }
      });
  }
}

// LB Health Check
app.get('/', function(req, res){
  res.send('health check')
});

// Trivias Near - Posting a new question
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

// Trivias Near - Verify Question
app.post('/verify', function(req, res){

  var last_question = req.body
  var players_redis_key_wrong_answer = [];

  redis_client.keys("player_*", function(err, keys) {

    for(var i=0;i<keys.length;i++){

      var tmp_key = keys[i];
      console.log("Player Object: " +tmp_key)

      redis_client.hgetall(tmp_key, function(err, object) {

        // Delete Player Key from Redis
        if(object.answer != last_question.answer)
        {

          console.log("Wrong Answer: " +tmp_key)
          players_redis_key_wrong_answer.push(tmp_key)
          //redis_client.del(tmp_key, function(err, reply) {
            //  if(err)
              //{
                //console.log("Error deleting key: " +tmp_key)
              //}
          //});
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

        if( (keys.length - players_redis_key_wrong_answer.length) == 1)
        {
            console.log("WE HAVE A WINNER")

            var winner_player = keys[0]
            winner_player = winner_player.split("player_")[1]
            var winner_msg = "Felicidades, " +winner_player +" ganaste Trivias Near!"

            last_question["final_message"] = winner_msg
            last_question["tie"] = 0

            io.emit('end_game',last_question)

            // Delete all players who got the question wrong
            deletePlayers(players_redis_key_wrong_answer);

            var user_query = "select Max(id) as id from trivias_prizes"

            pool.query(user_query, function (error, results, fields) {
              if (error)
              {
                console.log(error)
              }
              else
              {
                
                var user_query = "Update trivias_prizes SET player_winner=? Where id=?"
                var query_values = [winner_player,results[0].id]

                pool.query(user_query, query_values , function (error, results, fields) {
                  if (error)
                  {
                    console.log(error)
                  }
                  else
                  {
                    console.log(results)
                  }
                });
              }
            });


        }
        else if( (keys.length - players_redis_key_wrong_answer.length) == 0)
        {
            console.log("Everybody was incorrect")

            last_question["final_message"] = "Nadie obtuvo la respuesta correcta, sigamos jugando"
            last_question["tie"] = 1

            io.emit('verify_answer',last_question)
        }
        else
        {
            last_question["tie"] = 0
            io.emit('verify_answer',last_question)

            // Delete all players who got the question wrong
            deletePlayers(players_redis_key_wrong_answer);
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
