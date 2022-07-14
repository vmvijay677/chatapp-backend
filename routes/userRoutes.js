const express = require('express');
const User = require('../models/user.js');

const router = express.Router();

//signup user
router.post('/', async (req, res) => {
    try {
        const exist = await User.findOne({ email: req.body.email });

        if (exist) {
            return res.status(401).json({ message: 'Email already exists!' });
        }

        const { name, email, password, picture } = req.body;

        const newUser = new User({ name, email, password, picture });

        await newUser.save();
        res.status(200).json(newUser);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

//login user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findByCredentials(email, password);

        user.status = 'online';
        await user.save();
        res.status(200).json(user);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router;