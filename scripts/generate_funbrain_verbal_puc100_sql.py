#!/usr/bin/env python3
"""100 funbrain/verbal (PUC foundational). Idempotent: DELETE by pack then INSERT."""
from __future__ import annotations

import json
import random
from pathlib import Path

PACK = "cbse_verbal_puc100_foundational"

# (stem, correct, explanation, w1, w2, w3)
ROWS: list[tuple[str, str, str, str, str, str]] = [
    # Block 1: Synonyms
    ("What is a synonym for HUGE?", "Enormous", "Huge means very large; enormous is a close synonym (also: giant).", "Tiny", "Narrow", "Brief"),
    ("What is a synonym for BRAVE?", "Courageous", "Brave shows no fear; courageous / fearless match.", "Cowardly", "Shy", "Lazy"),
    ("What is a synonym for START?", "Begin", "Start means to commence an action.", "Finish", "Stop", "Delay"),
    ("What is a synonym for CALM?", "Peaceful", "Calm means quiet and not agitated (also: peaceful).", "Loud", "Angry", "Wild"),
    ("What is a synonym for RICH?", "Wealthy", "Rich means having a lot of money or assets.", "Poor", "Weak", "Hungry"),
    ("What is a synonym for HARD (difficult)?", "Difficult", "Hard often means not easy; solid is another sense.", "Easy", "Soft", "Simple"),
    ("What is a synonym for FAST?", "Quick", "Fast means high speed; quick / rapid match.", "Slow", "Late", "Heavy"),
    ("What is a synonym for BEAUTIFUL?", "Lovely", "Beautiful means pleasing; pretty / lovely fit.", "Ugly", "Plain", "Dull"),
    ("What is a synonym for HELP?", "Assist", "Help means aid someone; assist / aid match.", "Hinder", "Ignore", "Blame"),
    ("What is a synonym for HAPPY?", "Joyful", "Happy means pleased; joyful / glad match.", "Sad", "Angry", "Tired"),
    # Block 2: Antonyms
    ("What is the antonym of ALWAYS?", "Never", "Always = every time; never = not ever.", "Sometimes", "Often", "Usually"),
    ("What is the antonym of ACCEPT?", "Reject", "Accept = say yes; reject / refuse = say no.", "Welcome", "Keep", "Praise"),
    ("What is the antonym of MODERN?", "Ancient", "Modern = current era; ancient / old are opposites.", "New", "Fresh", "Young"),
    ("What is the antonym of PUBLIC?", "Private", "Public = open to all; private = restricted.", "Open", "Free", "Loud"),
    ("What is the antonym of DEEP?", "Shallow", "Deep goes far down; shallow is the opposite.", "Wide", "High", "Long"),
    ("What is the antonym of SUCCESS?", "Failure", "Success = reaching a goal; failure = not reaching it.", "Win", "Luck", "Hope"),
    ("What is the antonym of CRUEL?", "Kind", "Cruel hurts on purpose; kind / gentle are opposites.", "Strict", "Bold", "Loud"),
    ("What is the antonym of IMPORT?", "Export", "Import brings goods in; export sends them out.", "Buy", "Sell", "Tax"),
    ("What is the antonym of LIGHT (not heavy)?", "Heavy", "Light weight vs heavy.", "Dark", "Bright", "Soft"),
    ("What is the antonym of HOT?", "Cold", "Hot vs cold temperature.", "Warm", "Cool", "Dry"),
    # Block 3: Prepositions & articles
    ('Fill in: The cat is hiding _____ the bed.', "under", "Position directly below the bed.", "on", "in", "at"),
    ('Fill in: I will meet you _____ 5:00 PM.', "at", "Use at for clock times.", "on", "in", "by"),
    ('Fill in: My birthday is _____ August.', "in", "Use in for months.", "on", "at", "to"),
    ('Fill in: He is _____ honest boy.', "an", "Honest begins with a vowel sound.", "a", "the", "one"),
    ('Fill in: She placed the book _____ the table.', "on", "On the surface.", "in", "under", "at"),
    ('Fill in: They went to _____ sunniest beach in the state.', "the", "The before superlatives.", "a", "an", "some"),
    ('Fill in: I go to school _____ bus.', "by", "By + vehicle for transport mode.", "on", "in", "with"),
    ('Fill in: He has been sleeping _____ morning.', "since", "Since + point in time with present perfect.", "for", "from", "by"),
    ('Fill in: Please give me _____ pen. (any pen)', "a", "Non-specific singular countable noun.", "an", "the", "some"),
    ('Fill in: She is walking _____ the park.', "through", "Through / in / towards can fit; through is common for crossing the park.", "on", "at", "of"),
    # Block 4: Verbs & tenses
    ('Fill in: The sun _____ in the East.', "rises", "Simple present for facts.", "rise", "is rising", "rose"),
    ('Fill in: They _____ playing football yesterday.', "were", "Past continuous; plural they → were.", "was", "are", "is"),
    ('Fill in: She _____ not like ice cream.', "does", "Third person singular negative uses does.", "do", "is", "has"),
    ('Fill in: I _____ my homework right now.', "am doing", "Present continuous for now.", "do", "did", "have done"),
    ('Fill in: We _____ to the zoo tomorrow.', "will go", "Future: will go or are going; will go listed.", "go", "went", "goes"),
    ('Fill in: He _____ a new car last week.', "bought", "Past tense for last week.", "buy", "buys", "has bought"),
    ('Fill in: Dogs _____ a very good sense of smell.', "have", "Plural subject takes have.", "has", "is having", "having"),
    ('Fill in: I _____ never seen a tiger in real life.', "have", "Present perfect: have + past participle.", "has", "am", "had"),
    ('Fill in: Look! The bird _____ flying away.', "is", "Singular present continuous.", "are", "was", "were"),
    ('Fill in: If it rains, I _____ stay home.', "will", "First conditional: if + present, will + base.", "would", "stayed", "stays"),
    # Block 5: Idioms
    ('What does "piece of cake" mean?', "Something very easy", "Informal: very easy to do.", "A dessert order", "A broken plate", "A small snack"),
    ('What does "raining cats and dogs" mean?', "Raining very heavily", "Idiom for a downpour.", "Animals outside", "Light drizzle", "Snowing hard"),
    ('What does "break a leg" mean?', "Good luck", "Said especially before a performance.", "Get hurt", "Stop trying", "Leave quickly"),
    ('What does "once in a blue moon" mean?', "Happens very rarely", "Very infrequent event.", "Every month", "Every night", "Always"),
    ('What does "apple of my eye" mean?', "Someone cherished dearly", "A person you love or value highly.", "A fruit basket", "An eye problem", "A teacher"),
    ('What does "cost an arm and a leg" mean?', "To be very expensive", "Hyperbole for high price.", "To be cheap", "To be free", "To hurt physically"),
    ('What does "under the weather" mean?', "Feeling sick", "Mildly unwell.", "Very happy", "Outside", "In the rain"),
    ('What does "cry over spilled milk" mean?', "Worry about something past and unchangeable", "Don’t fuss over what cannot be undone.", "Clean the floor", "Buy more milk", "Cook carefully"),
    ('What does "hit the books" mean?', "To study hard", "Serious studying before exams.", "Throw books", "Buy textbooks", "Close the library"),
    ('What does "let the cat out of the bag" mean?', "To reveal a secret accidentally", "Spoil a surprise by telling.", "Buy a pet", "Pack luggage", "Open a window"),
    # Block 6: Error spotting
    ('Spot the error: "He go to school every day."', 'Use "goes" instead of "go"', "He takes singular verb goes.", 'Use "going"', 'Use "gone"', "No error"),
    ('Spot the error: "She has two brother."', 'Use "brothers"', "Plural after two.", 'Use "brotheres"', "Remove two", "No error"),
    ('Spot the error: "I am read a book."', 'Use "reading"', "Present continuous: am + -ing.", 'Use "reads"', 'Use "readed"', "No error"),
    ('Spot the error: "The children is playing outside."', 'Use "are" instead of "is"', "Children is plural.", 'Use "was"', 'Use "be"', "No error"),
    ('Spot the error: "Me and John are friends."', 'Say "John and I"', "Subject pronoun I; name first is polite.", 'Say "Me is"', "No error", 'Say "John and me" always'),
    ('Spot the error: "He don\'t like apples."', 'Use "doesn\'t"', "He requires does not (doesn't).", 'Use "don\'t still"', "No error", 'Use "not"'),
    ('Spot the error: "She sings very good."', 'Use "well"', "Adverb well modifies sings; good is adjective.", 'Use "gooder"', "No error", 'Use "best"'),
    ('Spot the error: "I bought a apple."', 'Use "an"', "Vowel sound before apple.", 'Use "the"', "No error", 'Use "some"'),
    ('Spot the error: "They was happy."', 'Use "were"', "Plural they needs were.", 'Use "is"', "No error", 'Use "be"'),
    ('Spot the error: "Where is my shoes?"', 'Use "are"', "Shoes is plural.", 'Use "was"', "No error", 'Use "is" with pair'),
    # Block 7: One-word substitution
    ("A child whose parents have died is called a(n)...", "Orphan", "Standard term.", "Widow", "Bachelor", "Infant"),
    ("A person who eats no meat is a...", "Vegetarian", "Plant-based diet (often with dairy/eggs).", "Carnivore", "Chef", "Farmer"),
    ("Something that happens once every year is...", "Annual", "Yearly event.", "Monthly", "Hourly", "Daily"),
    ("A period of ten years is a...", "Decade", "Ten-year span.", "Century", "Year", "Fortnight"),
    ("A period of one hundred years is a...", "Century", "100-year span.", "Decade", "Millennium", "Era"),
    ("A person who expects good outcomes is a(n)...", "Optimist", "Positive outlook.", "Pessimist", "Realist", "Critic"),
    ("A person who expects bad outcomes is a(n)...", "Pessimist", "Opposite of optimist.", "Optimist", "Hero", "Judge"),
    ("A book of word meanings is a...", "Dictionary", "Alphabetical reference.", "Atlas", "Novel", "Diary"),
    ("A person who treats sick animals is a...", "Veterinarian", "Animal doctor.", "Surgeon", "Dentist", "Pilot"),
    ("Safe to eat is...", "Edible", "Fit for consumption.", "Toxic", "Stale", "Raw"),
    # Block 8: Spelling
    ("Which spelling is correct for the rules of language?", "Grammar", "Grammar ends in -ar.", "Grammer", "Gramer", "Grammerr"),
    ("Which spelling is correct for the next day?", "Tomorrow", "One m, two r’s.", "Tomorow", "Tommorrow", "Tommorow"),
    ("Which spelling is correct for “have faith”?", "Believe", "i before e here.", "Beleive", "Belive", "Beleeve"),
    ("Which spelling is correct for “get a letter”?", "Receive", "e before i after c.", "Recieve", "Receeve", "Receiv"),
    ("Which spelling is correct for “apart”?", "Separate", "Par in the middle.", "Seperate", "Sepparate", "Seperete"),
    ("Which spelling is correct for “clear and sure”?", "Definite", "Contains finite.", "Definate", "Definit", "Defenite"),
    ("Which spelling is correct for a close companion?", "Friend", "Ends with end.", "Freind", "Frend", "Frind"),
    ("Which spelling is correct for “in truth”?", "Truly", "Drop e from true.", "Turely", "Truely", "Trulyy"),
    ("Which spelling is correct for “up to the time”?", "Until", "One l.", "Untill", "Untilll", "Untl"),
    ("Which spelling is correct for “strange”?", "Weird", "Exception spelling ei.", "Wierd", "Weired", "Werd"),
    # Block 9: Analogies
    ("Cat is to Kitten as Dog is to...", "Puppy", "Young of the species.", "Cub", "Calf", "Chick"),
    ("Day is to Night as Hot is to...", "Cold", "Opposite pairs.", "Warm", "Wet", "Big"),
    ("Bird is to Fly as Fish is to...", "Swim", "Typical movement.", "Walk", "Run", "Jump"),
    ("Pen is to Write as Knife is to...", "Cut", "Tool and main use.", "Eat", "Draw", "Cook"),
    ("Doctor is to Hospital as Teacher is to...", "School", "Job and workplace.", "Office", "Court", "Studio"),
    ("Eye is to See as Ear is to...", "Hear", "Sense organ and sense.", "Smell", "Taste", "Touch"),
    ("Apple is to Fruit as Carrot is to...", "Vegetable", "Food type category.", "Meat", "Grain", "Spice"),
    ("Car is to Road as Train is to...", "Track", "Vehicle and surface it uses.", "Sky", "Water", "Tunnel"),
    ("Book is to Read as Song is to...", "Listen", "Object and typical experience (also sing).", "Write", "Paint", "Drive"),
    ("Ice is to Cold as Fire is to...", "Hot", "Thing and temperature quality.", "Wet", "Hard", "Dark"),
    # Block 10: Plurals
    ("Plural of CHILD?", "Children", "Irregular plural.", "Childs", "Childrens", "Childes"),
    ("Plural of MOUSE (animal)?", "Mice", "Irregular vowel change.", "Mouses", "Meeces", "Mice's"),
    ("Plural of TOOTH?", "Teeth", "Vowel change oo → ee.", "Tooths", "Teethes", "Toothes"),
    ("Plural of WOMAN?", "Women", "Spelling and vowel change.", "Womans", "Womens", "Woman"),
    ("Plural of FOOT?", "Feet", "Same pattern as tooth/teeth.", "Foots", "Feets", "Feet's"),
    ("Plural of SHEEP?", "Sheep", "Same form singular and plural.", "Sheeps", "Sheepes", "Sheep's"),
    ("Plural of LEAF?", "Leaves", "f → ves pattern.", "Leafs", "Leafes", "Leavs"),
    ("Plural of KNIFE?", "Knives", "fe → ves pattern.", "Knifes", "Knifes'", "Knive"),
    ("Plural of GOOSE?", "Geese", "Vowel pattern like foot/feet.", "Gooses", "Goose's", "Geeses"),
    ("Plural of PERSON (general)?", "People", "Standard plural; persons is formal/legal.", "Persons", "Peoples", "Persones"),
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
        f"-- CBSE PUC foundational verbal (100), funbrain / verbal. Pack: {PACK}.",
        "-- Idempotent: delete this pack in verbal, then insert.",
        "",
        "BEGIN;",
        "",
        "DELETE FROM public.play_questions",
        "WHERE domain = 'funbrain'",
        "  AND category = 'verbal'",
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
            "  ('funbrain', 'verbal', "
            f"'{sql_escape(content_json)}'::jsonb, "
            f"'{sql_escape(options_json)}'::jsonb, "
            f"{ci}, "
            f"'{expl_sql}')"
        )
    lines.append(",\n".join(value_rows) + ";")
    lines.extend(["", "COMMIT;", ""])
    out = Path(__file__).resolve().parent.parent / "supabase" / "migrations" / "20260430336000_play_funbrain_verbal_puc100_foundational.sql"
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out} ({len(ROWS)} rows)")


if __name__ == "__main__":
    main()
