import * as React from 'react';
import { useState, useEffect } from 'react';
import {
  TagPicker,
  TagPickerControl,
  TagPickerGroup,
  TagPickerList,
  TagPickerOption,
  TagPickerInput,
  useTagPickerFilter,
  Tag,
  Field,
  FluentProvider,
  teamsLightTheme,
} from '@fluentui/react-components';

import {
  fetchSelectedConcernTags,
  fetchAvailableConcernTags,
  addTagToBridgeTable,
  removeTagFromBridgeTable,
  getCurrentUserId,
  fetchUserTeams,
} from '../services/concernTagService';
import { ConcernTag, MultiSelectDropdownProps } from '../services/types';

const MultiSelectDropdown: React.FC<MultiSelectDropdownProps> = ({
  concernComplaintId,
  selectedOptions: initialSelectedTags,
}) => {
  const [query, setQuery] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<ConcernTag[]>([]);
  const [availableTags, setAvailableTags] = useState<ConcernTag[]>([]);
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [userTeams, setUserTeams] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    const initData = async () => {
      const teams = await fetchUserTeams();
      setUserTeams(teams);

      const sel = await fetchSelectedConcernTags(concernComplaintId);

      const mappedSel = sel.map((tag) => ({
        ...tag,
        owner: teams.get(tag.owner) || tag.owner, // Convert GUID to Name, fallback to GUID if missing
        bridgeRecordId: tag.bridgeRecordId,
      }));

      setSelectedTags(mappedSel);

      const avail = await fetchAvailableConcernTags();
      const filteredAvail = avail.filter(
        (tag) => !sel.some((s) => s.id === tag.id),
      );
      setAvailableTags(filteredAvail);
    };
    initData();
  }, [concernComplaintId]);

  // Build a map for TagPicker filter
  const availableTagIds = availableTags.map((t) => t.id);
  const tagMap = new Map(availableTags.map((t) => [t.id, t]));

  const filteredOptionElements = useTagPickerFilter({
    query,
    options: availableTagIds,
    noOptionsElement: (
      <TagPickerOption value="no-matches" text="No options available">
        <div>No options available</div>
      </TagPickerOption>
    ),
    renderOption: (optionId: string) => {
      const tag = tagMap.get(optionId);
      if (!tag) return <></>;
      return (
        <TagPickerOption key={tag.id} value={tag.id} text={tag.label}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '14px' }}>{tag.label}</span>
            <span style={{ fontSize: '12px', color: 'gray' }}>{tag.owner}</span>
          </div>
        </TagPickerOption>
      );
    },
    filter: (optionId: string) => {
      const tag = tagMap.get(optionId);
      return tag
        ? tag.label.toLowerCase().includes(query.toLowerCase())
        : false;
    },
  });

  const onOptionSelect = ((ev, data) => {
    if (data.value === 'no-matches') return;
    const found = availableTags.find((o) => o.id === data.value);
    if (found) {
      handleAddTag(found);
      setQuery('');
    }
  }) as any;

  const handleAddTag = async (tag: ConcernTag) => {
    const userId = getCurrentUserId();
    const newBridgeRecordId = await addTagToBridgeTable(
      concernComplaintId,
      tag.id,
      tag.label,
      userId,
    );
    if (newBridgeRecordId) {
      console.log(
        `Tag added successfully: ${tag.label} with Bridge ID: ${newBridgeRecordId}`,
      );

      const newTag: ConcernTag = {
        ...tag,
        bridgeRecordId: newBridgeRecordId,
        owner: userTeams.get(tag.owner) || tag.owner,
      };
      setSelectedTags((prev) => [...prev, newTag]);
      setAvailableTags((prev) => prev.filter((x) => x.id !== tag.id));
    }
  };

  const handleRemoveTag = async (tag: ConcernTag) => {
    console.log('Attempting to remove tag:', tag);
    console.log('User Teams:', Array.from(userTeams.entries()));

    const canRemove = Array.from(userTeams.values()).includes(tag.owner);
    if (!canRemove) {
      console.warn(
        `User cannot remove tag: ${tag.label} (Owner: ${tag.owner})`,
      );
      return;
    }

    if (!tag.bridgeRecordId) {
      console.error('Tag has no bridgeRecordId, cannot remove.');
      return;
    }

    try {
      const success = await removeTagFromBridgeTable(tag.bridgeRecordId);

      if (success) {
        console.log(`Tag ${tag.label} removed successfully!`);
        setSelectedTags((prev) => prev.filter((t) => t.id !== tag.id));
        setAvailableTags((prev) => [...prev, tag]);
      } else {
        console.error('Failed to remove tag from bridge table:', tag);
      }
    } catch (error) {
      console.error('Error removing tag:', error);
    }
  };

  return (
    <FluentProvider
      theme={teamsLightTheme}
      style={{ width: '100%', display: 'flex', flexGrow: 1 }}
    >
      <Field style={{ width: '100%', display: 'flex', flexGrow: 1 }}>
        <TagPicker
          selectedOptions={selectedTags.map((tag) => tag.id)}
          onOptionSelect={onOptionSelect}
          onOpenChange={(_, { open }) => setIsOpen(open)}
        >
          <TagPickerControl
            style={{ width: '100%', display: 'flex', flexGrow: 1 }}
          >
            <TagPickerGroup aria-label="Selected Tags">
              {selectedTags.map((tag) => {
                const canRemove = Array.from(userTeams.values()).includes(
                  tag.owner,
                );
                console.log(
                  `Checking if tag "${tag.label}" is removable. Owner (GUID): ${tag.owner}, Can Remove: ${canRemove}, bridgeID: ${tag.bridgeRecordId}`,
                );

                return (
                  <Tag
                    appearance="filled"
                    shape="rounded"
                    key={tag.id}
                    dismissible={canRemove}
                    onClick={(ev) => {
                      if (canRemove) {
                        ev.preventDefault();
                        handleRemoveTag(tag);
                      }
                    }}
                    primaryText={tag.label}
                    secondaryText={tag.owner}
                    style={{ minHeight: '35px' }}
                  ></Tag>
                );
              })}
            </TagPickerGroup>
            <TagPickerInput
              aria-label="Select tags"
              value={query}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setQuery(e.target.value)
              }
              placeholder={selectedTags.length === 0 ? 'Select Tags' : ''}
            />
          </TagPickerControl>
          <TagPickerList>{filteredOptionElements}</TagPickerList>
        </TagPicker>
      </Field>
    </FluentProvider>
  );
};

export default MultiSelectDropdown;
