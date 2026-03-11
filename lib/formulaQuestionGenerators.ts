import type { BitsQuestion } from "@/data/deepDiveContent";

/**
 * Formula practice question generators for the Deep Dive "Regenerate" button.
 *
 * IMPORTANT: Whenever new practiceFormulas are added in testbee/data/deepDiveContent.ts,
 * you MUST add regeneration support here so the Regenerate button works automatically:
 * 1. Implement a generator function that returns BitsQuestion[] with new numbers/options.
 * 2. Add the formula's exact name (PracticeFormula.name) to REGENERATABLE_FORMULAS below.
 * 3. In generateFormulaQuestions(), add a branch for that formula name returning the generated set.
 * Do this without being askedâ€”the user should not have to remind you.
 */

/** Random integer in [a, b] inclusive. */
function randInt(a: number, b: number): number {
  return a + Math.floor(Math.random() * (b - a + 1));
}

/** Random choice from a few preset values for variety. */
function oneOf<T>(...vals: T[]): T {
  return vals[Math.floor(Math.random() * vals.length)]!;
}

/** Shuffle array and return new array plus mapping: newIndex -> oldIndex. */
function shuffleWithMapping<T>(arr: T[]): { shuffled: T[]; oldIndexToNew: number[] } {
  const indexed = arr.map((x, i) => ({ x, i }));
  indexed.sort(() => Math.random() - 0.5);
  const shuffled = indexed.map((p) => p.x);
  const oldIndexToNew = new Array(arr.length);
  indexed.forEach((p, newIdx) => { oldIndexToNew[p.i] = newIdx; });
  return { shuffled, oldIndexToNew };
}

/** Return a copy of the question with options shuffled and correctAnswer updated. */
function shuffleOptions(q: BitsQuestion): BitsQuestion {
  const { shuffled, oldIndexToNew } = shuffleWithMapping(q.options);
  return {
    question: q.question,
    options: shuffled,
    correctAnswer: oldIndexToNew[q.correctAnswer] ?? 0,
    solution: q.solution,
  };
}

/** Build four options with correct at correctIndex; distractors are wrong values. */
function buildOptions(
  correctValue: number,
  distractors: number[],
  format: (n: number) => string
): { options: string[]; correctIndex: number } {
  const correctStr = format(correctValue);
  const wrongSet = new Set(distractors.filter((d) => d !== correctValue));
  const wrongStrs = [...wrongSet].map(format);
  const all = [correctStr];
  for (const w of wrongStrs) {
    if (all.length >= 4) break;
    if (!all.includes(w)) all.push(w);
  }
  const fallbacks = [correctValue - 1, correctValue + 1, correctValue - 2, correctValue + 2, correctValue * 2];
  for (const v of fallbacks) {
    if (all.length >= 4) break;
    const s = format(v);
    if (!all.includes(s)) all.push(s);
  }
  const shuffled = all.slice().sort(() => Math.random() - 0.5);
  const correctIndex = shuffled.indexOf(correctStr);
  return { options: shuffled, correctIndex };
}

/** PV = nRT: rigid wall, V constant. P2 = P1 * (T2/T1). */
function genRigidWallP(): BitsQuestion {
  const P1 = oneOf(1, 2, 3);
  const T1 = randInt(250, 350);
  const T2 = randInt(400, 600);
  if (T2 === T1) return genRigidWallP();
  const P2 = Math.round((P1 * T2) / T1 * 100) / 100;
  const P2Int = P2 === Math.floor(P2) ? Math.round(P2) : P2;
  const { options, correctIndex } = buildOptions(
    P2Int,
    [
      Math.round((P1 * T1) / T2 * 100) / 100,
      P1,
      P1 * 2,
      T2 / T1,
    ],
    (n) => (Number.isInteger(n) ? `${n}` : n.toFixed(2)) + " atm"
  );
  return {
    question: `A gas is trapped inside a steel canister with perfectly rigid walls. The initial Pressure is ${P1} atm, and the Temperature is ${T1} K. If you heat the canister until the Temperature reaches ${T2} K, what is the new Pressure inside?`,
    options,
    correctAnswer: correctIndex,
    solution: `Since Volume (V) and R are constant, P is directly proportional to T. Pâ‚‚ = Pâ‚ Ã— (Tâ‚‚/Tâ‚) = ${P1} Ã— (${T2}/${T1}) = ${typeof P2Int === "number" && Number.isInteger(P2Int) ? P2Int : P2Int.toFixed(2)} atm.`,
  };
}

/** PV = nRT: balloon, P constant. V2 = V1 * (T2/T1). */
function genBalloonV(): BitsQuestion {
  const V1 = oneOf(3, 4, 5, 6);
  const T1 = randInt(280, 300);
  const T2 = randInt(310, 340);
  if (T2 === T1) return genBalloonV();
  const V2 = Math.round((V1 * T2) / T1 * 10) / 10;
  const { options, correctIndex } = buildOptions(
    V2,
    [
      Math.round((V1 * T1) / T2 * 10) / 10,
      V1,
      V1 * 2,
      Math.round(V1 * (T2 / T1) * 10) / 10 + 0.5,
    ],
    (n) => (Number.isInteger(n) ? `${n}` : n.toFixed(1)) + " Liters"
  );
  return {
    question: `A student fills a balloon (movable diathermic wall) with ${V1} Liters of gas in a cool room at ${T1} K. The student then takes the balloon outside where the temperature is ${T2} K. Assuming atmospheric pressure remains constant, what is the new Volume of the balloon?`,
    options,
    correctAnswer: correctIndex,
    solution: `Pressure (P) is constant (movable balloon). V âˆ T. Vâ‚‚ = Vâ‚ Ã— (Tâ‚‚/Tâ‚) = ${V1} Ã— (${T2}/${T1}) = ${V2} Liters.`,
  };
}

/** Kelvin trap: rigid bulb, temps in Â°C; must convert to K. P2 = P1 * (T2K/T1K). */
function genKelvinTrap(): BitsQuestion {
  const t1 = oneOf(27, 20, 30, 25);
  const t2 = oneOf(54, 40, 60, 50);
  if (t2 <= t1) return genKelvinTrap();
  const T1 = t1 + 273.15;
  const T2 = t2 + 273.15;
  const P1 = 1;
  const P2 = Math.round((P1 * T2) / T1 * 100) / 100;
  const trapAnswer = 2; // 2.00 atm (wrong: doubling pressure)
  const { options, correctIndex } = buildOptions(
    P2,
    [trapAnswer, 0.5, 4.0, P2 + 0.5],
    (n) => n.toFixed(2) + " atm"
  );
  return {
    question: `THE KELVIN TRAP: A rigid, sealed glass bulb contains gas at ${t1}Â°C with a pressure of 1 atm. You heat the bulb to ${t2}Â°C. What is the new pressure of the gas?`,
    options,
    correctAnswer: correctIndex,
    solution: `You cannot use Celsius in the Ideal Gas Law. Convert to Kelvin: Tâ‚ = ${t1 + 273} K, Tâ‚‚ = ${t2 + 273} K. Pâ‚‚ = Pâ‚ Ã— (Tâ‚‚/Tâ‚) = 1 Ã— (${(T2 / T1).toFixed(3)}) â‰ˆ ${P2.toFixed(2)} atm.`,
  };
}

/** Syringe: T constant. P2 = P1 * (V1/V2). */
function genSyringeP(): BitsQuestion {
  const P1 = 1;
  const V1 = oneOf(10, 20, 15);
  const V2 = oneOf(5, 4, 8);
  if (V2 >= V1) return genSyringeP();
  const P2 = Math.round((P1 * V1) / V2 * 10) / 10;
  const P2Int = P2 === Math.floor(P2) ? Math.round(P2) : P2;
  const { options, correctIndex } = buildOptions(
    P2Int,
    [
      Math.round((P1 * V2) / V1 * 10) / 10,
      P1,
      V1 / V2 + 1,
      P2 / 2,
    ],
    (n) => (Number.isInteger(n) ? `${n}` : n.toFixed(1)) + " atm"
  );
  return {
    question: `You have a syringe with a movable plunger. The gas inside has a Volume of ${V1} mL at a Pressure of 1 atm. You slowly crush the plunger down until the Volume is only ${V2} mL. Because you did it slowly, the Temperature (T) remained constant. What is the new Pressure inside the syringe?`,
    options,
    correctAnswer: correctIndex,
    solution: `T is constant, so PÃ—V = constant. Pâ‚‚ = Pâ‚ Ã— (Vâ‚/Vâ‚‚) = 1 Ã— (${V1}/${V2}) = ${P2Int} atm.`,
  };
}

/** Rigid tank: double moles, T and V constant. P2 = 2*P1. */
function genMolesDoubled(): BitsQuestion {
  const P1 = oneOf(2, 3, 4);
  const P2 = P1 * 2;
  const { options, correctIndex } = buildOptions(
    P2,
    [P1, P1 / 2, P1 * 3, P1 + 2],
    (n) => `${n} atm`
  );
  return {
    question: `A rigid adiabatic tank holds a specific amount of gas (n moles) at ${P1} atm. You inject more gas, doubling the number of moles. The temperature remains constant. What is the new pressure?`,
    options,
    correctAnswer: correctIndex,
    solution: `Rigid walls â†’ V locked. T constant. PV = nRT â‡’ P âˆ n. Doubling moles doubles pressure: ${P1} Ã— 2 = ${P2} atm.`,
  };
}

/**
 * Formula names that support regeneration (numeric and/or option shuffle).
 * When adding a new formula in deepDiveContent.ts practiceFormulas, add its exact .name here
 * and implement its generator in generateFormulaQuestions() below.
 */
const REGENERATABLE_FORMULAS = new Set([
  "PV = nRT (Equation of State)",
  "Condition for Equilibrium (T_A = T_B)",
  "Dynamic Balance Equation (Q_net = 0)",
  "Logical Proof of the Zeroth Law",
  "Absolute Temperature Conversion",
  "Universal Thermometer Formula",
]);

export function canRegenerate(formulaName: string): boolean {
  return REGENERATABLE_FORMULAS.has(formulaName);
}

/** Generate a fresh set of formula questions. For shuffle-only formulas, pass current questions so options can be reshuffled. */
export function generateFormulaQuestions(formulaName: string, currentQuestions?: BitsQuestion[]): BitsQuestion[] {
  if (formulaName === "PV = nRT (Equation of State)") {
    return [
      genRigidWallP(),
      genBalloonV(),
      genKelvinTrap(),
      genSyringeP(),
      genMolesDoubled(),
    ];
  }

  if (formulaName === "Condition for Equilibrium (T_A = T_B)") {
    return genConditionEquilibrium();
  }

  if (formulaName === "Dynamic Balance Equation (Q_net = 0)") {
    return genDynamicBalance();
  }

  if (formulaName === "Logical Proof of the Zeroth Law") {
    return (currentQuestions ?? []).map(shuffleOptions);
  }

  if (formulaName === "Absolute Temperature Conversion") {
    return genAbsoluteTempConversion(currentQuestions);
  }

  if (formulaName === "Universal Thermometer Formula") {
    return genUniversalThermometer(currentQuestions);
  }

  if (currentQuestions?.length) {
    return currentQuestions.map(shuffleOptions);
  }
  return [];
}

// ----- 1.2: Condition for Equilibrium (T_A = T_B) â€” numeric variants -----
function shuffleFour(correctIndex: number, opts: [string, string, string, string]): { options: string[]; correctAnswer: number } {
  const { shuffled, oldIndexToNew } = shuffleWithMapping([opts[0], opts[1], opts[2], opts[3]]);
  return { options: shuffled, correctAnswer: oldIndexToNew[correctIndex] ?? 0 };
}

function genConditionEquilibrium(): BitsQuestion[] {
  const mass1 = oneOf(30, 50, 40);
  const mass2 = oneOf(10, 5, 15);
  const T_same = oneOf(50, 40, 60);
  const Ua = oneOf(3000, 5000, 4000);
  const Ta = 300;
  const Ub = oneOf(200, 150, 300);
  const Tb = 400;
  const Tx = oneOf(70, 80, 60);
  const Ty = oneOf(20, 30, 15);
  const s1 = shuffleFour(2, [
    "From the massive iron block to the tiny coin because it has more total energy.",
    "From the copper coin to the iron block.",
    "Heat will flow back and forth, but the net flow is zero because T_iron = T_copper.",
    "The iron will absorb the coin's energy due to its higher mass.",
  ]);
  const s2 = shuffleFour(1, [
    "Heat flows from System A to System B because A has more total energy.",
    "Heat flows from System B to System A because T_B > T_A.",
    "No heat flows because the system is mathematically unbalanced.",
    "Heat flows from A to B until their internal energies are exactly equal.",
  ]);
  const s3 = shuffleFour(0, [
    "Heat flows from the coffee to the iceberg strictly because T_coffee > T_iceberg.",
    "Heat flows from the iceberg to the coffee because the iceberg has vastly more total internal energy.",
    "Heat flows from the ocean into the coffee.",
    "No heat flows because the size difference is too large for equilibrium to occur.",
  ]);
  const s4 = shuffleFour(2, [
    "The moment Liquid X hits 0Â°C.",
    "The moment the two lines cross and diverge again.",
    "The exact point where the two lines merge into a single, flat horizontal line (T_X = T_Y).",
    "The moment Liquid Y's temperature begins to drop.",
  ]);
  return [
    { question: `You place a massive ${mass1} kg block of iron at ${T_same}Â°C directly against a tiny ${mass2} gram copper coin at ${T_same}Â°C. Which direction will heat flow?`, ...s1, solution: "The trap is thinking mass matters. It doesn't. If T_A = T_B, the condition for equilibrium is met. Heat moves back and forth, but net flow is zero." },
    { question: `System A has an internal energy of ${Ua} J and a temperature of ${Ta} K. System B has an internal energy of ${Ub} J and a temperature of ${Tb} K. If connected by a diathermic wall, what happens?`, ...s2, solution: "Total internal energy is irrelevant to the direction of heat flow. Heat strictly flows from higher temperature to lower temperature." },
    { question: "THE ICEBERG TRAP: An entire iceberg in the ocean contains billions of Joules of internal energy. A single cup of boiling coffee contains only a few thousand Joules. If you pour the coffee onto the iceberg, what dictates the direction of heat flow?", ...s3, solution: "The iceberg has billions of Joules, but its temperature is lower. Heat only cares about the temperature gradient: Hot to Cold." },
    { question: `A student looks at a Temperature vs. Time graph showing two liquids placed in the same insulated container. Liquid X starts at ${Tx}Â°C and Liquid Y starts at ${Ty}Â°C. How do you identify the exact moment thermal equilibrium is reached on the graph?`, ...s4, solution: "Equilibrium is the mathematical state where T_X = T_Y. On a graph, this is where the temperature curves flatten out and become identical." },
  ];
}

// ----- 1.2: Dynamic Balance (Q_net = 0) â€” numeric variants -----
function genDynamicBalance(): BitsQuestion[] {
  const J1 = oneOf(30, 50, 80);
  const Qout = oneOf(5, 4, 6);
  const Qin = oneOf(2, 1, 3);
  const Qnet = Qin - Qout;
  const roomT = oneOf(25, 20, 30);
  const { shuffled: opts4, oldIndexToNew } = shuffleWithMapping([
    "Yes, because heat is flowing in both directions.",
    `No, because Q_net = ${Qnet} J. Block A is actively cooling down and has not reached equilibrium.`,
    "Yes, because the total energy inside the insulated box is conserved.",
    "No, because Q_in must be zero for equilibrium to occur.",
  ]);
  return [
    {
      question: `Two gases, System A and System B, are in perfect thermal equilibrium. At the microscopic level, if ${J1} J of thermal energy transfers from System A to System B in one second, what else MUST mathematically occur in that exact same second?`,
      options: shuffleWithMapping([
        `The temperature of System B must increase by ${J1} K.`,
        `Exactly ${J1} J of thermal energy must transfer back from System B to System A, making Q_net = 0.`,
        "System A must drop in pressure to compensate for the lost energy.",
        "The diathermic wall must absorb the " + J1 + " J of energy.",
      ]).shuffled,
      correctAnswer: shuffleWithMapping([
        `The temperature of System B must increase by ${J1} K.`,
        `Exactly ${J1} J of thermal energy must transfer back from System B to System A, making Q_net = 0.`,
        "System A must drop in pressure to compensate for the lost energy.",
        "The diathermic wall must absorb the " + J1 + " J of energy.",
      ]).oldIndexToNew[1] ?? 0,
      solution: "Dynamic equilibrium dictates that Q_in must exactly equal Q_out. If " + J1 + " J leaves, " + J1 + " J must return to keep the state variables locked.",
    },
    (() => {
      const s = shuffleFour(0, [
        "Because molecules at " + roomT + "Â°C are still moving and colliding, so they continuously transfer energy, but they absorb an equal amount back from the room.",
        "Because the tea will eventually drop to 0Â°C.",
        "Because the room is an adiabatic system.",
        "Because the tea molecules stop moving entirely at room temperature.",
      ]);
      return {
        question: `THE STATIC TRAP: A student claims that once a cup of hot tea cools down and matches the room temperature (${roomT}Â°C), the tea molecules stop transferring heat to the room molecules entirely (Q_out = 0). Why is this physically impossible?`,
        ...s,
        solution: "Atoms don't freeze at room temperature. They constantly collide with the air. Heat goes out, but identical heat comes in. The student fell for the static trap.",
      };
    })(),
    (() => {
      const s = shuffleFour(2, ["Q_in = 0 and Q_out = 0", "Q_in > Q_out", "Q_in = Q_out, therefore Q_net = 0", "Q_net = Q_in + Q_out"]);
      return {
        question: "If a system is in thermal equilibrium with its surroundings, which of the following equations accurately represents the energy exchange?",
        ...s,
        solution: "This is the strict definition of the dynamic balance equation.",
      };
    })(),
    {
      question: `You are monitoring a sealed, insulated box containing two blocks of metal. The computer shows that Block A is continuously losing ${Qout} Joules of heat per millisecond (Q_out = ${Qout} J), and gaining ${Qin} Joules of heat per millisecond (Q_in = ${Qin} J). Is this system in thermal equilibrium?`,
      options: opts4,
      correctAnswer: oldIndexToNew[1] ?? 0,
      solution: `For equilibrium Q_net must be 0. Here Q_net = ${Qin} - ${Qout} = ${Qnet} J, so Block A is cooling.`,
    },
  ];
}

// ----- 1.3: Absolute Temperature Conversion â€” delta trap variant + shuffle rest -----
function genAbsoluteTempConversion(currentQuestions?: BitsQuestion[]): BitsQuestion[] {
  const delta = oneOf(5, 10, 15, 20);
  const s = shuffleFour(1, [
    `An increase of ${273.15 + delta} K`,
    `An increase of ${delta} K`,
    `A decrease of ${delta} K`,
    "An increase of 273.15 K",
  ]);
  const deltaQuestion: BitsQuestion = {
    question: `THE DELTA TRAP: An engine block's temperature increases by exactly ${delta}Â°C during operation. What is the corresponding mathematical change in its Kelvin temperature?`,
    ...s,
    solution: "The step size (delta) of 1 degree Celsius equals the step size of 1 Kelvin. The change is " + delta + " K, not 273.15 + " + delta + ".",
  };
  if (!currentQuestions || currentQuestions.length < 4) {
    return currentQuestions ? currentQuestions.map(shuffleOptions) : [deltaQuestion];
  }
  const [q0, q1, , q3] = currentQuestions;
  return [shuffleOptions(q0!), shuffleOptions(q1!), deltaQuestion, shuffleOptions(q3!)];
}

// ----- 1.3: Universal Thermometer â€” denominator variant + shuffle rest -----
function genUniversalThermometer(currentQuestions?: BitsQuestion[]): BitsQuestion[] {
  const freeze = oneOf(10, 20, 0);
  const boil = oneOf(50, 80, 100);
  if (boil <= freeze) return genUniversalThermometer(currentQuestions);
  const denom = boil - freeze;
  const wrongs = [freeze, boil, denom + 20].filter((w) => w !== denom);
  const { options, correctIndex } = buildOptions(denom, wrongs, (n) => `${n}`);
  const denominatorQuestion: BitsQuestion = {
    question: `You build a custom "Student Scale" for a lab where water freezes at ${freeze}Â°S and boils at ${boil}Â°S. What is the exact numerical value of the denominator for your custom scale in the ratio equation?`,
    options,
    correctAnswer: correctIndex,
    solution: `Denominator = Boiling âˆ’ Freezing = ${boil} âˆ’ ${freeze} = ${denom}.`,
  };
  if (!currentQuestions || currentQuestions.length < 4) {
    return currentQuestions ? currentQuestions.map(shuffleOptions) : [denominatorQuestion];
  }
  const [q0, , q2, q3] = currentQuestions;
  return [shuffleOptions(q0!), denominatorQuestion, shuffleOptions(q2!), shuffleOptions(q3!)];
}
