#!/usr/bin/env python3
"""100 funbrain/analytical (PUC medium). Idempotent: DELETE by pack then INSERT."""
from __future__ import annotations

import json
import random
from pathlib import Path

PACK = "cbse_analytical_puc100_medium"

# (stem, correct, explanation, w1, w2, w3)
ROWS: list[tuple[str, str, str, str, str, str]] = [
    # Block 1: Coding & Decoding
    (
        'If "MENTAL" is coded as "LNDOMZUK" (each letter replaced by the letter before it and the letter after it in the alphabet), how is "TEST" coded?',
        "SUDFRTSU",
        "T→SU, E→DF, S→RT, T→SU; concatenate → SUDFRTSU.",
        "SUDFRTST",
        "RTSUFDUS",
        "TSEFDURS",
    ),
    (
        'In a code, "ROSE" = 6821, "CHAIR" = 73456, "PREACH" = 961473. Code for "SEARCH"?',
        "214673",
        "Map letters: S=2,E=1,A=4,R=6,C=7,H=3 → SEARCH = 214673.",
        "214678",
        "961473",
        "734562",
    ),
    (
        'If "WATER" is written as "YCVGT" (each letter shifted +2), how is "FIRE" written?',
        "HKTG",
        "F+2=H, I+2=K, R+2=T, E+2=G.",
        "HJTG",
        "HKUG",
        "GJTG",
    ),
    (
        '"256" = you are good, "637" = we are bad, "358" = good and bad. Which digit is "and"?',
        "8",
        "6=are, 5=good, 3=bad; in 358 the remaining digit 8 is and.",
        "3",
        "5",
        "6",
    ),
    (
        "If A = 1, B = 2, … and PAT = 16+1+20 = 37, what is PART?",
        "55",
        "P(16)+A(1)+R(18)+T(20)=55.",
        "54",
        "56",
        "52",
    ),
    (
        'If "DELHI" = 73541 and "CALCUTTA" = 82589662, code for "CALICUT"?',
        "8251896",
        "Same letter→digit map: C=8,A=2,L=5,I=1,U=9,T=6.",
        "8258966",
        "8251891",
        "82589662",
    ),
    (
        'If "GLARE" = 67810 and "MONSOON" = 2395339, code for "RANSOM"?',
        "189532",
        "R=1,A=8,N=9,S=5,O=3,M=2.",
        "189523",
        "198532",
        "189352",
    ),
    (
        'Code: A=2, B=4, C=6, … (each letter’s position × 2). Sum for "OWL"?',
        "100",
        "O(15×2)+W(23×2)+L(12×2)=30+46+24=100.",
        "96",
        "104",
        "98",
    ),
    (
        'If "MIND" → "KGLB" and "ARGUE" → "YPESC" (each letter −2), what is "DIAGRAM"?',
        "BGYESYK",
        "Each letter shifted back by 2 in the alphabet.",
        "BGYESYJ",
        "CEZFTRZ",
        "BGYFTYK",
    ),
    (
        'If "RED" = 6720 (add 2 to each letter’s position, then write digits in reverse letter order N←…←R), what is "GREEN"?',
        "1677209",
        "Reverse order N,E,E,R,G with values 16,7,7,20,9 → 1677209.",
        "1677207",
        "9071721",
        "1677029",
    ),
    # Block 2: Blood relations
    (
        'Pointing to a photo, a man said: "I have no brother or sister, but that man’s father is my father’s son." Whose photo?',
        "His son’s",
        "Father’s son with no siblings = himself; the man’s father is the speaker → the man in the photo is his son.",
        "His nephew’s",
        "His father’s",
        "His own",
    ),
    (
        "A is B’s sister. C is B’s mother. D is C’s father. E is D’s mother. How is A related to D?",
        "Granddaughter",
        "D is C’s father and C is A’s mother → D is A’s grandfather (maternal line).",
        "Daughter",
        "Niece",
        "Sister",
    ),
    (
        'A girl says of a boy: "He is the son of the daughter of the father of my uncle." How is the boy related to the girl?',
        "Brother or cousin",
        "Grandfather’s daughter may be her mother (brother) or an aunt (cousin).",
        "Uncle",
        "Nephew",
        "Father",
    ),
    (
        "A woman introduces a man as the son of the brother of her mother. How is he related to her?",
        "Cousin",
        "Mother’s brother’s son = first cousin.",
        "Brother",
        "Uncle",
        "Nephew",
    ),
    (
        "A+B = A is brother of B; A−B = sister; A×B = A is father of B. Which shows C is son of M?",
        "M × C + F",
        "M×C: M father of C; C+F: C brother of F → C is male child of M.",
        "M + C × F",
        "M × F + C",
        "C × M + F",
    ),
    (
        'Deepak: "His only brother is the father of my daughter’s father." How is the gentleman related to Deepak?',
        "Uncle",
        "Daughter’s father = Deepak; that man’s brother = Deepak’s father → the man is Deepak’s uncle.",
        "Father",
        "Brother",
        "Grandfather",
    ),
    (
        "Q’s mother is sister of P and daughter of M. S is daughter of P and sister of T. How is M related to T?",
        "Grandmother or grandfather",
        "P is child of M; T is child of P → M is T’s grandparent (gender of M unknown).",
        "Mother",
        "Aunt",
        "Cannot tell",
    ),
    (
        "Family A,B,C,D,E,F: B is son of C but C is not B’s mother. A and C are married. E is C’s brother. D is A’s daughter. F is A’s brother. Who is B’s mother?",
        "A",
        "C is father; married couple A,C → A is mother.",
        "C",
        "D",
        "E",
    ),
    (
        'A girl points to a lady: "She is the daughter-in-law of the grandmother of my father’s only son." Relation of lady to girl?',
        "Mother or aunt",
        "Father’s only son may be her brother; grandmother’s daughter-in-law can be mother or aunt.",
        "Sister",
        "Grandmother",
        "Cousin",
    ),
    (
        'X to Y: "I am the mother of your father’s brother’s son." How is X related to Y?',
        "Aunt",
        "Father’s brother’s son = cousin; cousin’s mother = aunt to Y.",
        "Mother",
        "Sister",
        "Grandmother",
    ),
    # Block 3: Direction sense
    (
        "Walk 5 km south, turn right 3 km, turn left 5 km. Direction from start?",
        "South-West",
        "Net south and west of origin.",
        "South-East",
        "North-West",
        "Due south",
    ),
    (
        "North 20 m, right 30 m, right 35 m, left 15 m, left 15 m. Displacement from start?",
        "45 m East",
        "Vertical legs cancel; horizontal 30+15=45 m east.",
        "15 m East",
        "0 m",
        "45 m West",
    ),
    (
        "Morning after sunrise, Vimal walks and meets Stephen from opposite direction. Stephen’s shadow falls to Vimal’s right. Vimal faces?",
        "South",
        "Morning sun east → shadows west; Vimal’s right is west → Vimal faces south.",
        "North",
        "East",
        "West",
    ),
    (
        "Clock placed so at 12 noon minute hand points north-east. At 1:30 PM, hour hand points?",
        "East",
        "Clock rotated 45° clockwise; hour direction at 1:30 maps to east.",
        "North-East",
        "South-East",
        "North",
    ),
    (
        "A east of B; C south of A; D north of C. Direction of D from B?",
        "Cannot be determined",
        "D north of C but horizontal offset from B is not fixed.",
        "East",
        "North-East",
        "South",
    ),
    (
        "Facing NW, turn 90° clockwise, then 180° anticlockwise, then 90° anticlockwise. Now facing?",
        "South-East",
        "Net −180° from NW → SE.",
        "North-West",
        "South-West",
        "North-East",
    ),
    (
        "12 km north, turn right, walk 5 km. Shortest distance back to start?",
        "13 km",
        "Right from north is east; √(12²+5²)=13 km.",
        "17 km",
        "7 km",
        "12 km",
    ),
    (
        "X is 1 km NE of Y. Y is 1 km SE of Z. W is 1 km west of Z. P is 1 km south of W. Q is 1 km east of P. Distance X to Q?",
        "3 km",
        "Fix coordinates from the chain; straight-line distance works out to 3 km in the standard layout.",
        "√5 km",
        "2 km",
        "1 km",
    ),
    (
        "Rat: 20 m east, right 10 m, right 9 m, left 5 m, left 12 m, left 6 m. Final facing?",
        "North",
        "Track heading after each turn from east.",
        "South",
        "East",
        "West",
    ),
    (
        "Facing south: right 20 m, right 10 m, left 10 m. Direction from start?",
        "North-West",
        "Path nets north and west of origin.",
        "North-East",
        "South-West",
        "Due west",
    ),
    # Block 4: Syllogisms
    (
        "Statements: All bats are boys. All boys are gloves. Conclusions: I. All bats are gloves. II. All gloves are bats.",
        "Only Conclusion I follows",
        "Bats ⊆ boys ⊆ gloves → I. II need not hold.",
        "Only II follows",
        "Both follow",
        "Neither follows",
    ),
    (
        "Statements: Some papers are pens. All pens are scales. I. Some papers are scales. II. Some scales are pens.",
        "Both I and II follow",
        "Papers meeting pens lie in scales; all pens are scales ⇒ some scales are pens.",
        "Only I follows",
        "Only II follows",
        "Neither follows",
    ),
    (
        "Statements: No cat is a rat. All rats are dogs. I. No cat is a dog. II. Some dogs are not cats.",
        "Only Conclusion II follows",
        "Rat-dogs are not cats; cats may still be other dogs → I fails.",
        "Only I follows",
        "Both follow",
        "Neither follows",
    ),
    (
        "Statements: All cars are wheels. Some wheels are heavy. I. Some cars are heavy. II. No car is heavy.",
        "Either I or II follows",
        "No definite link between cars and heavy; classical either-or.",
        "Only I follows",
        "Only II follows",
        "Neither follows",
    ),
    (
        "Statements: Some cats are kittens. All dogs are kittens. I. Some cats are dogs. II. No dog is a cat.",
        "Either I or II follows",
        "Cats and dogs subsets of kittens; mutual exclusion or overlap undetermined.",
        "Both follow",
        "Only I follows",
        "Neither follows",
    ),
    (
        "Statements: All windows are doors. No door is a wall. I. No window is a wall. II. No wall is a door.",
        "Both I and II follow",
        "Windows ⊆ doors disjoint from walls; II restates symmetry of disjointness.",
        "Only I follows",
        "Only II follows",
        "Neither follows",
    ),
    (
        "Statements: Some apples are red. All red things are sweet. I. Some apples are sweet. II. All sweet things are red.",
        "Only Conclusion I follows",
        "Red apples are sweet; sweet things need not all be red.",
        "Both follow",
        "Only II follows",
        "Neither follows",
    ),
    (
        "Statements: All birds can fly. Some flying objects are airplanes. I. Some birds are airplanes. II. No airplane is a bird.",
        "Either I or II follows",
        "Birds and planes only linked through flying; no definite relation.",
        "Both follow",
        "Only I follows",
        "Neither follows",
    ),
    (
        "Statements: (Hypothetical) No square is a rectangle. All rectangles are circles. I. Some circles are not squares. II. No square is a circle.",
        "Only Conclusion I follows",
        "Rectangle-circles are not squares; squares could still be non-rectangle circles.",
        "Both follow",
        "Only II follows",
        "Neither follows",
    ),
    (
        "Statements: Some books are magazines. Some magazines are novels. I. Some books are novels. II. No book is a novel.",
        "Either I or II follows",
        "Two 'some' chains give no definite link between books and novels.",
        "Both follow",
        "Only I follows",
        "Neither follows",
    ),
    # Block 5: Number & letter series
    ("Next: 3, 7, 15, 31, 63, …", "127", "×2+1 each step: 63×2+1=127.", "125", "129", "255"),
    ("Missing: 1, 9, 25, 49, ?, 121", "81", "Odd squares: 1²,3²,5²,7²,9²,11² → 9²=81.", "64", "100", "91"),
    ("Next: Z, W, S, P, L, I, E, …", "B", "Backward skips alternate 3,4 letters.", "A", "C", "D"),
    ("Odd one out: 8, 27, 64, 100, 125, 216", "100", "All are perfect cubes except 100 (square only).", "125", "64", "27"),
    ("Next: 2, 1, 1/2, 1/4, …", "1/8", "Each term ÷2.", "1/16", "0", "1/6"),
    ("Next: B2CD, BCD4, B5CD, BC6D, …", "BCD7", "Digit increases 2,4,5,6,7 cycling placement after B,C,D positions.", "B7CD", "B2C8D", "BC7D"),
    ("Wrong number: 4, 9, 19, 39, 79, 160, 319", "160", "Should be 79×2+1=159, not 160.", "319", "79", "39"),
    ("Next: 2, 3, 5, 7, 11, 13, 17, …", "19", "Consecutive primes.", "23", "18", "21"),
    ("Fill: SCD, TEF, UGH, ____, WKL", "VIJ", "First letter advances; next two letters advance in pairs.", "VJK", "VIK", "WGH"),
    ("Next: 5, 11, 24, 51, 106, …", "217", "×2+1, ×2+2, … ×2+5: 106×2+5=217.", "212", "220", "213"),
    # Block 6: Ranking & ordering
    ("40 students in a row; Rohan 14th from left. Position from right?", "27th", "40−14+1=27.", "26th", "28th", "25th"),
    ("Sam 9th from top and 38th from bottom. Total students?", "46", "9+38−1=46.", "47", "45", "48"),
    (
        "60 students; girls = 2× boys. Kamal 17th from top; 9 girls ahead of Kamal. Boys after Kamal?",
        "12",
        "20 boys, 40 girls; Kamal is 8th boy → 20−8=12 boys after.",
        "10",
        "11",
        "13",
    ),
    ("A taller than B, shorter than C. D taller than A, shorter than C. E tallest. Shortest?", "B", "Order E>C>D>A>B.", "A", "D", "Cannot tell"),
    (
        "A 15th from left, B 4th from right, 3 boys between A and B. C just left of A. C’s position from right?",
        "9th",
        "Total 22; C is 14th from left → 22−14+1=9.",
        "8th",
        "10th",
        "7th",
    ),
    ("Boxes: P above Q; R below S; T between Q and R. Bottom box?", "S", "Top to bottom: P, Q, T, R, S.", "R", "T", "Q"),
    (
        "A,B,C in queue: 5 between A and B, 8 between B and C; 3 ahead of C, 21 behind A. Minimum people in queue?",
        "28",
        "Standard minimal-overlap arrangement yields 28.",
        "30",
        "25",
        "38",
    ),
    (
        "5th of month is two days after Monday. Day before the 19th?",
        "Tuesday",
        "5th is Wednesday; 19th is Wednesday; day before is Tuesday.",
        "Wednesday",
        "Monday",
        "Thursday",
    ),
    ("Mohan 18th from either end. How many boys?", "35", "18+18−1=35.", "36", "34", "37"),
    (
        "50 in queue: Amrita 10th from front, Mukul 25th from behind, Maha midway between them. Maha from front?",
        "18th",
        "Mukul 26th from front; midpoint of 10 and 26 is 18.",
        "17th",
        "19th",
        "16th",
    ),
    # Block 7: Odd one out & analogies
    ("Odd one out: Circle, Triangle, Square, Rectangle, Pentagon", "Circle", "Only non-polygon (smooth curve).", "Rectangle", "Square", "Triangle"),
    ("Odd one out: Iron, Copper, Zinc, Aluminum, Brass", "Brass", "Alloy; others are elements.", "Zinc", "Copper", "Aluminum"),
    ("Clock is to Time as Thermometer is to …", "Temperature", "Instrument : quantity measured.", "Heat energy", "Speed", "Length"),
    ("Ocean is to Water as Glacier is to …", "Ice", "Large body : constituent material.", "Snow", "Cold", "Mountain"),
    ("Odd pair: (Tree:Branch), (Hand:Finger), (Table:Chair), (Room:Floor)", "(Table:Chair)", "Chair is not part of table; others are part-whole.", "(Hand:Finger)", "(Tree:Branch)", "(Room:Floor)"),
    ("11 is to 121 as 15 is to …", "225", "Square: 11²=121, 15²=225.", "200", "230", "256"),
    ("Odd one out: Tomato, Potato, Onion, Carrot, Radish", "Tomato", "Fruit/above ground; others often classed as root vegetables.", "Onion", "Potato", "Carrot"),
    ("Prologue is to Book as Overture is to …", "Opera (or musical)", "Opening section of a performance medium.", "Symphony", "Novel", "Chapter"),
    ("Odd number: 13, 17, 23, 27, 29", "27", "27=3×9 composite; others prime.", "23", "17", "13"),
    ("Eye is to Myopia as Teeth is to …", "Pyorrhea (or cavities)", "Organ : common ailment of that organ.", "Asthma", "Arthritis", "Deafness"),
    # Block 8: Seating
    (
        "Six people A–F sit in a circle facing center. D between F and B. A is second left of D and second right of E. Who faces A?",
        "B",
        "Consistent circular order gives B opposite A.",
        "C",
        "D",
        "E",
    ),
    (
        "Same setup. Who sits exactly between A and B?",
        "C",
        "From the deduced clockwise order.",
        "D",
        "F",
        "E",
    ),
    (
        "Same setup. Position of F with respect to E?",
        "Immediate right",
        "F adjacent to E on the appropriate side in the standard diagram.",
        "Immediate left",
        "Opposite",
        "Second to the left",
    ),
    (
        "Same setup. Who faces E?",
        "D",
        "D sits opposite E in the arrangement.",
        "A",
        "B",
        "F",
    ),
    (
        "P,Q,R,S,T in a line facing north. Q middle. P not at an end. T immediate right of R. S at extreme left. Order left→right?",
        "S, P, Q, R, T",
        "S left; Q center; RT block at right forces P second.",
        "S, Q, P, R, T",
        "P, S, Q, R, T",
        "S, R, T, Q, P",
    ),
    ("Same line. Who between P and R?", "Q", "Q is center between P and R.", "S", "T", "Nobody"),
    ("Same line. Extreme right?", "T", "Order ends with T.", "R", "Q", "P"),
    (
        "Four play cards in a circle. Ram faces east. Shyam opposite Ram. Tarun to Ram’s right. Mohan opposite Tarun. Shyam faces?",
        "West",
        "Opposite of east-facing Ram faces west.",
        "East",
        "North",
        "South",
    ),
    (
        "Same card setup. Tarun faces?",
        "North",
        "Tarun on Ram’s right with Ram facing east → Tarun faces north.",
        "South",
        "West",
        "East",
    ),
    (
        "Same card setup. Immediate left of Shyam (who faces west)?",
        "Tarun",
        "Shyam’s left when facing west is toward Tarun’s seat.",
        "Ram",
        "Mohan",
        "Nobody",
    ),
    # Block 9: Data sufficiency
    (
        "What is P’s age? I. P is 5 years older than Q. II. Q’s age is twice R’s; R is 10.",
        "(C) Both together are necessary",
        "II gives Q=20; I gives P=25.",
        "(A) I alone",
        "(B) II alone",
        "(D) Both insufficient",
    ),
    (
        "On which weekday did Rahul reach Delhi? I. After Tuesday before Friday. II. After Wednesday before Saturday.",
        "(C) Both together are necessary",
        "I: Wed/Thu; II: Thu/Fri → only Thursday common.",
        "(A) I alone",
        "(B) II alone",
        "(E) Either alone",
    ),
    (
        "Is integer x divisible by 6? I. x divisible by 2. II. x multiple of 3.",
        "(C) Both together are necessary",
        "Need 2 and 3; neither alone guarantees 6.",
        "(A) I alone",
        "(B) II alone",
        "(E) Either alone",
    ),
    (
        "How many children in the row? I. A is 5th from left and 7th from right. II. B is 6th from left.",
        "(A) Statement I alone is sufficient",
        "Total = 5+7−1 = 11; II adds no total.",
        "(B) II alone",
        "(C) Both necessary",
        "(D) Both insufficient",
    ),
    (
        "Color of fresh grass in a code? I. green→red, red→yellow. II. yellow→blue.",
        "(A) Statement I alone is sufficient",
        "Grass is green; I maps green to red.",
        "(B) II alone",
        "(C) Both necessary",
        "(D) Both insufficient",
    ),
    (
        "Among A–E, who is tallest? I. A taller than B and C, shorter than E. II. D shorter than C.",
        "(A) Statement I alone is sufficient",
        "E > A > B,C → E tallest regardless of D.",
        "(C) Both necessary",
        "(B) II alone",
        "(D) Both insufficient",
    ),
    (
        "Two-digit number? I. Sum of digits 7. II. Difference of digits 3.",
        "(D) Both together are insufficient",
        "Could be 52 or 25 (order unknown).",
        "(C) Both necessary",
        "(A) I alone",
        "(B) II alone",
    ),
    (
        "Direction of P from Q? I. P north of R. II. Q west of R.",
        "(C) Both together are necessary",
        "Together fix relative positions → P is north-east of Q.",
        "(A) I alone",
        "(B) II alone",
        "(D) Both insufficient",
    ),
    (
        "How is X related to Y? I. Y and Z are children of D, wife of X. II. Z’s sister Y is daughter of X.",
        "(E) Either statement alone is sufficient",
        "Both show X is father of Y.",
        "(C) Both necessary",
        "(A) I alone",
        "(B) II alone",
    ),
    (
        "Mr. Sharma’s monthly salary? I. 20% rent, saves ₹5000. II. 30% on food.",
        "(D) Both together are insufficient",
        "Percent pieces don’t fix total without more constraints.",
        "(C) Both necessary",
        "(A) I alone",
        "(B) II alone",
    ),
    # Block 10: Mixed
    ("Angle between hour and minute hands at 3:15?", "7.5°", "Minute at 3; hour 1/4 of 30° past 3 → 7.5°.", "0°", "22.5°", "15°"),
    ("How many times do clock hands coincide in 24 hours?", "22", "11 overlaps per 12 hours ×2.", "24", "21", "23"),
    ("Today is Monday. Day of week after 61 days?", "Saturday", "61 mod 7 = 5 → Mon+5 = Sat.", "Friday", "Sunday", "Thursday"),
    ("1 Jan 2004 was Thursday. 1 Jan 2005?", "Saturday", "2004 leap year +366 days → +2 weekdays.", "Friday", "Sunday", "Thursday"),
    (
        "Monkey climbs 30 ft pole: +3 ft/min, slips −2 ft/min after each minute until top. Minutes to touch top?",
        "28",
        "After 27 min at 27 ft; 28th minute climbs 3 ft to 30 before slip.",
        "30",
        "27",
        "15",
    ),
    (
        "Square with both diagonals and lines joining midpoints of opposite sides (+). How many triangles?",
        "16",
        "Count small, medium, and large triangular regions in the standard figure.",
        "8",
        "12",
        "20",
    ),
    (
        "Cows C and hens H: legs = 2×heads + 14. Number of cows?",
        "7",
        "4C+2H = 2(C+H)+14 → 2C=14 → C=7.",
        "6",
        "8",
        "5",
    ),
    (
        "Die 1–6: 1 adjacent to 2,3,5. Which number is opposite 1 on a standard die?",
        "6",
        "Standard die: opposite faces sum to 7; neighbors of 1 are 2,3,4,5 around sides → 6 opposite.",
        "4",
        "Cannot be determined from adjacency alone",
        "3",
    ),
    (
        "Day before yesterday was Thursday. When is Sunday?",
        "Tomorrow",
        "Today is Saturday → Sunday tomorrow.",
        "Today",
        "Day after tomorrow",
        "Yesterday",
    ),
    ("Shepherd had 17 sheep; all but nine died. How many alive?", "9", "All but nine survived = 9.", "8", "17", "0"),
]

assert len(ROWS) == 100, len(ROWS)


def sql_escape(s: str) -> str:
    return s.replace("'", "''")


def build_options(correct: str, d1: str, d2: str, d3: str) -> tuple[list[str], int]:
    opts = [correct, d1, d2, d3]
    random.shuffle(opts)
    return opts, opts.index(correct)


def main() -> None:
    random.seed(42)
    lines = [
        f"-- CBSE PUC medium analytical (100), funbrain / analytical. Pack: {PACK}.",
        "-- Idempotent: delete this pack in analytical, then insert.",
        "",
        "BEGIN;",
        "",
        "DELETE FROM public.play_questions",
        "WHERE domain = 'funbrain'",
        "  AND category = 'analytical'",
        f"  AND (content->>'pack') = '{PACK}';",
        "",
        "INSERT INTO public.play_questions (domain, category, content, options, correct_answer_index, explanation)",
        "VALUES",
    ]
    value_rows: list[str] = []
    for stem, correct, expl, w1, w2, w3 in ROWS:
        opts, ci = build_options(correct, w1, w2, w3)
        content_json = json.dumps({"text": stem, "pack": PACK}, ensure_ascii=False)
        options_json = json.dumps(opts, ensure_ascii=False)
        expl_sql = sql_escape(expl)
        value_rows.append(
            "  ('funbrain', 'analytical', "
            f"'{sql_escape(content_json)}'::jsonb, "
            f"'{sql_escape(options_json)}'::jsonb, "
            f"{ci}, "
            f"'{expl_sql}')"
        )
    lines.append(",\n".join(value_rows) + ";")
    lines.extend(["", "COMMIT;", ""])
    out = Path(__file__).resolve().parent.parent / "supabase" / "migrations" / "20260430334000_play_funbrain_analytical_puc100_medium.sql"
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out} ({len(ROWS)} rows)")


if __name__ == "__main__":
    main()
