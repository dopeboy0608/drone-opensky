export interface SearchCandidate {
  id: string;
  label: string;
  subLabel?: string;
  lat: number;
  lng: number;
}

export interface MapPosition {
  lat: number;
  lng: number;
}
