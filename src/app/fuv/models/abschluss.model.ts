export interface ValidationItem {
    label: string;
    status: 'valid' | 'warning' | 'error';
    message?: string;
}

export interface AbschlussData {
    unterschrift?: string;
    avbBestaetigung?: boolean;
    unterschrieben_am?: string;
    unterschrieben_art?: 'elektronisch' | 'physisch';
    status?: string;
}
