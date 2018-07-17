var app = require('express')();
var express = require('express');
var http = require('http').Server(app);
var port = process.env.PORT || 12000;
var bodyParser = require('body-parser')
var sha256 = require('js-sha256');

app.use(bodyParser.json());

// LB Health Check
app.get('/', function(req, res){
  res.send('health check')
});

// Player Login
app.post('/login', function(req, res){

  res.end()
});

// Player Register
app.post('/register', function(req, res){
  console.log(req.body)
  console.log(sha256("Hello"))
  res.end()
});


http.listen(port, function(){
  console.log('registerServer listening on *:' + port);
});



