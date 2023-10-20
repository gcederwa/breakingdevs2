const express = require('express');
const mysql = require("mysql");
const path = require("path");
const dotenv = require('dotenv');
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const bodyParser = require('body-parser');
const session = require('express-session');
const hbs = require('ejs');
const { resolveSrv } = require('dns');
const MySQLStore = require('express-mysql-session')(session);

dotenv.config({ path: './.env'})

const app = express();

app.use(bodyParser.json());

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

app.set('view engine', 'hbs')
app.set('views', __dirname + '/views'); // Specify the directory where your HBS files are located


db.connect((error) => {
    if(error) {
        console.log(error)
    } else {
        console.log("MySQL connected!")
    }
})



app.get("/", (req, res) => {
    if (req.session.userName) {
        // User is signed in, render personalized content
        res.render('mentor-dashboard', { userName: req.session.userName });
      } else {
        // User is not signed in, render generic content
        res.render('index');
      }
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
    res.render('mentee-dashboard', { userName: userName });
    console.log('User Name:', userName); // Log the user name to the console for debugging
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
  
        bcrypt.compare(password, storedPassword, (err, bcryptResult) => {
          if (bcryptResult) {
            // Passwords match, user is authenticated
            // Check user role and redirect accordingly
            const userName = results[0].name;

            req.session.userName = userName; // Store the user's name in the session
          
            if (userRole === 'mentor') {
              res.redirect('/mentor-dashboard'); // Redirect mentors to the mentor dashboard
            } else if (userRole === 'mentee') {
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
    const { name, username, password, password_confirm, role } = req.body

    db.query('SELECT username FROM users WHERE username = ?', [username], async (error, result) => {
        if(error){
            console.log(error)
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

        let hashedPassword = await bcrypt.hash(password, 8)

        console.log(hashedPassword)
       
        db.query('INSERT INTO users SET?', {name: name, username: username, password: hashedPassword, role: role}, (err, result) => {
            if(error) {
                console.log(error)
            } else {
                return res.render('register', {
                    message: 'User registered!'
                })
            }
        })        
    })
})

app.listen(5000, ()=> {
    console.log("server started on port 5000")
})
