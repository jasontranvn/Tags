// types.ts
export interface ConcernTag {
  id: string; // Tag ID (from nfcu_tag.nfcu_tagid)
  label: string; // Tag name (from nfcu_tag.nfcu_name)
  owner: string; // Owner’s team name (resolved via lookup)
  bridgeRecordId?: string; // The bridge record ID (from nfcu_concerntags), present if this tag is “selected”
}

export interface MultiSelectDropdownProps {
  concernComplaintId: string;
  selectedOptions: ConcernTag[];
}
