export function stripSslMode(connectionString: string): string {
  const parsedUrl = new URL(connectionString);
  parsedUrl.searchParams.delete('sslmode');
  return parsedUrl.toString();
}

export function createSslOptions(caCertificate: string | undefined, isProduction: boolean) {
  if (caCertificate) {
    return { ca: caCertificate, rejectUnauthorized: true };
  }
  if (isProduction) {
    throw new Error('DATABASE_SSL_CA is required to verify PostgreSQL TLS in production.');
  }
  return { rejectUnauthorized: false };
}
