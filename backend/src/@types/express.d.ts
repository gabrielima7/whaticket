declare namespace Express {
  export interface Request {
    user: { id: string; profile: string; companyId: number; super?: boolean };
    id: string;
    rawBody?: Buffer;
  }
}
