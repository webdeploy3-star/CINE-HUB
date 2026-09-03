import dns from 'dns';
import express from 'express';
import path from 'path';
import fs from 'fs';
import EventEmitter from 'events';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

try {
    dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);
} catch (e) {
    console.warn('Failed to set custom DNS servers programmatically:', e.message);
}

const app = express();
const PORT = process.env.PORT || 8000;

EventEmitter.defaultMaxListeners = 500;

// Mount body parsers
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Import route router
import code from './pair.js';
app.use('/code', code);
app.use('/', code);

app.get('/update-config', (req, res) => {
    res.send("Update config route working ✅");
});

app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', uptime: process.uptime(), timestamp: Date.now() });
});

// Serve compiled static files from React frontend (frontend/dist)
const distPath = path.join(__dirname, 'frontend', 'dist');
app.use(express.static(distPath));

// SPA Routing: Redirect all non-API routes to React index.html
app.get('*', (req, res) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
    } else {
        res.status(404).send('React Frontend build not found. Please run: cd frontend && npm run build');
    }
});

app.listen(PORT, () => {
    console.log(`
  ___ _  _   _   __  __   _     __  __ ___  
 / __| || | /_\ |  \/  | /_\   |  \/  |   \\ 
| (__| __ |/ _ \\| |\\/| |/ _ \\  | |\\/| | |) |
 \\___|_||_/_/ \\_\\_|  |_/_/ \\_\\ |_|  |_|___/ 

🔥 CHAMA MD SERVER ONLINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💖 Dev      : MADUSANKA-OFC
⚡ Bot      : MADUSANKA-MD MINI
🌐 URL      : http://localhost:${PORT}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);

    setInterval(async () => {
        try {
            await fetch(`http://localhost:${PORT}/health`).catch(() => {});
        } catch (e) {}
    }, 240000); // Self-ping every 4 minutes to maintain active event loop
});

export default app;
