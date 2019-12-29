const express = require('express'),
      app = express(),
      server = require('http').createServer(app);

app.use(express.static('public'));

server.listen(process.env.PORT, () => {
    console.log(`listening on port ${process.env.PORT}`); 
});

module.exports = server;