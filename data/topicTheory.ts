import type { Subject } from '@/types';
import type { ClassLevel } from '@/types';

export interface SubtopicTheory {
  theory: string;
  bits: string[];
}

function key(subject: Subject, classLevel: ClassLevel, topic: string, subtopicName: string): string {
  return `${subject}|${classLevel}|${topic}|${subtopicName}`;
}

const theoryMap: Record<string, SubtopicTheory> = {
  // ---------- Class 9 Physics: Motion ----------
  [key('physics', 9, 'Motion', 'Distance & Displacement')]: {
    theory: `**Distance** is the total length of the path actually travelled by an object. It is a scalar quantity (only magnitude, no direction). For example, if you walk from home to school along a curved road, the distance is the length of that road.

**Displacement** is the shortest straight-line distance between the starting point and the ending point, along with the direction from start to end. It is a vector quantity (has both magnitude and direction). If you go from home to school, displacement is the straight line from home to school, with an arrow pointing toward school.

**Key difference:** If you run one full lap around a circular track, your distance is the length of the track (e.g. 400 m), but your displacement is zero because you ended where you started. Distance is always positive or zero; displacement can be positive, negative, or zero depending on direction.`,
    bits: [
      'Distance = total path length (scalar). Displacement = straight line from start to end with direction (vector).',
      'One lap around a track: distance = track length, displacement = 0.',
      'SI unit for both: metre (m). Displacement can be negative if you choose a positive direction.',
    ],
  },
  [key('physics', 9, 'Motion', 'Uniform & Non-Uniform Motion')]: {
    theory: `**Uniform motion** means the object covers equal distances in equal intervals of time, no matter how small the interval. So the speed (and velocity, if direction is fixed) is constant. Example: a car moving at a steady 60 km/h on a straight highway.

**Non-uniform motion** means the object covers unequal distances in equal intervals of time. So the speed or velocity changes with time. Example: a car speeding up from rest, or slowing down at a traffic light.

**Speed** is how fast something moves (distance per time). **Velocity** is speed in a given direction. For uniform motion along a straight line, speed and velocity magnitude are the same. We use graphs (distance-time or velocity-time) to tell uniform from non-uniform: a straight line on a distance-time graph means uniform motion; a curved line means non-uniform.`,
    bits: [
      'Uniform motion: equal distances in equal times → constant speed/velocity.',
      'Non-uniform motion: unequal distances in equal times → speed or direction changes.',
      'Distance-time graph: straight line = uniform; curved line = non-uniform.',
    ],
  },
  [key('physics', 9, 'Motion', 'Equations of Motion')]: {
    theory: `For an object moving in a straight line with **constant acceleration**, we use three main equations (often called the equations of motion or SUVAT):

**1. v = u + at** — Final velocity (v) = initial velocity (u) + acceleration (a) × time (t).

**2. s = ut + ½at²** — Distance (s) = (initial velocity × time) + (half × acceleration × time²).

**3. v² = u² + 2as** — Final velocity squared = initial velocity squared + (2 × acceleration × distance).

Here, **u** = initial velocity, **v** = final velocity, **a** = acceleration (constant), **t** = time, **s** = distance/displacement. These only work when acceleration is constant (e.g. free fall under gravity, or a car moving with constant acceleration). If you know any three of u, v, a, t, s, you can find the other two using these equations.`,
    bits: [
      'v = u + at — relates velocity, acceleration, and time.',
      's = ut + ½at² — relates distance, initial velocity, acceleration, and time.',
      'v² = u² + 2as — relates velocities, acceleration, and distance (no time).',
    ],
  },
  [key('physics', 9, 'Motion', 'Uniform Circular Motion')]: {
    theory: `**Uniform circular motion** is when an object moves along a circular path at constant speed. The speed (magnitude of velocity) is constant, but the **velocity is not constant** because the direction of motion keeps changing (tangent to the circle). So the object is **accelerating** even though its speed is constant.

This acceleration is called **centripetal acceleration** and always points **toward the centre** of the circle. The force that keeps the object in the circle (e.g. tension in a string, friction on a turn) is the **centripetal force**, also directed toward the centre. Without it, the object would fly off in a straight line (Newton’s first law). Formulas: centripetal acceleration a = v²/r, centripetal force F = mv²/r, where v = speed, r = radius, m = mass.`,
    bits: [
      'Speed is constant but velocity changes (direction changes) → so there is acceleration.',
      'Centripetal acceleration and force point toward the centre of the circle.',
      'a = v²/r and F = mv²/r; without centripetal force the object would move in a straight line.',
    ],
  },

  // ---------- Class 11 Physics: Units & Measurements ----------
  [key('physics', 11, 'Units & Measurements', 'SI Units')]: {
    theory: `**SI Units** (International System of Units) are the standard units used globally in science to ensure consistency. Imagine trying to build a spaceship with engineers in different countries using different rulers—it would be a disaster! That's why we established a universal language of measurement.

There are **7 Base Units** from which all other units are derived:
• **Length:** Metre (m)
• **Mass:** Kilogram (kg)
• **Time:** Second (s)
• **Electric Current:** Ampere (A)
• **Temperature:** Kelvin (K)
• **Amount of Substance:** Mole (mol)
• **Luminous Intensity:** Candela (cd)

**Derived Units** are combinations of these base units. For example, Velocity is Length divided by Time (m/s), and Force is Mass times Acceleration (kg·m/s², also known as Newton). Remembering the 7 base units is the key to mastering all formulas in physics!`,
    bits: [
      'There are 7 fundamental SI units: length (m), mass (kg), time (s), current (A), temp (K), amount (mol), luminous intensity (cd).',
      'Derived units are formed by multiplying or dividing base units (e.g., Area is m², Velocity is m/s).',
      'Plane angle (radian) and solid angle (steradian) are supplementary units.',
    ],
  },
  [key('physics', 11, 'Units & Measurements', 'Dimensional Analysis')]: {
    theory: `**Dimensional Analysis** is like an X-ray for physics equations! It helps you check if an equation makes sense. Every physical quantity can be expressed in terms of fundamental dimensions: **[M]** for Mass, **[L]** for Length, and **[T]** for Time.

For example, Velocity is Distance/Time, so its dimension is **[L][T⁻¹]**.

**Why is it incredibly useful?**
1. **Checking Equations (Principle of Homogeneity):** You can only add, subtract, or equate quantities with the same dimensions. You can't add 5 kilograms to 3 meters! Thus, the left side of an equation must always match the dimensions of the right side.
2. **Converting Units:** It helps you systematically convert a value from one system (like SI) to another (like CGS).
3. **Deriving Formulas:** If you know what factors a physical quantity depends on, you can actually derive the formula using dimensions!

*Fun Fact: Pure numbers (like 2, π) and angles have NO dimensions, they are dimensionless.*`,
    bits: [
      'Base dimensions widely used: Mass [M], Length [L], Time [T].',
      'Principle of Homogeneity: Only quantities with identical dimensions can be added, subtracted, or equated.',
      'Dimensional formulas cannot determine the values of dimensionless constants like π or raw numbers.',
    ],
  },
  [key('physics', 11, 'Units & Measurements', 'Errors in Measurement')]: {
    theory: `No measurement in the real world is 100% perfect! **Errors in Measurement** deal with the tiny imperfections that happen whenever we measure practically anything.

There are two main concepts to understand perfectly:
• **Accuracy:** How close your measured value is to the *true* or accepted value.
• **Precision:** How detailed or incredibly consistent your measurements are, regardless of the true value. (E.g., 2.001 is more precise than 2.0, even if the true value is actually 5.0).

**Types of Errors:**
1. **Systematic Errors:** These happen consistently in one direction (always measuring too high or always too low). Example: A ruler with a broken zero-mark. They can be fixed if you identify the cause!
2. **Random Errors:** These are unpredictable fluctuations that occur seemingly by chance. Example: A sudden breeze while weighing a chemical. Taking multiple readings and finding the average is the best way to mathematically minimize these!

*Golden Rule: When combining measurements (like adding two lengths), their errors always add up to create a larger maximum possible error.*`,
    bits: [
      'Accuracy = closeness to the true value; Precision = resolution or consistency of repeated measurements.',
      'Systematic errors are consistent and directional (e.g. instrumental error, zero error). They can be mathematically corrected.',
      'Random errors are unpredictable. Minimized by taking the arithmetic mean (average) of multiple readings.',
      'Absolute error is the difference between individual measurement and true value. Relative error is Absolute error / True value.',
    ],
  },
  // ---------- Class 11 Physics: Kinematics ----------
  [key('physics', 11, 'Kinematics', 'Motion in a Straight Line')]: {
    theory: `**Motion in a Straight Line** (1D Kinematics) is the foundation of describing how things move! 

Imagine driving a car strictly forward or backward on a completely straight road. To describe this scientifically, we use:
• **Position (x):** Where you are relative to a starting point (origin).
• **Displacement (Δx):** The change in your position. It cares about direction! If you go 5m forward and 5m back, displacement is zero.
• **Velocity (v):** How fast your position changes. Average velocity = Displacement / Time. Instantaneous velocity is your exact speed and direction at a specific microsecond (what the speedometer shows + direction).
• **Acceleration (a):** How fast your *velocity* changes. If you press the gas pedal, you accelerate. If you brake, you decelerate (negative acceleration).

The core of this topic revolves around the **Three Equations of Motion** (for *constant* acceleration):
1. v = u + at
2. s = ut + ½at²
3. v² = u² + 2as

*Pro Tip: Free fall under gravity is the most common example of straight-line motion with constant acceleration (a = -g ≈ -9.8 m/s²).*`,
    bits: [
      'Displacement is the vector difference between final and initial position.',
      'Average velocity = Total displacement / Total time. Average speed = Total distance / Total time.',
      'Acceleration is the rate of change of velocity. Speeding up or slowing down both involve acceleration.',
    ],
  },
  [key('physics', 11, 'Kinematics', 'v-t Graphs & Frame of Reference')]: {
    theory: `**Velocity-Time (v-t) Graphs** are visual cheat sheets for motion! They tell you heavily detailed stories just by looking at lines.

**How to read a v-t graph:**
• **The y-axis** is velocity, the **x-axis** is time.
• **Slope of the line:** Represents **Acceleration**. A steep line means high acceleration. A horizontal line means zero acceleration (constant velocity). A downward slope means slowing down.
• **Area under the curve:** This is the magic trick of v-t graphs! The shaded geometric area between the line and the time axis tells you the exact **Displacement**.

**Frame of Reference:**
Motion is entirely relative! If you are sitting in a moving train at 100 km/h, your velocity relative to the train is zero. Relative to a tree outside, it's 100 km/h. A Frame of Reference is simply the coordinate system (the "point of view") from which you choose to measure motion.

**Relative Velocity formula:**
Velocity of object A relative to object B is: **v_AB = v_A - v_B**`,
    bits: [
      'The slope of a Velocity-Time graph gives Acceleration.',
      'The area under a Velocity-Time graph gives Displacement.',
      'Relative velocity v_AB = v_A - v_B (using vector subtraction).',
    ],
  },
  [key('physics', 11, 'Kinematics', 'Vectors & Projectile Motion')]: {
    theory: `Welcome to 2D Physics! **Vectors** are arrows that have both magnitude (length) and direction. You can't just add them like regular numbers (3 + 4 isn't always 7 with vectors, it could be 5 if they form a right triangle!).

**Resolving Vectors:** The most vital skill is breaking a slanted vector into horizontal (x) and vertical (y) components using trigonometry (soh-cah-toa).
• X-component: V_x = V * cos(θ)
• Y-component: V_y = V * sin(θ)

**Projectile Motion:**
Throw a ball in the air—that parabolic arc is a projectile! The brilliant secret to solving these is **separating the X and Y dimensions**:
1. **Horizontal (X) Motion:** Once thrown, there is NO acceleration pushing it sideways (ignoring air resistance). So explicitly, horizontal velocity remains **constant**.
2. **Vertical (Y) Motion:** Gravity pulls it down. So it accelerates purely vertically at -9.8 m/s².

The two dimensions don't affect each other, but they are linked by **Time**!
*Key formulas to memorize: Time of Flight, Maximum Height, and Horizontal Range.*`,
    bits: [
      'Vectors have magnitude and direction; scalars only have magnitude.',
      'In projectile motion, horizontal velocity is constant (a_x = 0).',
      'Vertical motion is independent of horizontal motion, governed solely by gravity (a_y = -g).',
    ],
  },
  [key('physics', 11, 'Kinematics', 'Uniform Circular Motion')]: {
    theory: `**Uniform Circular Motion (UCM)** happens when an object travels in a circle at a strictly constant speed. 

**Wait, is it accelerating?**
YES! Acceleration is a change in velocity. Since velocity is a vector (speed + direction), and the *direction* is constantly turning, the velocity is constantly changing! Therefore, it is accelerating.

**Centripetal Acceleration:**
This acceleration points strictly towards the **center** of the circle. Without it, the object would fly off straight in a tangent line. 
Formula: **a_c = v² / r** (where v is speed, r is radius).

To cause this acceleration, there must be a net force pulling towards the center—this is the **Centripetal Force** (F_c = m * v² / r). It's not a "new" magical force; it's provided by real things like string tension, gravity (for planets), or road friction (for turning cars).`,
    bits: [
      'In UCM, speed is constant but velocity is continuously changing due to direction.',
      'Centripetal acceleration (v²/r) is directed towards the center of the circular path.',
      'Centripetal force is necessary to maintain circular motion, provided by tension, gravity, friction, etc.',
    ],
  },
  // ---------- Class 12 Physics: Electrostatics ----------
  [key('physics', 12, 'Electrostatics', "Coulomb's Law & Electric Field")]: {
    theory: `**Electrostatics** is the study of stationary electric charges. The universe is full of charges (electrons and protons), and when they sit still, they create fascinating forces!

**Coulomb's Law:**
This is the fundamental rule of attraction and repulsion: *Like charges repel, opposite charges attract.*
The force between two point charges (q₁ and q₂) is directly proportional to the product of their charges and inversely proportional to the square of the distance (r) between them.
Formula: **F = k * (|q₁| * |q₂|) / r²** (where k is Coulomb's constant, 9×10⁹ N·m²/C²).

**Electric Field (E):**
Think of an electric field as an invisible "aura" or "web" that a charge creates around itself in space. If another charge enters this web, it feels a force!
Formula: **E = F / q** (Electric Field is the Force experienced per unit of positive test charge).
*Key Visual:* Electric field lines always point **away** from positive charges and **towards** negative charges.`,
    bits: [
      'Coulomb force follows the inverse-square law, just like gravity, but can be attractive OR repulsive.',
      'Electric Field (E) is a vector quantity. Its direction is the direction of force on a positive test charge.',
      'Electric field lines never cross each other. If they did, it would mean two different directions of force at one point!',
    ],
  },
  [key('physics', 12, 'Electrostatics', "Gauss's Law & Dipole")]: {
    theory: `**Electric Flux (Φ):**
Imagine a fishing net catching water flowing down a river. Electric flux is similar—it's a measure of how many electric field lines pass perpendicularly through a given surface area.
Formula: **Φ = E * A * cos(θ)**

**Gauss's Law:**
One of the most powerful and elegant laws in physics! It states that the total electric flux out of a *closed* surface (like a sphere or box) is entirely determined by the **total charge enclosed** within that surface.
Formula: **Φ_total = Q_enclosed / ε₀** (ε₀ is the permittivity of free space).
*Why is it useful?* It makes calculating electric fields for symmetrical shapes (like a long wire or a flat sheet) incredibly easy compared to using Coulomb's law!

**Electric Dipole:**
A dipole is simply a pair of equal and opposite charges (+q and -q) separated by a tiny distance (2a). Water molecules (H₂O) are perfect natural examples of electric dipoles!`,
    bits: [
      "Electric flux is maximum when the area is perpendicular to the electric field (normal vector is parallel).",
      "Gauss's Law relates electric flux through a closed surface to the net charge enclosed.",
      "An electric dipole in a uniform electric field experiences a torque (turning force) but ZERO net force.",
    ],
  },
  [key('physics', 12, 'Electrostatics', 'Capacitors & Dielectrics')]: {
    theory: `**Capacitors** are like tiny, lightning-fast batteries! While batteries provide a steady trickle of energy, capacitors store electrical energy and can dump it all at once (like a camera flash).

**Capacitance (C):**
It is the ability of a system to store charge per unit of electric potential difference (voltage).
Formula: **C = Q / V** (Units: Farads, F).
For a parallel-plate capacitor, **C = ε₀ * A / d** (where A is plate area, d is distance between plates). Notice how it purely depends on the *geometry* of the plates, not the charge!

**Dielectrics:**
If you stuff an insulating material (like glass, paper, or plastic) between the plates of a capacitor, it's called a dielectric.
*The Magic Effect:* A dielectric **increases** the capacitance of the capacitor (by a factor 'K', the dielectric constant) because the molecules inside the insulator polarize and partially cancel out the electric field, allowing the plates to store more charge for the same voltage!`,
    bits: [
      'Capacitors store energy in the form of an electric field between their plates.',
      'Inserting a dielectric between capacitor plates always increases its capacitance (C = K * C_0).',
      'Energy stored in a capacitor = ½ C V² = ½ Q V = Q² / 2C.',
    ],
  },

  // ---------- Class 12 Physics: Current Electricity ----------
  [key('physics', 12, 'Current Electricity', 'Drift Velocity')]: {
    theory: `**Electric Current** is simply the flow of electric charge (mostly electrons) through a conductor. But how exactly do they flow?

**The Illusion of Speed:**
When you flip a light switch, the light turns on instantly. You might think electrons zoom from the switch to the bulb at the speed of light. *They don't!*

Inside a wire, electrons are bouncing around wildly in random directions at huge speeds. When a voltage (battery) is applied, they continue bouncing wildly, but they gain a *tiny, incredibly slow* net forward movement. This slow forward marching speed is called **Drift Velocity (v_d)**. It's usually measured in millimeters per second!

**Formula:**
Current **I = n * A * e * v_d** 
(where n = electron density, A = cross-sectional area, e = charge of an electron).

*Why does the light turn on instantly then?* Because pushing one electron at the start of the wire instantly pushes the next one, like water in a fully packed hose—push water in one end, and water instantly comes out the other!`,
    bits: [
      'Drift velocity is the average velocity attained by charged particles (electrons) in a material due to an electric field.',
      'Even though drift velocity is very small (mm/s), the electric signal travels at near the speed of light.',
      'Ohm’s law (V = IR) is valid only when temperature and physical conditions remain constant.',
    ],
  },
  [key('physics', 12, 'Current Electricity', "Kirchhoff's Laws")]: {
    theory: `When circuits get complicated with multiple batteries and branching wires, simple Ohm's Law (V=IR) isn't enough. We need **Kirchhoff's Circuit Laws**!

**1. Kirchhoff's Current Law (KCL - Junction Rule):**
*The Law of Conservation of Charge.* 
At any junction (branch point) in a circuit, the total current entering the junction exactly equals the total current leaving it. 
*Analogy:* Think of a plumbing intersection. The water flowing into the intersection must equal the water flowing out. You can't magically create or destroy water (charge).

**2. Kirchhoff's Voltage Law (KVL - Loop Rule):**
*The Law of Conservation of Energy.*
Around any closed loop in a circuit, the sum of all voltage drops (across resistors) and voltage gains (across batteries) must equal zero.
*Analogy:* If you go for a hike starting and ending at the exact same base camp, the total altitude you gained must exactly equal the total altitude you lost!`,
    bits: [
      'KCL (Junction Rule) is based on the conservation of electric charge: Sum of currents entering = Sum leaving.',
      'KVL (Loop Rule) is based on the conservation of energy: Algebraic sum of changes in potential in a closed loop is zero.',
      'When applying KVL, traversing a battery from - to + is a voltage gain; traversing a resistor in the direction of current is a voltage drop.',
    ],
  },
  [key('physics', 12, 'Current Electricity', 'Wheatstone Bridge & Potentiometer')]: {
    theory: `**Wheatstone Bridge:**
This is a brilliant circuit design used to perfectly measure an unknown electrical resistance. It consists of four resistors arranged in a diamond shape with a galvanometer (current meter) bridging the middle.
*The Balancing Act:* When the ratio of resistances on one side equals the ratio on the other side (R1/R2 = R3/R4), the bridge is "balanced". The voltage across the middle becomes exactly zero, so the galvanometer shows ZERO deflection. This allows incredibly precise calculations!

**Potentiometer:**
A potentiometer is a versatile, highly accurate instrument that essentially acts as an adjustable voltage divider. Why use it instead of a normal voltmeter?
*The Secret:* A normal voltmeter actually steals a tiny bit of current from the circuit to measure it, which slightly alters the reading. A potentiometer measures voltage by finding a "null point" where it draws **zero current** from the circuit. It is the ultimate tool for measuring the true EMF (Electromotive Force) of a cell!`,
    bits: [
      'A Wheatstone Bridge is most sensitive when all four resistances are of the same order of magnitude.',
      'In a balanced Wheatstone Bridge, no current flows through the central galvanometer arm.',
      'A potentiometer does not draw any current from the cell whose EMF is being measured, making it more accurate than a standard voltmeter.',
    ],
  },
};

export function getTheoryForSubtopic(
  subject: Subject,
  classLevel: ClassLevel,
  topic: string,
  subtopicName: string
): SubtopicTheory | null {
  return theoryMap[key(subject, classLevel, topic, subtopicName)] ?? null;
}

/** Fallback when no theory is defined: short placeholder so UI always has something. */
export function getTheoryOrPlaceholder(
  subject: Subject,
  classLevel: ClassLevel,
  topic: string,
  subtopicName: string
): SubtopicTheory {
  const found = getTheoryForSubtopic(subject, classLevel, topic, subtopicName);
  if (found) return found;
  return {
    theory: `This subtopic covers **${subtopicName}** in the chapter **${topic}** (${subject}, Class ${classLevel}). Study your textbook and notes for a full explanation. Key ideas will appear in the Bits popup once content is added.`,
    bits: ['Read the chapter in your textbook.', 'Note definitions, formulas, and examples.', 'Practice related numericals and concepts.'],
  };
}
