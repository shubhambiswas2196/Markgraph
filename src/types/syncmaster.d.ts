// Type definitions for SyncMaster.json OAuth credentials
export interface GoogleOAuthCredentials {
    client_id: string;
    project_id: string;
    auth_uri: string;
    token_uri: string;
    auth_provider_x509_cert_url: string;
    client_secret: string;
    redirect_uris: string[];
}

export interface SyncMasterConfig {
    web?: GoogleOAuthCredentials;
    installed?: GoogleOAuthCredentials;
}
