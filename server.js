//Setting Up
var express = require('express');
var path = require('path');
var app = express();

//Configuration
app.use(express.static('build'));
app.use(express.static(path.join(__dirname, '/app')));
app.get('*', function(req, res) {
    res.sendFile(path.join(__dirname, 'index.html'));
});

//Starts the app
app.listen(3000);
console.log("Running localhost:3000");