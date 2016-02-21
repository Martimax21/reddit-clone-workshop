require('babel-register'); // This will let us require() files with JSX!

/*
  PASSWORDS
*/
var bcrypt = require('bcrypt');
var secureRandom = require('secure-random');

function hashPassword(password) {
    return bcrypt.hashSync(password, 10);
}
var comparePasswordToHash = bcrypt.compareSync;
function createSessionToken() {
    return secureRandom.randomArray(40).map(code => code.toString(36)).join('');
}

/*
  DATA MODELS AND RELATIONS
*/
var Sequelize = require('sequelize');
var db = new Sequelize('reddit', 'ziad_saab', '', {
    dialect: 'mysql'
});

var User = db.define('user', {
    username: {
        type: Sequelize.STRING,
        unique: true
    },
    hashed_password: Sequelize.STRING,
    password: {
        type: Sequelize.VIRTUAL,
        set: function(actualPassword) {
            this.setDataValue('hashed_password', hashPassword(actualPassword));
        }
    }
});

// Even though the content belongs to users, we will setup the userId relationship later
var Content = db.define('content', {
    url: Sequelize.STRING,
    title: Sequelize.STRING
});

// Even though a vote has a link to user and content, we will setup the relationship later
// voteDirection will be 1 for upvote and -1 for downvote, allowing for easy SUM()
var Vote = db.define('vote', {
    voteDirection: Sequelize.INTEGER
});

// Sessions will be used to "remember" logged in  users
var Session = db.define('session', {
    token: {
        type: Sequelize.STRING,
        unique: true 
    }
});

User.hasMany(Content); // This will let us do user.addContent

User.hasMany(Session); // This will let us do user.createSession
Session.belongsTo(User); // This will let us do Session.findOne({include: User})

Content.belongsToMany(User, {through: Vote, as: 'Votes'});
Content.hasMany(Vote); // This will let us retrieve the sum of votes per content

// db.sync();

/*
  EXPRESS
*/
// dependencies
var express = require('express');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');

// initialization
var app = express();
app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser());
app.use(function checkLoginTokenAndMaybeSetLoggedInUser(request, response, next) {
   if (request.cookies && request.cookies.SESSION) {
       Session.findOne({
           where: {
               token: request.cookies.SESSION
           },
           include: User
       }).then(
         function(sessionObj) {
             if (sessionObj && sessionObj.user) {
                 request.currentUser = sessionObj.user;
             }
             else {
                 response.clearCookie('SESSION');
             }
             next();
         },
         function(error) {
             console.error(error);
             next();
         }
       );
   }
   else {
       next();
   }
});

/*
  ROUTES
*/

// homepage
var HomePage = require('./components/HomePage');
app.get('/', function(request, response) {
    var html = HomePage.renderToHtml({
        layout: {
            title: 'Welcome to Reddit clone!',
            loggedIn: request.currentUser && request.currentUser.toJSON()
        },
        homepage: {
            contents: []
        }
    });
    
    response.render('layout', {content: html});
});

// login
var Login = require('./components/Login');
app.get('/login', function(request, response) {
    if (request.currentUser) {
        response.redirect('/');
        return;
    }
    
    var html = Login.renderToHtml({
        layout: {
            title: 'Login',
            loggedIn: false
        },
        login: {
            error: request.query.error, // in case we pass an error string
            message: request.query.message // in case we have a message string
        }
    });
    
    response.render('layout', {content: html});
});
app.post('/login', function(request, response) {
    if (request.currentUser) {
        response.redirect('/');
        return;
    }
    
    var username = (request.body.username || '').trim();
    var password = request.body.password;
    
    if (username && password) {
        User.findOne({
            where: {
                username: username
            }
        }).then(
            function(userObj) {
                if (userObj) {
                    if (comparePasswordToHash(password, userObj.hashed_password)) {
                        userObj.createSession({
                            token: createSessionToken()
                        }).then(
                            function(session) {
                                response.cookie('SESSION', session.token);
                                response.redirect('/');
                            },
                            function(error) {
                                console.error(error);
                                response.redirect('/login?error=Unknown error. Please try again later');
                            }
                        );
                    }
                    else {
                        response.redirect('/login?error=Invalid username or password');
                    }
                }
                else {
                    response.redirect('/login?error=Invalid username or password');
                }
            }
        );
    }
    else {
        response.redirect('/login?error=Username and password required.')
    }
});

// signup
var Signup = require('./components/Signup');
app.get('/signup', function(request, response) {
    if (request.currentUser) {
        response.redirect('/');
        return;
    }
    
    var html = Signup.renderToHtml({
        layout: {
            title: 'Signup',
            loggedIn: false
        },
        signup: {
            error: request.query.error // in case we pass an error string
        }
    });
    
    response.render('layout', {content: html});
});
app.post('/signup', function(request, response) {
    if (request.currentUser) {
        response.redirect('/');
        return;
    }
    
    var username = (request.body.username || '').trim();
    var password = request.body.password;
    
    if (username && password) {
        User.create({
            username: username,
            password: password
        }).then(
            function(userObj) {
                response.redirect('/login?message=User has been created. Please login.')
            },
            function(errorObj) {
                if (errorObj.name === 'SequelizeUniqueConstraintError') {
                    response.redirect('/signup?error=Username already exists');
                }
                else {
                    response.redirect('/signup?error=Unexpected server error. Please try again later')
                }
            }
        );
    }
    else {
        response.redirect('/signup?error=username and password must be provided');
    }
});

// create
var CreateContent = require('./components/CreateContent');
app.get('/createContent', function(request, response) {
    if (!request.currentUser) {
        response.redirect('/login?error=Login to add a post');
        return;
    }
    
    var html = CreateContent.renderToHtml({
        layout: {
            title: 'Create a new post',
            loggedIn: request.currentUser && request.currentUser.toJSON()
        },
        createContent: {
            error: request.query.error
        }
    });
    
    response.render('layout', {content: html});
});
app.post('/createContent', function(request, response) {
    if (!request.curentUser) {
        response.redirect('/login?error=Login to add a post');
        return;
    }
});

// vote
app.post('/vote', function(request, response) {
    
});

// Start the server
app.listen(process.env.PORT);