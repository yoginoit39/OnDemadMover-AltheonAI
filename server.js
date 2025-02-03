require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const path = require('path');

const app = express();
const upload = multer({ dest: 'uploads/' });

// Serve uploaded files with proper path
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Add this near the top of your file
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost/claims_db';
mongoose.connect(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    serverSelectionTimeoutMS: 5000,
    retryWrites: true
}).then(async () => {
    console.log('MongoDB connected successfully');
    // Test query
    try {
        const count = await Claim.countDocuments();
        console.log(`Found ${count} claims in database`);
    } catch (error) {
        console.error('Error testing database:', error);
    }
}).catch(err => {
    console.error('Initial MongoDB connection error:', err);
});

// Define schemas
const ClaimSchema = new mongoose.Schema({
    name: String,
    email: String,
    phone: String,
    moveDate: Date,
    itemType: String,
    itemWeight: Number,
    damageType: String,
    description: String,
    additionalInfo: String,
    images: [String],
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const AdminSchema = new mongoose.Schema({
    username: String,
    password: String
});

const Claim = mongoose.model('Claim', ClaimSchema);
const Admin = mongoose.model('Admin', AdminSchema);

// Move logging middleware to the top
app.use((req, res, next) => {
    console.log('Request URL:', req.url);
    console.log('Request Headers:', req.headers);
    next();
});

// Add session middleware before other middleware
app.use(session({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        httpOnly: true,
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

// JWT middleware
const authenticateToken = (req, res, next) => {
    console.log('Headers:', req.headers);
    // Check session first, then cookie, then headers
    const token = req.session.token || 
                  req.cookies.adminToken || 
                  req.headers.authorization?.split(' ')[1];
    
    console.log('Token:', token);

    if (!token) {
        console.log('No token found');
        return res.sendStatus(401);
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            console.log('Token verification error:', err);
            return res.sendStatus(403);
        }
        console.log('Verified user:', user);
        req.user = user;
        next();
    });
};

// Admin routes
app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });

    if (!admin || !await bcrypt.compare(password, admin.password)) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ username }, JWT_SECRET);
    // Store token in both session and cookie
    req.session.token = token;
    res.cookie('adminToken', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
    });
    res.json({ token });
});

app.get('/api/admin/claims', authenticateToken, async (req, res) => {
    try {
        const claims = await Claim.find().sort({ createdAt: -1 });
        console.log('Fetched claims:', claims);
        if (!claims) {
            console.log('No claims found');
            return res.json([]);
        }
        res.json(claims);
    } catch (error) {
        console.error('Error fetching dashboard data:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

app.patch('/api/admin/claims/:id/status', authenticateToken, async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;

    const claim = await Claim.findByIdAndUpdate(id, { status }, { new: true });
    res.json(claim);
});

// Get single claim details
app.get('/api/admin/claims/:id', authenticateToken, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid claim ID' });
        }

        const claim = await Claim.findById(req.params.id);
        if (!claim) {
            return res.status(404).json({ error: 'Claim not found' });
        }
        res.json(claim);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch claim details' });
    }
});

// Add the sendEmails function
async function sendEmails(claimData, pdfPath) {
    try {
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: 587,
            secure: false,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS
            }
        });

        // Send email to customer
        const customerEmail = await transporter.sendMail({
            from: `"Claims System" <${process.env.SMTP_USER}>`,
            to: claimData.email,
            subject: 'Claim Submission Confirmation',
            html: `
                <h1>Claim Received</h1>
                <p>Dear ${claimData.name},</p>
                <p>We have received your claim and will review it shortly.</p>
                <p>Claim Details:</p>
                <ul>
                    <li>Item: ${claimData.itemType}</li>
                    <li>Issue: ${claimData.damageType}</li>
                    <li>Date Submitted: ${new Date().toLocaleDateString()}</li>
                </ul>
                <p>We will contact you if we need any additional information.</p>
            `,
            attachments: [{
                filename: 'claim.pdf',
                path: pdfPath
            }]
        });

        console.log('Customer email sent:', customerEmail.messageId);

        // Send notification to admin
        const adminEmail = await transporter.sendMail({
            from: `"Claims System" <${process.env.SMTP_USER}>`,
            to: process.env.ADMIN_EMAIL,
            subject: 'New Claim Submission',
            html: `
                <h1>New Claim Received</h1>
                <p>A new claim has been submitted:</p>
                <ul>
                    <li>Customer: ${claimData.name}</li>
                    <li>Email: ${claimData.email}</li>
                    <li>Phone: ${claimData.phone}</li>
                    <li>Item: ${claimData.itemType}</li>
                    <li>Issue: ${claimData.damageType}</li>
                </ul>
            `,
            attachments: [{
                filename: 'claim.pdf',
                path: pdfPath
            }]
        });

        console.log('Admin email sent:', adminEmail.messageId);
    } catch (error) {
        console.error('Email error:', error);
        // Don't throw the error - we still want to save the claim even if email fails
    }
}

// Updated PDF generation function
async function generatePDF(data, imagePaths) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument();
        const pdfPath = `./temp-${Date.now()}.pdf`;
        const stream = fs.createWriteStream(pdfPath);

        doc.pipe(stream);

        // Add header
        doc.fontSize(20).text('On Demand Movers USA - Claim Form', { align: 'center' });
        doc.moveDown();

        // Add claim information
        doc.fontSize(12);
        doc.text(`Claim Date: ${new Date().toLocaleDateString()}`);
        doc.moveDown();

        // Add sections
        addSection(doc, 'Personal Information', {
            'Name': data.name,
            'Phone': data.phone,
            'Email': data.email,
            'Move Date': data.moveDate
        });

        addSection(doc, 'Claim Details', {
            'Item Type': data.itemType,
            'Item Weight': `${data.itemWeight} lbs`,
            'Type of Issue': data.damageType,
            'Description': data.description
        });

        if (data.additionalInfo) {
            addSection(doc, 'Additional Information', {
                'Notes': data.additionalInfo
            });
        }

        // Add images
        if (imagePaths.length > 0) {
            doc.addPage();
            doc.fontSize(16).text('Attached Images', { align: 'center' });
            doc.moveDown();

            imagePaths.forEach((path, index) => {
                if (index > 0 && index % 2 === 0) {
                    doc.addPage();
                }
                doc.image(path, {
                    fit: [250, 250],
                    align: 'center'
                });
                doc.moveDown();
            });
        }

        doc.end();

        stream.on('finish', () => resolve(pdfPath));
        stream.on('error', reject);
    });
}

function addSection(doc, title, fields) {
    doc.fontSize(14).text(title, { underline: true });
    doc.moveDown(0.5);
    doc.fontSize(12);
    
    Object.entries(fields).forEach(([key, value]) => {
        doc.text(`${key}: ${value}`);
    });
    
    doc.moveDown();
}

// Add this after your mongoose connection
// This is a one-time setup code - remove after first use
async function createInitialAdmin() {
    try {
        const adminExists = await Admin.findOne({ username: 'admin' });
        if (!adminExists) {
            const hashedPassword = await bcrypt.hash('admin123', 10);
            const admin = new Admin({
                username: 'admin',
                password: hashedPassword
            });
            await admin.save();
            console.log('Admin user created successfully');
        }
    } catch (error) {
        console.error('Error creating admin:', error);
    }
}
createInitialAdmin();

// Secure admin routes
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'public/admin-login.html'));
});

app.get('/admin/dashboard', authenticateToken, (req, res) => {
    res.sendFile(path.join(__dirname, 'views/admin-dashboard.html'));
});

// API routes that require authentication
app.get('/api/verify-token', authenticateToken, (req, res) => {
    res.json({ success: true });
});

// Get single claim details
app.get('/api/admin/claims/:id', authenticateToken, async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({ error: 'Invalid claim ID' });
        }

        const claim = await Claim.findById(req.params.id);
        if (!claim) {
            return res.status(404).json({ error: 'Claim not found' });
        }
        res.json(claim);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to fetch claim details' });
    }
});

// Update claim status
app.patch('/api/admin/claims/:id/status', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;
        
        const claim = await Claim.findByIdAndUpdate(
            id,
            { status },
            { new: true }
        );
        
        if (!claim) {
            return res.status(404).json({ error: 'Claim not found' });
        }
        
        res.json(claim);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to update claim status' });
    }
});

// Add claim submission endpoint
app.post('/api/submit-claim', upload.array('images'), async (req, res) => {
    try {
        const claimData = req.body;
        const images = req.files || [];

        // Save images and get their paths
        const webPaths = images.map(file => `/uploads/${file.filename}`);

        // Create new claim
        const claim = new Claim({
            name: claimData.name,
            email: claimData.email,
            phone: claimData.phone,
            moveDate: claimData.moveDate,
            itemType: claimData.itemType,
            itemWeight: claimData.itemWeight,
            damageType: claimData.damageType,
            description: claimData.description,
            additionalInfo: claimData.additionalInfo,
            images: webPaths
        });

        console.log('Saving claim:', claim);
        await claim.save();
        console.log('Claim saved successfully');

        // Generate PDF with images
        const pdfPath = await generatePDF(claimData, images.map(file => file.path));

        try {
            // Send emails - but don't fail if email sending fails
            await sendEmails(claimData, pdfPath);
        } catch (emailError) {
            console.error('Email sending failed:', emailError);
        }

        // Clean up
        fs.unlinkSync(pdfPath);

        res.json({ success: true });
    } catch (error) {
        console.error('Error saving claim:', error);
        res.status(500).json({ error: 'Failed to process claim', details: error.message });
    }
});

// Add this after mongoose connection
mongoose.connection.on('connected', () => {
    console.log('Connected to MongoDB successfully');
});

mongoose.connection.on('error', (err) => {
    console.error('MongoDB connection error:', err);
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

// Add this after your other routes
app.post('/api/admin/logout', (req, res) => {
    try {
        // Clear the session
        req.session.destroy((err) => {
            if (err) {
                console.error('Session destruction error:', err);
                return res.status(500).json({ error: 'Failed to logout' });
            }
            
            // Clear the cookie
            res.clearCookie('adminToken');
            res.clearCookie('connect.sid');
            
            res.json({ success: true, message: 'Logged out successfully' });
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ error: 'Failed to logout' });
    }
}); 