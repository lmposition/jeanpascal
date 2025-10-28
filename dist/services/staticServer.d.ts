export declare class StaticServer {
    private app;
    private server;
    private port;
    constructor(port?: number);
    private setupRoutes;
    start(): Promise<void>;
    stop(): Promise<void>;
    getIconUrl(filename: string): string;
}
