// Global Google Identity Services TypeScript Declarations

interface GoogleIdentityCredentialResponse {
  credential: string;
  select_by?: string;
}

interface GoogleTokenResponse {
  access_token: string;
  error?: string;
  error_description?: string;
  expires_in?: number;
  prompt?: string;
  scope?: string;
  token_type?: string;
}

interface Window {
  google?: {
    accounts?: {
      id?: {
        initialize: (config: any) => void;
        prompt: (callback?: (notification: any) => void) => void;
        renderButton: (parent: HTMLElement, options: any) => void;
        disableAutoSelect: () => void;
        revoke: (hint: string, callback?: (done: any) => void) => void;
      };
      oauth2?: {
        initTokenClient: (config: {
          client_id: string;
          scope: string;
          callback: (response: GoogleTokenResponse) => void;
          error_callback?: (error: any) => void;
        }) => {
          requestAccessToken: (overrideConfig?: { prompt?: string }) => void;
        };
        initCodeClient?: (config: any) => {
          requestCode: () => void;
        };
      };
    };
  };
}
