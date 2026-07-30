export interface Contact {
  id: string;
  name: string;
  phone: string;
  relation: string;
  avatar: string;
  online: boolean;
  status: "Active" | "Inactive";
  at: number;
  shareLocation: boolean;
  lastUpdated: string;
  distance: string;
  latitude: number;
  longitude: number;
}

export interface ContactRequest {
  id: string;
  name: string;
  phone: string;
  relation: string;
  avatar: string;
  online: boolean;
  type: "incoming" | "outgoing";
  status: "Pending" | "Accepted" | "Rejected";
  at: number;
}

export interface Layer2Candidate {
  id: string;
  name: string;
  phone: string;
  relation: string;
  avatar: string;
  online: boolean;
  distance: string;
  mutualContact: string;
}
