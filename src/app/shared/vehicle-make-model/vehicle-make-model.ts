import { Component, computed, inject, input, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { ControlContainer, FormGroup, ReactiveFormsModule } from '@angular/forms';
import {
  CUSTOM_MAKE_VALUE,
  FUEL_TYPES,
  indianModelsForMake,
  indianVehicleMakes,
  isKnownVehicleMake,
  resolveKnownMake,
  resolveVehicleMakeModel,
} from '../../core/constants/indian-vehicles';

@Component({
  selector: 'app-vehicle-make-model',
  standalone: true,
  imports: [ReactiveFormsModule],
  encapsulation: ViewEncapsulation.None,
  viewProviders: [
    {
      provide: ControlContainer,
      useFactory: () => inject(ControlContainer, { skipSelf: true }),
    },
  ],
  templateUrl: './vehicle-make-model.html',
  styleUrl: './vehicle-make-model.scss',
})
export class VehicleMakeModel implements OnInit {
  private readonly controlContainer = inject(ControlContainer);

  readonly makeId = input('vehMake');
  readonly modelId = input('vehModel');
  readonly yearId = input('vehYear');
  readonly fuelId = input('vehFuel');
  readonly registrationId = input('custReg');
  readonly colorId = input('vehColor');
  readonly showRegistration = input(false);
  readonly showYear = input(false);
  readonly showFuelType = input(false);
  readonly showColor = input(false);
  readonly registrationRequired = input(true);
  readonly registrationInvalid = input(false);
  readonly registrationError = input('');
  readonly compact = input(true);
  readonly sizeSm = input(false);

  readonly otherMakeValue = CUSTOM_MAKE_VALUE;
  readonly fuelTypes = FUEL_TYPES;
  readonly carMakes = indianVehicleMakes();
  readonly selectedMake = signal('');
  readonly customMakeMode = signal(false);

  readonly models = computed(() => indianModelsForMake(this.selectedMake()));
  readonly hasModelOptions = computed(() => this.models().length > 0);

  get form(): FormGroup {
    return this.controlContainer.control as FormGroup;
  }

  get fieldClass(): string {
    const size = this.compact() || this.sizeSm() ? 'form-control-sm' : '';
    return ['form-control', 'cv-field-input', 'text-uppercase', size].filter(Boolean).join(' ');
  }

  get plainFieldClass(): string {
    const size = this.compact() || this.sizeSm() ? 'form-control-sm' : '';
    return ['form-control', 'cv-field-input', 'text-uppercase', size].filter(Boolean).join(' ');
  }

  get selectClass(): string {
    const size = this.compact() || this.sizeSm() ? 'form-select-sm' : '';
    return ['form-select', 'cv-field-input', 'text-uppercase', size].filter(Boolean).join(' ');
  }

  ngOnInit(): void {
    const resolved = resolveVehicleMakeModel({
      make: this.form.get('make')?.value ?? '',
      model: this.form.get('model')?.value ?? '',
      makeCustom: this.form.get('makeCustom')?.value ?? '',
      modelCustom: this.form.get('modelCustom')?.value ?? '',
    });

    const knownMake = resolveKnownMake(resolved.make);
    const useCustomMake = !!resolved.make && !isKnownVehicleMake(knownMake);

    this.customMakeMode.set(useCustomMake);
    this.form.patchValue(
      {
        make: useCustomMake ? CUSTOM_MAKE_VALUE : knownMake,
        makeCustom: useCustomMake ? resolved.make : '',
        model: resolved.model,
        modelCustom: '',
      },
      { emitEvent: false },
    );
    this.selectedMake.set(useCustomMake ? resolved.make : knownMake);
  }

  onMakeSelect(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    if (value === CUSTOM_MAKE_VALUE) {
      this.customMakeMode.set(true);
      this.selectedMake.set('');
      this.form.patchValue({ make: CUSTOM_MAKE_VALUE, makeCustom: '', model: '' });
      return;
    }

    this.customMakeMode.set(false);
    this.selectedMake.set(value);
    this.form.patchValue({ make: value, makeCustom: '', model: '' });
  }

  onCustomMakeInput(event: Event): void {
    const make = (event.target as HTMLInputElement).value.trim();
    this.selectedMake.set(make);
    this.form.patchValue({ makeCustom: make }, { emitEvent: false });
  }

  useMakeList(): void {
    this.customMakeMode.set(false);
    this.selectedMake.set('');
    this.form.patchValue({ make: '', makeCustom: '', model: '' });
  }

  pickModel(event: Event): void {
    const select = event.target as HTMLSelectElement;
    const model = select.value;
    if (!model) {
      return;
    }
    this.form.patchValue({ model });
    select.value = '';
  }
}
