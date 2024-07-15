const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const cors = require('cors');

const mongoUrl = 'mongodb+srv://parath_saf:Motorola%40g4@cluster25356.24dv64h.mongodb.net/?retryWrites=true&w=majority&appName=Cluster25356'; // Replace with your MongoDB connection string
mongoose.connect(mongoUrl, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log('MongoDB connected'))
    .catch(err => console.error('MongoDB connection error:', err));

// Define a schema and model for storing set data
const licensePlateSchema = new mongoose.Schema({
    values: String, // Array of strings to store the set values
    timestamp: { type: Date, default: Date.now }
});

const bodySchema = new mongoose.Schema({
    plateNumber: { type: String, required: true },
    // other fields as needed
});

const SetModel = mongoose.model('InsideCars', licensePlateSchema);
const Body = mongoose.model('Body', bodySchema);

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });
app.use(cors());

const parkingLots = new Map();



function updateParkingLot(lot_id, free_space, car_count) {
    parkingLots.set(lot_id, { car_count: car_count, free_space: free_space });
}

function saveMapToFile() {
    const data = [];
    parkingLots.forEach((value, key) => {
        data.push({ lot_id: key, ...value });
    });

    const filePath = path.join(__dirname, 'parking_lots.txt');
    fs.writeFile(filePath, JSON.stringify(data, null, 2), (err) => {
        if (err) {
            console.error('Error saving map to file:', err);
        } else {
            console.log('Map saved to parking_lots.txt');
        }
    });
}

let license_number = new Set();
let yellow = new Set();
let lot_status = new Set([{lot_id: 1, total: 0, available: 0 },{lot_id: 2, total: 0, available: 0 }]);


function updateOrAddLotStatus(newLotStatus) {
    let found = false;
    // Iterate through the set to find if an object with the same lot_id exists
    lot_status.forEach((lot) => {
        if (lot.lot_id === newLotStatus.lot_id) {
            // Update the existing object
            lot.total=newLotStatus.total;
            lot.available=newLotStatus.available;
            found = true;
        }
    });

    if (!found) {
        // Add the new object to the set if it doesn't already exist
        lot_status.add(newLotStatus);
    }
}



wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message) => {
        console.log(`Received: ${message}`);
        try {
            const data = JSON.parse(message);
            if (data.type === 'parking_update') {
                lot_id_temp = data.lot_id;
                free_space_temp = data.free_space;
                car_count_temp = data.car_count;
                // {type:jbd,data:[{},{}]}

                updateOrAddLotStatus({lot_id: lot_id_temp, total: free_space_temp+car_count_temp, available: free_space_temp });

                updateParkingLot(data.lot_id, data.free_space - yellow.size, data.car_count);
                saveMapToFile();


                console.log(`Lot ${data.lot_id}: Free spaces: ${data.free_space}, Car count: ${data.car_count}`);
                ws.send(JSON.stringify({ type: 'ack', message: `Parking data for lot ${data.lot_id} received` }));
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    });
    
    setInterval(async () => {
        const parkingUpdate = lot_status;
        console.log(JSON.stringify([...parkingUpdate]))
        const temp = {"type": "parking_update","data": [...parkingUpdate] ,"data2" : [...license_number] };
        await ws.send(JSON.stringify(temp));
    }, 5000); // Sends updates every 5 seconds (adjust as per your application logic)
    ws.on('close', () => {
        console.log('Client disconnected');
    });
});

// Endpoint to allocate parking slot based on distance and availability
app.use(express.json());

// Middleware to enable CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1:5500'); // Replace with your actual frontend URL
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    next();
});

app.get('/allocate', (req, res) => {
    // we 0->1
    //Sockets free - 
    try {
        let nearestLotId;

        let minDistance = Infinity;
        console.log(parkingLots)
        console.log(minDistance)

        parkingLots.forEach((value, key) => {
            if (value.free_space > 0 && value.Distance < minDistance) {
                minDistance = value.Distance;
                nearestLotId = key;
            }
        });

        console.log(nearestLotId)
        
        if (nearestLotId ) {
            parkingLots.get(nearestLotId).free_space--; // Decrease free space
            saveMapToFile(); // Save updated parking lots map to file
            console.log(parkingLots.get(nearestLotId).free_space)
            res.json({ lot_id: nearestLotId });
        } else {
            res.status(404).json({ error: 'No available parking slots' });
        }
    } catch (error) {
        console.error('Error allocating parking slot:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// check if inside
async function insertLicensePlate(plateNumber) {
    try {
        const newLicensePlate = new SetModel({
                license_number: plateNumber.number,
                datetime: plateNumber.date
        });
        const savedPlate = await newLicensePlate.save();
        console.log(`Saved: ${savedPlate}`);
    } catch (err) {
        console.error('Error inserting license plate:', err);
    }
}

async function checkLicensePlate(plateNumber) {
    try {
        console.log(plateNumber)
        const body = await Body.findOne({ license_number: plateNumber.number });
        console.log("");
        console.log(body);
        console.log("")
        if (body) {
            // allocate();
            insertLicensePlate(plateNumber);
        } else {
            // License plate not found, print message
            console.log('Kindly register by contacting security');
        }
    } catch (err) {
        console.error('Error checking license plate:', err);
    }
}

function clearSet() {
    for (const plate of license_number) {
        checkLicensePlate(plate);
    }
    // license_number.clear();
}

const intervalId = setInterval(() => {
    clearSet();
}, 1500);


//license_number contains inside cars
let mx_avl = 0,mx_lot=1;
app.post('/ocrplatein',(req,res)=>{
   const data = req.body.number;
   const currentDateTime = new Date();
   const formattedDateTime = currentDateTime.toISOString(); 
   
   lot_status.forEach((lot) => {
    if( lot.available > mx_avl ){
        mx_avl=lot.available;
        mx_lot=lot.lot_number;
    }
    
});
function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }
   license_number.add({"lot_id": getRandomInt(1,2),"number": data,"checkin": formattedDateTime});
   res.send("recieved")
})


// Serve static files (e.g., index.html, script.js, styles.css)
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 8080;
server.listen(PORT, '0.0.0.0',() => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
 