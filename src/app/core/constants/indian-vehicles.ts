/** Popular passenger vehicles sold in India — make → models. */
export const INDIAN_VEHICLES: Record<string, string[]> = {
  'Maruti Suzuki': [
    'Alto',
    'Alto K10',
    'S-Presso',
    'Wagon R',
    'Swift',
    'Dzire',
    'Baleno',
    'Ignis',
    'Celerio',
    'Brezza',
    'Fronx',
    'Ertiga',
    'XL6',
    'Ciaz',
    'Grand Vitara',
    'Jimny',
    'Eeco',
    'Invicto',
  ],
  Hyundai: [
    'Grand i10 Nios',
    'i20',
    'Aura',
    'Venue',
    'Exter',
    'Verna',
    'Creta',
    'Alcazar',
    'Tucson',
    'Ioniq 5',
  ],
  Tata: [
    'Tiago',
    'Tigor',
    'Altroz',
    'Punch',
    'Nexon',
    'Harrier',
    'Safari',
    'Nexon EV',
    'Punch EV',
    'Tiago EV',
  ],
  Mahindra: [
    'Bolero',
    'Bolero Neo',
    'Scorpio Classic',
    'Scorpio-N',
    'Thar',
    'XUV300',
    'XUV400 EV',
    'XUV700',
    'Marazzo',
    'BE 6',
    'XEV 9e',
  ],
  Kia: ['Sonet', 'Seltos', 'Carens', 'Carnival', 'EV6', 'Syros'],
  Toyota: [
    'Glanza',
    'Urban Cruiser Hyryder',
    'Innova Crysta',
    'Innova Hycross',
    'Fortuner',
    'Hilux',
    'Camry',
    'Vellfire',
    'Land Cruiser',
  ],
  Honda: ['Amaze', 'City', 'Elevate', 'WR-V'],
  MG: ['Comet EV', 'Astor', 'Hector', 'Hector Plus', 'Gloster', 'ZS EV', 'Windsor EV'],
  Volkswagen: ['Polo', 'Vento', 'Taigun', 'Virtus', 'Tiguan'],
  Skoda: ['Kushaq', 'Slavia', 'Octavia', 'Superb', 'Kodiaq', 'Kylaq'],
  Renault: ['Kwid', 'Triber', 'Kiger', 'Duster'],
  Nissan: ['Magnite', 'Kicks'],
  Jeep: ['Compass', 'Meridian', 'Wrangler'],
  Citroen: ['C3', 'eC3', 'C3 Aircross', 'C5 Aircross'],
  BMW: ['2 Series', '3 Series', '5 Series', 'X1', 'X3', 'X5', 'X7', 'i4', 'iX'],
  'Mercedes-Benz': ['A-Class', 'C-Class', 'E-Class', 'GLA', 'GLC', 'GLE', 'S-Class', 'EQB'],
  Audi: ['A4', 'A6', 'Q3', 'Q5', 'Q7', 'Q8', 'e-tron'],
  'Land Rover': ['Defender', 'Discovery', 'Range Rover', 'Range Rover Sport', 'Range Rover Velar'],
  Volvo: ['XC40', 'XC60', 'XC90', 'C40 Recharge'],
  Isuzu: ['D-Max V-Cross', 'mu-X'],
  Force: ['Gurkha', 'Trax Cruiser'],
  BYD: ['Atto 3', 'Seal', 'e6'],
  Other: ['Other model'],
};

/** Select value — user types make in the companion input. */
export const CUSTOM_MAKE_VALUE = '__custom_make__';

/** Select value — user types model in the companion input. */
export const CUSTOM_MODEL_VALUE = '__custom_model__';

export const FUEL_TYPES = ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid', 'LPG'] as const;

export type FuelType = (typeof FUEL_TYPES)[number];

export function indianVehicleMakes(): string[] {
  return Object.keys(INDIAN_VEHICLES)
    .filter((make) => make !== 'Other')
    .sort((a, b) => a.localeCompare(b));
}

export function resolveKnownMake(make: string): string {
  const trimmed = make?.trim() ?? '';
  if (!trimmed || trimmed in INDIAN_VEHICLES) {
    return trimmed;
  }
  const lower = trimmed.toLowerCase();
  return Object.keys(INDIAN_VEHICLES).find((key) => key.toLowerCase() === lower) ?? trimmed;
}

export function indianModelsForMake(make: string): string[] {
  const resolved = resolveKnownMake(make);
  const models = [...(INDIAN_VEHICLES[resolved] ?? [])].filter((m) => m !== 'Other model');
  return models;
}

export function isKnownVehicleMake(make: string): boolean {
  const resolved = resolveKnownMake(make);
  return !!resolved && resolved !== CUSTOM_MAKE_VALUE && resolved !== 'Other' && resolved in INDIAN_VEHICLES;
}

export function isKnownVehicleModel(make: string, model: string): boolean {
  if (!model || model === CUSTOM_MODEL_VALUE || model === 'Other model') {
    return false;
  }
  const resolvedMake = resolveKnownMake(make);
  if (!isKnownVehicleMake(resolvedMake)) {
    return false;
  }
  return indianModelsForMake(resolvedMake).includes(model);
}

export function resolveVehicleMakeModel(values: {
  make: string;
  model: string;
  makeCustom?: string;
  modelCustom?: string;
}): { make: string; model: string } {
  let make = values.make?.trim() ?? '';
  let model = values.model?.trim() ?? '';

  if (make === CUSTOM_MAKE_VALUE || make === 'Other') {
    make = values.makeCustom?.trim() ?? '';
  }
  if (model === CUSTOM_MODEL_VALUE || model === 'Other model') {
    model = values.modelCustom?.trim() ?? '';
  }

  return { make, model };
}

export function vehicleMakeModelFormDefaults(
  make?: string,
  model?: string,
): { make: string; model: string; makeCustom: string; modelCustom: string } {
  const m = make?.trim() ?? '';
  const mod = model?.trim() ?? '';

  if (m && !isKnownVehicleMake(m)) {
    return {
      make: CUSTOM_MAKE_VALUE,
      model: mod && !isKnownVehicleModel(m, mod) ? CUSTOM_MODEL_VALUE : mod,
      makeCustom: m,
      modelCustom: mod && !isKnownVehicleModel(m, mod) ? mod : '',
    };
  }

  if (m && mod && !isKnownVehicleModel(m, mod)) {
    return {
      make: m,
      model: CUSTOM_MODEL_VALUE,
      makeCustom: '',
      modelCustom: mod,
    };
  }

  return { make: m, model: mod, makeCustom: '', modelCustom: '' };
}

export const COMMON_INVOICE_SERVICES = [
  'GENERAL SERVICE',
  'LABOR CHARGES',
  'PERIODIC MAINTENANCE',
  'WHEEL ALIGNMENT',
  'WHEEL BALANCING',
  'AC SERVICE',
  'DENTING & PAINTING',
  'ENGINE DIAGNOSIS',
  'BRAKE SERVICE',
  'CLUTCH OVERHAUL',
  'SUSPENSION REPAIR',
  'ELECTRICAL WORK',
  'BATTERY REPLACEMENT SERVICE',
  'PICK & DROP',
];
