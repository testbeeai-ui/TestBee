#!/usr/bin/env python3
"""100 funbrain/puzzles (PUC basic). Idempotent: DELETE by pack then INSERT."""
from __future__ import annotations

import json
import random
from pathlib import Path

PACK = "cbse_puzzles_puc100_basic"

# (stem, correct, explanation, w1, w2, w3)
ROWS: list[tuple[str, str, str, str, str, str]] = [
    ("What is the next number in the sequence: 2, 6, 12, 20, 30, ?", "42", "Differences increase by even steps: +4,+6,+8,+10; next +12 → 42.", "40", "36", "48"),
    ("What comes next: 1, 1, 2, 3, 5, 8, 13, ?", "21", "Fibonacci: each term is sum of previous two (8+13=21).", "20", "18", "34"),
    ("What is the next number: 1, 4, 9, 16, 25, ?", "36", "Perfect squares: 6² = 36.", "30", "49", "32"),
    ("Find the missing number: 3, 9, 27, 81, ?", "243", "Multiply by 3 each time: 81×3 = 243.", "162", "324", "729"),
    ("What comes next: 2, 3, 5, 7, 11, ?", "13", "Consecutive primes; next after 11 is 13.", "17", "9", "15"),
    ("What is the next number: 8, 27, 64, 125, ?", "216", "Cubes: 2³…5³; next 6³ = 216.", "343", "200", "256"),
    ("Find the next number: 10, 9, 7, 4, 0, ?", "−5", "Subtract 1,2,3,4… next subtract 5 from 0.", "−4", "1", "5"),
    ("What is the next number: 2, 4, 8, 16, 32, ?", "64", "Powers of 2; double 32.", "128", "48", "96"),
    ("Find the missing number: 121, 144, 169, 196, ?", "225", "11²…14²; next 15² = 225.", "210", "214", "200"),
    ("What is the next number: 100, 96, 91, 85, ?", "78", "Decreases by 4,5,6… next −7: 85−7 = 78.", "77", "80", "72"),
    ('I am an odd number. Take away one letter from my name and I become even. What number am I?', "Seven", "Remove S from SEVEN → EVEN.", "Five", "Nine", "Eleven"),
    ("Which three positive numbers give the same result whether added or multiplied?", "1, 2, and 3", "1+2+3 = 6 and 1×2×3 = 6.", "1, 1, 1", "2, 2, 2", "0, 1, 2"),
    ("A bat and a ball cost ₹110 total. The bat costs ₹100 more than the ball. How much is the ball?", "₹5", "x + (x+100) = 110 → x = 5.", "₹10", "₹55", "₹15"),
    ("If 5 machines make 5 widgets in 5 minutes, how long for 100 machines to make 100 widgets?", "5 minutes", "Each machine makes one widget in 5 min; parallel work still 5 min.", "100 minutes", "20 minutes", "50 minutes"),
    ("Lily pads double in area daily; full pond on day 48. When was it half covered?", "47 days", "Half a day before full = one doubling step earlier.", "24 days", "46 days", "48 days"),
    ("A farmer has 17 sheep. All but 9 run away. How many are left?", "9", "All but nine means nine remain.", "8", "17", "0"),
    ("How many times can you subtract 10 from 100?", "Only once", "After first subtraction you subtract from 90, not 100.", "Ten times", "Five times", "Nine times"),
    ("Divide 30 by a half and add 10. What is the result?", "70", "30 ÷ 0.5 = 60; 60 + 10 = 70.", "25", "40", "35"),
    ('What is "half of two plus two"?', "3", "Half of two is 1, then 1 + 2 = 3 (order of wording).", "4", "2", "1"),
    ("If a dozen eggs cost ₹12, how many eggs can you buy for ₹100?", "100 eggs", "₹1 per egg → 100 eggs.", "120", "8 dozen", "50"),
    ("What letter comes next: O, T, T, F, F, S, S, E, ?", "N", "First letters of One, Two, … Eight; next Nine → N.", "T", "O", "I"),
    ("What letter comes next: J, F, M, A, M, J, J, A, ?", "S", "Months January…August; next September → S.", "O", "N", "D"),
    ("What letter comes next: M, V, E, M, J, S, U, ?", "N", "Planets Mercury…Uranus; next Neptune → N.", "P", "V", "U"),
    ("What letter comes next: S, M, T, W, T, F, ?", "S", "Days Sun…Fri; next Saturday → S.", "M", "T", "W"),
    ("What letter comes next: A, C, F, J, O, ?", "U", "Skip 1,2,3,4,5 letters between terms.", "V", "T", "X"),
    ("What letter comes next: Z, Y, X, W, V, ?", "U", "Alphabet backwards.", "T", "W", "S"),
    ('Forward I am heavy, backward I am not. What am I?', "A ton", "TON reversed is NOT.", "A pound", "Lead", "Stone"),
    ("What word is spelled incorrectly in every dictionary?", "Incorrectly", "The word itself is the answer.", "Wrongly", "Error", "Mistake"),
    ("I have cities but no houses, mountains but no trees, water but no fish. What am I?", "A map", "Symbolic geography only.", "A globe", "A painting", "GPS"),
    ("The more you take, the more you leave behind. What are they?", "Footsteps", "Walking leaves a trail.", "Shadows", "Money", "Breath"),
    ("A plane crashes on the US–Canada border. Where are survivors buried?", "Nowhere", "Survivors are not buried.", "Canada", "USA", "The border line"),
    ("A rooster lays an egg on a barn roof. Which way does the egg roll?", "Nowhere / It does not", "Roosters do not lay eggs.", "East", "West", "Down the slope"),
    ("How much dirt is inside a 3 ft deep, 3 ft wide hole?", "None", "A hole is empty space.", "27 cubic feet", "9 cubic feet", "3 pounds"),
    ("Electric train north 100 mph; wind west 10 mph. Which way does the smoke blow?", "Nowhere / No smoke", "Electric trains produce no smoke.", "West", "North", "Southwest"),
    ("What weighs more: a pound of feathers or a pound of bricks?", "They weigh the same", "Both are one pound.", "Feathers", "Bricks", "Cannot tell"),
    ("A house has all four walls facing South. A bear passes the window. What color is the bear?", "White", "Only at North Pole can all walls face south; polar bear.", "Brown", "Black", "Gray"),
    ("Can a man marry his widow's sister?", "No", "A widow implies the man is dead.", "Yes", "Sometimes", "Only abroad"),
    ("You overtake the runner in second place in a marathon. What place are you in?", "Second place", "You took their spot.", "First place", "Third place", "Last place"),
    ("You overtake the last person in a race. What place are you in?", "Impossible", "You cannot be behind the last person and overtake them.", "Last place", "Second to last", "First place"),
    ("Two coins total 30 cents. One is not a nickel. What are the coins?", "A quarter and a nickel", "The quarter is not a nickel; the other coin is.", "Two dimes", "Three dimes", "Two nickels"),
    ("Father 36, son 11. In how many years is father twice as old as son?", "14 years", "36+14=50, 11+14=25; 50=2×25.", "10 years", "7 years", "25 years"),
    ("Snail in 20 ft well: climbs 5 ft by day, slides 4 ft by night. Days to exit?", "16 days", "Net +1 ft/day until final climb clears top on day 16.", "20 days", "4 days", "15 days"),
    ("Grandfather clock: 2 seconds to strike 3 o'clock. Time to strike 6?", "5 seconds", "3 strikes = 2 gaps → 1 s per gap; 6 strikes = 5 gaps.", "4 seconds", "6 seconds", "3 seconds"),
    ('Day before yesterday I was 21; next year I will be 24. When is my birthday?', "December 31st", "Statement on Jan 1: Dec 30 was 21; Dec 31 birthday; next year age 24.", "January 1st", "June 15th", "March 1st"),
    ("Two monkeys type two pages in two minutes. Monkeys to type 18 pages in 18 minutes?", "Two monkeys", "Rate 1 page per monkey per 2 min; same two suffice.", "18 monkeys", "9 monkeys", "6 monkeys"),
    ("Trains 60 mph and 40 mph toward each other from stations 100 mi apart. Time until they meet?", "1 hour", "Closing speed 100 mph covers 100 mi in 1 h.", "2 hours", "30 minutes", "100 minutes"),
    ("Add 5 to 9 and get 2. How is this correct?", "Time on a clock", "9:00 + 5 hours = 2:00.", "Mod 12 arithmetic only", "Wrong math", "Roman numerals"),
    ("Mary's father has five daughters: Nana, Nene, Nini, Nono. Fifth daughter's name?", "Mary", "Stated in the first words.", "Nono", "Nini", "Nana"),
    ("How many months have 28 days?", "All 12 months", "Every month has at least 28 days.", "One month", "February only", "Eleven months"),
    ("Two parents, six sons, each son has one sister. Total people?", "9 people", "2 parents + 6 sons + 1 shared sister.", "8", "10", "14"),
    ("How many squares on a standard 8×8 chessboard?", "204", "Sum of k² for k=1..8 = 204.", "64", "128", "100"),
    ("How many times does digit '9' appear from 1 to 100?", "20 times", "9,19,…,89 and 90–99 (99 counts twice).", "19", "18", "11"),
    ("3 apples on a table; you take away 2. How many do you have?", "2 apples", "You possess the two you took.", "1", "3", "0"),
    ("6 eggs: broke 2, cooked 2, ate 2. How many left?", "4 eggs", "Same two eggs in all three actions.", "0", "2", "6"),
    ("10 black and 10 white socks in dark drawer. Minimum to guarantee a matching pair?", "3 socks", "Third must match one of first two colors.", "2 socks", "4 socks", "20 socks"),
    ("How many times does digit '1' appear from 1 to 10?", "Twice", "In 1 and in 10.", "Once", "Ten times", "Nine times"),
    ("Multiply all digits on a standard phone keypad (0–9). Result?", "0", "Zero is on the pad; product is 0.", "3628800", "45", "10"),
    ("How many corners does a standard 3D cube have?", "8 corners", "4 top + 4 bottom vertices.", "6", "12", "4"),
    ("How many edges does a solid sphere have?", "Zero", "Smooth surface; no straight edges.", "1", "Infinite", "360"),
    ("Interior degrees in a full circle?", "360 degrees", "One full rotation.", "180 degrees", "90 degrees", "100 degrees"),
    ("I am tall when young, short when old. What am I?", "A candle (or a pencil)", "Burns or is sharpened away.", "A tree", "A person", "A building"),
    ("What must be broken before you can use it?", "An egg", "Crack the shell to cook or eat.", "A lock", "Glass", "A rule"),
    ("Full of keys but opens no doors. What am I?", "A piano", "Musical keys.", "A keyboard", "A map", "A ring"),
    ("You can catch it but never throw it. What is it?", "A cold", "Illness wordplay.", "A ball", "A fish", "Wind"),
    ("What has one eye but cannot see?", "A needle", "The thread hole is the eye.", "A storm", "A potato", "A cyclops"),
    ("What belongs to you but others use more than you?", "Your name", "Others call you by it.", "Your money", "Your time", "Your phone"),
    ("What only goes up and never comes down?", "Your age", "Time moves forward.", "Temperature", "A balloon", "Stairs"),
    ("What gets bigger the more you remove from it?", "A hole", "Digging removes more material.", "A debt", "A shadow", "A rumor"),
    ("Has pages and a cover but never speaks. What is it?", "A book", "Silent reading.", "A magazine", "A diary", "A PDF"),
    ("Travels the world but stays in a corner. What is it?", "A postage stamp", "Corner of the envelope.", "A tourist", "Wi‑Fi", "A coin"),
    ("What has a head and a tail but no body?", "A coin", "Heads and tails sides.", "A snake", "A comet", "A tadpole"),
    ("I have branches but no fruit, trunk, or leaves. What am I?", "A bank", "Branch offices.", "A tree", "A river delta", "Git"),
    ("What gets wetter as it dries?", "A towel", "Absorbs water from you.", "A sponge", "Paint", "Hair"),
    ("What has hands but cannot clap?", "A clock", "Hour and minute hands.", "A robot", "A statue", "Gloves"),
    ("No life but can die. What am I?", "A battery", "Goes dead when discharged.", "A star", "Software", "Fire"),
    ("What breaks without falling, and what falls without breaking?", "Day breaks, and night falls.", "English idioms.", "Glass and rain", "Ice and snow", "Heart and tears"),
    ("Yellow hat dropped in the Red Sea. What happens?", "Wet", "Name of sea does not dye it; it gets wet.", "Red", "Yellow", "It floats forever"),
    ("Goes up and down without moving location?", "A staircase", "Fixed structure.", "An elevator", "Temperature", "Stock price"),
    ("What is at the end of every rainbow?", "The letter 'W'", "End of the word rainbow.", "Gold", "Sky", "Pot"),
    ("Turned on my side I am infinite; cut in half I am nothing. What am I?", "The number 8", "Sideways ∞; halved looks like 0 0.", "The letter O", "A Möbius strip", "A circle"),
    ("Three matches, no breaking: how make four?", "Form the Roman numeral IV", "I and V shapes.", "Spell the word FOUR", "Light four fires", "Stack in a 4 shape"),
    ("Slice a cylinder lengthwise and unroll the curved surface. What 2D shape?", "A rectangle", "Height × circumference.", "A circle", "A parallelogram", "An ellipse"),
    ("Minimum straight lines through all 9 dots in 3×3 without lifting pen?", "4 lines", "Extend lines outside the dot square.", "3 lines", "5 lines", "6 lines"),
    ("3×3×3 cube painted red outside. How many small cubes have exactly 3 painted faces?", "8 cubes", "Corner cubes only; a cube has 8 corners.", "6", "12", "1"),
    ("Sum of interior angles of any plane triangle?", "180 degrees", "Euclidean geometry.", "360 degrees", "90 degrees", "270 degrees"),
    ("How many equal sides does a regular hexagon have?", "6 sides", "Hex = six.", "8", "5", "12"),
    ("Square cut corner to corner. What two shapes?", "Two right-angled triangles", "Diagonal bisects square.", "Two rectangles", "Two squares", "Two trapezoids"),
    ("No angles but not a circle or oval — in 3D?", "A sphere", "Smooth closed surface, no vertices.", "A point", "A line", "A torus"),
    ("How many parallel lines in a perfect circle?", "Zero", "No straight lines on a circle.", "Infinite", "Two", "One"),
    ("Six faces, twenty-one eyes, cannot see?", "A standard playing die (dice)", "Six faces; pips total 1+…+6 = 21.", "A robot", "A bee", "A house"),
    ("If 1=3, 2=3, 3=5, 4=4, 5=4 by counting letters, what is 6=?", "3", "S-I-X has three letters.", "6", "4", "5"),
    ("If 2=1 and 4=2 by halving, what is 6=?", "3", "6 ÷ 2 = 3.", "2", "4", "1"),
    ("If A=1,B=2,C=3, sum of letters in CAB?", "6", "C+A+B = 3+1+2 = 6.", "5", "7", "3"),
    ("Evaluate: 8 + 8 ÷ 2 × 2 − 2", "14", "Division then multiplication: 8+8−2 = 14.", "10", "6", "2"),
    ("Six letters; remove one and twelve remains. What word?", "Dozens", "Remove s → dozen = 12.", "Twelve", "Scores", "Single"),
    ("Black when bought, red when used, gray when thrown away?", "Charcoal", "Fuel life cycle.", "Coal", "Iron", "Rubber"),
    ("Door 1: fire. Door 2: lion not eaten in 3 years. Door 3: cliff. Safest?", "Door 2", "Lion would be long dead.", "Door 1", "Door 3", "All equal"),
    ("What has 13 hearts and no other organs?", "A deck of playing cards", "13 heart suit cards.", "An octopus", "A whale", "Artichoke"),
    ("Heavier: a ton of gold or a ton of silver?", "They weigh the exact same.", "A ton is a ton.", "Gold", "Silver", "Depends on location"),
    ("Odd number: remove first letter → very even, level surface. What number?", "Seven", "Remove S → even (wordplay on even/level).", "Five", "Nine", "Eleven"),
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
        f"-- CBSE PUC basic puzzles (100), funbrain / puzzles. Pack: {PACK}.",
        "-- Idempotent: delete this pack in puzzles, then insert.",
        "",
        "BEGIN;",
        "",
        "DELETE FROM public.play_questions",
        "WHERE domain = 'funbrain'",
        "  AND category = 'puzzles'",
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
            "  ('funbrain', 'puzzles', "
            f"'{sql_escape(content_json)}'::jsonb, "
            f"'{sql_escape(options_json)}'::jsonb, "
            f"{ci}, "
            f"'{expl_sql}')"
        )
    lines.append(",\n".join(value_rows) + ";")
    lines.extend(["", "COMMIT;", ""])
    out = Path(__file__).resolve().parent.parent / "supabase" / "migrations" / "20260430333000_play_funbrain_puzzles_puc100_basic.sql"
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out} ({len(ROWS)} rows)")


if __name__ == "__main__":
    main()
