require('babel-register'); // This will let us require() files with JSX!

/*
  PASSWORDS
*/
// NOTE: read everything we have to say about not implementing your own user management ;)

var bcrypt = require('bcrypt'); // hashes passwords "securely"
var secureRandom = require('secure-random'); // generates arrays of "secure random" numbers

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
    // VIRTUAL means it won't be stored
    password: {
        type: Sequelize.VIRTUAL,
        set: function(actualPassword) {
            this.setDataValue('hashed_password', hashPassword(actualPassword));
        }
    }
});

// Even though the content belongs to users, we will setup the userId relationship later
var Content = db.define('content', {
    url: {
        type: Sequelize.STRING,
        // Look at the validator.js library for these options
        validate: {
            isURL: {
                args: {
                    protocols: ['http', 'https'],
                    require_protocol: true
                }
            },
            notEmpty: true
        }
    },
    title: {
        type: Sequelize.STRING,
        validate: {
            notEmpty: true
        }
    }
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
Content.belongsTo(User); // This will let us include: User in Content.findAll

User.hasMany(Session); // This will let us do user.createSession
Session.belongsTo(User); // This will let us do Session.findOne({include: User})

Content.belongsToMany(User, {
    through: Vote,
    as: 'Votes'
});
Content.hasMany(Vote); // This will let us retrieve the sum of votes per content
User.hasMany(Vote); // This will let us do user.findVote

// db.sync(); // only run this once. try to figure out migrations manually (alter tables)

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
app.use(bodyParser.urlencoded({
    extended: true
}));
app.use(cookieParser());
// Middleware run in the order we add them. Since checkLogin uses cookies,
// we are including it AFTER the cookieParser middleware
app.use(function checkLoginTokenAndMaybeSetLoggedInUser(request, response, next) {

    // if there's a session cookie
    if (request.cookies && request.cookies.SESSION) {
        Session.findOne({
            where: {
                token: request.cookies.SESSION
            },
            include: User
        }).then(
            function(sessionObj) {
                // if session cookie is valid, set currentUser on request object
                if (sessionObj && sessionObj.user) {
                    request.currentUser = sessionObj.user;
                }
                else {
                    // if session cookie is invalid, clear it!
                    response.clearCookie('SESSION');
                }
                next();
            },
            // if session retrieval failed, let them through as anonymous
            function(error) {
                console.error(error);
                next();
            }
        );
    }
    else {
        // if we don't find the session cookie, call next to move on
        next();
    }
});

/*
  ROUTES
*/

// homepage
var HomePage = require('./components/HomePage');
app.get('/', function(request, response) {

    Content.findAll({
        include: [{
            model: Vote, // include Vote so we can SUM over the voteDirection
            attributes: [] // we don't need the actual Vote attributes
        }, {
            model: User,
            attributes: ['username'] // include creator User's username for display
        }],
        group: 'id', // group by content id so the SUM works
        attributes: {
            include: [
                // Sequelize.fn will simly output the requested SQL function
                // voteScore will be the sum's alias
                [Sequelize.fn('SUM', Sequelize.col('voteDirection')), 'voteScore']
            ]
        },
        // if two posts have the same score, order by created date
        order: [Sequelize.literal('voteScore DESC'), ['createdAt', 'DESC']],
        limit: 25,
        subQuery: false // necessary for limit to work properly (ask me why in class)
    }).then(
        function(contents) {
            // before passing our data to the UI, we map it to something flat and simple
            contents = contents.map(
                function(item) {
                    item = item.toJSON();
                    return {
                        id: item.id,
                        url: item.url,
                        title: item.title,
                        postedBy: item.user && item.user.username || 'Anonymous',
                        voteScore: item.voteScore || 0
                    }
                }
            );

            // we pass the data to our view's rendering function and get back an HTML string
            var html = HomePage.renderToHtml({
                layout: {
                    title: 'Welcome to Reddit clone!',
                    loggedIn: request.currentUser && request.currentUser.toJSON()
                },
                homepage: {
                    contents: contents
                }
            });

            // output the HTML for this page inside the layout.ejs in the views directory
            response.render('layout', {
                content: html
            });
        }
    )

});

// login
var Login = require('./components/Login');
app.get('/login', function(request, response) {
    // if already logged in, you have nothing to do here
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

    response.render('layout', {
        content: html
    });
});
app.post('/login', function(request, response) {
    if (request.currentUser) {
        response.redirect('/');
        return;
    }

    var username = (request.body.username || '').trim();
    var password = request.body.password;

    // find existing user with this username
    if (username && password) {
        User.findOne({
            where: {
                username: username
            }
        }).then(
            function(userObj) {
                // if username exists, compare passwords
                if (userObj) {
                    if (comparePasswordToHash(password, userObj.hashed_password)) {
                        // calling createSession on the user will associate userId
                        userObj.createSession({
                            token: createSessionToken()
                        }).then(
                            function(session) {
                                // if session is created, set session token for future requests
                                response.cookie('SESSION', session.token);
                                // on the next request to /, the user will be authenticated!
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

    response.render('layout', {
        content: html
    });
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
                // if creating the user failed because of UniqueConstraint, then tell them username exists
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

    response.render('layout', {
        content: html
    });
});
app.post('/createContent', function(request, response) {
    if (!request.currentUser) {
        response.redirect('/login?error=Login to add a post');
        return;
    }

    var url = request.body.url && request.body.url.trim();
    var title = request.body.title && request.body.title.trim();
    if (url && title) {
        request.currentUser.createContent({
            url: request.body.url,
            title: request.body.title
        }).then(
            function(content) {
                response.redirect('/');
            },
            function(error) {
                console.error(error);
                if (error.message.indexOf('isURL') >= 0) {
                    response.redirect('/createContent?error=Invalid URL!');
                }
                else {
                    response.redirect('/createContent?error=Unknown error. Try again later');
                }
            }
        )
    }
    else {
        response.redirect('/createContent?error=URL and title required');
    }
});

// vote
app.post('/vote', function(request, response) {
    if (!request.currentUser) {
        response.redirect('/login?message=Login to vote');
        return;
    }

    var contentId = request.body.contentId;
    var voteDirection = request.body.voteDirection === '1' ? 1 : -1;

    var contentQuery = Content.findById(contentId);
    var voteQuery = Vote.findOne({
        where: {
            userId: request.currentUser.id,
            contentId: contentId
        }
    });

    Promise.all([contentQuery, voteQuery]).then(
        function(results) {
            var content = results[0],
                vote = results[1];
            if (!content) {
                throw new Error('invalid content id');
            }

            if (vote) {
                var newVoteDirection = voteDirection === vote.voteDirection ? 0 : voteDirection;

                return vote.update({
                    voteDirection: newVoteDirection
                });
            }
            else {
                return request.currentUser.createVote({
                    contentId: contentId,
                    voteDirection: voteDirection
                });
            }
        }
    ).then(
        function(vote) {
            response.redirect('/');
        }
    ).catch(
        function(error) {
            console.error(error);
            response.redirect('/');
        }
    );
});

// logout
app.get('/logout', function(request, response) {
    response.clearCookie('SESSION').redirect('/');
});

// Start the server
app.listen(process.env.PORT);