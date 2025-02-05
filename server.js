const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const session = require('express-session');
const path = require('path');

// Models
const User = require('./models/User');
const Message = require('./models/Message');
const PrivateMessage = require('./models/PrivateMessage');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(session({ secret: 'chatappsecret', resave: false, saveUninitialized: true }));

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/chatapp', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// Socket.io events
io.on('connection', (socket) => {
    console.log('A user connected');

    socket.on('joinRoom', ({ username, room }) => {
        socket.join(room);
        console.log(`${username} joined ${room}`);
        io.to(room).emit('message', { username: 'System', message: `${username} joined the room.` });
    });

    socket.on('leaveRoom', ({ username, room }) => {
        socket.leave(room);
        console.log(`${username} left ${room}`);
        io.to(room).emit('message', { username: 'System', message: `${username} has left the room.` });
    });

    socket.on('chatMessage', async ({ username, room, message }) => {
        const newMessage = new Message({ from_user: username, room, message, date_sent: new Date() });
        await newMessage.save();
        io.to(room).emit('message', { username, message });
    });

    socket.on('privateMessage', async ({ from_user, to_user, message }) => {
        const newPrivateMessage = new PrivateMessage({ from_user, to_user, message, date_sent: new Date() });
        await newPrivateMessage.save();
        io.to(to_user).emit('privateMessage', { from_user, message });
    });

    socket.on('typing', ({ username, room }) => {
        socket.to(room).emit('typing', username);
    });

    socket.on('disconnect', () => {
        console.log('A user disconnected');
    });
});

// Signup Route
app.post('/signup', async (req, res) => {
    const { username, firstname, lastname, password } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    try {
        const newUser = new User({ username, firstname, lastname, password: hashedPassword, created_on: new Date() });
        await newUser.save();
        res.status(201).json({ message: 'User registered successfully' });
    } catch (error) {
        res.status(400).json({ error: 'User already exists' });
    }
});

// Login Route
app.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (user && await bcrypt.compare(password, user.password)) {
        req.session.user = user;
        res.json({ message: 'Login successful', user: { username: user.username, firstname: user.firstname } });
    } else {
        res.status(400).json({ error: 'Invalid credentials' });
    }
});

// Logout Route
app.post('/logout', (req, res) => {
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
});

// Start the server
server.listen(3000, () => {
    console.log('Server running on port 3000');
});
