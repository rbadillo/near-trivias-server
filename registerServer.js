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

  var response = {
    "msg":""
  }

  var user_query = "Select country_name from global_countries"

  pool.query(user_query, function (error, results, fields) {
    if (error)
    {
      console.log(error)
      response['msg']="Hubo un error en el servidor, por favor intenta de nuevo"
      res.status(500).json(response)
    }
    else if(results.length)
    {
      res.status(200).json(results)
    }
    else
    {
      console.log(results)
      response['msg']="Hubo un error en el servidor, por favor intenta de nuevo"
      res.status(400).json(response)
    }
  });
});

app.get('/states', function(req, res){

  var country = req.query.country
  var user_query = ""

  if(country=="Mexico")
  {
    user_query = "Select state_name from mx_states"
  }
  else if(country=="USA")
  {
    user_query = "Select state_name from us_states"
  }

  var response = {
    "msg":""
  }

  pool.query(user_query, function (error, results, fields) {
    if (error)
    {
      console.log(error)
      response['msg']="Hubo un error en el servidor, por favor intenta de nuevo"
      res.status(500).json(response)
    }
    else if(results.length)
    {
      res.status(200).json(results)
    }
    else
    {
      console.log(results)
      response['msg']="Hubo un error en el servidor, por favor intenta de nuevo"
      res.status(400).json(response)
    }
  });
});

app.get('/cities', function(req, res){

  var country = req.query.country
  var state = req.query.state
  var user_query = ""

  if(country=="Mexico")
  {
    user_query = "Select mxc.city_name from mx_cities mxc, mx_states mxs WHERE mxc.id_state = mxs.id AND mxs.state_name=? order by mxc.city_name"
  }
  else if(country=="USA")
  {
    user_query = "Select usc.city_name from us_cities usc, us_states uss WHERE usc.id_state = uss.id AND uss.state_name=? order by usc.city_name"
  }

  var query_values = [state]

  var response = {
    "msg":""
  }

  pool.query(user_query, query_values, function (error, results, fields) {
    if (error)
    {
      console.log(error)
      response['msg']="Hubo un error en el servidor, por favor intenta de nuevo"
      res.status(500).json(response)
    }
    else if(results.length)
    {
      res.status(200).json(results)
    }
    else
    {
      console.log(results)
      response['msg']="Hubo un error en el servidor, por favor intenta de nuevo"
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

  var user_query = "Select id from users where email = ? and password = ? and is_enabled=1"
  var query_values = [player_email,player_password]

  console.log("Query: ",user_query)
  console.log("Query values: ",query_values)

  pool.query(user_query, query_values , function (error, results, fields) {
    if (error)
    {
      console.log(error)
      response['msg']="Hubo un error en el servidor, por favor intenta de nuevo."
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
      response['msg']="El usuario no existe, la contraseña es incorrecta\no la cuenta no ha sido verificada."
      console.log(response)
      res.status(400).json(response)
    }
  });
});

// Player Register
app.post('/register', function(req, res){

  var name=req.body.name
  var lastname=req.body.lastname
  var age=req.body.age
  var email=req.body.email
  var country=req.body.country
  var state=req.body.state
  var city=req.body.city
  var password=req.body.password
  console.log(req.body)

  var response = {
    "msg":""
  }

  var user_query = "Select email from users where email=?"
  var query_values = [email]

  pool.query(user_query, query_values , function (error, results, fields) {
    if (error)
    {
      console.log(error)
      response['msg']="Hubo un error en el servidor, por favor intenta de nuevo"
      res.status(500).json(response)
    }
    else if(results.length==1)
    {
      response['msg']="Lo sentimos pero un usuario con ese\ncorreo electrónico ya fue registrado"
      res.status(400).json(response)
    }
    else
    {
      var user_query = "Insert into users (name,last_name,age,email,password,country,state,city) VALUES (?,?,?,?,?,?,?,?)"
      var query_values = [name,lastname,age,email,password,country,state,city]

      console.log("Query: ",user_query)
      console.log("Query values: ",query_values)

      pool.query(user_query, query_values , function (error, results, fields) {
        if (error)
        {
          console.log(error)
          response['msg']="Hubo un error en el servidor, por favor intenta de nuevo"
          res.status(500).json(response)
        }
        else
        {
          response['msg']="Tu cuenta ha sido creada exitosamente.\nPor favor confirma tu cuenta\ndando click en el link enviado\na tu correo electrónico"
          res.status(200).json(response)
        }
      });
    }
  });
});


http.listen(port, function(){
  console.log('registerServer listening on *:' + port);
});



