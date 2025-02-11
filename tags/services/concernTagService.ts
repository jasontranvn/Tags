import { ConcernTag } from './types';

export const fetchSelectedConcernTags = async (
  concernComplaintId: string,
): Promise<ConcernTag[]> => {
  try {
    console.log(
      `Fetching bridge records for concernComplaintId: ${concernComplaintId}`,
    );

    // Step 1: Fetch the user teams to map known GUIDs to names
    const userTeams = await fetchUserTeams();

    const query = `?$filter=_nfcu_concerncomplaint_value eq '${concernComplaintId}'&$select=nfcu_concerntagsid,_nfcu_tags_value,ownerid`;
    const response = await Xrm.WebApi.retrieveMultipleRecords(
      'nfcu_concerntags',
      query,
    );

    if (!response.entities || response.entities.length === 0) {
      console.log(
        `No bridge records found for concernComplaintId: ${concernComplaintId}`,
      );
      return [];
    }

    // Fetch tag details & ensure we resolve the owner team name properly
    const concernTags = await Promise.all(
      response.entities.map(async (entity: any) => {
        try {
          const tagResponse = await Xrm.WebApi.retrieveRecord(
            'nfcu_tag',
            entity._nfcu_tags_value,
            `?$select=nfcu_tagid,nfcu_name,_ownerid_value`,
          );

          let ownerTeamName = userTeams.get(tagResponse._ownerid_value); // Check user teams first

          // 🔹 If team name isn't in userTeams, fetch it from Dynamics
          if (!ownerTeamName) {
            try {
              const teamResponse = await Xrm.WebApi.retrieveRecord(
                'team',
                tagResponse._ownerid_value,
                `?$select=name`,
              );
              ownerTeamName = teamResponse.name;
            } catch (teamError) {
              console.error(
                `Failed to fetch team name for GUID: ${tagResponse._ownerid_value}`,
                teamError,
              );
              ownerTeamName = tagResponse._ownerid_value; // Fallback to GUID
            }
          }

          return {
            id: tagResponse.nfcu_tagid,
            label: tagResponse.nfcu_name,
            owner: ownerTeamName, // ✅ Now always displays a name instead of GUID
            bridgeRecordId: entity.nfcu_concerntagsid,
          } as ConcernTag;
        } catch (error) {
          console.error(
            `Error fetching tag details for ID ${entity._nfcu_tags_value}: Possibly deleted. Auto-removing the invalid bridge record.`,
            error,
          );
          await removeTagFromBridgeTable(entity.nfcu_concerntagsid);
          return null;
        }
      }),
    );

    return concernTags.filter((tag): tag is ConcernTag => tag !== null);
  } catch (error) {
    console.error('Error fetching selected concern tags:', error);
    return [];
  }
};

/**
 * Fetch available tag options from the "nfcu_tag" table.
 * Only returns tags whose owner (lookup value) is in the user’s teams.
 */
export const fetchAvailableConcernTags = async (): Promise<ConcernTag[]> => {
  try {
    const teams = await fetchUserTeams();
    console.log('Using team map:', teams);
    console.log(`Fetching available tag options...`);

    const query = `?$select=nfcu_tagid,nfcu_name,_ownerid_value`;
    const response = await Xrm.WebApi.retrieveMultipleRecords(
      'nfcu_tag',
      query,
    );

    if (!response.entities || response.entities.length === 0) {
      console.log(`No tag options found.`);
      return [];
    }

    const tags: ConcernTag[] = response.entities
      .filter((entity: any) => teams.has(entity._ownerid_value))
      .map((entity: any) => ({
        id: entity.nfcu_tagid,
        label: entity.nfcu_name,
        owner: teams.get(entity._ownerid_value) || 'No Team Assigned',
        // No bridgeRecordId for available tags
      }));

    return tags;
  } catch (error) {
    console.error('Error fetching available tag options:', error);
    return [];
  }
};

/**
 * Add a tag to the bridge table.
 * Creates a new record in "nfcu_concerntags" linking the concern complaint and the tag.
 * Returns the new bridge record's ID or null on failure.
 */
export const addTagToBridgeTable = async (
  concernComplaintId: string,
  tagId: string,
  tagName: string,
  ownerId: string,
): Promise<string | null> => {
  const newRecord = {
    'nfcu_tags@odata.bind': `/nfcu_tags(${tagId})`,
    'nfcu_concerncomplaint@odata.bind': `/nfcu_concerncomplaints(${concernComplaintId.replace(
      /[{}]/g,
      '',
    )})`,
    nfcu_name: tagName,
    'ownerid@odata.bind': `/systemusers(${ownerId})`,
  };

  try {
    const result = await Xrm.WebApi.createRecord('nfcu_concerntags', newRecord);
    console.log('Record created successfully with ID:', result.id);
    return result.id;
  } catch (error) {
    console.error('Error creating record:', error);
    return null;
  }
};

/**
 * Remove a tag from the bridge table.
 * Deletes the record from "nfcu_concerntags" by its ID.
 */
export const removeTagFromBridgeTable = async (
  bridgeRecordId: string,
): Promise<boolean> => {
  try {
    await Xrm.WebApi.deleteRecord('nfcu_concerntags', bridgeRecordId);
    console.log('Record removed successfully with ID:', bridgeRecordId);
    return true;
  } catch (error) {
    console.error('Error removing record:', error);
    return false;
  }
};

/**
 * Get the current user's ID.
 */
export const getCurrentUserId = (): string => {
  const userId = Xrm.Utility.getGlobalContext().userSettings.userId;
  return userId.replace(/[{}]/g, '');
};

/**
 * Fetch the current user's teams.
 * Returns a Map where the key is the team ID and the value is the team name.
 */
export const fetchUserTeams = async (): Promise<Map<string, string>> => {
  const userId = getCurrentUserId();
  const teamMap = new Map<string, string>();

  try {
    const response = await Xrm.WebApi.retrieveRecord(
      'systemuser',
      userId,
      `?$select=fullname&$expand=teammembership_association($select=name,teamid)`,
    );

    if (
      response &&
      response.teammembership_association &&
      response.teammembership_association.length > 0
    ) {
      response.teammembership_association.forEach(
        (team: { teamid: string; name: string }) => {
          console.log(`Team ID: ${team.teamid}, Team Name: ${team.name}`);
          teamMap.set(team.teamid, team.name); // 🔹 Now indexed by GUID
        },
      );
    } else {
      console.log('User is not part of any teams.');
    }
  } catch (error) {
    console.error('Error fetching user teams:', error);
  }

  return teamMap;
};

/**
 * Update the tag check field on the concern complaint record.
 * Assumes the field name is "nfcu_tagcheck" on the concern complaint.
 */
// export const updateTagCheckField = async (
//   concernComplaintId: string,
//   isChecked: boolean,
// ): Promise<void> => {
//   try {
//     const entity = {
//       nfcu_tagcheck: isChecked,
//     };

//     const response = await Xrm.WebApi.updateRecord(
//       'nfcu_concerncomplaints',
//       concernComplaintId,
//       entity,
//     );
//     console.log('Successfully updated the tag check field', response);
//   } catch (error) {
//     console.error('Error updating the tag check field:', error);
//     throw error;
//   }
// };
