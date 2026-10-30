export interface Prize { id: string; name: string; quantity: number; photo: Blob; createdAt: number; updatedAt: number; }
export interface DrawResult { id: string; prizeId: string; name: string; photo: Blob; drawnAt: number; }
export interface Snapshot { prizes: Prize[]; result: DrawResult | null; }
export interface Aim { x: number; z: number; }
export type GamePhase = 'loading' | 'idle' | 'saving' | 'animating' | 'revealed';
export interface CapsulePose extends Aim { y: number; }
export interface Capture { id: string; target: Aim; targetY?: number; targetIndex: number; count: number; result: DrawResult; reduced: boolean; }
