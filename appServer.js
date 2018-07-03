var app = require('express')();
var express = require('express');
var http = require('http').Server(app);
var io = require('socket.io')(http);
var port = process.env.PORT || 10000;
var bodyParser = require('body-parser')
var moment = require('moment')

app.use(bodyParser.json());

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

  io.emit('contest',req.body);
  last_question = req.body
  res.end();

  is_game_on = true

  console.log("Set Timeout")

  setTimeout(function () {

  	  console.log("Fire Timeout")

      io.emit('timeout',last_question)
      
  }, 10000)
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

    // WE HAVE A WINNER
    if(Object.keys(active_players).length == 1)
    {
      console.log("WE HAVE A WINNER")

      var winner_player = Object.keys(active_players)[0]

      last_question["final_message"] = "Felicidades, " +winner_player +" ganaste Trivias Near!"

      var winner_user = Object.keys(active_players)
      active_players[winner_user[0]].last_msg = winner.msg

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

    res.end();

})

app.post('/answer', function(req, res){

  console.log("Answer")
  console.log(req.body)

  var user = req.body.user;
  var answer = req.body.answer;

  active_players[user].answer = answer;

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

io.on('connection', function(socket){

  console.log("User Connected")

  var player = socket.handshake.query.username

  if(!is_game_on && !active_players.hasOwnProperty(player))
  {
    console.log("Adding Player to active_players")
    var plyr_object = Object.assign({}, player_object);
    active_players[player] = plyr_object;
  }

  if(is_game_on && !active_players.hasOwnProperty(player))
  {

    console.log("Sorry, You are late: " +player)
    last_question["sorry"] = "Sorry, you can't play tonight. Enjoy the game!"

    socket.emit("game_is_already_on",last_question)
  }

  if(is_game_on && last_question!=null && active_players.hasOwnProperty(player) && active_players[player].last_msg!=null)
  {
    console.log("This user already submitted an answer")

   var answer_submitted = Object.assign({}, last_question);
   answer_submitted["msg"] = active_players[player].last_msg

   console.log(answer_submitted)

    setTimeout(function () {
          socket.emit('answer_already_submitted',answer_submitted)
    }, 50)
  }
  else if(is_game_on && last_question!=null && active_players.hasOwnProperty(player))
  {
    console.log("Emiting Last Question")
    console.log(last_question)

    setTimeout(function () {
          socket.emit('contest',last_question)
    }, 50)
  }

  console.log("Active Players")
  console.log(active_players)
});

// Active Players
setInterval(function () {
    active_players_count["count"]=Object.keys(active_players).length
    io.emit('active_players_count',active_players_count)
}, 10000)


http.listen(port, function(){
  console.log('appServer listening on *:' + port);
});
