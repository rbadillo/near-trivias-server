var app = require('express')();
var express = require('express');
var http = require('http').Server(app);
var port = process.env.PORT || 12000;
var bodyParser = require('body-parser')
var sha256 = require('js-sha256');
var mysql = require('mysql');
var uuid=require('uuid')
var nodemailer = require('nodemailer');
var fs = require('fs');
var path = require('path');

// Global variables
var html_template = ""
var email_transporter = null

// Mysql
var pool  = mysql.createPool({
  connectionLimit : 50,
  host            : '127.0.0.1',
  user            : 'root',
  password        : 'EstaTrivialDb!',
  database        : 'trivias_near'
});

// JSON parser
app.use(bodyParser.json());

// LB Health Check
app.get('/', function(req, res){
  res.send('health check')
});

app.get('/nextgame', function(req, res){

  var response = {
    "msg":""
  }

  var user_query = "select prize_date,prize_description,streaming_id from trivias_prizes order by id DESC LIMIT 1"

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

app.get('/leaderboard', function(req, res){

  var response = {
    "msg":""
  }

  var user_query = "select player_winner,prize_description,DATE_FORMAT(when_created,'%d/%b/%Y') as date \
  from trivias_prizes where player_winner is not null"

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

app.get('/activate', function(req,res){

  var player_uuid = req.query.uuid

  if(player_uuid==null || player_uuid == "")
  {
    console.log("player_uuid is null or empty")
    res.sendFile(path.join(__dirname+'/public/error.html'));
  }
  else
  {
    var user_query = "Select id from users where register_uuid=? and is_enabled=0"
    var query_values = [player_uuid]

    //console.log("Query: ",user_query)
    //console.log("Query values: ",query_values)

    pool.query(user_query, query_values , function (error, results, fields) {
      if (error)
      {
        console.log("Error searching for user")
        console.log(error)
        res.sendFile(path.join(__dirname+'/public/error.html'));
      }
      else if(results.length == 1)
      {

        var user_query = "Update users set is_enabled=1 where id=?"
        var query_values = [results[0].id]
        pool.query(user_query, query_values , function (error, results, fields) {
          if (error)
          {
            console.log("Error activating user account")
            console.log(error)
            res.sendFile(path.join(__dirname+'/public/error.html'));
          }
          else
          {
            res.sendFile(path.join(__dirname+'/public/registration_complete.html'));
          }
        })
      }
      else
      {
          var user_query = "Select id from users where register_uuid=? and is_enabled=1"
          var query_values = [player_uuid]

          //console.log("Query: ",user_query)
          //console.log("Query values: ",query_values)

          pool.query(user_query, query_values , function (error, results, fields) {
            if (error)
            {
              console.log("Error searching for user")
              console.log(error)
              res.sendFile(path.join(__dirname+'/public/error.html'));
            }
            else if(results.length == 1)
            {
              res.sendFile(path.join(__dirname+'/public/registration_complete.html'));
            }
            else
            {

              console.log("registration_uuid not found")
              console.log(results)
              res.sendFile(path.join(__dirname+'/public/error.html'));
            }
          })
        }
    });
  }
})

// Player Login
app.post('/login', function(req, res){

  var player_email = req.body.email 
  var player_password = req.body.password

  var response = {
    "msg":""
  }

  var user_query = "Select id from users where email = ? and password = ? and is_enabled=1"
  var query_values = [player_email,player_password]

  //console.log("Query: ",user_query)
  //console.log("Query values: ",query_values)

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
      response['msg']="El usuario no existe, la contraseña es incorrecta\no la cuenta no ha sido activada."
      console.log(response)
      res.status(400).json(response)
    }
  });
});

// Player Forgot Password
app.post('/forgotpassword', function(req, res){

  var player_email = req.body.email 

  var response = {
    "msg":""
  }

  var user_query = "Select id,register_uuid from users where email = ?"
  var query_values = [player_email]

  //console.log("Query: ",user_query)
  //console.log("Query values: ",query_values)

  pool.query(user_query, query_values , function (error, results, fields) {
    if (error)
    {
      console.log(error)
      response['msg']="Hubo un error en el servidor, por favor intenta de nuevo."
      res.status(500).json(response)
    }
    else if(results.length == 1)
    {

        var register_uuid = results[0].register_uuid
        var player_link_activation = "http://register-trivias.descubrenear.com/resetpassword?uuid=" +register_uuid
        html_template = html_template.replace("<USER_MSG>", "Gracias por registrarte en Trivias Near, da click en el link para cambiar tu contraseña.")
        html_template = html_template.replace("<USER_LINK>", player_link_activation)
        html_template = html_template.replace("<USER_BUTTON_MSG>", "Cambiar Contraseña")

        var mailOptions = {
          from: 'no-reply@descubrenear.com', // sender address
          to: player_email, // list of receivers
          subject: 'Cambio de contraseña - Trivias Near', // Subject line
          html: html_template
        }

        email_transporter.sendMail(mailOptions, function (error, info) {
           if(error)
           {
              console.log(error)
              response['msg']="Hubo un error en el servidor, por favor intenta de nuevo"
              res.status(500).json(response)
           }
           else
           {
              //console.log(info);
              response['msg']="Tu cuenta ha sido validada exitosamente.\nPara cambiar tu contraseña da click en el link\n enviado a tu correo electrónico.\n\nSi el correo no se encuentra en tu bandeja\nde entrada, revisa el correo no deseado."
              res.status(200).json(response)
           }
        });

    }
    else
    {
      console.log(results)
      response['msg']="El usuario no existe, verifica la dirección\nde correo electrónico."
      console.log(response)
      res.status(400).json(response)
    }
  });
});

app.get('/resetpassword', function(req,res){

  res.sendFile(path.join(__dirname+'/public/reset_password.html'));

})

app.post('/resetpassword', function(req,res){

  var player_uuid = req.query.uuid
  var password=req.body.password

  var response = {
    "msg":""
  }

  if(player_uuid==null || player_uuid == "")
  {
    console.log("player_uuid is null or empty")
    response['msg']="El link utilizado para cambiar la contraseña es inválido"
    res.status(400).json(response)
  }
  else
  {
    var user_query = "Select id,email from users where register_uuid=?"
    var query_values = [player_uuid]

    //console.log("Query: ",user_query)
    //console.log("Query values: ",query_values)

    pool.query(user_query, query_values , function (error, results, fields) {
      if (error)
      {
        console.log("Error searching for user")
        console.log(error)
        response['msg']="Hubo un error en el servidor, por favor intenta de nuevo"
        res.status(500).json(response)
      }
      else if(results.length == 1)
      {

        var user_query = "Update users set password=?, register_uuid=? where id=? and email=?"
        var new_register_uuid = uuid.v1()
        var query_values = [password,new_register_uuid, results[0].id,results[0].email]

        pool.query(user_query, query_values , function (error, results, fields) {
          if (error)
          {
            console.log("Error updating user password")
            console.log(error)
            response['msg']="Hubo un error en el servidor, por favor intenta de nuevo"
            res.status(500).json(response)
          }
          else
          {
            response['msg']="Tu contraseña ha sido actualizada exitosamente.\n\nRegresa al App para seguir concursando."
            res.status(200).json(response)
          }
        })
      }
      else
      {
        response['msg']="El link utilizado para cambiar la contraseña es inválido"
        res.status(400).json(response)
      }
    });
  }
})

// Player Register
app.post('/register', function(req, res){

  var name=req.body.name
  var lastname=req.body.lastname
  var nickname=req.body.nickname
  var age=req.body.age
  var email=req.body.email
  var country=req.body.country
  var state=req.body.state
  var city=req.body.city
  var password=req.body.password
  var register_uuid= uuid.v1()
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
      var user_query = "Insert into users (name,last_name,nickname,age,email,password,country,state,city,register_uuid) VALUES (?,?,?,?,?,?,?,?,?,?)"
      var query_values = [name,lastname,nickname,age,email,password,country,state,city,register_uuid]

      //console.log("Query: ",user_query)
      //console.log("Query values: ",query_values)

      pool.query(user_query, query_values , function (error, results, fields) {
        if (error)
        {
          console.log(error)
          response['msg']="Hubo un error en el servidor, por favor intenta de nuevo"
          res.status(500).json(response)
        }
        else
        {

          var player_link_activation = "http://register-trivias.descubrenear.com/activate?uuid=" +register_uuid
          html_template = html_template.replace("<USER_MSG>", "Gracias por registrarte en Trivias Near, da click en el link para activar tu cuenta.")
          html_template = html_template.replace("<USER_LINK>", player_link_activation)
          html_template = html_template.replace("<USER_BUTTON_MSG>", "Activar Cuenta")

          var mailOptions = {
            from: 'no-reply@descubrenear.com', // sender address
            to: email, // list of receivers
            subject: 'Bienvenido a Trivias Near', // Subject line
            html: html_template
          }

          email_transporter.sendMail(mailOptions, function (error, info) {
             if(error)
             {
                console.log(error)
                response['msg']="Hubo un error en el servidor, por favor intenta de nuevo"
                res.status(500).json(response)
             }
             else
             {
                //console.log(info);
                response['msg']="Tu cuenta ha sido creada exitosamente.\nPor favor activa tu cuenta\ndando click en el link enviado\na tu correo electrónico.\n\nSi el correo no se encuentra en tu bandeja\nde entrada, revisa el correo no deseado."
                res.status(200).json(response)
             }
          });
        }
      });
    }
  });
});


http.listen(port, function(){

  html_template = fs.readFileSync("./email_template.html","utf8").toString();

  email_transporter = nodemailer.createTransport({
    host: 'divox.com.mx',
    port: 587,
    secure: false, // true for 465, false for other ports
     auth: {
            user: 'no-reply@descubrenear.com',
            pass: 'EstaTrivialMail!'
        }
  });

  // Verify email server connection configuration
  email_transporter.verify(function(error, success) {
     if (error)
     {
        console.log("Error connecting to email server")
        console.log(error);
        process.exit(1);
     }
     else 
     {
        console.log('registerServer listening on *:' + port);
        console.log('Email server is ready to take our messages');
     }
  });
});



