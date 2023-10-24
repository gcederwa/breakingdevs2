const express = require('express');
const mysql = require("mysql");
const path = require("path");
const dotenv = require('dotenv');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const bodyParser = require('body-parser');
const session = require('express-session');
const { resolveSrv } = require('dns');
const MySQLStore = require('express-mysql-session')(session);
const exphbs = require('express-handlebars');

dotenv.config({ path: './.env'})

const app = express();

app.use(bodyParser.json());
const hbs = exphbs.create({
  helpers: {
    isEqual: function (value1, value2, options) {
      return value1 === value2 ? options.fn(this) : options.inverse(this);
    }
  }
});
const db = mysql.createConnection({
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
})

const dbOptions = {
    host: process.env.DATABASE_HOST,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE
  };

const sessionStore = new MySQLStore({
    clearExpired: true,
    checkExpirationInterval: 900000, // How frequently expired sessions will be cleared (in milliseconds) - 15 minutes in this case
    expiration: 86400000, // The maximum age of a valid session (in milliseconds) - 1 day in this case
    createDatabaseTable: true, // Whether or not to create the sessions table automatically in the database
    connectionLimit: 1, // Number of connections when creating a connection pool
    endConnectionOnClose: true,
    schema: {
      tableName: 'sessions',
      columnNames: {
        session_id: 'session_id',
        expires: 'expires',
        data: 'data'
      }
    }
  }, mysql.createConnection(dbOptions));
  
//Session setup - to keep users signed into website
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    store: sessionStore,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // Session cookie will expire after 30 days (in milliseconds)
      secure: false, // Set to true if using HTTPS
      httpOnly: true
    }
  }));


const publicDir = path.join(__dirname, './public')

app.use(express.static(publicDir))
app.use(express.urlencoded({extended: 'false'}))
app.use(express.json())
app.use(express.static('public'));

app.set('view engine', 'hbs')
app.set('views', __dirname + '/views'); // Specify the directory where your HBS files are located


db.connect((error) => {
    if(error) {
        console.log(error)
    } else {
        console.log("MySQL connected!")
    }
})

app.get('/my-mentees', function(req, res) {
  // Get mentor ID from session
  const mentorId = req.session.userId;
  console.log(mentorId);
  // Query the database to get all mentees of the mentor
  const sql = 'SELECT users.* FROM users JOIN relationships ON users.id = relationships.mentee_id WHERE relationships.mentor_id = ?';
  db.query(sql, [mentorId], function(err, results) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    // If mentees are found, pass them to the template
    const mentees = results ? results : []; // Get the mentees or an empty array if not found

    // Render the my-mentees Handlebars template with the mentees
    res.render('my-mentees', { mentees: mentees, userName : req.session.userName });
  });
});

app.get('/my-mentees/:userId', (req, res) => {
  const menteeId = req.params.userId;
  console.log(menteeId);
  // Query the database to get the Calendly link for the mentee
  const sql = 'SELECT calendly_link FROM users WHERE id = ?';
  db.query(sql, [menteeId], (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    // If a Calendly link is found, pass it to the template
    const calendlyLink = results[0] ? results[0].calendly_link : ''; // Get the Calendly link or an empty string if not found

    // Render the my-mentees Handlebars template with the Calendly link
    res.render('my-mentees', {
      menteeName: req.session.userName, // Replace this with the mentee's name obtained from the database
      calendlyLink: calendlyLink,
    });
  });
});

app.get("/", (req, res) => {
    if (req.session.userName) {
        // User is signed in, render personalized content
        res.render('mentor-dashboard', { userName: req.session.userName });
      } else {
        // User is not signed in, render generic content
        res.render('index');
      }
})

app.get("/menteequestionaire", (req, res) => {
  res.render('menteequestionaire')
})

app.get("/mentorquestionaire", (req, res) => {
  res.render('mentorquestionaire')
})

app.get("/my-mentees", (req, res) => {
    const userName = req.session.userName; // Retrieve the user's name from the session
    res.render("my-mentees", { userName: userName});;
})

app.get("/register", (req, res) => {
    res.render("register")
})

app.get("/login", (req,res) => {
    res.render("login")
})

app.get('/mentor-dashboard', (req, res) => {
    const userName = req.session.userName; // Retrieve the user's name from the session
    res.render('mentor-dashboard', { userName: userName });;
    console.log('User Name:', userName); // Log the user name to the console for debugging
});
  
app.get('/mentee-dashboard', (req, res) => {
    const userName = req.session.userName; // Retrieve the user's name from the session
    const userID = req.session.id;
    res.render('mentee-dashboard', { userName: userName });
    console.log('User Name:', userName); // Log the user name to the console for debugging
});

app.get('/select-mentor', function(req, res) {
  // Query the database to get all mentors
  const sql = 'SELECT * FROM users WHERE role = "mentor"';
  db.query(sql, function(err, results) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    // Render the select-mentor Handlebars template with the mentors
    res.render('select-mentor', { mentors: results , userName : req.session.userName});
  });
});

app.post('/select-mentor', function(req, res) {
  // Get mentor ID from form data
  const mentorId = req.body.mentorId;

  // Get mentee ID from session or wherever it's stored
  const menteeId = req.session.userId;

  // Query the database to set the mentor for the mentee
  const sql = 'INSERT INTO relationships (mentee_ID, mentor_ID) VALUES (?, ?)';
  db.query(sql, [menteeId, mentorId], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    // Redirect to a success page or somewhere else
    res.redirect('my-mentors', {userName : req.session.userName});
  });
});

app.get('/my-mentors', function(req, res) {
  // Get mentee ID from session
  const menteeId = req.session.userId;
  const name = req.session.userName;
  // Query the database to get all mentors of the mentee
  const sql = 'SELECT users.* FROM users JOIN relationships ON users.id = relationships.mentor_id WHERE relationships.mentee_id = ?';
  db.query(sql, [menteeId], function(err, results) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    // If mentors are found, pass them to the template
    const mentors = results ? results : []; // Get the mentors or an empty array if not found

    // Render the my-mentors Handlebars template with the mentors
    res.render('my-mentors', { mentors: mentors, userName : req.session.userName});
  });
});

app.get('/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error('Error destroying session:', err);
      }
      res.redirect('..'); // Redirect to the login page after logout
    });
  });

app.post('/login', (req, res) => {
    const { username, password } = req.body;
  
    db.query('SELECT * FROM users WHERE username = ?', [username], (error, results, fields) => {
      if (error) throw error;
  
      if (results.length > 0) {
        const storedPassword = results[0].password;
        const userRole = results[0].role; // Assuming 'role' is the column name for role in your database
        const userID = results[0].id;
        bcrypt.compare(password, storedPassword, (err, bcryptResult) => {
          if (bcryptResult) {
            // Passwords match, user is authenticated
            // Check user role and redirect accordingly
            const userName = results[0].name;

            req.session.userName = userName; // Store the user's name in the session
            req.session.userRole = userRole;
            req.session.userId = userID; // Store user ID in session
            if (userRole === 'mentor') {
              res.redirect('/mentor-dashboard'); // Redirect mentors to the mentor dashboard
            } else if (userRole === 'mentee') {
              console.log(req.session.userId);
              res.redirect('/mentee-dashboard'); // Redirect mentees to the mentee dashboard
            } else {
              // Handle other roles or unexpected cases
              res.status(401).send('Invalid role');
            }
          } else {
            // Passwords do not match, authentication failed
            res.status(401).send('Authentication failed');
          }
        });
      } else {
        // No user found with the provided username
        res.status(401).send('User not found');
      }
    });
  });

  app.get("/about", (req, res) => {
    if (req.session.userName) {
        // User is signed in, render personalized content
        res.render('about', { userName: req.session.userName });
      } else {
        // User is not signed in, render generic content
        res.render('about');
      }
})


app.post("/auth/register", (req, res) => {    
    const { name, username, password, password_confirm, role, calendlyLink } = req.body

    db.query('SELECT username FROM users WHERE username = ?', [username], async (error, result) => {
        if(error){
            console.log(error)
        }
        if (!username || !password || !role || !name) {
          return res.status(400).json({ error: 'All fields are required' });
        }
        if( result.length > 0 ) {
            return res.render('register', {
                message: 'This username is already in use'
            })
        } else if(password !== password_confirm) {
            return res.render('register', {
                message: 'Password Didn\'t Match!'
            })
        }

        if (role === 'mentee' && !calendlyLink) {
          return res.status(400).json({ error: 'Calendly link is required for mentees' });
        }
        let hashedPassword = await bcrypt.hash(password, 8)

        console.log(hashedPassword)
       
        db.query('INSERT INTO users SET?', {name: name, username: username, password: hashedPassword, role: role, calendly_link: calendlyLink}, (err, result) => {
            if(error) {
                console.log(error)
            } else {
                return res.render('register', {
                    message: 'User registered!'
                })
            }
        })
        if (role === 'mentee') {
          res.redirect('/mentee-dashboard');
        } else if (role === 'mentor') {
          res.redirect('/mentor-dashboard');
        } else {
          // Handle unknown role
          res.status(403).send('Unauthorized');
        }        
    })
})

app.listen(5000, ()=> {
    console.log("server started on port 5000")
})
