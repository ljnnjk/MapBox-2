const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const app = express();
const port = 3000;

const dbPath = './points.db';
const uploadDir = './uploads';

// Create uploads directory if it doesn't exist
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error("Error opening database:", err.message);
        process.exit(1);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS locations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                longitude REAL NOT NULL,
                latitude REAL NOT NULL,
                "Job #" INTEGER,
                "Company Name" TEXT,
                "Company Phone" TEXT,
                "Company Email" TEXT,
                "Customer Name" TEXT,
                "Customer Phone" TEXT,
                "Customer Email" TEXT,
                "Assigned Technicians" TEXT,
                "Completion Date" TEXT,
                "Location Address" TEXT NOT NULL,
                "Last Job Date" TEXT,
                "Jobs Total" INTEGER,
                Team TEXT,
                Estimate REAL,
                "Service Titan Link" TEXT,
                filename TEXT,
                filepath TEXT
              )`, (err) => {
            if (err) {
              console.error("Error creating table:", err.message);
            }
          });
    }
});

const corsOptions = {
  origin: '*', 
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(uploadDir));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

app.get('/locations', (req, res) => {
    db.all("SELECT * FROM locations", [], (err, rows) => {
        if (err) {
            console.error("Error fetching locations:", err.message);
            res.status(500).json({ error: err.message });
        } else {
            res.json({
                type: "FeatureCollection",
                features: rows.map(row => ({
                    type: "Feature",
                    geometry: { type: "Point", coordinates: [row.longitude, row.latitude] },
                    properties: { ...row, color: '#888888' } 
                }))
            });
        }
    });
});

app.post('/locations', upload.single('file'), (req, res) => {
    const { longitude, latitude, jobNumber, companyName, companyPhone, companyEmail, customerName, customerPhone, customerEmail, assignedTechnicians, completionDate, locationAddress, lastJobDate, jobsTotal, team, estimate, serviceTitanLink } = req.body;
    const fileName = req.file ? req.file.filename : null;
    const filePath = req.file ? path.join(uploadDir, req.file.filename) : null;

    if (!longitude || !latitude || !locationAddress) { 
        return res.status(400).json({ error: "Missing required fields: longitude, latitude, and locationAddress are mandatory." });
    }

    db.run(`INSERT INTO locations (longitude, latitude, "Job #", "Company Name", "Company Phone", "Company Email", "Customer Name", "Customer Phone", "Customer Email", "Assigned Technicians", "Completion Date", "Location Address", "Last Job Date", "Jobs Total", Team, Estimate, "Service Titan Link", filename, filepath) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [longitude, latitude, jobNumber, companyName, companyPhone, companyEmail, customerName, customerPhone, customerEmail, assignedTechnicians, completionDate, locationAddress, lastJobDate, jobsTotal, team, estimate, serviceTitanLink, fileName, filePath],
        function(err) {
            if (err) {
                console.error("Error inserting location:", err.message);
                res.status(500).json({ error: err.message });
                if (req.file) {
                    fs.unlink(path.join(uploadDir, req.file.filename), err => {
                        if (err) console.error("Error deleting file:", err);
                    });
                }
            } else {
                console.log("Point inserted successfully with ID:", this.lastID);
                res.json({ id: this.lastID, success: true });
            }
        });
});


app.put('/locations/:id', upload.single('file'), (req, res) => {
    const locationId = req.params.id;
    const updatedData = req.body;
    const file = req.file;

    if (!locationId || Object.keys(updatedData).length === 0) {
        return res.status(400).json({ error: "Missing location ID or update data." });
    }

    let updateSQL = `UPDATE locations SET `;
    const updateParams = [];
    let first = true;

    for (const key in updatedData) {
        if (key === 'file') continue; // Skip file handling for now

        const dbColumnName = key.includes(' ') ? `"${key}"` : key; // Quote column names with spaces

        const value = updatedData[key];
        updateSQL += (first ? '' : ', ') + `${dbColumnName} = ?`;
        updateParams.push(value === '' ? null : value); // Handle empty strings as NULL
        first = false;
    }

    // Handle file upload (if any)
    if (file) {
        updateSQL += (first ? '' : ', ') + `filename = ?, filepath = ?`;
        updateParams.push(file.filename);
        updateParams.push(path.join(uploadDir, file.filename));
        first = false;
    }

    updateSQL += ` WHERE id = ?`;
    updateParams.push(locationId);

    console.log("UPDATE SQL:", updateSQL); // Add logging to inspect the generated SQL
    console.log("UPDATE Params:", updateParams); // Log parameters for debugging

    db.run(updateSQL, updateParams, function(err) {
        if (err) {
            console.error("Error updating location:", err.message, err.stack);
            res.status(500).json({ error: err.message, details: err });
            if (file) {
                fs.unlink(path.join(uploadDir, file.filename), (unlinkErr) => {
                    if (unlinkErr) console.error("Error deleting file after update failure:", unlinkErr);
                });
            }
        } else {
            console.log(`Point updated successfully: ${this.changes} rows affected`);
            res.json({ success: true, changes: this.changes, message: 'Point updated' });
        }
    });
});


app.get('/locations/:id/file', (req, res) => {
    const locationId = req.params.id;
    db.get("SELECT filepath FROM locations WHERE id = ?", [locationId], (err, row) => {
        if (err) {
            console.error("Error fetching file:", err.message);
            res.status(500).json({ error: err.message });
            return;
        }
        if (!row || !row.filepath) {
            res.status(404).json({ error: "File not found for this location." });
            return;
        }
        const filePath = path.join(__dirname, row.filepath); 
        res.download(filePath);
    });
});


app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});

process.on('SIGINT', () => {
    db.close((err) => {
        if (err) {
            console.error('Error closing the database:', err.message);
        }
        console.log('Closed the database connection.');
        process.exit(0);
    });
});