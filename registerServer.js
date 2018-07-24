var app = require('express')();
var express = require('express');
var http = require('http').Server(app);
var port = process.env.PORT || 12000;
var bodyParser = require('body-parser')
var sha256 = require('js-sha256');
var mysql = require('mysql');

// Mysql
var pool  = mysql.createPool({
  connectionLimit : 100,
  host            : '127.0.0.1',
  user            : 'root',
  password        : 'EstaTrivialDb!',
  database        : 'trivias_near'
});

app.use(bodyParser.json());

// LB Health Check
app.get('/', function(req, res){
  res.send('health check')
});

app.get('/countries', function(req, res){
  var user_query = "Select country_name from global_countries"

  pool.query(user_query, function (error, results, fields) {
    if (error)
    {
      console.log(error)
      response['msg']="Hubo un error en el servidor obteniendo la lista de paises, por favor intenta de nuevo"
      res.status(500).json(response)
    }
    else if(results.length)
    {
      console.log(results)
      response['msg']="Bienvenido a Trivias Near"
      res.status(200).json(response)
    }
    else
    {
      console.log(results)
      response['msg']="El usuario no existe o la contraseña es incorrecta"
      console.log(response)
      res.status(400).json(response)
    }
  });
});

// Player Login
app.post('/login', function(req, res){

  var player_email = req.body.email 
  var player_password = req.body.password

  var response = {
    "msg":""
  }

  var user_query = "Select id from users where email = ? and password = ? "
  var query_values = [player_email,player_password]

  console.log("Query: ",user_query)
  console.log("Query values: ",query_values)

  pool.query(user_query, query_values , function (error, results, fields) {
    if (error)
    {
      console.log(error)
      response['msg']="Hubo un error en el servidor, por favor intenta de nuevo"
      res.status(500).json(response)
    }
    else if(results.length == 1)
    {
      response['msg']="Bienvenido a Trivias Near"
      res.status(200).json(response)
    }
    else
    {
      console.log(results)
      response['msg']="El usuario no existe o la contraseña es incorrecta"
      console.log(response)
      res.status(400).json(response)
    }
  });
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



