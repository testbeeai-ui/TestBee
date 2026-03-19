import type { Subject } from "@/types";
import type { ClassLevel } from "@/types";
import type { DifficultyLevel } from "@/lib/slugs";

/**
 * Deep Dive content is COMPLETELY SEPARATE from topic theory.
 * Content you add here appears ONLY on the Deep Dive page.
 * It does NOT affect or reflect on the topic overview page.
 *
 * CRITICAL: Deep Dive is LEVEL-SPECIFIC. Basic, Intermediate, and Advanced
 * each have SEPARATE content. Add separate entries per level.
 *
 * Key: subject | classLevel | topic | subtopicName | sectionIndex (0,1,2...) | level (basics|intermediate|advanced)
 * When no content exists for a section+level → Deep Dive shows blank page with empty InstaCue.
 */

export interface DeepDiveReference {
  type: "video" | "reading";
  title: string;
  description?: string;
  url: string;
}

/** Single Bits MCQ for one-at-a-time quiz display (like explore Bits). */
export interface BitsQuestion {
  question: string;
  options: string[];
  correctAnswer: number;
  solution?: string;
}

/** One formula with its own Bits/MCQ practice set. */
export interface PracticeFormula {
  name: string;
  formulaLatex?: string;
  description?: string;
  bitsQuestions: BitsQuestion[];
}

export interface DeepDiveEntry {
  title: string;
  content: string;
  references?: DeepDiveReference[];
  didYouKnow?: string;
  playableElements?: string[];
  /** Legacy: full bits as markdown (fallback if bitsQuestions not set). */
  bits?: string;
  /** Structured Bits MCQs — shown one question at a time with Previous/Next (recommended). */
  bitsQuestions?: BitsQuestion[];
  /** Formula practice: pick a formula, then answer Bits for that formula. */
  practiceFormulas?: PracticeFormula[];
}

function key(
  subject: Subject,
  classLevel: ClassLevel,
  topic: string,
  subtopicName: string,
  sectionIndex: number,
  level: DifficultyLevel
): string {
  return `${subject}|${classLevel}|${topic}|${subtopicName}|${sectionIndex}|${level}`;
}

const deepDiveMap: Record<string, DeepDiveEntry> = {
  // ----- BASIC level - Subtopic 1.1 -----
  [key("physics", 11, "Thermodynamics", "Thermal equilibrium and zeroth law", 0, "basics")]: {
    title: "Subtopic 1.1: State Variables & Thermodynamic Walls (Level: Basic - Deep Dive Edition)",
    content: `**1. The Concept of the "System" (Defining your Universe)**

Before you can apply a single law of physics, you must draw an imaginary line around what you are studying. This is the **System**. Everything outside that line is the **Surroundings**.

* **The Universe:** In thermodynamics, System + Surroundings = The Universe.
* **The Visualization:** Imagine a piston-cylinder filled with air. The air is the System. The metal walls, the piston head, and the air in the room are the Surroundings.
* **The "Why":** If you don't define your system clearly, your energy calculations will be wrong. Are you measuring the heat lost by the coffee, or the heat gained by the cup?

**2. State Variables: The "DNA" of a Gas**

Instead of tracking billions of molecules, we use **Macroscopic Variables**. Think of these as the "Vital Signs" of a patient.

![From chaos to order: understanding gas pressure — microscopic collisions create macroscopic pressure](/images/gas-pressure-micro-to-macro.png)

* **Pressure ($P$):** This is the "Force" of the gas. On a microscopic level, it is the result of billions of molecules slamming into the walls every second.

*Deep Insight:* If the molecules stop moving, Pressure becomes zero.

* **Volume ($V$):** The 3D space the system occupies.

* **Temperature ($T$):** The average "Speed" (Kinetic Energy) of the molecules.

*Deep Insight:* If you double the temperature (in Kelvin), you are doubling the average energy of every single molecule in that jar.

* **Mass ($m$)** or **Moles ($n$):** How much "stuff" is actually inside.

**3. The Geometry of Walls: The Gatekeepers of Energy**

How a system interacts with the world depends entirely on its boundary. This is where most students get confused.

**A. Diathermic Walls (The "Open Door")**

* **The Material:** Usually thin metals (Copper, Aluminum).
* **The Logic:** These walls allow thermal energy (heat) to pass through freely. If you put a system with diathermic walls in a cold room, it will bleed heat until it matches the room.
* **Practical Example:** A single-walled stainless steel water bottle.

**B. Adiabatic Walls (The "Bank Vault")**

* **The Material:** Insulators (Asbestos, Thick Foam, Vacuum layers).
* **The Logic:** These walls are "Heat-Proof." No energy can enter or leave via heat. The only way to change the energy inside is to physically move the wall (Work).
* **Practical Example:** A high-end vacuum-insulated flask (Thermos).

**C. Rigid vs. Movable Walls**

![Types of containers: thermal and structural properties — diathermic, adiabatic, rigid](/images/container-types-thermal-structural.png)

* **Rigid:** The volume is locked. The gas cannot do work.
* **Movable:** The system can expand or contract. This is how engines work.`,
    didYouKnow:
      "Did you know that a perfect Adiabatic wall does not exist in the real universe? Even the best vacuum flask will eventually let heat through. In physics, an 'Adiabatic Process' usually just means a process that happens so fast that heat doesn't have time to move!",
    playableElements: ["wall-toggle"],
    references: [
      {
        type: "video",
        title: "PhET Gas Properties Simulation",
        description: "Visualizes how P, V, and T interact in real time.",
        url: "https://phet.colorado.edu/en/simulations/legacy/gas-properties",
      },
      {
        type: "video",
        title: "Using the PhET Gas Properties Sim (YouTube)",
        description: "Step-by-step tutorial on the PhET simulation.",
        url: "https://www.youtube.com/watch?v=MjBwdfAXSQ8",
      },
      {
        type: "video",
        title: "Heat Transfer: Crash Course Engineering (YouTube)",
        description: "Explains how different materials act as adiabatic or diathermic boundaries.",
        url: "https://www.youtube.com/watch?v=YK7G6l_K6sA",
      },
      {
        type: "reading",
        title: "NCERT Class 11 Physics - Chapter 12 Thermodynamics",
        description: "The gold standard for CBSE definitions.",
        url: "https://ncert.nic.in/textbook.php?keph2=0-12",
      },
      {
        type: "reading",
        title: "NASA Glenn Research Center - Thermodynamics",
        description: "Professional deep-dive on systems and boundaries.",
        url: "https://www.grc.nasa.gov/www/BGH/thermo.html",
      },
    ],
    bitsQuestions: [
      { question: "A student is analyzing the thermodynamic properties of hot air trapped inside a sealed metal cylinder. In this scenario, what constitutes the \"Surroundings\"?", options: ["Only the hot air inside the cylinder.", "The hot air, the metal cylinder, and the room outside.", "Only the room outside the cylinder.", "The metal cylinder and the room outside."], correctAnswer: 3, solution: "The system is only the air. Everything else, including the container walls, belongs to the surroundings." },
      { question: "Which equation represents the absolute, fundamental definition of the \"Universe\" in thermodynamics?", options: ["System + Energy = Universe", "System + Surroundings = Universe", "Surroundings + Heat = Universe", "Pressure × Volume = Universe"], correctAnswer: 1, solution: "Directly stated: System + Surroundings = The Universe." },
      { question: "According to the microscopic definition of Pressure (P), what would happen if every single gas molecule inside a container suddenly stopped moving?", options: ["The Pressure would become infinite.", "The Pressure would match the atmospheric pressure outside.", "The Pressure would drop to exactly zero.", "The Pressure would remain constant but the Volume would shrink."], correctAnswer: 2, solution: "Pressure is strictly the result of molecular collisions. No movement = no collisions = zero pressure." },
      { question: "If a scientist doubles the Temperature (T) of a gas (measured in Kelvin), what exact microscopic change has occurred?", options: ["The number of molecules in the system has doubled.", "The volume of the container has been cut in half.", "The molecules have stopped colliding with the walls.", "The average kinetic energy of every molecule has doubled."], correctAnswer: 3, solution: "Temperature is the direct measurement of average kinetic energy. Doubling Kelvin doubles the energy." },
      { question: "A single-walled stainless steel water bottle is placed in a refrigerator. The water inside cools down quickly. What type of thermodynamic wall does the stainless steel represent?", options: ["Adiabatic Wall", "Diathermic Wall", "Rigid Wall", "Isolated Wall"], correctAnswer: 1, solution: "Diathermic walls, like thin metals, allow heat to pass through freely." },
      { question: "What is the defining physical characteristic of an \"Adiabatic\" wall?", options: ["It is perfectly rigid and cannot be moved.", "It allows thermal energy to pass through freely.", "It is entirely heat-proof, preventing any thermal energy from entering or leaving.", "It is made of thin metals like Copper or Aluminum."], correctAnswer: 2, solution: "Adiabatic walls act as a \"bank vault\" and are completely heat-proof." },
      { question: "If a gas is trapped inside a perfect Adiabatic container (like a high-end vacuum flask), what is the only physical way to change the energy of the system inside?", options: ["By placing the container in a hotter room.", "By physically moving the walls of the container (doing Work).", "By waiting for thermal equilibrium to occur.", "It is physically impossible to change the energy of an adiabatic system."], correctAnswer: 1, solution: "Because heat cannot pass through adiabatic walls, the only way to alter the energy is by moving the wall (Work)." },
      { question: "Why is a gas trapped inside a container with strictly \"Rigid\" walls incapable of doing physical work?", options: ["Because the volume (V) is locked and the system cannot expand.", "Because the walls are adiabatic and block heat.", "Because the pressure (P) drops to zero.", "Because the diathermic walls bleed all the energy away."], correctAnswer: 0, solution: "Work requires physical movement. If the walls are rigid, the volume is locked, and no work can be done." },
      { question: "Which of the following is NOT considered a macroscopic \"State Variable\" (the vital signs of a gas)?", options: ["Pressure (P)", "Volume (V)", "Temperature (T)", "The velocity of one specific, individual molecule."], correctAnswer: 3, solution: "State variables are macroscopic. We cannot track individual molecules; we only measure overall averages like P, V, and T." },
      { question: "What is the critical failure point that occurs if a student fails to properly define the \"System\" before solving a thermodynamics problem?", options: ["The diathermic walls will mathematically convert into adiabatic walls.", "The energy calculations will be fundamentally wrong (e.g., confusing heat lost with heat gained).", "The temperature of the system will drop to absolute zero.", "The gas molecules will stop colliding with the container walls."], correctAnswer: 1, solution: "If you do not draw the imaginary boundary correctly, you will audit the wrong energy transfer, leading to failed calculations." },
    ],
    practiceFormulas: [
      {
        name: "PV = nRT (Equation of State)",
        formulaLatex: "PV = nRT",
        description: "Rigid walls → V locked. Movable wall (piston/balloon) → P locked to outside. Use proportionality.",
        bitsQuestions: [
          { question: "A gas is trapped inside a steel canister with perfectly rigid walls. The initial Pressure is 2 atm, and the Temperature is 300 K. If you heat the canister until the Temperature reaches 600 K, what is the new Pressure inside?", options: ["1 atm", "2 atm", "4 atm", "8 atm"], correctAnswer: 2, solution: "Since Volume (V) and R are constant, P is directly proportional to T. You doubled the temperature (300 K to 600 K), so pressure doubles: 2 × 2 = 4 atm." },
          { question: "A student fills a balloon (movable diathermic wall) with 4 Liters of gas in a cool room at 290 K. The student then takes the balloon outside where the temperature is 319 K. Assuming atmospheric pressure remains constant, what is the new Volume of the balloon?", options: ["3.6 Liters", "4.0 Liters", "4.4 Liters", "8.0 Liters"], correctAnswer: 2, solution: "Pressure (P) is constant (movable balloon). V ∝ T. V₁/T₁ = V₂/T₂ → 4/290 = V₂/319 → V₂ = 4 × (319/290) ≈ 4.4 Liters." },
          { question: "THE KELVIN TRAP: A rigid, sealed glass bulb contains gas at 27°C with a pressure of 1 atm. You heat the bulb to 54°C. What is the new pressure of the gas?", options: ["2.00 atm", "1.09 atm", "0.50 atm", "4.00 atm"], correctAnswer: 1, solution: "You cannot use Celsius in the Ideal Gas Law. Convert to Kelvin: T₁ = 300 K, T₂ = 327 K. P₂ = P₁ × (T₂/T₁) = 1 × (327/300) = 1.09 atm." },
          { question: "You have a syringe with a movable plunger. The gas inside has a Volume of 10 mL at a Pressure of 1 atm. You slowly crush the plunger down until the Volume is only 5 mL. Because you did it slowly, the Temperature (T) remained constant. What is the new Pressure inside the syringe?", options: ["0.5 atm", "1 atm", "2 atm", "5 atm"], correctAnswer: 2, solution: "T is constant, so P×V = constant. Halving volume (10 mL → 5 mL) doubles pressure: 1 × 10 = P₂ × 5 → P₂ = 2 atm." },
          { question: "A rigid adiabatic tank holds a specific amount of gas (n moles) at 3 atm. You inject more gas, doubling the number of moles. The temperature remains constant. What is the new pressure?", options: ["1.5 atm", "3 atm", "6 atm", "9 atm"], correctAnswer: 2, solution: "Rigid walls → V locked. T constant. PV = nRT ⇒ P ∝ n. Doubling moles doubles pressure: 3 × 2 = 6 atm." },
        ],
      },
    ],
  },
  // ----- BASIC level - Subtopic 1.2 -----
  [key("physics", 11, "Thermodynamics", "Thermal equilibrium and zeroth law", 1, "basics")]: {
    title: "Subtopic 1.2: Thermal Equilibrium (Level: Basic - Deep Dive Edition)",
    didYouKnow:
      "Did you know that the entire Universe is slowly heading towards a final, unavoidable Thermal Equilibrium? It is called the 'Heat Death of the Universe.' Trillions of years from now, all stars will burn out, and all heat will evenly distribute across the vacuum of space. Once everything is the exact same temperature, no more work can ever be done, and nothing will ever change again.",
    references: [
      {
        type: "video",
        title: "MinutePhysics - What is Heat?",
        description: "A brilliant, fast-paced visualization of atomic vibrations.",
        url: "https://www.youtube.com/watch?v=Wav5YLjDQ8E",
      },
      {
        type: "video",
        title: "PhET Interactive Simulations - Energy Forms and Changes",
        description: "Mandatory link. Place iron and brick blocks in water and watch the Energy blocks flow until they balance.",
        url: "https://phet.colorado.edu/en/simulations/energy-forms-and-changes",
      },
      {
        type: "reading",
        title: "Feynman Lectures on Physics - Vol 1, Chapter 39",
        description: "For the top 1% of students. How Richard Feynman explained kinetic theory of heat and equilibrium.",
        url: "https://www.feynmanlectures.caltech.edu/I_39.html",
      },
      {
        type: "reading",
        title: "CBSE Competency-Based Questions Database",
        description: "Official board PDFs showing how they test the Dynamic vs. Static trap in Assertion-Reasoning questions.",
        url: "https://cbseacademic.nic.in/cbe/",
      },
    ],
    content: `**1. The Illusion of "Cold"**

To master thermodynamics, you must first unlearn a childhood lie. "Cold" does not exist. Physics does not recognize "cold" as a physical property; it is simply the absence of heat.

When you touch a block of ice, the ice is not "giving you cold." Instead, your hand is bleeding its own thermal energy into the ice. Heat is the only active currency. It strictly flows down a one-way street: from the object with higher temperature to the object with lower temperature. Thermal Equilibrium is the exact moment that street gets shut down.

**2. The Microscopic Battle (What actually happens?)**

You cannot see equilibrium with your eyes, so you must visualize it at the atomic level.

* **The Hot Object:** Billions of atoms are vibrating violently, moving at incredibly high speeds (High Kinetic Energy).
* **The Cold Object:** The atoms are sluggish, vibrating very slowly (Low Kinetic Energy).
* **The Collision:** When you place a diathermic wall (like a thin sheet of metal) between them, the violently vibrating "hot" atoms smash into the wall. The wall shakes, and those vibrations smash into the sluggish "cold" atoms on the other side.
* **The Result:** The fast atoms lose a little bit of speed with every crash, and the slow atoms gain a little bit of speed. This billions-of-collisions-per-second battle continues until every single atom in both objects is vibrating at the exact same average speed.

![Molecular representation of thermal equilibrium — unequal velocities before, uniform speed after energy exchange](/images/thermal-equilibrium-molecular.png)

**3. The Macroscopic "Ceasefire"**

Once that shared average speed is reached, the system hits Thermal Equilibrium.

![Temperature vs time — hot and cold curves converge to thermal equilibrium, state variables locked](/images/thermal-equilibrium-temp-vs-time.png)

* **Dynamic, Not Static:** A massive failure point for students is thinking that the atoms stop moving, or that heat stops transferring. Wrong. Heat is still jumping back and forth across the boundary, but for every $1\\text{ Joule}$ that goes left, exactly $1\\text{ Joule}$ goes right. The net transfer is absolutely zero.
* **The Vital Signs Stabilize:** Because the microscopic chaos has leveled out, the macroscopic state variables (Pressure $P$, Volume $V$, and Temperature $T$) stop changing. The needle on your pressure gauge stops moving. The system is locked.`,
    playableElements: ["particle-sandbox"],
    bitsQuestions: [
      { question: "A student states that placing a block of ice on a table cools the table down because the ice \"transfers its coldness\" into the wood. Why is this statement physically incorrect?", options: ["Because the wood is a perfect adiabatic wall that blocks the cold.", "Because \"cold\" is not a physical property; the table is actually transferring its heat into the ice.", "Because the ice and the table are already in thermal equilibrium.", "Because coldness only transfers through liquids, not solids."], correctAnswer: 1, solution: "Physics does not recognize \"cold\" as a transferable energy. Heat strictly flows from the hotter object (table) to the colder object (ice)." },
      { question: "At a microscopic level, what is the defining difference between a \"hot\" object and a \"cold\" object?", options: ["The hot object contains more gas molecules than the cold object.", "The hot object has a higher average kinetic energy (faster atomic vibrations) than the cold object.", "The cold object has a completely static atomic structure with zero movement.", "The hot object has a higher pressure but a lower volume."], correctAnswer: 1, solution: "Temperature is merely the macroscopic measurement of average microscopic kinetic energy. Hot = fast; Cold = slow." },
      { question: "When a hot metal block is placed in contact with a cold metal block, what exact mechanism causes their temperatures to equalize?", options: ["The diathermic wall absorbs the heat and destroys it.", "The macroscopic state variables merge into a single, unified volume.", "The violently vibrating fast atoms collide with the wall, transferring kinetic energy to the slower atoms until their average speeds match.", "The cold atoms speed up spontaneously, absorbing energy from the surrounding room."], correctAnswer: 2, solution: "Equilibrium is achieved through billions of physical microscopic collisions transferring kinetic energy across the boundary." },
      { question: "What is the fatal flaw in the statement: \"When two objects reach thermal equilibrium, all heat transfer between them completely stops.\"?", options: ["Heat transfer actually reverses direction permanently.", "The transfer does not stop; the atoms are still exchanging energy, but the net transfer is exactly zero.", "Heat transfer only stops if the objects are isolated in a vacuum.", "The statement is completely accurate; all atomic motion freezes at equilibrium."], correctAnswer: 1, solution: "This is the ultimate CBSE trap. Equilibrium is dynamic. 1 Joule goes left, 1 Joule goes right. The atoms never stop moving." },
      { question: "How do you know, strictly from a macroscopic perspective, that a sealed system has finally reached Thermal Equilibrium?", options: ["The container becomes completely cold to the touch.", "The diathermic walls automatically convert into adiabatic walls.", "The State Variables (Pressure, Volume, and Temperature) completely stop changing.", "The mass of the gas inside the system begins to decrease."], correctAnswer: 2, solution: "Because we cannot see the atoms matching speeds, we rely on the macroscopic variables (P, V, T). When the needle stops moving, the system is locked in equilibrium." },
      { question: "What is the fundamental requirement for two objects to eventually reach thermal equilibrium with each other?", options: ["They must be separated by an adiabatic wall.", "They must have the exact same initial mass and volume.", "They must be able to exchange thermal energy (e.g., connected by a diathermic boundary).", "They must be made of the exact same chemical element."], correctAnswer: 2, solution: "If heat cannot flow between them, they cannot negotiate a balance point. An adiabatic wall prevents equilibrium." },
      { question: "If Object A and Object B are in a state of thermal equilibrium, which of the following statements MUST be mathematically true?", options: ["Object A and Object B possess the exact same amount of Internal Energy.", "Object A and Object B are at the exact same Temperature.", "Object A and Object B have the exact same Pressure and Volume.", "Object A and Object B have exactly zero kinetic energy."], correctAnswer: 1, solution: "Equilibrium guarantees equal Temperature. It does not guarantee equal internal energy, as one object might be much larger or made of a different material." },
      { question: "The concept of the \"Heat Death of the Universe\" relies on which thermodynamic principle?", options: ["That the universe will eventually shrink into a zero-volume state.", "That all adiabatic walls in the universe will eventually break down.", "That once the entire universe reaches perfect Thermal Equilibrium, no more heat will flow and no more work can ever be done.", "That the universe is constantly generating new heat from absolute zero."], correctAnswer: 2, solution: "Work requires a flow of heat from hot to cold. If the whole universe is the same temperature, heat cannot flow, and the universe becomes \"dead\" to any further changes." },
      { question: "During the process of reaching thermal equilibrium, what happens to the average kinetic energy of the \"cold\" object?", options: ["It decreases until it reaches absolute zero.", "It remains exactly the same, but its volume expands.", "It continuously fluctuates up and down randomly.", "It steadily increases until it matches the average kinetic energy of the hot object."], correctAnswer: 3, solution: "The slow atoms in the cold object are battered by the fast atoms of the hot object, gaining speed until both sides share the exact same average speed." },
      { question: "In a physics simulation, a student sets up a hot gas and a cold gas separated by a perfectly adiabatic wall. How long will it take for these two gases to reach thermal equilibrium?", options: ["It will happen instantly.", "It will take exactly half the time it would with a diathermic wall.", "They will never reach thermal equilibrium because the wall strictly forbids the transfer of heat.", "They will reach equilibrium only if the volume of the container is doubled."], correctAnswer: 2, solution: "An adiabatic wall is the \"bank vault.\" It is completely heat-proof. Without heat transfer, equilibrium between the two sides is a physical impossibility." },
    ],
    practiceFormulas: [
      {
        name: "Condition for Equilibrium (T_A = T_B)",
        formulaLatex: "T_A = T_B",
        description: "Heat flows strictly based on Temperature (T), never on size, mass, or total internal energy. The condition for thermal equilibrium is T_A = T_B. If temperatures match, macroscopic heat flow is impossible.",
        bitsQuestions: [
          { question: "You place a massive 50 kg block of iron at 50°C directly against a tiny 10 gram copper coin at 50°C. Which direction will heat flow?", options: ["From the massive iron block to the tiny coin because it has more total energy.", "From the copper coin to the iron block.", "Heat will flow back and forth, but the net flow is zero because T_iron = T_copper.", "The iron will absorb the coin's energy due to its higher mass."], correctAnswer: 2, solution: "The trap is thinking mass matters. It doesn't. If T_A = T_B, the condition for equilibrium is met. Heat moves back and forth, but net flow is zero." },
          { question: "System A has an internal energy of 5000 J and a temperature of 300 K. System B has an internal energy of 200 J and a temperature of 400 K. If connected by a diathermic wall, what happens?", options: ["Heat flows from System A to System B because A has more total energy.", "Heat flows from System B to System A because T_B > T_A.", "No heat flows because the system is mathematically unbalanced.", "Heat flows from A to B until their internal energies are exactly equal."], correctAnswer: 1, solution: "Total internal energy is irrelevant to the direction of heat flow. Heat strictly flows from higher temperature (400 K) to lower temperature (300 K)." },
          { question: "THE ICEBERG TRAP: An entire iceberg in the ocean contains billions of Joules of internal energy. A single cup of boiling coffee contains only a few thousand Joules. If you pour the coffee onto the iceberg, what dictates the direction of heat flow?", options: ["Heat flows from the coffee to the iceberg strictly because T_coffee > T_iceberg.", "Heat flows from the iceberg to the coffee because the iceberg has vastly more total internal energy.", "Heat flows from the ocean into the coffee.", "No heat flows because the size difference is too large for equilibrium to occur."], correctAnswer: 0, solution: "The iceberg has billions of Joules, but its temperature is lower. Heat only cares about the temperature gradient: Hot to Cold." },
          { question: "A student looks at a Temperature vs. Time graph showing two liquids placed in the same insulated container. Liquid X starts at 80°C and Liquid Y starts at 20°C. How do you identify the exact moment thermal equilibrium is reached on the graph?", options: ["The moment Liquid X hits 0°C.", "The moment the two lines cross and diverge again.", "The exact point where the two lines merge into a single, flat horizontal line (T_X = T_Y).", "The moment Liquid Y's temperature begins to drop."], correctAnswer: 2, solution: "Equilibrium is the mathematical state where T_X = T_Y. On a graph, this is where the temperature curves flatten out and become identical." },
        ],
      },
      {
        name: "Dynamic Balance Equation (Q_net = 0)",
        formulaLatex: "Q_net = Q_in - Q_out = 0",
        description: "Equilibrium is a dynamic state, not a static one. Atoms never stop vibrating or colliding. Heat (Q) never actually stops moving; the rate of heat entering perfectly matches the rate of heat leaving.",
        bitsQuestions: [
          { question: "Two gases, System A and System B, are in perfect thermal equilibrium. At the microscopic level, if 50 J of thermal energy transfers from System A to System B in one second, what else MUST mathematically occur in that exact same second?", options: ["The temperature of System B must increase by 50 K.", "Exactly 50 J of thermal energy must transfer back from System B to System A, making Q_net = 0.", "System A must drop in pressure to compensate for the lost energy.", "The diathermic wall must absorb the 50 J of energy."], correctAnswer: 1, solution: "Dynamic equilibrium dictates that Q_in must exactly equal Q_out. If 50 J leaves, 50 J must return to keep the state variables locked." },
          { question: "THE STATIC TRAP: A student claims that once a cup of hot tea cools down and matches the room temperature (25°C), the tea molecules stop transferring heat to the room molecules entirely (Q_out = 0). Why is this physically impossible?", options: ["Because molecules at 25°C are still moving and colliding, so they continuously transfer energy, but they absorb an equal amount back from the room.", "Because the tea will eventually drop to 0°C.", "Because the room is an adiabatic system.", "Because the tea molecules stop moving entirely at room temperature."], correctAnswer: 0, solution: "Atoms don't freeze at 25°C. They constantly collide with the air. Heat goes out, but identical heat comes in. The student fell for the static trap." },
          { question: "If a system is in thermal equilibrium with its surroundings, which of the following equations accurately represents the energy exchange?", options: ["Q_in = 0 and Q_out = 0", "Q_in > Q_out", "Q_in = Q_out, therefore Q_net = 0", "Q_net = Q_in + Q_out"], correctAnswer: 2, solution: "This is the strict definition of the dynamic balance equation." },
          { question: "You are monitoring a sealed, insulated box containing two blocks of metal. The computer shows that Block A is continuously losing 5 Joules of heat per millisecond (Q_out = 5 J), and gaining 2 Joules of heat per millisecond (Q_in = 2 J). Is this system in thermal equilibrium?", options: ["Yes, because heat is flowing in both directions.", "No, because Q_net = -3 J. Block A is actively cooling down and has not reached equilibrium.", "Yes, because the total energy inside the insulated box is conserved.", "No, because Q_in must be zero for equilibrium to occur."], correctAnswer: 1, solution: "For equilibrium Q_net must be 0. Here Q_net = 2 - 5 = -3 J, so Block A is cooling." },
        ],
      },
    ],
  },
  // ----- BASIC level - Subtopic 1.3 -----
  [key("physics", 11, "Thermodynamics", "Thermal equilibrium and zeroth law", 2, "basics")]: {
    title: "Subtopic 1.3: The Zeroth Law & Temperature Measurement (Level: Basic - Deep Dive Edition)",
    didYouKnow:
      "Did you know that you can create your own valid temperature scale right now? If you decide that the freezing point of water is 10 'Michael-Degrees' and boiling is 50 'Michael-Degrees', your scale is 100% scientifically accurate, as long as the lines between 10 and 50 are evenly spaced. The Zeroth Law doesn't care what you name the numbers; it only cares that the physical expansion is consistent!",
    references: [
      {
        type: "video",
        title: "MIT OpenCourseWare - Thermodynamics: State of a System, 0th Law",
        description: "University-level lecture on Temperature and the Zeroth Law.",
        url: "https://ocw.mit.edu/courses/5-60-thermodynamics-kinetics-spring-2008/resources/lecture-1-state-of-a-system-0th-law-equation-of-state/",
      },
      {
        type: "video",
        title: "How a Thermometer Works (YouTube)",
        description: "Engaging explainer on thermometric properties.",
        url: "https://www.youtube.com/watch?v=IVNnnHOI97w",
      },
      {
        type: "reading",
        title: "BIPM - The Kelvin (SI base unit)",
        description: "Official global definition of temperature.",
        url: "https://www.bipm.org/en/si-base-units/kelvin",
      },
      {
        type: "reading",
        title: "Feynman Lectures - Ch 44: The Laws of Thermodynamics",
        description: "Feynman's breakdown of the laws of thermodynamics and the concept of temperature.",
        url: "https://www.feynmanlectures.caltech.edu/I_44.html",
      },
    ],
    content: `**1. The Logical Loophole (Why this Law exists)**

Physics is built on strict, unbreakable mathematical proofs. Before the 1930s, scientists had a massive philosophical problem: How do you prove two things are the same temperature if you cannot bring them together to touch?

If you have a vat of boiling chemicals in London and a vat in Tokyo, you cannot place them side-by-side to see if heat transfers between them. You need a "middleman."

The Zeroth Law is the mathematical permission slip to use that middleman. It formally states: If System A is in thermal equilibrium with System C (the thermometer), and System B is in thermal equilibrium with System C, then System A and System B are guaranteed to be in thermal equilibrium with each other. Without this exact logical statement, every thermometer on Earth would be scientifically invalid.

![The Logic of the Middleman — A, C, B in thermal equilibrium; therefore T_A = T_B](/images/zeroth-law-middleman-logic.png)

**2. The Historical Embarrassment (Why "Zeroth"?)**

You might wonder why it is called the "Zeroth" Law and not the 3rd or 4th. This is a famous historical embarrassment in physics.

Scientists had already locked in the First Law (Conservation of Energy) and the Second Law (Entropy) in the 1800s. It wasn't until 1931 that a physicist named Ralph Fowler realized they had forgotten to mathematically define "Temperature" in the first place. Because this new law was the fundamental foundation for the other two, they couldn't call it the 3rd Law. They had to slot it in at the very bottom of the hierarchy. Thus, the Zeroth Law was born.

**3. Thermometric Properties (Hacking Nature to Measure Heat)**

A thermometer does not actually measure "temperature" directly. It measures a physical property of an object that changes predictably when heated. This is called a **Thermometric Property**.

![Measuring temperature: volume expansion (liquid glass) and electrical resistance (digital)](/images/thermometric-properties-measuring-temperature.png)

* **Volume (The Liquid Glass):** As mercury or alcohol heats up, the atoms push each other apart, and the liquid strictly expands up the glass tube. You measure the length of the liquid, not the heat.

* **Resistance (The Digital Thermometer):** When a metal wire gets hot, its atoms vibrate wildly, making it harder for electricity to flow through it. A digital thermometer measures the electrical resistance, which translates perfectly to a temperature number.

* **Pressure (The Gas Thermometer):** If you trap a gas in a rigid steel box (constant volume) and heat it, the gas molecules smash into the walls harder. You measure the pressure to calculate the temperature.`,
    playableElements: ["thermometer-sandbox"],
    bitsQuestions: [
      { question: "Before the 1930s, physics lacked a formal mathematical rule to define temperature measurement. Why was the Zeroth Law mathematically necessary for the foundation of thermodynamics?", options: ["To prove that heat always flows from a higher temperature to a lower temperature.", "To provide a mathematical \"permission slip\" to use a middleman (a thermometer) to compare the temperatures of two isolated systems.", "To establish the maximum possible efficiency of a Carnot heat engine.", "To define the exact physical thickness required for a diathermic wall."], correctAnswer: 1, solution: "You cannot always place two objects together to see if they are the same temperature. The Zeroth Law legally allows the use of a third object—a thermometer—as a proxy." },
      { question: "According to the strict logical formulation of the Zeroth Law, if System A is in thermal equilibrium with System C, and System B is also in thermal equilibrium with System C, what MUST be mathematically true?", options: ["System A and System B possess the exact same amount of total internal energy.", "System A and System B must be in direct physical contact with each other.", "System A and System B are guaranteed to be in thermal equilibrium with each other.", "System A and System B must share the exact same volume and pressure."], correctAnswer: 2, solution: "This is the exact, strict definition of the Zeroth Law. If A = C, and B = C, then A = B. It guarantees thermal equilibrium between A and B." },
      { question: "Why was the foundational law of temperature measurement named the \"Zeroth\" Law instead of the 3rd or 4th Law?", options: ["Because it specifically deals with the unreachable state of Absolute Zero.", "Because the First and Second Laws were already established, and physicists realized this new law was the logical foundation that had to precede them both.", "Because it proves that the net heat transfer between two objects at equilibrium is exactly zero.", "Because the heat capacity of an ideal thermometer must be zero."], correctAnswer: 1, solution: "It was discovered late (1931), but because Temperature is the foundation of the 1st and 2nd Laws, it had to be placed before them in the logical hierarchy. Hence, the \"Zeroth\" Law." },
      { question: "A thermometer does not directly measure \"heat\" or \"temperature.\" Instead, it measures a \"Thermometric Property.\" Which of the following best defines this term?", options: ["A chemical reaction that permanently alters the state of the measuring device.", "A physical property of an object that changes predictably and consistently when heated or cooled.", "The exact number of microscopic atomic collisions happening per second.", "The rate at which adiabatic walls leak thermal energy into the surrounding room."], correctAnswer: 1, solution: "A thermometric property is any measurable physical change—like volume expanding or resistance rising—that scales reliably with heat." },
      { question: "In a traditional liquid-in-glass thermometer (such as a mercury or alcohol thermometer), what exact macroscopic variable is physically changing to give the temperature reading?", options: ["The mass of the liquid inside the glass.", "The internal pressure of the vacuum space above the liquid.", "The volume of the liquid as its atoms push each other apart.", "The kinetic energy of the rigid glass wall."], correctAnswer: 2, solution: "As the liquid heats up, its atoms gain kinetic energy and push each other apart. Because the glass tube restricts them, the volume expands strictly upward." },
      { question: "A modern digital thermometer uses a metal wire to measure temperature. At a microscopic level, why does the electrical resistance of this wire increase as it is exposed to higher temperatures?", options: ["The metal atoms vibrate more violently, making it physically harder for the electrons to flow smoothly through them.", "The metal wire contracts, squeezing the electrons and stopping their flow entirely.", "The wire absorbs the heat and converts it directly into a reverse electrical voltage.", "The diathermic casing around the wire begins to block the flow of electricity."], correctAnswer: 0, solution: "Electrical resistance measures how hard it is for electrons to move. When a metal is hot, its atoms vibrate chaotically, creating a \"traffic jam\" for the electrons." },
      { question: "If an engineer is using a constant-volume gas thermometer to measure the temperature of an industrial furnace, what specific variable are they tracking to calculate the heat?", options: ["The expansion of the container's rigid walls.", "The continuous change in the gas's mass.", "The pressure exerted by the gas molecules smashing violently against the locked walls.", "The electrical resistance of the gas molecules."], correctAnswer: 2, solution: "Because the volume is locked (rigid walls), the gas cannot expand. Instead, the heated molecules speed up and smash the walls harder, causing a measurable spike in pressure." },
      { question: "A student invents a custom temperature scale where the freezing point of water is exactly 10 \"Student-Degrees\" and boiling water is exactly 50 \"Student-Degrees.\" Assuming the lines between 10 and 50 are evenly spaced, is this scale scientifically valid?", options: ["No, because all valid temperature scales must have exactly 100 degrees between freezing and boiling.", "No, because it does not align with the International System of Units (Kelvin).", "Yes, because the Zeroth Law only requires consistent physical expansion; the human-invented numbers attached to that expansion do not matter.", "Yes, but only if it is converted to Celsius before the thermometer is allowed to be used."], correctAnswer: 2, solution: "Celsius and Fahrenheit are just made-up human numbers. As long as the physical expansion of the thermometric property is mapped evenly, any numbered scale is valid." },
      { question: "You place a cold glass thermometer into a cup of hot coffee. According to the principles of the Zeroth Law, what physical event MUST occur before the thermometer can display the true temperature of the coffee?", options: ["The coffee must cool down to match the initial starting temperature of the thermometer.", "The thermometer and the coffee must negotiate a balance and reach a state of thermal equilibrium.", "The internal pressure of the coffee must drop to zero.", "The thermometer must absorb 100% of the internal energy of the coffee."], correctAnswer: 1, solution: "The thermometer does not instantly know the coffee's temperature. It must absorb heat from the coffee until they both reach a perfectly balanced state of thermal equilibrium." },
      { question: "What was the fundamental \"philosophical problem\" in physics before Ralph Fowler formally introduced the Zeroth Law in 1931?", options: ["Physicists could not explain why heat engines always wasted energy.", "There was no strict mathematical proof allowing the use of a \"middleman\" (thermometer) to prove two separated objects were the same temperature.", "Scientists did not know how to measure the volume of a gas at constant pressure.", "The concept of adiabatic walls had not yet been invented."], correctAnswer: 1, solution: "Without the Zeroth Law, scientists had no mathematical justification for assuming a thermometer reading in London meant the same thing as a thermometer reading in Tokyo." },
    ],
    practiceFormulas: [
      {
        name: "Logical Proof of the Zeroth Law",
        formulaLatex: "If T_A = T_C and T_B = T_C, then T_A = T_B",
        description: "The Zeroth Law establishes the mathematical validity of a thermometer. Temperature is transitive: if two isolated systems are each in thermal equilibrium with a third (the thermometer C), they are guaranteed in equilibrium with each other.",
        bitsQuestions: [
          { question: "In the mathematical logic of the Zeroth Law equation, what real-world object does the variable T_C strictly represent?", options: ["The physical wall separating two systems.", "The total internal energy of the system.", "A thermometer acting as a measurement middleman.", "A vacuum chamber."], correctAnswer: 2, solution: "The trap is treating T_C as a random variable. It specifically represents the thermometer, which is the independent measuring device validating the equilibrium of A and B." },
          { question: "Block A is perfectly balanced with Block C. Block B is also perfectly balanced with Block C. If you suddenly remove Block C and push Block A and Block B directly together, what is guaranteed to happen physically?", options: ["Heat will flow from A to B.", "Heat will flow from B to A.", "Both blocks will instantly change temperature.", "The net heat transfer between them will be zero."], correctAnswer: 3, solution: "If T_A = T_C and T_B = T_C, the math proves T_A = T_B. If temperatures are equal, the net heat flow (Q_net) is precisely zero." },
          { question: "THE EQUALS SIGN TRAP: In the statement T_A = T_B, what physical thermodynamic reality does the equals sign (=) strictly enforce?", options: ["Both systems contain the exact same amount of total thermal energy.", "Both systems are in a state of thermal equilibrium with no net heat flow.", "Both systems possess the same mass and volume.", "Both systems are made of the identical material."], correctAnswer: 1, solution: "Students frequently confuse temperature with total internal energy. The equals sign ONLY dictates that the temperatures are identical, meaning equilibrium is achieved." },
          { question: "A student is analyzing three separate gas tanks. Tank A is NOT in equilibrium with Tank C. However, Tank B IS in equilibrium with Tank C. What strict logical conclusion must be drawn about Tanks A and B?", options: ["T_A must equal T_B.", "T_A cannot equal T_B, and heat would flow if they touched.", "They will reach equilibrium instantly without heat transfer.", "No conclusion can be made without knowing the exact gases inside."], correctAnswer: 1, solution: "Applying contrapositive logic. If A does not equal C, but B does equal C, A and B cannot be mathematically equal. Therefore, heat will flow if they are connected." },
        ],
      },
      {
        name: "Absolute Temperature Conversion",
        formulaLatex: "T(K) = t(°C) + 273.15",
        description: "Human-invented scales (e.g. Celsius) have arbitrary zero points. Kelvin locks zero to the total absence of thermodynamic motion. Use Kelvin in gas laws; negative Celsius in PV=nRT implies negative volume or pressure, which is physically impossible.",
        bitsQuestions: [
          { question: "In the absolute conversion formula, what physical reality does the constant 273.15 represent?", options: ["The boiling point of water under standard pressure.", "The exact thermal offset between water freezing and absolute zero.", "The rate at which thermometer fluid expands per degree.", "The average kinetic energy of room temperature air."], correctAnswer: 1, solution: "This forces the student to understand why the number exists, locking the human-invented zero (water freezing) to the absolute thermodynamic zero." },
          { question: "You are running a digital simulation of an ideal gas. The computer outputs a final temperature reading of -15 K. Why is this result mathematically and physically impossible?", options: ["The simulation forgot to add 273.15 to the final output.", "The Celsius temperature must have been a positive integer.", "The Kelvin scale is absolute; it cannot possess negative values because motion cannot be less than zero.", "The gas law only functions at room temperature."], correctAnswer: 2, solution: "Tests the foundational definition of an absolute scale. Zero is a hard physical limit; negative values represent a mathematical failure." },
          { question: "THE DELTA TRAP: An engine block's temperature increases by exactly 10°C during operation. What is the corresponding mathematical change in its Kelvin temperature?", options: ["An increase of 283.15 K", "An increase of 10 K", "A decrease of 10 K", "An increase of 273.15 K"], correctAnswer: 1, solution: "This is a massive failure point in physics tests. The step size (delta) of 1 degree Celsius is exactly equal to the step size of 1 Kelvin. The change is 10, not 283.15." },
          { question: "According to the strict algebraic structure of the conversion formula, what is the temperature in degrees Celsius when a system reaches absolute zero (0 K)?", options: ["0°C", "100°C", "-273.15°C", "273.15°C"], correctAnswer: 2, solution: "Basic algebraic manipulation. Set T(K) to 0, and subtract 273.15 from both sides to isolate t(°C)." },
        ],
      },
      {
        name: "Universal Thermometer Formula",
        formulaLatex: "(Reading - Freezing) / (Boiling - Freezing) = Constant",
        description: "Temperature scales are human inventions; thermal expansion is a physical constant. If a material expands uniformly (linearly), the fraction of its expansion between freezing and boiling is identical whether you use Celsius, Fahrenheit, or a custom scale.",
        bitsQuestions: [
          { question: "In the universal ratio formula, what does the denominator (Boiling Point - Freezing Point) strictly represent mathematically?", options: ["The total heat capacity of the thermometer's glass.", "The total number of numerical divisions or \"scale size\" between the two reference points.", "The current absolute temperature of the room.", "The expansion rate of the fluid inside."], correctAnswer: 1, solution: "Deconstructs the formula. The denominator is a difference (Δ) representing the total interval count, not a static point or energy value." },
          { question: "You build a custom \"Student Scale\" for a lab where water freezes at 10°S and boils at 50°S. What is the exact numerical value of the denominator for your custom scale in the ratio equation?", options: ["10", "50", "40", "60"], correctAnswer: 2, solution: "Tests application of the algebraic structure to a non-standard scenario. 50 - 10 = 40. If they answer 50, they failed to subtract the freezing point." },
          { question: "The formula states that the ratio equals a \"Constant\" for any linear scale. What foundational physics concept does this prove?", options: ["Celsius is fundamentally more accurate than Fahrenheit.", "The physical fraction of expansion is mathematically identical across all scales, regardless of the arbitrary numbers used.", "Water boils at different thermal energy levels depending on the scale.", "You must always convert the constant to Kelvin before calculating."], correctAnswer: 1, solution: "Clarifies that the constant represents a universal physical ratio. The underlying thermodynamic reality ignores human-invented measurement systems." },
          { question: "The universal ratio formula strictly requires the physical temperature scale to be linear. Which of the following imaginary scenarios would cause the math in this formula to instantly fail?", options: ["A scale that uses negative numbers for its boiling point.", "A scale where freezing is set at 1000 and boiling is set at 0.", "A scale where the thermometer fluid expands twice as much for the second degree as it did for the first degree.", "A scale that spans exactly 1 million degrees between freezing and boiling."], correctAnswer: 2, solution: "Stress-tests the boundary condition of the formula. If the physical expansion is not uniform (linear), the entire mathematical ratio collapses and becomes invalid." },
        ],
      },
    ],
  },
  // ----- INTERMEDIATE level - Subtopic 1.1 (State Variables & Walls — deeper application) -----
  [key("physics", 11, "Thermodynamics", "Thermal equilibrium and zeroth law", 0, "intermediate")]: {
    title: "Subtopic 1.1: State Variables & Thermodynamic Walls (Level: Intermediate)",
    content: `**Extending the Basics**

You've mastered System vs Surroundings and the geometry of walls. At the intermediate level, we combine these with proportionality reasoning.

**Key extensions:**
* **Rigid + Diathermic:** Heat can flow, but Volume is locked. Work = 0. Only P and T can change.
* **Adiabatic + Movable:** No heat, but Work crosses the boundary. Compression/expansion changes internal energy.
* **PV = nRT** — apply proportionality: which variables are locked, and how do the others respond?`,
    bitsQuestions: [
      { question: "A gas is in a rigid diathermic container. You place it in a hotter room. Which of P, V, T, n changes?", options: ["Only T", "T and P (V and n locked)", "T, P, and V", "None — diathermic blocks all change"], correctAnswer: 1, solution: "V locked (rigid), n constant. Heat enters (diathermic). T rises, and since PV=nRT with V,n constant, P ∝ T. So P rises too." },
      { question: "An adiabatic piston-cylinder holds gas. You slowly push the piston in. What happens to internal energy?", options: ["Decreases (heat leaves)", "Stays constant", "Increases (work done on gas)", "Drops to zero"], correctAnswer: 2, solution: "Adiabatic = no heat. Work is done ON the gas (compression). ΔU = Q + W. Q=0, W>0 ⇒ ΔU > 0." },
      { question: "Same gas, same T. Container A has volume V, Container B has volume 2V. Both rigid. Compare pressures.", options: ["P_A = P_B", "P_A = 2 P_B", "P_A = 0.5 P_B", "Cannot compare without n"], correctAnswer: 1, solution: "PV = nRT. Same n, T, R. P ∝ 1/V. B has 2× volume ⇒ B has half the pressure. So P_A = 2 P_B." },
      { question: "Which combination allows the gas to do work on the surroundings?", options: ["Rigid adiabatic walls", "Rigid diathermic walls", "Movable diathermic walls (e.g. piston)", "Fixed mass in a sealed box"], correctAnswer: 2, solution: "Work requires volume change. Movable walls allow expansion; the gas pushes the piston. Rigid walls lock V ⇒ no work." },
    ],
    practiceFormulas: [
      {
        name: "Ideal Gas Proportionality",
        formulaLatex: "PV = nRT",
        description: "For intermediate: identify which variables are constant, then use P∝T, P∝n/V, etc.",
        bitsQuestions: [
          { question: "Rigid container, constant T. You add more gas (n doubles). What happens to P?", options: ["P doubles", "P halves", "P unchanged", "P quadruples"], correctAnswer: 0, solution: "V, T constant. P ∝ n. Doubling n doubles P." },
        ],
      },
    ],
  },
  // ----- ADVANCED level - Subtopic 1.1 (State Variables & Walls — exam traps) -----
  [key("physics", 11, "Thermodynamics", "Thermal equilibrium and zeroth law", 0, "advanced")]: {
    title: "Subtopic 1.1: State Variables & Thermodynamic Walls (Level: Advanced)",
    content: `**Assertion-Reasoning & JEE/NEET Traps**

Advanced questions combine walls, state variables, and the Zeroth Law in subtle ways.

**Common traps:**
* Adiabatic ≠ isolated. Work can still cross.
* Rigid + adiabatic: only Work can change U.
* Extensive vs intensive: n, V are extensive; P, T are intensive.`,
    bitsQuestions: [
      { question: "Assertion: A gas in a rigid adiabatic container cannot exchange energy with surroundings. Reason: Both heat and work are zero. The assertion is _____ and reason is _____.", options: ["Both correct; reason explains assertion", "Assertion wrong; work can cross adiabatic rigid boundary if wall moves", "Assertion correct; reason wrong", "Both wrong"], correctAnswer: 0, solution: "Rigid = no volume change = no work. Adiabatic = no heat. So no energy transfer. Both correct and reason explains assertion." },
      { question: "Which is intensive: (A) Pressure, (B) Volume, (C) Number of moles?", options: ["Only A", "A and B", "B and C", "All three"], correctAnswer: 0, solution: "Intensive: independent of system size (P, T). Extensive: scale with size (V, n)." },
      { question: "A gas at 300 K in a rigid container is heated to 600 K. If n is constant, by what factor does P change?", options: ["×2", "×0.5", "×4", "unchanged"], correctAnswer: 0, solution: "PV=nRT. V, n constant. P ∝ T. Double T ⇒ double P." },
      { question: "Two ideal gases at same P and T. Gas 1 has twice the volume of Gas 2. What is n1/n2?", options: ["2", "0.5", "1", "4"], correctAnswer: 0, solution: "n = PV/(RT). Same P, T. n ∝ V. So n1/n2 = V1/V2 = 2." },
    ],
    practiceFormulas: [
      {
        name: "State Variable Constraints",
        formulaLatex: "PV = nRT",
        description: "Advanced: combine wall constraints with extensivity to solve multi-step problems.",
        bitsQuestions: [
          { question: "Rigid adiabatic container. Gas is compressed (piston pushed in). What stays constant?", options: ["U (internal energy)", "T", "P", "n"], correctAnswer: 3, solution: "n is fixed (closed system). Adiabatic + work done on gas: U increases, so T increases. P = nRT/V; T↑, V↓ ⇒ P increases. Only n is constant." },
        ],
      },
    ],
  },
};

export function getDeepDiveContent(
  subject: Subject,
  classLevel: ClassLevel,
  topic: string,
  subtopicName: string,
  sectionIndex: number,
  level: DifficultyLevel
): DeepDiveEntry | null {
  return deepDiveMap[key(subject, classLevel, topic, subtopicName, sectionIndex, level)] ?? null;
}
