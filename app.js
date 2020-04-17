var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var lessMiddleware = require('less-middleware');
var logger = require('morgan');
var config = require('./config.json')
var session = require('express-session');
var  fileUpload=require('express-fileupload')
const socket=require("./handlers/socketHandler")

var knex = require('knex')({
  client: 'pg',
  version: '7.2',
  connection:config.pgConnection
});

var meetingRouter = require('./routes/meeting');
var apiRouter = require('./routes/meetingApi');

const pgSession = require('connect-pg-simple')(session);
const pgStoreConfig = {conObject: config.pgConnection}

var app = express();

app.use(session({
  secret: (config.sha256Secret),
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 1 * 24 * 60 * 60 * 1000 }, // 1 days
  store:new pgSession(pgStoreConfig),
}));

app.use(fileUpload({
  limits: { fileSize: 1024 * 1024 * 1024 },
  useTempFiles : true,
  tempFileDir : path.join(__dirname, 'public/files'),
  safeFileNames: true
}));


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use('/meeting',express.static(path.join(__dirname, 'public')));

app.use("/", (req,res, next)=>{req.knex=knex;next();});
app.use('/meeting', meetingRouter);
app.use('/meeting/api', apiRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});

app.onListen=(server)=>{
  var sockServer= new socket(server, knex);
}

module.exports = app;
