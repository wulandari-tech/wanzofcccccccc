const express = require('express');
const http = require('http');
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Store group information (in-memory for simplicity - use a database in production!)
const groups = {}; // { groupId: { name: 'Group Name', members: [socketId1, socketId2] } }

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  // --- Group Management ---
  socket.on('create group', (groupName, callback) => {
      const groupId = 'group-' + Date.now(); // Simple unique ID
      groups[groupId] = { name: groupName, members: [socket.id] };
      socket.join(groupId); // Join the Socket.IO room
      callback({ success: true, groupId, groupName }); // Acknowledge to client
      console.log(`Group created: ${groupId} - ${groupName}`);
  });

    socket.on('join group', (groupId, callback) => {
        if (groups[groupId]) {
            groups[groupId].members.push(socket.id);
            socket.join(groupId);
            callback({ success: true, groupName: groups[groupId].name });
             // Notify existing members
            socket.to(groupId).emit('user joined', socket.id);
            console.log(`${socket.id} joined group ${groupId}`);
        } else {
            callback({ success: false, message: 'Group not found' });
        }
    });

    socket.on('leave group', (groupId) => {
      if (groups[groupId]) {
        groups[groupId].members = groups[groupId].members.filter(id => id !== socket.id);
        socket.leave(groupId);

        // Remove group if empty
        if(groups[groupId].members.length === 0){
            delete groups[groupId];
        } else {
          //Notify other members
          socket.to(groupId).emit('user left', socket.id);
        }
      }
      console.log(`${socket.id} left group ${groupId}`);
    });

    socket.on('chat message', (data) => { //data: {groupId, msg}
      if (data.groupId) {
        // Send to a specific group
        io.to(data.groupId).emit('chat message', {groupId: data.groupId, msg: data.msg, sender: socket.id });
      } else {
        // For private messages (optional)
        io.emit('chat message', {msg: data.msg, sender: socket.id});
      }
    });

    // --- WebRTC Signaling ---
    socket.on('offer', (data) => { // data : {targetSocketId, offer}
        socket.to(data.targetSocketId).emit('offer', { offer: data.offer, sender: socket.id });
    });

    socket.on('answer', (data) => { // data : {targetSocketId, answer}
        socket.to(data.targetSocketId).emit('answer', { answer: data.answer, sender: socket.id });
    });

    socket.on('ice-candidate', (data) => { // data : {targetSocketId, candidate}
        socket.to(data.targetSocketId).emit('ice-candidate', { candidate: data.candidate, sender: socket.id });
    });


    socket.on('disconnect', () => {
        console.log('user disconnected:', socket.id);
        // Remove user from groups
        for (const groupId in groups) {
            if (groups[groupId].members.includes(socket.id)) {
              groups[groupId].members = groups[groupId].members.filter(id => id !== socket.id);
              socket.leave(groupId);
              //Notify group members
              socket.to(groupId).emit('user left', socket.id);
              //Remove group if empty
              if(groups[groupId].members.length === 0){
                  delete groups[groupId];
              }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`listening on *:${PORT}`);
});
