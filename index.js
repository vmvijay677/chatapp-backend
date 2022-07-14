const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const mongoose = require('mongoose');
const userRoutes = require('./routes/userRoutes.js');
const User = require('./models/user.js');
const Message = require('./models/message.js')

const rooms = ['T20 WC', 'Techies', 'Avengers', 'WWE'];

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
dotenv.config();

const PORT = process.env.PORT || 5000;

mongoose
    .connect(process.env.MONGO_URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    })
    .then(() => {
        console.log("Mongo is connected!");
    })
    .catch((err) => {
        console.log(err.message);
    });

const server = require('http').createServer(app);

const io = require('socket.io')(server, {
    cors: {
        origin: "http://localhost:3000",
        methods: ["GET", "POST"]
    }
});

async function getLastMessagesFromRoom(room) {
    let roomMessages = await Message.aggregate([
        { $match: { to: room } },
        { $group: { _id: '$date', messagesByDate: { $push: '$$ROOT' } } }
    ]);

    return roomMessages;
};

function sortRoomMessagesByDate(messages) {
    return messages.sort(function (a, b) {
        let date1 = a._id.split('/');

        let date2 = b._id.split('/');

        date1 = date1[2] + date1[0] + date1[1];
        date2 = date2[2] + date2[0] + date2[1];

        return date1 < date2 ? -1 : 1
    })
}

//socket connection
io.on('connection', (socket) => {

    socket.on('new-user', async () => {
        const members = await User.find();

        io.emit('new-user', members)
    });

    socket.on("join-room", async (newRoom, previousRoom) => {
        socket.join(newRoom);
        socket.leave(previousRoom);

        let roomMessages = await getLastMessagesFromRoom(newRoom);

        roomMessages = sortRoomMessagesByDate(roomMessages);
        socket.emit('room-messages', roomMessages);
    });

    socket.on('message-room', async (room, content, sender, time, date) => {
        const newMessage = await Message.create({ content, from: sender, time, date, to: room });

        let roomMessages = await getLastMessagesFromRoom(room);

        roomMessages = sortRoomMessagesByDate(roomMessages);
        io.to(room).emit('room-messages', roomMessages);
        socket.broadcast.emit('notifications', room);
    });

    app.delete('/logout', async (req, res) => {
        try {
            const { _id, newMessages } = req.body;

            const user = await User.findById(_id);

            user.status = "offline";
            user.newMessages = newMessages;
            await user.save();
            const members = await User.find();

            socket.broadcast.emit('new-user', members);
            res.status(200).send();
        } catch (e) {
            console.log(e);
            res.status(400).send();
        }
    });
});

app.get("/", (req, res) => {
    res.send("This is MyChatApp API!");
});

app.use("/users", userRoutes);

app.get('/rooms', (req, res) => {
    res.json(rooms)
});

server.listen(PORT, () => {
    console.log(`Server started in ${PORT}`);
});
