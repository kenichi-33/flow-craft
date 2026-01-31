const express = require('express');
const cors = require('cors');
const app = express();
const port = 3001; // Avoid conflict with backend on 3000

app.use(cors());
app.use(express.json());

// Mock Data
const USERS = Array.from({ length: 100 }, (_, i) => ({
    id: `U-${String(i + 1).padStart(3, '0')}`,
    label: `User ${i + 1}`,
    value: `U-${String(i + 1).padStart(3, '0')}`,
    metadata: {
        email: `user${i + 1}@example.com`,
        department: ['Sales', 'Engineering', 'HR', 'Marketing'][i % 4],
        role: ['Admin', 'Manager', 'Staff'][i % 3]
    }
}));

const PRODUCTS = Array.from({ length: 50 }, (_, i) => ({
    id: `P-${String(i + 1).padStart(3, '0')}`,
    label: `Product ${i + 1}`,
    value: `P-${String(i + 1).padStart(3, '0')}`,
    metadata: {
        price: (i + 1) * 1000,
        category: ['Electronics', 'Furniture', 'Stationery'][i % 3],
        stock: Math.floor(Math.random() * 100)
    }
}));

// Middleware to log request details
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        console.log('Body:', JSON.stringify(req.body, null, 2));
    }
    next();
});

// Middleware for simulating network conditions and auth
app.use((req, res, next) => {
    // 1. Simulate Delay
    const delay = req.query.delay ? parseInt(req.query.delay) : 0;
    
    // 2. Simulate Error
    if (req.query.error === 'true') {
        return res.status(500).json({ message: 'Simulated Internal Server Error' });
    }

    setTimeout(() => {
        // 3. Auth Simulation
        // Check "auth_type" query param to decide what to enforce
        const authType = req.query.auth_type;

        if (authType === 'basic') {
            const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Basic ')) {
                return res.status(401).json({ message: 'Basic Auth Required' });
            }
            // Optional: Check specific credentials (e.g. admin:password)
            // const creds = Buffer.from(authHeader.split(' ')[1], 'base64').toString().split(':');
        }

        if (authType === 'bearer') {
             const authHeader = req.headers.authorization;
            if (!authHeader || !authHeader.startsWith('Bearer ')) {
                return res.status(401).json({ message: 'Bearer Token Required' });
            }
        }

        if (authType === 'apikey_header') {
            const key = req.headers['x-api-key'];
            if (!key) {
                return res.status(401).json({ message: 'API Key Header Required' });
            }
        }

        if (authType === 'apikey_query') {
            const key = req.query.api_key;
            if (!key) {
                return res.status(401).json({ message: 'API Key Query Param Required' });
            }
        }

        next();
    }, delay);
});

// -- Endpoints --

// Users
app.get('/users', (req, res) => {
    let results = [...USERS];
    const q = req.query.q;

    if (q) {
        const lowerQ = q.toLowerCase();
        results = results.filter(u => 
            u.label.toLowerCase().includes(lowerQ) || 
            u.metadata.email.toLowerCase().includes(lowerQ)
        );
    }

    res.json(results);
});

// Products
app.get('/products', (req, res) => {
    let results = [...PRODUCTS];
    const q = req.query.q;

    if (q) {
        const lowerQ = q.toLowerCase();
        results = results.filter(p => 
            p.label.toLowerCase().includes(lowerQ) || 
            p.metadata.category.toLowerCase().includes(lowerQ)
        );
    }

    res.json(results);
});

// Generic Echo (for testing mapping)
app.get('/echo', (req, res) => {
    res.json({
        headers: req.headers,
        query: req.query,
        body: req.body,
        message: 'Echo response'
    });
});

app.listen(port, () => {
    console.log(`Mock server listening at http://localhost:${port}`);
    console.log(`- /users`);
    console.log(`- /products`);
    console.log(`- /echo`);
    console.log(`Options: ?delay=ms, ?error=true, ?auth_type=basic|bearer|apikey_header|apikey_query`);
});
