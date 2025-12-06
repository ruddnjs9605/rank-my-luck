declare module "@apps-in-toss/web-bridge" {
  export function useAppBridge(): any;
  export function appLogin(): Promise<{
    encryptedUser: any;
    referrer?: string | null;
  }>;
}