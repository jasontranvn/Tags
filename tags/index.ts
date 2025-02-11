import { IInputs, IOutputs } from './generated/ManifestTypes';
import * as React from 'react';
import * as ReactDOM from 'react-dom';
import MultiSelectDropdown from './components/MultiSelectDropdown';
import { fetchSelectedConcernTags } from './services/concernTagService';
import { ConcernTag } from './services/types';

export class tags
  implements ComponentFramework.ReactControl<IInputs, IOutputs>
{
  private _notifyOutputChanged: () => void;
  private _concernComplaintId: string = '';
  private _selectedValues: ConcernTag[] = [];

  constructor() {}

  public async init(
    context: ComponentFramework.Context<IInputs>,
    notifyOutputChanged: () => void,
    state: ComponentFramework.Dictionary,
  ): Promise<void> {
    this._notifyOutputChanged = notifyOutputChanged;
    this._concernComplaintId =
      context.parameters.concernId.raw?.replace(/[{}]/g, '') || '';

    console.log(`Start the control: ${this._concernComplaintId}`);

    if (this._concernComplaintId) {
      try {
        this._selectedValues = await fetchSelectedConcernTags(
          this._concernComplaintId,
        );
        this._notifyOutputChanged();
      } catch (error) {
        console.error('Error initializing the Concern Tag Control:', error);
      }
    }
  }

  public updateView(
    context: ComponentFramework.Context<IInputs>,
  ): React.ReactElement {
    return React.createElement(MultiSelectDropdown, {
      concernComplaintId: this._concernComplaintId,
      selectedOptions: this._selectedValues,
    });
  }

  public getOutputs(): IOutputs {
    return {};
  }

  public destroy(): void {}
}
