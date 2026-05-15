import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      contributorId?: string;
      role?: 'admin' | 'contributor' | 'viewer';
    };
  }
}
