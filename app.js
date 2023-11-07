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
const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

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
    checkExpirationInterval: 900000, // How frequently expired sessions will be cleared
    expiration: 86400000, // The maximum age of a valid session
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
  
//Session setup to keep users signed into website
app.use(session({
    secret: 'your_secret_key',
    resave: false,
    saveUninitialized: true,
    store: sessionStore,
    cookie: {
      maxAge: 30 * 24 * 60 * 60 * 1000, // Session cookie will expire after 30 days
      secure: false,
      httpOnly: true
    }
  }));


const publicDir = path.join(__dirname, './public')

app.use(express.static(publicDir))
app.use(express.urlencoded({extended: 'false'}))
app.use(express.json())
app.use(express.static('public'));

app.set('view engine', 'hbs')
app.set('views', __dirname + '/views'); // directory where HBS files are located


db.connect((error) => {
    if(error) {
        console.log(error)
    } else {
        console.log("MySQL connected!")
    }
})

app.post('/mentor-dashboard', upload.single('profilePicture'), (req, res) => {

  const filePath = req.file.path;

  // Assuming you have a `users` table and a `profile_picture` column
  const sql = 'UPDATE users SET profile_picture = ? WHERE id = ?';
  const userId = req.session.userId;  // The logged in user's ID

  db.query(sql, [filePath, userId], (err, result) => {
    if (err) throw err;
    console.log('Number of records updated: ' + result.affectedRows);
  });

  

  res.redirect('/mentor-dashboard');
});

app.post('/mentee-dashboard', upload.single('profilePicture'), (req, res) => {
  // req.file is the `profilePicture` file
  // req.body will hold the text fields, if there were any

  const filePath = req.file.path;

  // Assuming you have a `users` table and a `profile_picture` column
  const sql = 'UPDATE users SET profile_picture = ? WHERE id = ?';
  const userId = req.session.userId;  // The logged in user's ID

  db.query(sql, [filePath, userId], (err, result) => {
    if (err) throw err;
    console.log('Number of records updated: ' + result.affectedRows);
  });

  

  res.redirect('/mentee-dashboard');
});

app.use('/uploads', express.static('uploads'));

app.get('/my-mentees', function(req, res) {
  // Get mentor ID from session
  const mentorId = req.session.userId;

  // Query the database to get all mentees of the mentor
  const sql = 'SELECT users.* FROM users JOIN relationships ON users.id = relationships.mentee_id WHERE relationships.mentor_id = ?';
  db.query(sql, [mentorId], function(err, results) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    // If mentees are found, pass them to the template
    const mentees = results ? results : []; // Get the mentees or an empty array if not found

    // Query the database for the logged in user's profile picture path
    db.query('SELECT profile_picture FROM users WHERE id = ?', [mentorId], (err, userResults) => {
      if (err) throw err;
      // Render the my-mentees page with the mentees and the profile picture
      res.render('my-mentees', { mentees: mentees, userName: req.session.userName, profilePicture: userResults[0].profile_picture });
    });
  });
});


// app.get('/my-mentees/:userId', (req, res) => {
//  const menteeId = req.params.userId;
//   console.log(menteeId);
//   // Query the database to get the Calendly link for the mentee
//   const sql = 'SELECT calendly_link FROM users WHERE id = ?';
//   db.query(sql, [menteeId], (error, results) => {
//     if (error) {
//       console.error(error);
//       return res.status(500).json({ error: 'Internal Server Error' });
//     }
//     // If a Calendly link is found, pass it to the template
//     const calendlyLink = results[0] ? results[0].calendly_link : ''; // Get the Calendly link or an empty string if not found
//     // Render the my-mentees Handlebars template with the Calendly link
//     res.render('my-mentees', {
//       menteeName: req.session.userName, // Replace this with the mentee's name obtained from the database
//       calendlyLink: calendlyLink,
//       });
//   });
// });

app.get('/my-mentees/:userId', (req, res) => {
  const menteeId = req.params.userId;
  const userId = req.session.userId;

  // Query the database to get the Calendly link for the mentee
  const sql = 'SELECT calendly_link, name FROM users WHERE id = ?';
  db.query(sql, [menteeId], (error, results) => {
    if (error) {
      console.error(error);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    // If a Calendly link is found, pass it to the template
    const calendlyLink = results[0] ? results[0].calendly_link : ''; // Get the Calendly link or an empty string if not found
    const menteeName = results[0] ? results[0].name : ''; // Get the mentee's name or an empty string if not found

    // Query the database to get the userName and profilePicture for the logged in user
    db.query('SELECT name, profile_picture FROM users WHERE id = ?', [userId], (err, userResults) => {
      if (err) throw err;
      const userName = userResults[0] ? userResults[0].name : ''; // Get the userName or an empty string if not found
      const profilePicture = userResults[0] ? userResults[0].profile_picture : ''; // Get the profilePicture or an empty string if not found

      console.log(profilePicture);
      // Render the my-mentees page with the mentee's name, Calendly link, and the profile picture
      res.render('my-mentees', {
        menteeName: menteeName,
        calendlyLink: calendlyLink,
        showDetails: true,
        userName: userName,
        profilePicture: profilePicture
      });
    });
  });
});

app.get('/my-mentees/uploads/:filename', (req, res) => {
  res.sendFile(path.join(__dirname, '/uploads/' + req.params.filename));
});


app.use('/uploads', express.static('/uploads'));


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
  
  const userId = req.session.userId;  // The logged in user's ID

  // Query the database for the logged in user's profile picture
  db.query('SELECT profile_picture FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) throw err;
    res.render('menteequestionaire', { userName: req.session.userName, profilePicture: results[0].profile_picture });
  });
})

app.get("/mentorquestionaire", (req, res) => {
  const userId = req.session.userId;  // The logged in user's ID

  // Query the database for the logged in user's profile picture
  db.query('SELECT profile_picture FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) throw err;
    res.render('mentorquestionaire', { userName: req.session.userName, profilePicture: results[0].profile_picture });
  });
});



app.post('/menteequestionaire', function(req, res) {
  // Get form data
  const { personality, education, experience, adviceType, skills, goals } = req.body;

  // Get mentee ID from session
  const menteeId = req.session.userId;

  // Query the database to store the survey responses
  const sql = 'INSERT INTO surveys (userId, role, personality, education, experience, adviceType, skills, goals) VALUES (?, "mentee", ?, ?, ?, ?, ?, ?)';
  db.query(sql, [menteeId, personality, education, experience, adviceType, skills, goals], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    // Redirect to mentee-dashbord
    res.redirect('/mentee-dashboard');
  });
});


app.post('/mentorquestionaire', function(req, res) {
  // Get form data
  const { personality, education, adviceType, skills} = req.body;
  const mentorId = req.session.userId;

  //This was what I had before, will revert after testing is done
  // const { personality, education, experience, adviceType, skills, goals } = req.body;

  // Query the database to store the survey responses
  const sql = 'INSERT INTO surveys (userId, role, personality, education, adviceType, skills) VALUES (?, "mentor", ?, ?, ?, ?)';
  db.query(sql, [mentorId, personality, education, adviceType, skills], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    // Redirect to a mentor-dashboard
    res.redirect('/mentor-dashboard');
  });
});


// app.get("/my-mentees", (req, res) => {
//   const userId = req.session.userId;  // The logged in user's ID

//   // Query the database for the logged in user's profile picture path
//   db.query('SELECT profile_picture FROM users WHERE id = ?', [userId], (err, results) => {
//     if (err) throw err;
//     res.render('my-mentees', { userName: req.session.userName, profilePicture: results[0].profile_picture });
//   });
// });


app.get("/register", (req, res) => {
    res.render("register")
})

app.get("/login", (req,res) => {
    res.render("login")
})

app.get('/mentor-dashboard', (req, res) => {

  const userId = req.session.userId;  // The logged in user's ID

  db.query('SELECT profile_picture FROM users WHERE id = ?', [userId], (err, results) => {
    if (err) throw err;
    const userName = req.session.userName; // Retrieve the user's name from the session
    res.render('mentor-dashboard', { userName: userName, profilePicture: results[0].profile_picture });;
    console.log('User Name:', userName); // Log the user name to the console for debugging
  });
    
});
  
// app.get('/mentee-dashboard', (req, res) => {

//     const userId = req.session.id;
//     db.query('SELECT profile_picture FROM users WHERE id = ?', [userId], (err, results) => {
//       if (err) throw err;
//       const userName = req.session.userName; // Retrieve the user's name from the session
//       res.render('mentee-dashboard', { userName: userName, profilePicture: results[0].profile_picture });;
//       console.log('User Name:', userName); // Log the user name to the console for debugging
//     });
// });

app.get('/mentee-dashboard', (req, res) => {
  const menteeId = req.session.userId;  // The logged in mentee's ID
  
  db.query('SELECT profile_picture FROM users WHERE id = ?', [menteeId], (err, results) => {
    if (err) throw err;
    res.render('mentee-dashboard', { profilePicture: results[0].profile_picture, userName: req.session.userName});
  });
});


// app.get('/select-mentor', function(req, res) {
//   // Query the database to get all mentors
//   const sql = 'SELECT * FROM users WHERE role = "mentor"';
//   db.query(sql, function(err, results) {
//     if (err) {
//       console.error(err);
//       return res.status(500).json({ error: 'Internal Server Error' });
//     }

//     // Render the select-mentor Handlebars template with the mentors
//     res.render('select-mentor', { mentors: results , userName : req.session.userName});
//   });
// });

// app.get('/select-mentor', (req, res) => {
//   const userId = req.session.userId;
//   const userName = req.session.userName;

//   let sql = `
//         SELECT mentors.*, mentorSurveys.education, mentorSurveys.skills, mentorSurveys.adviceType 
//         FROM users AS mentors
//         JOIN surveys AS mentorSurveys ON mentors.id = mentorSurveys.userId
//         JOIN surveys AS menteeSurveys ON menteeSurveys.personality = mentorSurveys.personality
//         WHERE menteeSurveys.userId = ${db.escape(userId)}
//         AND mentors.role = 'mentor'
//         AND mentors.id NOT IN (SELECT mentor_ID FROM relationships WHERE mentee_ID = ${db.escape(userId)})
//     `;
//   db.query(sql, (err, results) => {
//       if(err) throw err;
//       res.render('select-mentor', { mentors: results, userName: req.session.userName});
//   });
// });
app.get('/select-mentor', (req, res) => {
  const userId = req.session.userId;
  const userName = req.session.userName;

  let sql = `
        SELECT mentors.*, mentorSurveys.education, mentorSurveys.skills, mentorSurveys.adviceType 
        FROM users AS mentors
        JOIN surveys AS mentorSurveys ON mentors.id = mentorSurveys.userId
        JOIN surveys AS menteeSurveys ON menteeSurveys.personality = mentorSurveys.personality
        WHERE menteeSurveys.userId = ${db.escape(userId)}
        AND mentors.role = 'mentor'
        AND mentors.id NOT IN (SELECT mentor_ID FROM relationships WHERE mentee_ID = ${db.escape(userId)})
    `;
  db.query(sql, (err, results) => {
      if(err) throw err;
      // Query the database for the logged in user's profile picture
      db.query('SELECT profile_picture FROM users WHERE id = ?', [userId], (err, userResults) => {
        if (err) throw err;
        res.render('select-mentor', { mentors: results, userName: req.session.userName, profilePicture: userResults[0].profile_picture });
      });
  });
});




app.post('/select-mentor', function(req, res) {
  // Get mentor ID from form data
  const mentorId = req.body.mentorId;
  
  // Get mentee ID from session
  const menteeId = req.session.userId;

  // Query the database to set the mentor for the mentee
  const sql = 'INSERT INTO relationships (mentee_ID, mentor_ID) VALUES (?, ?)';
  db.query(sql, [menteeId, mentorId], function(err) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }

    // Redirect to my-mentors
    res.redirect('my-mentors');
  });
});

// app.get('/my-mentors', function(req, res) {
//   // Get mentee ID from session
//   const menteeId = req.session.userId;
//   const name = req.session.userName;
//   // Query the database to get all mentors of the mentee
//   const sql = 'SELECT users.* FROM users JOIN relationships ON users.id = relationships.mentor_id WHERE relationships.mentee_id = ?';
//   db.query(sql, [menteeId], function(err, results) {
//     if (err) {
//       console.error(err);
//       return res.status(500).json({ error: 'Internal Server Error' });
//     }

//     // If mentors are found, pass them to the template
//     const mentors = results ? results : []; // Get the mentors or an empty array if not found

//     // Render the my-mentors page with the mentors
//     res.render('my-mentors', { mentors: mentors, userName : req.session.userName});
//   });
// });

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

    // Query the database for the logged in user's profile picture
    db.query('SELECT profile_picture FROM users WHERE id = ?', [menteeId], (err, userResults) => {
      if (err) throw err;
      // Render the my-mentors page
      res.render('my-mentors', { mentors: mentors, userName: req.session.userName, profilePicture: userResults[0].profile_picture });
    });
  });
});

// Delete selected mentor from mentee list
app.post('/my-mentors', function(req, res) { 
  // Get mentee ID from session
  const menteeId = req.session.userId;
  const mentorId = req.body.mentorId;

  // Delete relationship where mentee and mentor id match
  const sql = 'DELETE FROM relationships WHERE mentee_id = ? AND mentor_id = ?;';

  db.query(sql, [menteeId], [mentorId], function(err, results) {
    if (err) {
      console.error(err);
      return res.status(500).json({ error: 'Internal Server Error' });
    }
    
    // Render the my-mentors page with the mentors
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
        const userRole = results[0].role; 
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
              res.redirect('/mentor-dashboard'); // Redirect mentors to the mentor-dashboard
            } else if (userRole === 'mentee') {
              console.log(req.session.userName);
              res.redirect('/mentee-dashboard'); // Redirect mentees to the mentee-dashboard
            } else {
              res.status(401).send('Invalid role');
            }
          } else {
            // Passwords do not match
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
      const userId = req.session.userId;  // The logged in user's ID
  
      // Query the database for the logged in user's profile picture path
      db.query('SELECT profile_picture FROM users WHERE id = ?', [userId], (err, results) => {
        if (err) throw err;
        res.render('about', { userName: req.session.userName, profilePicture: results[0].profile_picture });
      });
    } else {
      // User is not signed in, render generic content
      res.render('about');
    }
  });
  


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
  })
})



app.listen(5000, ()=> {
    console.log("server started on port 5000")
})
