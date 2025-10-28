import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export class StaticServer {
    app;
    server;
    port;
    constructor(port = 3001) {
        this.port = port;
        this.app = express();
        this.setupRoutes();
    }
    setupRoutes() {
        // Servir les fichiers statiques du dossier icons
        const iconsPath = path.join(__dirname, '../../icons');
        this.app.use('/icons', express.static(iconsPath));
        // Route de test
        this.app.get('/health', (req, res) => {
            res.json({ status: 'ok', message: 'Static server is running' });
        });
    }
    start() {
        return new Promise((resolve, reject) => {
            this.server = this.app.listen(this.port, () => {
                console.log(`📁 Static server running on http://localhost:${this.port}`);
                resolve();
            }).on('error', (err) => {
                reject(err);
            });
        });
    }
    stop() {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    console.log('📁 Static server stopped');
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
    getIconUrl(filename) {
        return `http://localhost:${this.port}/icons/${filename}`;
    }
}
