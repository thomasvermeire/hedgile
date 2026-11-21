/**
 * The periodic table (Mendeleev) for the Books metal picker. Browser-safe data.
 * Metalloids count as non-metals: only metals can be activated.
 */
export interface Element {
  number: number;
  symbol: string;
  name: string;
  /** Period (row of the table), 1-7. */
  period: number;
  /** Group (column), 1-18; null for the lanthanides and actinides. */
  group: number | null;
  /** Grid column and row of the drawn table (f-block rows sit below the main table). */
  column: number;
  row: number;
  isMetal: boolean;
}

const names =
  'Hydrogen Helium Lithium Beryllium Boron Carbon Nitrogen Oxygen Fluorine Neon Sodium Magnesium Aluminium Silicon Phosphorus Sulfur Chlorine Argon Potassium Calcium Scandium Titanium Vanadium Chromium Manganese Iron Cobalt Nickel Copper Zinc Gallium Germanium Arsenic Selenium Bromine Krypton Rubidium Strontium Yttrium Zirconium Niobium Molybdenum Technetium Ruthenium Rhodium Palladium Silver Cadmium Indium Tin Antimony Tellurium Iodine Xenon Caesium Barium Lanthanum Cerium Praseodymium Neodymium Promethium Samarium Europium Gadolinium Terbium Dysprosium Holmium Erbium Thulium Ytterbium Lutetium Hafnium Tantalum Tungsten Rhenium Osmium Iridium Platinum Gold Mercury Thallium Lead Bismuth Polonium Astatine Radon Francium Radium Actinium Thorium Protactinium Uranium Neptunium Plutonium Americium Curium Berkelium Californium Einsteinium Fermium Mendelevium Nobelium Lawrencium Rutherfordium Dubnium Seaborgium Bohrium Hassium Meitnerium Darmstadtium Roentgenium Copernicium Nihonium Flerovium Moscovium Livermorium Tennessine Oganesson'.split(
    ' '
  );

const symbols =
  'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(
    ' '
  );

/** Non-metals, metalloids (B, Si, Ge, As, Sb, Te, At), the halogens and noble gases. */
const nonMetals = new Set(
  'H He B C N O F Ne Si P S Cl Ar Ge As Se Br Kr Sb Te I Xe At Rn Ts Og'.split(' ')
);

/** Where element `z` is drawn: [period, group or null, column, row]. */
function position(z: number): [number, number | null, number, number] {
  if (z === 1) return [1, 1, 1, 1];
  if (z === 2) return [1, 18, 18, 1];
  if (z <= 4) return [2, z - 2, z - 2, 2];
  if (z <= 10) return [2, z + 8, z + 8, 2];
  if (z <= 12) return [3, z - 10, z - 10, 3];
  if (z <= 18) return [3, z, z, 3];
  if (z <= 36) return [4, z - 18, z - 18, 4];
  if (z <= 54) return [5, z - 36, z - 36, 5];
  if (z <= 56) return [6, z - 54, z - 54, 6];
  if (z <= 71) return [6, null, z - 54, 9]; // lanthanides, drawn below the table
  if (z <= 86) return [6, z - 68, z - 68, 6];
  if (z <= 88) return [7, z - 86, z - 86, 7];
  if (z <= 103) return [7, null, z - 86, 10]; // actinides
  return [7, z - 100, z - 100, 7];
}

export const elements: readonly Element[] = symbols.map((symbol, i) => {
  const number = i + 1;
  const [period, group, column, row] = position(number);
  return {
    number,
    symbol,
    name: names[i] ?? symbol,
    period,
    group,
    column,
    row,
    isMetal: !nonMetals.has(symbol),
  };
});

const bySymbol = new Map(elements.map((e) => [e.symbol, e]));

export function findElement(symbol: string): Element | undefined {
  return bySymbol.get(symbol);
}
