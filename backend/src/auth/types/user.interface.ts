export interface JwtPayload {
    sub: string;
    preferred_username: string;
    email: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    roles?: string[];
    groups?: string[];
    employeeId?: string;
    displayName?: string;
    exp?: number;
    iat?: number;
}

export interface AuthUser {
    id: string;
    username: string;
    email: string;
    name?: string;
    firstName?: string;
    lastName?: string;
    roles: string[];
    groups: string[];
    employeeId?: string;
    displayName?: string;
}
