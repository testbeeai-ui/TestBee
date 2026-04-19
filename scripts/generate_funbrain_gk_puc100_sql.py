#!/usr/bin/env python3
"""Generate Supabase migration: 100 funbrain/gk PUC questions. Idempotent: DELETE pack then INSERT."""
from __future__ import annotations

import json
import random
from pathlib import Path

# (stem, correct, explanation, wrong1, wrong2, wrong3)
ROWS: list[tuple[str, str, str, str, str, str]] = [
    ("Who was the first Governor-General of independent India?", "Lord Mountbatten", "Mountbatten served until June 1948; India became a republic in 1950.", "C. Rajagopalachari", "Lord Wavell", "Warren Hastings"),
    ("Who was the first Indian Governor-General of independent India?", "C. Rajagopalachari", "He succeeded Mountbatten in 1948.", "Lord Mountbatten", "Jawaharlal Nehru", "Dr. Rajendra Prasad"),
    ("In which year did the Jallianwala Bagh massacre take place?", "1919", "General Dyer ordered firing on 13 April 1919.", "1920", "1918", "1942"),
    ("Who founded the Indian National Congress in 1885?", "Allan Octavian Hume (A.O. Hume)", "Retired ICS officer; first session Bombay.", "Dadabhai Naoroji", "Womesh Chunder Bonnerjee", "Bal Gangadhar Tilak"),
    ("What was the real name of Swami Vivekananda?", "Narendranath Datta", "Disciple of Ramakrishna Paramahamsa.", "Dayananda Saraswati", "Ramakrishna Paramahamsa", "Mulk Raj Anand"),
    ("Who is known as the 'Iron Man of India'?", "Sardar Vallabhbhai Patel", "Unified princely states into the Indian Union.", "Subhas Chandra Bose", "Bhagat Singh", "Jawaharlal Nehru"),
    ('During which movement did Mahatma Gandhi give the slogan "Do or Die"?', "Quit India Movement (1942)", "August Kranti; launched 8 August 1942.", "Non-Cooperation Movement", "Civil Disobedience Movement", "Champaran Satyagraha"),
    ("Who wrote the Indian National Anthem?", "Rabindranath Tagore", "Jana Gana Mana; originally in Bengali.", "Bankim Chandra Chatterjee", "Muhammad Iqbal", "Sarojini Naidu"),
    ("The Battle of Plassey was fought in which year?", "1757", "British East India Company under Clive vs Siraj ud-Daulah.", "1764", "1857", "1784"),
    ("Who was the first woman President of the Indian National Congress?", "Annie Besant", "Presided over 1917 Calcutta session.", "Sarojini Naidu", "Kamala Nehru", "Vijaya Lakshmi Pandit"),
    ("Who gave the title 'Mahatma' to Mohandas Karamchand Gandhi?", "Rabindranath Tagore", "Literary honorific meaning 'great soul'.", "Jawaharlal Nehru", "C. F. Andrews", "Subhas Chandra Bose"),
    ("Who was the political guru of Mahatma Gandhi?", "Gopal Krishna Gokhale", "Moderate leader; Gandhi called him his mentor.", "Bal Gangadhar Tilak", "Dadabhai Naoroji", "Lala Lajpat Rai"),
    ("Which Mughal Emperor built the Taj Mahal?", "Shah Jahan", "In memory of Mumtaz Mahal.", "Akbar", "Aurangzeb", "Jahangir"),
    ("Who was the founder of the Maurya Empire?", "Chandragupta Maurya", "With guidance of Chanakya (Kautilya).", "Ashoka", "Bindusara", "Samudragupta"),
    ("In which year did Vasco da Gama discover the sea route to India?", "1498", "Landed at Calicut (Kozhikode).", "1492", "1526", "1510"),
    ("Who is known as the 'Frontier Gandhi'?", "Khan Abdul Ghaffar Khan", "Pashtun leader; Khudai Khidmatgar.", "Mahatma Gandhi", "Khan Abdul Jabbar Khan", "Lala Lajpat Rai"),
    ("The Indus Valley Civilization was most famous for what feature?", "Town planning / Urban planning", "Grid streets, drainage, baked bricks at Harappa and Mohenjo-daro.", "Iron smelting", "Pyramid construction", "Horse domestication only"),
    ("Who was the last Mughal Emperor of India?", "Bahadur Shah Zafar", "1857 revolt leader; exiled to Rangoon.", "Aurangzeb", "Shah Alam II", "Akbar II"),
    ("Which movement was abruptly suspended by Gandhi due to the Chauri Chaura incident?", "Non-Cooperation Movement", "Violence at Gorakhpur district, Feb 1922.", "Quit India Movement", "Civil Disobedience Movement", "Khilafat Movement"),
    ('Who is the author of the national song "Vande Mataram"?', "Bankim Chandra Chatterjee", "From novel Anandamath (1882).", "Rabindranath Tagore", "Subramania Bharati", "Hasrat Mohani"),
    ("Which is the highest mountain peak situated entirely within India?", "Kangchenjunga", "On India–Nepal border; highest fully in India is often cited as Kangchenjunga (maintenance of territory).", "Nanda Devi", "Mount Abu", "Saser Kangri"),
    ('Which river is infamously known as the "Sorrow of Bihar"?', "Kosi River", "Frequent flooding and course shifts.", "Gandak River", "Son River", "Damodar River"),
    ("What is the standard meridian longitude of India?", "82.5° East", "IST is based on this meridian near Mirzapur.", "77.5° East", "88.5° East", "0° (Greenwich)"),
    ("Which is the largest state in India by geographical area?", "Rajasthan", "Desert and arid regions dominate.", "Madhya Pradesh", "Maharashtra", "Uttar Pradesh"),
    ("Which Indian state has the longest coastline?", "Gujarat", "Includes Gulf of Kutch and marshy coast.", "Maharashtra", "Tamil Nadu", "Andhra Pradesh"),
    ("Which imaginary line passes almost halfway through India?", "Tropic of Cancer", "23.5°N; passes through eight states.", "Equator", "Tropic of Capricorn", "Arctic Circle"),
    ("What is the capital of the Union Territory of Lakshadweep?", "Kavaratti", "Island group off Kerala coast.", "Port Blair", "Daman", "Puducherry"),
    ("Which is the longest river in the world?", "The Nile", "Conventionally measured; Amazon sometimes debated by source.", "Amazon River", "Mississippi River", "Yangtze River"),
    ("The Sahara Desert is located on which continent?", "Africa", "World's largest hot desert.", "Asia", "Australia", "South America"),
    ("Which planet in our solar system is known as the Red Planet?", "Mars", "Iron oxide on surface.", "Venus", "Jupiter", "Mercury"),
    ("Which is the largest and deepest ocean on Earth?", "Pacific Ocean", "Covers about one-third of Earth's surface.", "Atlantic Ocean", "Indian Ocean", "Arctic Ocean"),
    ("Mount Everest is located in which mountain range?", "The Himalayas", "On Nepal–China border.", "The Andes", "The Alps", "The Rockies"),
    ("Which Indian state is translated as the 'Land of Five Rivers'?", "Punjab", "Panj-aab: five waters.", "Sindh", "Haryana", "Uttar Pradesh"),
    ("What is the capital city of Australia?", "Canberra", "Planned capital; not Sydney or Melbourne.", "Sydney", "Melbourne", "Perth"),
    ("Which country is known globally as the 'Land of the Rising Sun'?", "Japan", "Japanese name Nihon relates to sun origin.", "China", "South Korea", "Thailand"),
    ("The Great Barrier Reef is located off the coast of which country?", "Australia", "Queensland coastline.", "Indonesia", "Philippines", "New Zealand"),
    ("Which state in India is the largest producer of tea?", "Assam", "Brahmaputra valley estates.", "West Bengal", "Kerala", "Tamil Nadu"),
    ("What is the official currency of Japan?", "Japanese Yen", "ISO code JPY.", "Chinese Yuan", "South Korean Won", "US Dollar"),
    ("Which is the smallest continent in the world by land area?", "Australia", "Oceania region; Australia as continent.", "Europe", "Antarctica", "South America"),
    ("Majuli, recognized as the world's largest river island, is located on which river?", "Brahmaputra", "In Assam.", "Ganga", "Godavari", "Mahanadi"),
    ("Who is widely recognized as the Chief Architect of the Indian Constitution?", "Dr. B.R. Ambedkar", "Chairman of the Drafting Committee.", "Jawaharlal Nehru", "Sardar Patel", "Dr. Rajendra Prasad"),
    ("The Constitution of India was officially adopted by the Constituent Assembly on which date?", "November 26, 1949", "Constitution Day; came into force 26 Jan 1950.", "January 26, 1950", "August 15, 1947", "December 9, 1946"),
    ("Who is the Supreme Commander of the Indian Armed Forces?", "The President of India", "Article 53; executive power vested in President.", "The Prime Minister of India", "The Defence Minister", "The Chief of Defence Staff"),
    ("What is the minimum age required to be eligible for the office of the President of India?", "35 years", "Article 58.", "30 years", "40 years", "25 years"),
    ("How many Fundamental Rights are currently guaranteed by the Indian Constitution?", "Six", "Originally seven; Right to property removed from Part III.", "Five", "Seven", "Nine"),
    ("Which Article of the Indian Constitution officially abolishes Untouchability?", "Article 17", "Abolition of untouchability.", "Article 14", "Article 15", "Article 32"),
    ("Who appoints the Chief Justice of India?", "The President of India", "On advice of Union Council of Ministers.", "The Prime Minister of India", "The Parliament", "The Collegium alone"),
    ("What is the maximum constitutionally allowed strength of the Lok Sabha?", "552", "530 states + 20 Union Territories + 2 Anglo-Indian (latter provision later amended).", "545", "500", "600"),
    ("The concept of 'Fundamental Duties' was borrowed from the constitution of which nation?", "USSR (Russia)", "Added by 42nd Amendment 1976.", "United States", "United Kingdom", "Ireland"),
    ("Who acts as the ex-officio Chairman of the Rajya Sabha?", "The Vice President of India", "Article 89.", "The President of India", "The Lok Sabha Speaker", "The Prime Minister of India"),
    ("Who administers the oath of office to the President of India?", "The Chief Justice of India", "Or senior-most SC judge if CJI unavailable.", "The Vice President of India", "The Prime Minister of India", "The Lok Sabha Speaker"),
    ("How many Schedules are there in the Indian Constitution?", "12", "Originally 8; grew with amendments.", "8", "10", "14"),
    ("Which Constitutional Amendment lowered the voting age in India from 21 to 18 years?", "61st Amendment Act (1988)", "Took effect 28 March 1989.", "42nd Amendment", "44th Amendment", "73rd Amendment"),
    ("Who serves as the ex-officio Chairperson of the NITI Aayog?", "The Prime Minister of India", "Replaced Planning Commission (2015).", "The President of India", "The Finance Minister", "The Home Minister"),
    ("What is the standard tenure of a member of the Rajya Sabha?", "6 years", "One-third retire every two years.", "5 years", "4 years", "7 years"),
    ("Which was the first state in India to be formed strictly on a linguistic basis?", "Andhra Pradesh", "1953 from Madras State; later bifurcated.", "Bombay State", "Tamil Nadu", "Gujarat"),
    ("Who was the first Chief Election Commissioner of independent India?", "Sukumar Sen", "1950–1958.", "T. N. Seshan", "M. S. Gill", "James Michael Lyngdoh"),
    ("The Right to Information (RTI) Act came into full force in which year?", "2005", "Effective 12 October 2005.", "2002", "2010", "1995"),
    ("The Panchayati Raj system in India operates on how many tiers?", "Three tiers", "Gram panchayat, block, district (varies by state).", "Two tiers", "Four tiers", "Five tiers"),
    ("Who was the first and only female Prime Minister of India?", "Indira Gandhi", "PM 1966–1977 and 1980–1984.", "Sarojini Naidu", "Pratibha Patil", "Sonia Gandhi"),
    ("What is the chemical symbol for the element Gold?", "Au", "From Latin aurum.", "Ag", "Go", "Fe"),
    ("Which gas is the most abundant in the Earth's atmosphere?", "Nitrogen (approx. 78%)", "About 78% N₂, 21% O₂.", "Oxygen", "Carbon dioxide", "Argon"),
    ("What is the standard SI unit of Force?", "Newton", "N = kg·m/s².", "Joule", "Pascal", "Watt"),
    ("Which vitamin is naturally synthesized by the human body when exposed to sunlight?", "Vitamin D", "D₃ from UVB on skin.", "Vitamin C", "Vitamin B12", "Vitamin A"),
    ("What is the hardest naturally occurring substance known on Earth?", "Diamond", "Carbon allotrope, Mohs 10.", "Quartz", "Corundum", "Granite"),
    ("Who discovered the first antibiotic, Penicillin?", "Alexander Fleming", "1928 observation at St Mary's.", "Louis Pasteur", "Robert Koch", "Edward Jenner"),
    ('Which organelle is universally known as the "powerhouse of the cell"?', "Mitochondria", "ATP production via respiration.", "Nucleus", "Ribosome", "Chloroplast"),
    ("Which acid is naturally present in lemons and other citrus fruits?", "Citric Acid", "Weak organic acid.", "Ascorbic acid only", "Acetic acid", "Sulfuric acid"),
    ("What is the approximate speed of light in a vacuum?", "3 × 10⁸ meters per second (300,000 km/s)", "Exact value ~299,792,458 m/s.", "3 × 10⁶ m/s", "340 m/s", "1.5 × 10⁸ m/s"),
    ("What is the common chemical name for baking soda?", "Sodium Bicarbonate", "NaHCO₃.", "Sodium chloride", "Sodium carbonate", "Calcium carbonate"),
    ("Which organ in the human biological system is primarily responsible for filtering and purifying blood?", "Kidneys", "Nephrons filter waste.", "Liver", "Heart", "Lungs"),
    ("What is the closest star to the Earth?", "The Sun", "G-type main-sequence star.", "Proxima Centauri", "Polaris", "Sirius"),
    ("Who formulated the Theory of Relativity (E=mc²)?", "Albert Einstein", "1905 special; 1915 general.", "Isaac Newton", "Stephen Hawking", "Max Planck"),
    ("What is the largest organ in the human body?", "The Skin", "Epidermis and dermis.", "Liver", "Large intestine", "Brain"),
    ("What scientific instrument is utilized to measure atmospheric pressure?", "Barometer", "Mercury or aneroid types.", "Thermometer", "Hygrometer", "Anemometer"),
    ("Which greenhouse gas is the primary contributor to global warming?", "Carbon Dioxide (CO₂)", "Long-lived in atmosphere; fossil emissions.", "Methane only", "Ozone only", "Neon"),
    ("What is the average lifespan of a human Red Blood Cell (RBC)?", "120 days", "Destroyed in spleen/liver.", "90 days", "180 days", "7 days"),
    ("Who is credited with inventing the telephone?", "Alexander Graham Bell", "1876 patent dispute with Gray.", "Thomas Edison", "Nikola Tesla", "Guglielmo Marconi"),
    ("What does the acronym ISRO stand for?", "Indian Space Research Organisation", "Space agency headquartered in Bengaluru.", "International Space Research Organisation", "Indian Satellite Research Office", "Indian Scientific Research Organisation"),
    ("What is the primary combustible component of biogas?", "Methane", "CH₄ from anaerobic digestion.", "Ethane", "Carbon monoxide", "Hydrogen only"),
    ("Who was the first human to step onto the surface of the Moon?", "Neil Armstrong", "20 July 1969, Apollo 11.", "Buzz Aldrin", "Yuri Gagarin", "Michael Collins"),
    ("What is the highest civilian award given by the Republic of India?", "Bharat Ratna", "Instituted 1954.", "Padma Vibhushan", "Param Vir Chakra", "Ashoka Chakra"),
    ('Who is the author of the famous autobiography "Wings of Fire"?', "Dr. A.P.J. Abdul Kalam", "With Arun Tiwari.", "N. R. Narayana Murthy", "Vikram Sarabhai", "Homi Bhabha"),
    ("In which year were the Nobel Prizes first awarded?", "1901", "Alfred Nobel's will executed.", "1895", "1905", "1911"),
    ("Who was the first Indian (and Asian) to win a Nobel Prize?", "Rabindranath Tagore (Literature, 1913)", "Gitanjali.", "C. V. Raman", "Mother Teresa", "Amartya Sen"),
    ("In which city are the headquarters of the United Nations located?", "New York City", "Manhattan; not Geneva UN offices.", "Geneva", "Washington D.C.", "The Hague"),
    ("Which Indian city is globally referred to as the 'Silicon Valley of India'?", "Bengaluru (Bangalore)", "IT and startup hub.", "Hyderabad", "Pune", "Chennai"),
    ("The Summer Olympic Games are traditionally held every how many years?", "Every four years", "Winter Olympics also on 4-year cycle (offset).", "Every two years", "Every five years", "Every three years"),
    ('Who wrote the classic tragedy play "Romeo and Juliet"?', "William Shakespeare", "Late 16th century.", "Christopher Marlowe", "Charles Dickens", "George Bernard Shaw"),
    ("Which is the largest known animal to have ever lived on Earth?", "The Blue Whale", "Balaenoptera musculus.", "Argentinosaurus", "African elephant", "Great white shark"),
    ("What is the National Tree of India?", "The Banyan Tree", "Ficus benghalensis.", "The Peepal Tree", "The Mango Tree", "The Neem Tree"),
    ("In the context of the internet, what does 'WWW' stand for?", "World Wide Web", "Tim Berners-Lee, CERN.", "World Wide Wireless", "Web Wide World", "Wireless Web Workgroup"),
    ("Which date is globally observed as World Environment Day?", "June 5th", "UN since 1974.", "April 22nd", "March 8th", "December 1st"),
    ("Who painted the famous portrait known as the Mona Lisa?", "Leonardo da Vinci", "Louvre, Paris.", "Michelangelo", "Raphael", "Vincent van Gogh"),
    ("Which specific category of the Nobel Prize is awarded in Oslo, Norway, rather than in Sweden?", "The Nobel Peace Prize", "Per Nobel's will.", "The Nobel Literature Prize", "The Nobel Economics Prize", "The Nobel Chemistry Prize"),
    ("Who was the first woman to travel into space?", "Valentina Tereshkova", "Soviet Vostok 6, 1963.", "Sally Ride", "Kalpana Chawla", "Svetlana Savitskaya"),
    ("Which country is the largest in the world by total landmass?", "Russia", "Spans Eastern Europe and Northern Asia.", "Canada", "China", "United States"),
    ('Who is the author of the internationally acclaimed "Harry Potter" book series?', "J.K. Rowling", "Seven main books.", "J. R. R. Tolkien", "C. S. Lewis", "Rick Riordan"),
    ("What is the official national language of Brazil?", "Portuguese", "Colonial heritage.", "Spanish", "English", "French"),
    ("Which bird is universally recognized as a symbol of peace?", "The Dove", "Often with olive branch.", "The Eagle", "The Owl", "The Swallow"),
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
        "-- CBSE PUC basic General Knowledge (100 items), funbrain / gk.",
        "-- Idempotent: remove prior rows with this pack, then insert.",
        "",
        "BEGIN;",
        "",
        "DELETE FROM public.play_questions",
        "WHERE domain = 'funbrain'",
        "  AND category = 'gk'",
        "  AND (content->>'pack') = 'cbse_gk_puc100_basic';",
        "",
        "INSERT INTO public.play_questions (domain, category, content, options, correct_answer_index, explanation)",
        "VALUES",
    ]
    value_rows: list[str] = []
    for stem, correct, expl, w1, w2, w3 in ROWS:
        opts, ci = build_options(correct, w1, w2, w3)
        content_json = json.dumps({"text": stem, "pack": "cbse_gk_puc100_basic"}, ensure_ascii=False)
        options_json = json.dumps(opts, ensure_ascii=False)
        expl_sql = sql_escape(expl)
        value_rows.append(
            "  ('funbrain', 'gk', "
            f"'{sql_escape(content_json)}'::jsonb, "
            f"'{sql_escape(options_json)}'::jsonb, "
            f"{ci}, "
            f"'{expl_sql}')"
        )
    lines.append(",\n".join(value_rows) + ";")
    lines.extend(["", "COMMIT;", ""])
    out = Path(__file__).resolve().parent.parent / "supabase" / "migrations" / "20260430332000_play_funbrain_gk_puc100_basic.sql"
    out.write_text("\n".join(lines), encoding="utf-8")
    print(f"Wrote {out} ({len(ROWS)} rows)")


if __name__ == "__main__":
    main()
