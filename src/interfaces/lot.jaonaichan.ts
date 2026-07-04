export type LotStatus = 'open' | 'packed' | 'shipped';

export interface Lot {
    id: number;
    status: LotStatus;
    created_at: string;
}
